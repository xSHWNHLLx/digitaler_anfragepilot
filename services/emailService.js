const nodemailer = require('nodemailer');

// Maximale Anzahl von Wiederholungsversuchen für E-Mail-Versand
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000; // 2 Sekunden Verzögerung zwischen den Versuchen

// Füge Exports für Hilfsfunktionen hinzu, damit sie in anderen Modulen verwendbar sind
exports.MAX_RETRY_ATTEMPTS = MAX_RETRY_ATTEMPTS;
exports.RETRY_DELAY_MS = RETRY_DELAY_MS;

// Warte-Funktion für Verzögerungen
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Konfiguration des Mail-Transports
function createTransporter() {
  // Prüfe, ob alle erforderlichen Umgebungsvariablen gesetzt sind
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('⚠️ E-Mail-Konfiguration unvollständig. Prüfen Sie die .env-Datei!');
    console.error('Fehlende Werte:', {
      SMTP_HOST: !process.env.SMTP_HOST,
      SMTP_USER: !process.env.SMTP_USER,
      SMTP_PASS: !process.env.SMTP_PASS
    });
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      // Weniger strenge TLS-Anforderungen für Entwicklung
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    },
    debug: process.env.NODE_ENV !== 'production'
  });
}

// Empfänger-E-Mail für Veranstaltungsanfragen
const recipientEmail = process.env.RECIPIENT_EMAIL || 'shawn.hellmann@gmail.com';

// Verbesserte Funktion zum Versenden der E-Mail mit Wiederholungsversuchen
async function sendEmailWithRetry(transporter, mailOptions, retryCount = 0) {
  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ E-Mail-Fehler (Versuch ${retryCount + 1}/${MAX_RETRY_ATTEMPTS}):`, error.message);
    
    if (retryCount < MAX_RETRY_ATTEMPTS - 1) {
      console.log(`🔄 Wiederhole E-Mail-Versand in ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS);
      return sendEmailWithRetry(transporter, mailOptions, retryCount + 1);
    }
    
    return {
      success: false,
      error: error.message,
      details: error.code || 'Unbekannter Fehler nach mehreren Versuchen'
    };
  }
}

// Verbesserte Funktion zum Senden der Anfrage-E-Mail
async function sendInquiryEmail(formattedInquiry, contactEmail, contactName, options = {}) {
  const { isInternalEmail = false, chatHistory = '' } = options;
  
  console.log('🔄 Starte E-Mail-Versand...');
  console.log(`📧 An ${isInternalEmail ? 'OsnabrückHalle' : 'Veranstalter'}: ${isInternalEmail ? recipientEmail : contactEmail}`);
  
  // Input-Validierung
  if (!contactEmail || !contactName) {
    return { 
      success: false, 
      error: 'Fehlende Kontaktdaten', 
      details: 'E-Mail-Adresse und Name müssen angegeben werden' 
    };
  }
  
  const transporter = createTransporter();
  if (!transporter) {
    return { 
      success: false, 
      error: 'E-Mail-Konfiguration unvollständig. Bitte prüfen Sie die Servereinstellungen.' 
    };
  }

  try {
    // Verbindung testen mit Timeout
    try {
      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP verification timeout')), 10000))
      ]);
      console.log('✅ SMTP-Verbindung erfolgreich hergestellt');
    } catch (verifyError) {
      console.error('❌ SMTP-Verbindungsfehler:', verifyError.message);
      return { 
        success: false, 
        error: `SMTP-Verbindungsfehler: ${verifyError.message}`,
        details: 'Verbindung zum E-Mail-Server konnte nicht hergestellt werden'
      };
    }
    
    // Mail-Optionen je nach Empfänger anpassen
    let mailOptions = {};
    
    if (isInternalEmail) {
      // E-Mail an OsnabrückHalle mit Zusammenfassung UND ausklappbarem Chatverlauf
      mailOptions = {
        from: process.env.FROM_EMAIL || '"Anfrage-Pilot OsnabrückHalle" <shawn.hellmann@gmail.com>',
        to: recipientEmail,
        subject: `Neue Veranstaltungsanfrage von ${contactName}`,
        text: `${formattedInquiry}\n\n--- Chat-Verlauf in HTML-Version verfügbar ---`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2 style="color: #3a5eb9;">Neue Veranstaltungsanfrage</h2>
            <div style="background-color: #f5f7fa; padding: 20px; border-radius: 5px; border-left: 4px solid #3a5eb9; margin-bottom: 20px;">
              <pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${formattedInquiry}</pre>
            </div>
            ${chatHistory}
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
              <p>Diese Anfrage wurde automatisch durch den Digitalen Anfragepiloten der OsnabrückHalle generiert.</p>
            </div>
          </div>
        `
      };
    } else {
      // E-Mail an den Kunden - nur mit Zusammenfassung
      mailOptions = {
        from: process.env.FROM_EMAIL || '"OsnabrückHalle" <shawn.hellmann@gmail.com>',
        to: contactEmail,
        subject: 'Ihre Veranstaltungsanfrage an die OsnabrückHalle wurde erfolgreich übermittelt',
        text: `Sehr geehrte(r) ${contactName},\n\nvielen Dank für Ihre Anfrage an die OsnabrückHalle. Wir haben Ihre Anfrage erhalten und werden uns in Kürze bei Ihnen melden.\n\nNachfolgend finden Sie eine Zusammenfassung Ihrer Anfrage:\n\n${formattedInquiry}\n\nMit freundlichen Grüßen,\nIhr Team der OsnabrückHalle\n\nOsnabrückHalle\nSchlosswall 1-9\n49074 Osnabrück\nTel.: 0541-323-4700\nE-Mail: osnabrueckhalle@marketingosnabrueck.de\nwww.osnabrueckhalle.de`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2 style="color: #3a5eb9;">Vielen Dank für Ihre Anfrage!</h2>
            <p>Sehr geehrte(r) ${contactName},</p>
            <p>vielen Dank für Ihre Anfrage an die OsnabrückHalle. Wir haben Ihre Anfrage erhalten und werden uns in Kürze bei Ihnen melden.</p>
            <p>Nachfolgend finden Sie eine Zusammenfassung Ihrer Anfrage:</p>
            <div style="background-color: #f5f7fa; padding: 15px; border-radius: 5px; border-left: 4px solid #3a5eb9;">
              <pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${formattedInquiry}</pre>
            </div>
            <p>Mit freundlichen Grüßen,<br>Ihr Team der OsnabrückHalle</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
              <p>OsnabrückHalle<br>
              Schlosswall 1-9<br>
              49074 Osnabrück<br>
              Tel.: 0541-323-4700<br>
              E-Mail: osnabrueckhalle@marketingosnabrueck.de<br>
              <a href="https://www.osnabrueckhalle.de" style="color: #3a5eb9;">www.osnabrueckhalle.de</a></p>
            </div>
          </div>
        `
      };
    }
    
    // E-Mail mit Wiederholungsversuchen versenden
    const emailResult = await sendEmailWithRetry(transporter, mailOptions);
    
    if (!emailResult.success) {
      return emailResult; // Fehler zurückgeben
    }
    
    console.log(`✅ E-Mail an ${isInternalEmail ? 'OsnabrückHalle' : 'Veranstalter'} gesendet:`, emailResult.messageId);
    return { 
      success: true, 
      messageId: emailResult.messageId 
    };
  } catch (error) {
    console.error('❌ Unbehandelter Fehler beim E-Mail-Versand:', error);
    
    // Detaillierte Fehlermeldungen
    let errorDetails = 'Unbekannter Fehler';
    if (error.code === 'ECONNREFUSED') {
      errorDetails = 'Verbindung zum SMTP-Server wurde verweigert. Bitte SMTP-Einstellungen überprüfen.';
    } else if (error.code === 'EAUTH') {
      errorDetails = 'Authentifizierung fehlgeschlagen. Bitte Benutzername und Passwort überprüfen.';
    } else if (error.responseCode >= 500) {
      errorDetails = 'SMTP-Server-Fehler. Mögliche Ursachen: Sicherheitseinstellungen, Kontingente oder Blockierungen.';
    }
    
    return { 
      success: false, 
      error: error.message,
      details: errorDetails
    };
  }
}

// Generiere eine formatierte Zusammenfassung aus dem geparsten JSON-Objekt
function generateInquirySummary(parsed) {
  // Wenn kein gültiges Objekt vorhanden ist, leere Zusammenfassung zurückgeben
  if (!parsed) return 'Keine Daten verfügbar';

  // Veranstaltungstitel mit Fallback
  const eventTitle = parsed.eventTitle || 'Kein Titel angegeben';

  // Datumsbereiche formatieren
  let dateInfo = 'Kein Datum angegeben';
  if (parsed.dateFrom && parsed.dateTo) {
    dateInfo = `${parsed.dateFrom} bis ${parsed.dateTo}`;
  } else if (parsed.dateFrom) {
    dateInfo = parsed.dateFrom;
  } else if (parsed.altDates) {
    dateInfo = parsed.altDates;
  }

  // Zeitbereiche formatieren
  let timeInfo = '';
  if (parsed.startTime && parsed.endTime) {
    timeInfo = `, ${parsed.startTime} Uhr - ${parsed.endTime} Uhr`;
  } else if (parsed.startTime) {
    timeInfo = `, ab ${parsed.startTime} Uhr`;
  }

  // Teilnehmerzahl formatieren
  const attendees = parsed.expectedAttendees || 'keine Angabe';

  // Budget
  const budget = parsed.budget || 'keine Angabe';

  // Bestuhlung
  const seating = parsed.seating || 'keine Angabe';

  // Veranstalter
  let organizerInfo = 'Keine Kontaktdaten angegeben';
  if (parsed.organizerEmail || parsed.organizerFirstName || parsed.organizerLastName) {
    let name = `${parsed.organizerFirstName || ''} ${parsed.organizerLastName || ''}`.trim();
    organizerInfo = name || 'Name nicht angegeben';
    
    // Firma/Organisation hinzufügen, wenn vorhanden
    if (parsed.organizationCompany) {
      organizerInfo += ` (${parsed.organizationCompany})`;
    }

    // Adresse hinzufügen, wenn vorhanden
    const addressParts = [];
    if (parsed.organizerStreet) addressParts.push(parsed.organizerStreet);
    if (parsed.organizerZip || parsed.organizerCity) {
      addressParts.push(`${parsed.organizerZip || ''} ${parsed.organizerCity || ''}`.trim());
    }
    if (addressParts.length > 0) {
      organizerInfo += `\n${addressParts.join(', ')}`;
    }

    // Kontaktdaten hinzufügen
    const contactParts = [];
    if (parsed.organizerPhone) contactParts.push(`Tel.: ${parsed.organizerPhone}`);
    if (parsed.organizerEmail) contactParts.push(`E-Mail: ${parsed.organizerEmail}`);
    if (contactParts.length > 0) {
      organizerInfo += `\n${contactParts.join(' | ')}`;
    }
  }

  // Zusammenfassung erstellen
  return `VERANSTALTUNGSANFRAGE - OSNABRÜCKHALLE

Veranstaltungstitel: ${eventTitle}
Art der Veranstaltung: ${parsed.eventType || 'Keine Angabe'}
Datum: ${dateInfo}${timeInfo}
Teilnehmerzahl: ${attendees}
Bestuhlung: ${seating}
Budget: ${budget}

${parsed.description ? `Beschreibung: ${parsed.description}\n` : ''}
${parsed.catering ? `Catering: ${parsed.catering}\n` : ''}
${parsed.additionalRequirements ? `Zusätzliche Anforderungen: ${parsed.additionalRequirements}\n` : ''}

VERANSTALTER:
${organizerInfo}

Diese Anfrage wurde über den Digitalen Anfragepiloten der OsnabrückHalle am ${new Date().toLocaleDateString('de-DE')} erstellt.`;
}

module.exports = {
  sendInquiryEmail,
  generateInquirySummary
};