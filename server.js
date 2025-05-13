require('dotenv').config();
const express = require('express');
const cors = require('cors');
const claudeModule = require('./routes/claude');
const claudeRoute = claudeModule.router;
// Neue Sicherheits-Middleware importieren
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { apiKeyAuth } = require('./services/authService');

const app = express();

// Sicherheits-Header hinzufügen
app.use(helmet());

app.use(cors({
  // CORS-Einstellungen einschränken
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || 'https://osnabrueckhalle.de' 
    : '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ 
  // Größenlimit für JSON-Payloads begrenzen
  limit: '100kb' 
}));

// Statische Dateien aus dem public-Verzeichnis bereitstellen
app.use(express.static('public'));

// Rate-Limiter für alle Anfragen
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Limit pro IP-Adresse
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Zu viele Anfragen von dieser IP, bitte versuchen Sie es später erneut'
});
app.use(globalLimiter);

// Strengeres Limit für API-Anfragen
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 Minuten
  max: 30, // Maximal 30 API-Anfragen pro Stunde
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Zu viele API-Anfragen, bitte versuchen Sie es später erneut'
});

// API-Routen mit Authentifizierung und Rate-Limiting
app.use('/api/claude', apiLimiter, apiKeyAuth, claudeRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Test-Endpunkt für E-Mail-Versand (nur in Entwicklungsumgebung)
if (process.env.NODE_ENV !== 'production') {
  const emailService = require('./services/emailService');
  
  // Test-Route mit Admin-Authentifizierung schützen
  app.get('/api/test-email', apiKeyAuth, async (req, res) => {
    try {
      console.log('E-Mail-Test gestartet...');
      
      const testInquiry = `
TESTANFRAGE - OSNABRÜCKHALLE

Veranstaltungstitel: Test-Veranstaltung
Art der Veranstaltung: Test
Datum: 01.01.2026 bis 01.01.2026
Uhrzeit: 10:00 - 18:00 Uhr

Diese E-Mail wurde vom Test-Endpunkt gesendet, um die E-Mail-Konfiguration zu überprüfen.
`;
      
      const testResult = await emailService.sendInquiryEmail(
        testInquiry,
        process.env.SMTP_USER, // An sich selbst senden
        "Test-Nutzer"
      );
      
      if (testResult.success) {
        res.json({
          success: true,
          message: 'E-Mail erfolgreich gesendet'
          // Details nicht mehr zurückgeben
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'E-Mail konnte nicht gesendet werden'
          // Keine Fehlerdetails mehr zurückgeben
        });
      }
    } catch (error) {
      console.error('Fehler beim Testen des E-Mail-Versands:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Senden der Test-E-Mail'
        // Keine Fehlerdetails mehr zurückgeben
      });
    }
  });
  
  console.log('E-Mail-Test-Route auf /api/test-email verfügbar (API-Key erforderlich)');
}