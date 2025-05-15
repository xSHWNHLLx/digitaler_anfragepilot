const claudeModule = require('../routes/claude');
const unwrapResponse = claudeModule.unwrapResponse;
const formatExtractedData = claudeModule.formatExtractedData;
const emailService = require('./emailService');
const Anthropic = require('@anthropic-ai/sdk');

// Initialisiere den Anthropic-Client mit API-Schlüssel
const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
});

// Importiere notwendige Module und Funktionen
const MAX_TRACKER_SIZE = 1000; // Maximale Größe des Trackers
const SENT_EMAIL_TRACKER = new Set(); // Set zum Tracking bereits gesendeter E-Mails
const ACTIVE_EXTRACTIONS = new Set(); // Set für aktive Extraktionen

// Cleanup-Funktion für den E-Mail-Tracker
function cleanupEmailTracker() {
  if (SENT_EMAIL_TRACKER.size > MAX_TRACKER_SIZE) {
    console.log(`🧹 Bereinige E-Mail-Tracker (aktuelle Größe: ${SENT_EMAIL_TRACKER.size})`);
    // Löscht 20% der ältesten Einträge (einfache Implementierung)
    const deleteCount = Math.floor(MAX_TRACKER_SIZE * 0.2);
    let count = 0;
    for (const item of SENT_EMAIL_TRACKER) {
      SENT_EMAIL_TRACKER.delete(item);
      count++;
      if (count >= deleteCount) break;
    }
    console.log(`✅ ${deleteCount} Einträge aus E-Mail-Tracker gelöscht (neue Größe: ${SENT_EMAIL_TRACKER.size})`);
  }
}

// Hilfsfunktion für das Generieren einer Konversations-ID
function generateConversationId(messages) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return null;
  }
  
  // Verwende nur die ersten 3 Nachrichten für eine stabileere ID
  const stableMessages = messages.slice(0, Math.min(3, messages.length));
  const conversationStr = stableMessages
    .map(m => `${m.role}:${typeof m.content === 'string' ? m.content.substring(0, 100) : ''}`)
    .join('|');
  
  // Einfacher Hash für die Konversation
  let hash = 0;
  for (let i = 0; i < conversationStr.length; i++) {
    const char = conversationStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Konvertiere zu 32-Bit-Integer
  }
  
  // Konvertiere zu String und entferne Minuszeichen
  return Math.abs(hash).toString(16);
}

// Hilfsfunktion zur Validierung von E-Mail-Adressen
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  // Einfache Validierung
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

// Hilfsfunktion zum Säubern von Benutzereingaben
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .trim();
}

// Hilfsfunktion zur Formatierung des Chat-Verlaufs für E-Mails
function formatChatHistoryForEmail(messages) {
  if (!messages || !Array.isArray(messages)) return '';
  
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\n/g, "<br>");
  }
  
  return messages
    .map(msg => {
      const role = msg.role === 'user' ? 'Nutzer' : 'Assistent';
      const content = escapeHtml(msg.content || '');
      return `<div style="margin-bottom:10px;"><strong>${role}:</strong> ${content}</div>`;
    })
    .join('\n');
}

// Hilfsfunktion für die Hintergrundverarbeitung von Anfragen
async function extractAndProcessInBackground(internalMessages, hasContactInfo, summaryText) {
  // Generiere eine Konversations-ID außerhalb des try-Blocks, um sie im catch-Block verwenden zu können
  let conversationId;
  try {
    // Generiere eine Konversations-ID, um mehrfache E-Mail-Sendungen zu vermeiden
    conversationId = generateConversationId(internalMessages);
    
    // Früher Abbruch: Überprüfe, ob für diese Konversation bereits eine E-Mail gesendet wurde
    if (conversationId && SENT_EMAIL_TRACKER.has(conversationId)) {
      console.log('🚫 E-Mail für diese Konversation wurde bereits gesendet (ID: ' + 
        conversationId.substring(0, 8) + '...), überspringe Verarbeitung');
      return { success: false, reason: 'already_sent' };
    }

    // Überprüfe, ob diese Konversation bereits aktiv extrahiert wird
    if (conversationId && ACTIVE_EXTRACTIONS.has(conversationId)) {
      console.log('⏳ Parallele Extraktion für dieselbe Konversation erkannt (ID: ' + 
        conversationId.substring(0, 8) + '...), überspringe Verarbeitung');
      return { success: false, reason: 'already_processing' };
    }

    // Markieren, dass diese Konversation in Bearbeitung ist
    if (conversationId) {
      ACTIVE_EXTRACTIONS.add(conversationId);
      console.log('🔍 Neue Konversation erkannt (ID: ' + 
        conversationId.substring(0, 8) + '...), Extraktion wird fortgesetzt');
    }
    
    // Intern: JSON-Extraktion basierend auf internem Gesprächsverlauf
    const extractSystemPrompt =
      `Du bist ein JSON-Extraktor für Veranstaltungsanfragen der OsnabrückHalle. ` +
      `Nutze die bisherigen Nutzer- und Bot-Nachrichten und liefere ausschließlich ein gültiges JSON-Objekt mit den folgenden Schlüsseln: ` +
      `eventTitle, eventType, dateFrom, dateTo, altDates, startTime, endTime, description, budget, expectedAttendees, ` +
      `additionalRequirements, catering, seating, organizationCompany, organizerFirstName, organizerLastName, organizerStreet, ` +
      `organizerZip, organizerCity, organizerPhone, organizerEmail, missing. ` +
      `WICHTIG: 
      - Bei eventTitle auch Themenangaben berücksichtigen, wenn "Thema ist X" oder ähnliches vorkommt. Verwende niemals "Nicht angegeben" als Wert.
      - Bei eventType setze "Tagung", "Kongress", "Messe", "Konzert", etc. basierend auf dem Gespräch. Verwende niemals "Nicht angegeben" als Wert.
      - Auch budget und expectedAttendees sind wichtige Felder, die du soweit wie möglich extrahieren solltest.
      - Nutze organizerEmail für jede erwähnte E-Mail-Adresse. 
      - Setze Werte basierend auf dem gesamten Gesprächsverlauf, nicht nur der letzten Nachricht.
      - missing muss IMMER ein Array sein, selbst wenn es leer ist.
      - Falls ein Wert nicht im Gespräch vorkommt, lasse das Feld komplett weg oder setze es auf null, aber NIEMALS auf "Nicht angegeben".
      - Sei besonders sorgfältig mit der E-Mail-Adresse, dem Veranstaltungstitel und dem Veranstaltungstyp.
      - Setze keine leeren Werte oder Platzhalter - lass das Feld lieber ganz weg.
      Gib KEINERLEI andere Texte aus.`;
      
    console.log('🛠️ Bereite JSON-Extraktion im Hintergrund vor...');
    
    // Sichere Version: Stelle sicher, dass keine Prompts manipuliert werden
    const sanitizedMessages = internalMessages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : String(msg.content)
    }));
    
    const extractResponse = await client.messages.create({
      model: 'claude-3-opus-latest',
      max_tokens: 700,
      temperature: 0,
      system: extractSystemPrompt,
      messages: [{ role: 'user', content: 
        sanitizedMessages.map(m => 
          (m.role === 'user' ? 'Human: ' : 'Assistant: ') + m.content
        ).join('\n')
      }]
    });
    
    console.log('⚙️ Extraktion abgeschlossen, Verarbeitung beginnt...');
    const extractText = unwrapResponse(extractResponse).trim();
    
    // Verbesserte JSON-Validierung - Suche explizit nach JSON-Bereichen
    let jsonStartPos = extractText.indexOf('{');
    let jsonEndPos = extractText.lastIndexOf('}');
    
    if (jsonStartPos === -1 || jsonEndPos === -1 || jsonEndPos <= jsonStartPos) {
      console.warn('⚠️ Kein gültiges JSON im Extraktionstext gefunden');
      return { success: false, reason: 'invalid_json' };
    }
    
    const jsonText = extractText.substring(jsonStartPos, jsonEndPos + 1);
    
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
      
      // Handle flexible date ranges if no concrete dateFrom provided
      if (!parsed.dateFrom) {
        // Look for flexible date expressions in user messages
        const userTexts = internalMessages
          .filter(m => m.role === 'user')
          .map(m => m.content)
          .join(' ');
          
        // Verschiedene Datumsmuster erkennen
        const datePatterns = [
          /Ende\s+(\w+)\s+(\d{4})/i,                    // Ende Januar 2029
          /Anfang\s+(\w+)\s+(\d{4})/i,                  // Anfang März 2029
          /Mitte\s+(\w+)\s+(\d{4})/i,                   // Mitte April 2029
          /(\w+)\s+(\d{4})/i,                           // Januar 2029
          /im\s+(\w+)\s+(\d{4})/i,                      // im Februar 2029
          /zwischen\s+(.+?)\s+und\s+(.+?)(?=\s|$|\.)/i  // zwischen Montag und Mittwoch
        ];
        
        // Stelle sicher, dass altDates immer ein Array ist, BEVOR wir es benutzen
        parsed.altDates = Array.isArray(parsed.altDates) ? parsed.altDates : [];
        
        for (const pattern of datePatterns) {
          const match = userTexts.match(pattern);
          if (match) {
            parsed.altDates.push(match[0]);
            break;
          }
        }
      }

      // Validiere wichtige Felder: E-Mail, Veranstaltungstitel und Veranstaltungstyp
      if (!parsed.organizerEmail || !isValidEmail(parsed.organizerEmail)) {
        console.warn('⚠️ Keine gültige E-Mail-Adresse gefunden');
        return { success: false, reason: 'missing_email' };
      }
      
      if (!parsed.eventTitle) {
        console.warn('⚠️ Kein Veranstaltungstitel gefunden');
        // Fallback: Generiere einen Titel basierend auf den verfügbaren Informationen
        if (parsed.eventType) {
          parsed.eventTitle = `${parsed.eventType} in der OsnabrückHalle`;
          console.log(`✅ Automatisch generierten Titel erstellt: "${parsed.eventTitle}"`);
        } else if (parsed.organizerFirstName || parsed.organizerLastName) {
          const name = `${parsed.organizerFirstName || ''} ${parsed.organizerLastName || ''}`.trim();
          parsed.eventTitle = `Veranstaltung von ${name} in der OsnabrückHalle`;
          console.log(`✅ Automatisch generierten Titel erstellt: "${parsed.eventTitle}"`);
        } else {
          // Letzte Fallback-Option mit Datum falls vorhanden
          const dateInfo = parsed.dateFrom || parsed.altDates?.[0] || '2025';
          parsed.eventTitle = `Veranstaltung in der OsnabrückHalle am ${dateInfo}`;
          console.log(`✅ Automatisch generierten Titel erstellt: "${parsed.eventTitle}"`);
        }
      }
      
      if (!parsed.eventType) {
        console.warn('⚠️ Kein Veranstaltungstyp gefunden');
        return { success: false, reason: 'missing_type' };
      }
      
      // Generiere einen E-Mail-Lock basierend auf den wichtigsten Daten, um Duplikate zu vermeiden
      const emailLock = `email_lock_${parsed.eventTitle}_${parsed.organizerEmail}`.replace(/\s+/g, '_');
      
      // Prüfe, ob bereits eine E-Mail-Sendung für diese Daten läuft
      if (global[emailLock]) {
        console.log('🔒 E-Mail-Versand ist bereits für diese Daten in Bearbeitung, überspringe');
        return { success: false, reason: 'email_lock' };
      }
      
      // Setze Lock für diesen E-Mail-Versand
      global[emailLock] = Date.now();
      
      // VERBESSERT: Detailliertes Logging für Debugging mit mehr Informationen
      console.log('📧 Extrahierte Daten für E-Mail: ', JSON.stringify({
        id: conversationId.substring(0, 8),
        title: parsed.eventTitle || '(kein Titel)',
        type: parsed.eventType || '(kein Typ)',
        attendees: parsed.expectedAttendees || '(keine Angabe)',
        date: parsed.dateFrom || '(kein Datum)',
        email: parsed.organizerEmail,
        name: `${parsed.organizerFirstName || ''} ${parsed.organizerLastName || ''}`.trim() || '(kein Name)'
      }, null, 2));
      
      // E-Mail-Eingabevalidierung
      if (!isValidEmail(parsed.organizerEmail)) {
        console.error('⚠️ Ungültige E-Mail-Adresse erkannt:', parsed.organizerEmail);
        return { success: false, reason: 'invalid_email' };
      }
      
      // Sanitiere Eingaben für E-Mail-Header und Inhalte
      const sanitizedName = sanitizeInput(`${parsed.organizerFirstName || ''} ${parsed.organizerLastName || ''}`.trim() || 'Veranstalter');
      
      // Verwende die Zusammenfassung aus dem Chat für die E-Mail
      // Aber extrahiere nur den strukturierten Zusammenfassungsteil
      let inquirySummary;
      
      if (summaryText) {
        console.log('🔍 Originaltext aus Chat-Zusammenfassung:');
        console.log(summaryText.substring(0, 500) + '...');
        
        // Extrahiere nur die ZUSAMMENFASSUNG DER VERANSTALTUNGSANFRAGE, falls vorhanden
        if (summaryText.includes('ZUSAMMENFASSUNG DER VERANSTALTUNGSANFRAGE')) {
          const summaryPart = summaryText.split('ZUSAMMENFASSUNG DER VERANSTALTUNGSANFRAGE')[1];
          if (summaryPart) {
            // Nehme nur den Teil bis zum nächsten Absatz nach der Zusammenfassung
            const endIndex = summaryPart.indexOf('\n\nVielen Dank');
            inquirySummary = 'ZUSAMMENFASSUNG DER VERANSTALTUNGSANFRAGE' + 
                (endIndex !== -1 ? summaryPart.substring(0, endIndex) : summaryPart);
            console.log('✅ Strukturierte Zusammenfassung gefunden und extrahiert');
          } else {
            inquirySummary = formatExtractedData(parsed);
            console.log('⚠️ Konnte Zusammenfassung nicht richtig extrahieren, verwende formatExtractedData');
          }
        } else {
          // Falls keine strukturierte Zusammenfassung vorhanden ist, extrahiere mit Regex
          const summaryRegex = /Zusammenfassung[^:]*:?\s*([\s\S]+?)(?=\n\nVielen Dank|\n\nIch habe|\n\nWir freuen|$)/i;
          const match = summaryText.match(summaryRegex);
          
          if (match && match[1]) {
            // Wenn eine Zusammenfassung gefunden wurde, verwende diese
            inquirySummary = match[1].trim();
            console.log('✅ Zusammenfassung mit Regex gefunden und extrahiert');
          } else {
            // Fallback zu formatExtractedData, wenn keine Zusammenfassung gefunden wurde
            inquirySummary = formatExtractedData(parsed);
            console.log('⚠️ Keine Zusammenfassung gefunden, verwende formatExtractedData');
          }
        }
      } else {
        // Fallback, wenn kein Summary-Text vorhanden ist
        inquirySummary = formatExtractedData(parsed);
        console.log('⚠️ Kein Summary-Text vorhanden, verwende formatExtractedData');
      }
      
      // Entferne Markdown-Formatierungen (z.B. **fett** wird zu "fett")
      inquirySummary = inquirySummary.replace(/\*\*(.*?)\*\*/g, '$1');
      
      // Log der finalen Zusammenfassung
      console.log('✉️ FINALE E-MAIL-ZUSAMMENFASSUNG:');
      console.log('-------------------------------');
      console.log(inquirySummary);
      console.log('-------------------------------');
      console.log(`Länge: ${inquirySummary.length} Zeichen`);
      
      // Bereite den formatierten Chat-Verlauf für die interne E-Mail vor
      const chatHistory = formatChatHistoryForEmail(internalMessages);
      
      // 1. E-Mail an OsnabrückHalle - mit Zusammenfassung UND ausklappbarem Chatverlauf
      const hallEmailResult = await emailService.sendInquiryEmail(
        inquirySummary,
        process.env.RECIPIENT_EMAIL || 'osnabrueckhalle@marketingosnabrueck.de',
        sanitizedName,
        {
          isInternalEmail: true,
          chatHistory: chatHistory
        }
      );
      
      if (!hallEmailResult.success) {
        console.error('❌ E-Mail an OsnabrückHalle fehlgeschlagen');
        return { success: false, reason: 'hall_email_failed', error: hallEmailResult.error };
      }
      
      console.log('✉️ E-Mail erfolgreich an OsnabrückHalle gesendet');
      
      // 2. E-Mail an Kunden - nur mit Zusammenfassung
      const customerEmailResult = await emailService.sendInquiryEmail(
        inquirySummary,
        parsed.organizerEmail,
        sanitizedName,
        {
          isInternalEmail: false
        }
      );
      
      if (!customerEmailResult.success) {
        console.error('❌ E-Mail an Kunden fehlgeschlagen');
        return { success: false, reason: 'customer_email_failed', error: customerEmailResult.error };
      }
      
      console.log('✉️ E-Mail erfolgreich an Kunden gesendet:', 
        parsed.organizerEmail.replace(/^(.{2})(.*)@(.{2})(.*)$/, '$1***@$3***'));
      
      // VERBESSERT: Entferne alle Locks und Markierungen für diese Konversation
      if (ACTIVE_EXTRACTIONS.has(conversationId)) {
        ACTIVE_EXTRACTIONS.delete(conversationId);
        console.log(`🔄 Aktive Extraktion für (ID: ${conversationId.substring(0, 8)}...) wurde abgeschlossen`);
      }
      
      // Entferne den globalen Lock für E-Mail-Versand
      if (global[emailLock]) {
        delete global[emailLock];
      }
      
      // Überprüfen, ob Bereinigung des Trackers erforderlich ist
      if (SENT_EMAIL_TRACKER.size > MAX_TRACKER_SIZE) {
        cleanupEmailTracker();
      }
      
      // Füge Konversations-ID erneut hinzu, um sicherzustellen, dass sie nicht verloren geht
      SENT_EMAIL_TRACKER.add(conversationId);
      
      return { success: true, emailId: conversationId };
    } catch (jsonError) {
      console.error('❌ JSON-Verarbeitungsfehler:', jsonError.message);
      return { success: false, reason: 'json_processing_error', error: jsonError.message };
    }
    
  } catch (mainError) {
    console.error('❌ Allgemeiner Fehler bei E-Mail-Verarbeitung:', mainError.message);
    
    // Stelle sicher, dass wir den Extraktionsstatus bereinigen
    if (conversationId && ACTIVE_EXTRACTIONS.has(conversationId)) {
      ACTIVE_EXTRACTIONS.delete(conversationId);
      console.log(`🧹 Extraktion für ID: ${conversationId.substring(0, 8)}... nach Fehler bereinigt`);
    }
    
    return { success: false, reason: 'general_error', error: mainError.message };
  }
}

// Export der Funktionen für die Verwendung in anderen Modulen
module.exports = {
  extractAndProcessInBackground,
  generateConversationId,
  isValidEmail,
  sanitizeInput,
  formatChatHistoryForEmail,
  cleanupEmailTracker,
  SENT_EMAIL_TRACKER,
  ACTIVE_EXTRACTIONS
};
