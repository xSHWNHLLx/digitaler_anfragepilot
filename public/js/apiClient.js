// API-Konfiguration
const API_CONFIG = {
  // API-Schlüssel für die Authentifizierung
  // In einer produktiven Umgebung würde dieser Schlüssel sicherer verwaltet werden
  API_KEY: 'pilot-XqKFMGAo8JYbbzUibv_SpqygWAq6vpCv-secure-key',
  // Client-ID zur Nachverfolgung von Token-Nutzung
  CLIENT_ID: generateClientId()
};

export async function sendMessage(messages, userId) {
  try {
    // Zeige den Typing-Indikator sofort an, damit der Benutzer Feedback erhält
    const typingEvent = new CustomEvent('typing:start');
    document.dispatchEvent(typingEvent);
    
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // Hinzufügen eines Cache-Prevention-Headers
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        // Hinzufügen des API-Schlüssels für die Authentifizierung
        'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
        // Client-ID für Token-Tracking
        'X-Client-ID': API_CONFIG.CLIENT_ID
      },
      body: JSON.stringify({ messages, userId })
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'API error');
    }
    
    const data = await res.json();
    
    // Benachrichtigen, dass die Antwort erhalten wurde
    const responseEvent = new CustomEvent('response:received', { detail: data });
    document.dispatchEvent(responseEvent);
    
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    
    // Benachrichtigen, dass ein Fehler aufgetreten ist
    const errorEvent = new CustomEvent('response:error', { detail: error.message });
    document.dispatchEvent(errorEvent);
    
    throw error;
  } finally {
    // Typing-Indikator entfernen, egal was passiert
    const typingEndEvent = new CustomEvent('typing:end');
    document.dispatchEvent(typingEndEvent);
  }
}

export function generateUserId() {
  // Einfache Implementierung für user ID
  return 'user_' + Math.random().toString(36).substring(2, 15);
}

// Generiert eine eindeutige Client-ID, die beibehalten wird
function generateClientId() {
  // Versuche gespeicherte Client-ID zu laden
  let clientId = localStorage.getItem('anfragepilot_client_id');
  
  // Falls keine vorhanden, erstelle eine neue
  if (!clientId) {
    clientId = 'client_' + Math.random().toString(36).substring(2, 15) + 
               '_' + Date.now().toString(36);
    // Speichere für zukünftige Requests
    localStorage.setItem('anfragepilot_client_id', clientId);
  }
  
  return clientId;
}