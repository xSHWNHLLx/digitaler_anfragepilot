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
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; color: #333333; padding: 20px; max-width: 800px; margin: 0 auto;">
            <div style="text-align: center; padding-bottom: 1rem; border-bottom: 1px solid #ddd;">
              <h1 style="color: #3DAE2B; margin-bottom: 0.5rem;">Neue Veranstaltungsanfrage</h1>
              <p style="color: #666666;">Digitaler Anfragepilot der OsnabrückHalle</p>
            </div>
            
            <div style="margin-top: 1.5rem; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border-left: 4px solid #3DAE2B;">
              <h2 style="color: #3DAE2B; margin-bottom: 1rem; font-weight: 600;">Zusammenfassung der Anfrage</h2>
              <div style="background-color: #f2f2f2; padding: 15px; border-radius: 12px; border-bottom-left-radius: 4px; border-left: 3px solid #e0e0e0; line-height: 1.6; margin-bottom: 1.5rem;">
                <pre style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; white-space: pre-wrap; margin: 0;">${formattedInquiry}</pre>
              </div>
              
              <div style="margin-top: 1.5rem;">
                <h3 style="color: #3DAE2B; margin-bottom: 0.8rem; font-weight: 600;">Chat-Verlauf:</h3>
                <div style="max-height: 500px; overflow-y: auto; border: 1px solid #eee; padding: 1rem; border-radius: 8px;">
                  ${chatHistory}
                </div>
              </div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666666; font-size: 0.8rem;">
              <p>Diese Anfrage wurde automatisch durch den Digitalen Anfragepiloten der OsnabrückHalle generiert.</p>
              <p>OsnabrückHalle | Schlosswall 1-9, 49074 Osnabrück | Tel.: +49 541 3490991</p>
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
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; color: #333333; padding: 20px; max-width: 800px; margin: 0 auto;">
            <div style="text-align: center; padding-bottom: 1rem; border-bottom: 1px solid #ddd;">
              <h1 style="color: #3DAE2B; margin-bottom: 0.5rem;">Digitaler Anfragepilot der OsnabrückHalle</h1>
              <p style="color: #666666;">Für Veranstaltungen in unserem Event- und Kongresszentrum</p>
            </div>
            
            <div style="margin-top: 1.5rem; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
              <h2 style="color: #3DAE2B; margin-bottom: 1rem; font-weight: 600;">Vielen Dank für Ihre Anfrage!</h2>
              
              <div style="line-height: 1.6;">
                <p>Sehr geehrte(r) ${contactName},</p>
                <p>vielen Dank für Ihre Anfrage an die OsnabrückHalle. Wir haben Ihre Anfrage erhalten und werden uns in Kürze bei Ihnen melden.</p>
                <p>Nachfolgend finden Sie eine Zusammenfassung Ihrer Anfrage:</p>
              </div>
              
              <div style="background-color: #e8f5e6; padding: 1rem 1.2rem; border-radius: 12px; border-bottom-right-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); line-height: 1.6; margin: 1.5rem 0;">
                <pre style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; white-space: pre-wrap; margin: 0;">${formattedInquiry}</pre>
              </div>
              
              <div style="line-height: 1.6; margin-top: 1.5rem;">
                <p>Mit freundlichen Grüßen,<br>Ihr Team der OsnabrückHalle</p>
              </div>
            </div>
            
            <div style="margin-top: 1.5rem; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border-left: 4px solid #3DAE2B;">
              <h3 style="color: #3DAE2B; margin-top: 0; margin-bottom: 0.8rem;">Kontakt</h3>
              <p style="line-height: 1.6;">
                <strong>OsnabrückHalle</strong><br>
                Schlosswall 1-9<br>
                49074 Osnabrück<br>
                Tel.: 0541-323-4700<br>
                E-Mail: <a href="mailto:osnabrueckhalle@marketingosnabrueck.de" style="color: #3DAE2B;">osnabrueckhalle@marketingosnabrueck.de</a><br>
                <a href="https://www.osnabrueckhalle.de" style="color: #3DAE2B;">www.osnabrueckhalle.de</a>
              </p>
            </div>
            
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; color: #666666; font-size: 0.8rem;">
              <p>Diese E-Mail wurde automatisch durch den Digitalen Anfragepiloten der OsnabrückHalle generiert.</p>
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

  // Falls kein Veranstaltungstitel angegeben wurde, generiere automatisch einen sinnvollen Titel
  if (!parsed.eventTitle) {
    if (parsed.eventType) {
      parsed.eventTitle = `${parsed.eventType} in der OsnabrückHalle`;
    } else if (parsed.organizerFirstName || parsed.organizerLastName) {
      const name = `${parsed.organizerFirstName || ''} ${parsed.organizerLastName || ''}`.trim();
      parsed.eventTitle = `Veranstaltung von ${name} in der OsnabrückHalle`;
    } else {
      const dateInfo = parsed.dateFrom || parsed.altDates?.[0] || '2025';
      parsed.eventTitle = `Veranstaltung in der OsnabrückHalle am ${dateInfo}`;
    }
  }
  
  // Veranstaltungstitel mit Fallback
  const eventTitle = parsed.eventTitle;

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