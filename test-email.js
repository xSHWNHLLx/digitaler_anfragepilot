// test-email.js - Einfaches Skript zum Testen der E-Mail-Konfiguration
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('Start E-Mail-Test');
  console.log('----------------');
  console.log('Umgebungsvariablen:');
  console.log('- SMTP_HOST:', process.env.SMTP_HOST ? '✓ vorhanden' : '✗ fehlt');
  console.log('- SMTP_PORT:', process.env.SMTP_PORT ? process.env.SMTP_PORT : '(Standard: 587)');
  console.log('- SMTP_USER:', process.env.SMTP_USER ? '✓ vorhanden' : '✗ fehlt');
  console.log('- SMTP_PASS:', process.env.SMTP_PASS ? '✓ vorhanden' : '✗ fehlt');
  console.log('- FROM_EMAIL:', process.env.FROM_EMAIL || '(Standard: SMTP_USER)');
  console.log('- RECIPIENT_EMAIL:', process.env.RECIPIENT_EMAIL || '(Standard: SMTP_USER)');
  console.log('----------------');

  try {
    // Transporter erstellen
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false // Weniger streng für Tests
      },
      debug: true
    });

    console.log('Überprüfe SMTP-Verbindung...');
    
    // Verbindung testen
    await transporter.verify();
    console.log('✅ SMTP-Verbindung erfolgreich hergestellt!');

    // Test-E-Mail senden
    console.log('Sende Test-E-Mail...');
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: process.env.RECIPIENT_EMAIL || process.env.SMTP_USER,
      subject: 'Test E-Mail vom OsnabrückHalle Anfragepilot',
      text: 'Dies ist eine Test-E-Mail, um die SMTP-Konfiguration zu überprüfen.',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; color: #333333; padding: 20px; max-width: 800px; margin: 0 auto;">
          <div style="text-align: center; padding-bottom: 1rem; border-bottom: 1px solid #ddd;">
            <h1 style="color: #3DAE2B; margin-bottom: 0.5rem;">Digitaler Anfragepilot der OsnabrückHalle</h1>
            <p style="color: #666666;">Test der E-Mail-Konfiguration</p>
          </div>
          
          <div style="margin-top: 1.5rem; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
            <h2 style="color: #3DAE2B; margin-bottom: 1rem; font-weight: 600;">Test E-Mail</h2>
            
            <div style="background-color: #f2f2f2; padding: 1rem 1.2rem; border-radius: 12px; border-bottom-left-radius: 4px; border-left: 3px solid #e0e0e0; line-height: 1.6; margin: 1.5rem 0;">
              <p>Dies ist eine Test-E-Mail, um die SMTP-Konfiguration zu überprüfen.</p>
              <p>Wenn Sie diese E-Mail erhalten, funktioniert die E-Mail-Konfiguration korrekt!</p>
            </div>
            
            <div style="padding: 0.8rem 1.2rem; margin-top: 1rem; background-color: #e8f5e6; border-radius: 12px; border-bottom-right-radius: 4px;">
              <p><strong>Gesendet:</strong> ${new Date().toLocaleString('de-DE')}</p>
            </div>
          </div>
          
          <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; color: #666666; font-size: 0.8rem;">
            <p>OsnabrückHalle | Schlosswall 1-9, 49074 Osnabrück | Tel.: +49 541 3490991</p>
            <p>Diese Test-E-Mail wurde automatisch generiert.</p>
          </div>
        </div>
      `
    });

    console.log('✅ E-Mail erfolgreich gesendet!');
    console.log('Nachrichten-ID:', info.messageId);
    console.log('Empfänger:', info.accepted);
    console.log('Antwort vom Server:', info.response);
    console.log('----------------');
    console.log('TEST BESTANDEN');
  } catch (error) {
    console.error('❌ Fehler beim E-Mail-Versand:', error);
    console.error('Fehlercode:', error.code);
    console.error('Fehlermeldung:', error.message);
    
    if (error.code === 'EAUTH') {
      console.error('Authentifizierungsfehler! Bitte überprüfen Sie Benutzername und Passwort.');
      console.error('Bei Gmail mit 2FA müssen Sie ein App-Passwort verwenden.');
    } else if (error.code === 'ESOCKET' || error.code === 'ECONNECTION') {
      console.error('Verbindungsfehler! Bitte überprüfen Sie Host und Port.');
      if (process.env.SMTP_HOST === 'smtp.gmail.com') {
        console.error('Für Gmail: Host sollte smtp.gmail.com sein, Port 587 mit secure=false oder Port 465 mit secure=true');
      }
    }
    
    console.error('----------------');
    console.error('TEST FEHLGESCHLAGEN');
  }
}

testEmail();