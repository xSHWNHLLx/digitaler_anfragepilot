/**
 * Authentifizierungsdienst für die API-Zugriffskontrolle
 * Stellt Middleware für die Validierung von API-Schlüsseln bereit
 */

// Middleware für die API-Schlüssel-Authentifizierung
function apiKeyAuth(req, res, next) {
  // API-Schlüssel aus den Umgebungsvariablen laden
  const validApiKey = process.env.API_KEY;
  
  if (!validApiKey) {
    console.warn('⚠️ Kein API_KEY in den Umgebungsvariablen definiert');
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ 
        error: 'Server-Konfigurationsfehler'
      });
    }
  }

  // API-Schlüssel aus dem Anfrage-Header extrahieren
  const apiKey = req.headers.authorization?.split('Bearer ')[1] ||
                req.query.apiKey;

  // Im Entwicklungsmodus ohne API-Schlüssel fortfahren, wenn kein Schlüssel konfiguriert ist
  if (process.env.NODE_ENV !== 'production' && !validApiKey) {
    console.warn('⚠️ Entwicklungsmodus: API-Authentifizierung übersprungen');
    return next();
  }

  // API-Schlüssel validieren
  if (!apiKey || apiKey !== validApiKey) {
    // Anfrage ablehnen, um keine Information über den Fehlergrund preiszugeben
    return res.status(401).json({ 
      error: 'Nicht autorisiert' 
    });
  }

  // Request-Counter für diesen API-Schlüssel
  global.apiKeyUsageCounter = global.apiKeyUsageCounter || {};
  global.apiKeyUsageCounter[apiKey] = (global.apiKeyUsageCounter[apiKey] || 0) + 1;

  // Bei erfolgreicher Authentifizierung fortfahren
  next();
}

// Überprüfen der Benutzer-Session (für zukünftige Erweiterungen)
function checkUserSession(req, res, next) {
  // Für zukünftige Implementierung
  next();
}

module.exports = {
  apiKeyAuth,
  checkUserSession
};