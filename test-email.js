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
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 5px;">
          <h2 style="color: #3a5eb9;">Test E-Mail</h2>
          <p>Dies ist eine Test-E-Mail, um die SMTP-Konfiguration zu überprüfen.</p>
          <p>Wenn Sie diese E-Mail erhalten, funktioniert die E-Mail-Konfiguration korrekt!</p>
          <p>Gesendet: ${new Date().toLocaleString()}</p>
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