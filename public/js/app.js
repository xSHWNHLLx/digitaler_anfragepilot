import { sendMessage, generateUserId } from './apiClient.js';
// Import the botAvatarPath along with the functions
const botAvatarPath = 'img/bot-avatar.png';

import { 
  appendMessage, 
  showTyping, 
  hideTyping, 
  showPreemptiveResponse, 
  replacePreemptiveWithActual,
  formatMessageText
} from './chatUI.js';

// Definiere wie lange eine Session aktiv bleibt (in Millisekunden)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 Stunden

// Session-ID generieren oder wiederverwenden, wenn noch gültig
let userId;
const storedUserId = localStorage.getItem('inquiryUserId');
const lastActivityTime = localStorage.getItem('inquiryLastActivity');
const sessionStartTime = localStorage.getItem('inquirySessionStart');

// Prüfe, ob eine aktive Session existiert
if (storedUserId && lastActivityTime && (Date.now() - parseInt(lastActivityTime, 10)) < SESSION_TIMEOUT) {
  // Session ist noch gültig, verwende die gespeicherte User-ID
  userId = storedUserId;
  console.log('Bestehende Session wiederhergestellt');
} else {
  // Session ist abgelaufen oder neu, generiere neue User-ID und Session-Start
  userId = generateUserId();
  const now = Date.now();
  localStorage.setItem('inquiryUserId', userId);
  localStorage.setItem('inquirySessionStart', now.toString());
  console.log('Neue Session gestartet mit ID:', userId);
}

const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');

// Funktion zum Überprüfen der Session-Gültigkeit
function checkSessionValidity() {
  const lastActivityTime = localStorage.getItem('inquiryLastActivity');
  
  if (lastActivityTime) {
    const now = Date.now();
    const lastActivity = parseInt(lastActivityTime, 10);
    
    // Wenn die Session abgelaufen ist, lösche alle session-bezogenen Daten
    if (now - lastActivity >= SESSION_TIMEOUT) {
      localStorage.removeItem('inquiryConversation');
      localStorage.removeItem('inquiryLastActivity');
      localStorage.removeItem('inquiryUserId'); // Auch die User-ID löschen
      localStorage.removeItem('inquirySessionStart'); // Session-Start löschen
      console.log('Session abgelaufen, alle Session-Daten gelöscht');
      return false;
    }
    return true;
  }
  return false;
}

// Lade Konversation aus dem Local Storage, falls existiert und noch gültig
let conversation = [];
const savedConversationData = localStorage.getItem('inquiryConversation');

// Prüfe, ob eine gespeicherte Konversation existiert und noch aktuell ist
if (savedConversationData && checkSessionValidity()) {
  try {
    conversation = JSON.parse(savedConversationData);
    console.log('Chat-Verlauf aus vorheriger Session wiederhergestellt');
  } catch (e) {
    console.error('Fehler beim Laden des Chat-Verlaufs:', e);
    conversation = [];
  }
} else if (savedConversationData) {
  console.log('Vorherige Session ist abgelaufen, starte neue Konversation');
}

// Begrüßungsnachricht hinzufügen
function addWelcomeMessage() {
  const welcomeMessage = document.querySelector('#messages .message.claude');
  if (welcomeMessage) {
    conversation.push({ 
      role: 'assistant', 
      content: welcomeMessage.textContent.trim() 
    });
    saveConversationToStorage();
  }
}

// Speichere die Konversation im Local Storage
function saveConversationToStorage() {
  try {
    localStorage.setItem('inquiryConversation', JSON.stringify(conversation));
    updateLastActivity();
  } catch (e) {
    console.error('Fehler beim Speichern der Konversation:', e);
  }
}

// Aktualisiert den Zeitstempel der letzten Aktivität
function updateLastActivity() {
  localStorage.setItem('inquiryLastActivity', Date.now().toString());
}

// Beim Laden der Seite
document.addEventListener('DOMContentLoaded', () => {
  // Status-Element erstellen (wird später mit CSS gezeigt/versteckt)
  const statusEl = document.createElement('div');
  statusEl.id = 'connection-status';
  statusEl.className = 'status-indicator';
  document.body.appendChild(statusEl);
  
  // Wenn keine gespeicherte Konversation existiert, füge Willkommensnachricht hinzu
  if (conversation.length === 0) {
    addWelcomeMessage();
    statusEl.textContent = 'Neue Konversation';
    statusEl.classList.add('new-session');
  } else {
    // Andernfalls lade die gespeicherte Konversation in die UI
    displaySavedConversation();
    statusEl.textContent = 'Konversation wiederhergestellt';
    statusEl.classList.add('restored-session');
    
    // Status nach 8 Sekunden ausblenden (erhöht für bessere Sichtbarkeit)
    setTimeout(() => {
      statusEl.classList.add('fade-out');
    }, 8000);
  }
  
  // Auto-resize Textfeld
  setupDynamicTextarea();
  
  // Globaler Status für den Platzhalter
  let preemptiveResponseShown = false;
  
  // Event-Listener für UI-Updates einrichten
  document.addEventListener('typing:start', () => {
    hideTyping(); // Entferne standard typing indicator
    
    // Nur einen Platzhalter anzeigen, wenn noch keiner vorhanden ist
    if (!document.getElementById('preemptive-response') && !preemptiveResponseShown) {
      showPreemptiveResponse();
      preemptiveResponseShown = true;
    }
  });
  
  document.addEventListener('typing:end', () => {
    // Wir entfernen den Platzhalter nicht automatisch,
    // er wird durch die echte Antwort ersetzt
    console.log('Typing beendet, warte auf Antwort...');
  });
  
  document.addEventListener('response:received', (event) => {
    const claudeReply = event.detail.text;
    console.log('Antwort erhalten, ersetze Platzhalter:', claudeReply.substring(0, 30) + '...');
    
    // Ersetze Platzhalter durch tatsächliche Antwort
    replacePreemptiveWithActual(claudeReply);
    preemptiveResponseShown = false;
    conversation.push({ role: 'assistant', content: claudeReply });
    saveConversationToStorage();
  });
  
  document.addEventListener('response:error', (event) => {
    console.error('Fehler bei der Antwort:', event.detail);
    replacePreemptiveWithActual('Entschuldigung, es ist ein Fehler aufgetreten: ' + event.detail);
    preemptiveResponseShown = false;
  });
  
  // "Senden" Button Event-Listener
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userText = input.value.trim();
    if (!userText) return;

    // Sofort Benutzereingabe anzeigen für schnellere wahrgenommene Reaktion
    appendMessage(userText, 'user');
    conversation.push({ role: 'user', content: userText });
    saveConversationToStorage();
    input.value = '';
    
    // Textarea-Höhe zurücksetzen
    input.style.height = 'auto';
    
    try {
      // Zeige sofort eine Platzhalter-Antwort an, NOCH VOR dem API-Call
      // Aber nur, wenn noch kein Platzhalter existiert
      if (!document.getElementById('preemptive-response') && !preemptiveResponseShown) {
        showPreemptiveResponse();
        preemptiveResponseShown = true;
      }
      
      // Sendet Nachricht an den Server - Events werden in apiClient.js ausgelöst
      await sendMessage(conversation, userId);
    } catch (err) {
      console.error('Chat error:', err);
      preemptiveResponseShown = false;
      // Fehler werden bereits vom response:error Event behandelt
    }
  });
  
  // Hilfe-Button hinzufügen
  const helpButton = document.createElement('button');
  helpButton.id = 'help-button';
  helpButton.innerHTML = '?';
  helpButton.title = 'Hilfe zur OsnabrückHalle';
  document.body.appendChild(helpButton);
  
  // Overlay und Popup für Hilfe erstellen
  const helpOverlay = document.createElement('div');
  helpOverlay.id = 'help-overlay';
  helpOverlay.className = 'help-overlay';
  helpOverlay.style.display = 'none';
  document.body.appendChild(helpOverlay);
  
  helpButton.addEventListener('click', (e) => {
    e.preventDefault();
    // Öffne das Hilfe-Popup in einem neuen Fenster mit angepasster Größe
    window.open(
      'help-popup.html', 
      'hilfeAnfragepilot',
      'width=600,height=700,resizable=yes,scrollbars=yes,status=no'
    );
  });
  
  // Button zum Zurücksetzen des Chats hinzufügen
  const resetButton = document.createElement('button');
  resetButton.id = 'reset-button';
  resetButton.innerHTML = '🔄';
  resetButton.title = 'Chat zurücksetzen';
  document.body.appendChild(resetButton);
  
  resetButton.addEventListener('click', () => {
    if (confirm('Möchten Sie den Chat zurücksetzen und eine neue Konversation starten?')) {
      // Lösche alle gespeicherten Chat-Daten inklusive User ID und Session-Start
      localStorage.removeItem('inquiryConversation');
      localStorage.removeItem('inquiryLastActivity');
      localStorage.removeItem('inquiryUserId');
      localStorage.removeItem('inquirySessionStart');
      
      // Lade die Seite neu, um mit einem frischen Chat zu starten
      window.location.reload();
    }
  });
  
  // Session-Verwaltung für Sichtbarkeitswechsel der Seite
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Wenn die Seite wieder sichtbar ist, überprüfe die Session
      if (checkSessionValidity()) {
        // Nur wenn die Session noch gültig ist, aktualisiere den Zeitstempel
        updateLastActivity();
      } else if (conversation.length > 0) {
        // Wenn die Session abgelaufen ist und wir eine Konversation haben,
        // reload the page to start fresh
        window.location.reload();
      }
    }
  });
  
  // Event-Listener für Benutzerinteraktionen hinzufügen, um Session-Aktivität zu aktualisieren
  ['click', 'keydown', 'touchstart'].forEach(eventType => {
    document.addEventListener(eventType, () => {
      if (conversation.length > 0 && checkSessionValidity()) {
        updateLastActivity();
      }
    }, { passive: true });
  });
  
  // Regelmäßige Überprüfung der Session-Gültigkeit
  setInterval(() => {
    if (conversation.length > 0 && !checkSessionValidity()) {
      // Wenn die Session abgelaufen ist, zeige einen Hinweis und lade die Seite neu
      const status = document.getElementById('connection-status');
      if (status) {
        status.textContent = 'Session abgelaufen, wird neu geladen...';
        status.className = 'status-indicator restored-session';
      }
      
      // Kurze Verzögerung für die Anzeige der Nachricht
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }, 60000); // Überprüfung jede Minute
});

// Funktion für dynamisch wachsendes Texteingabefeld
function setupDynamicTextarea() {
  const textarea = document.getElementById('user-input');
  
  // Initialisierung der Texthöhe
  function adjustHeight() {
    textarea.style.height = 'auto'; // Reset height
    const newHeight = Math.min(textarea.scrollHeight, 150); // Maximum height: 150px
    textarea.style.height = newHeight + 'px';
  }
  
  // Input-Event für dynamische Anpassung der Höhe
  textarea.addEventListener('input', adjustHeight);
  
  // Fokus-Event für bessere UX
  textarea.addEventListener('focus', adjustHeight);
  
  // Enter-Taste behandeln (mit Shift+Enter für neue Zeile)
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });
  
  // Bei Initialisierung einmal anpassen
  setTimeout(adjustHeight, 10);
}

// Funktion zum Anzeigen der gespeicherten Konversation in der UI
function displaySavedConversation() {
  // Entferne die Standard-Willkommensnachricht, wenn vorhanden
  const messagesContainer = document.getElementById('messages');
  messagesContainer.innerHTML = '';
  
  console.log(`Zeige ${conversation.length} gespeicherte Nachrichten an`);
  
  // Füge einen Hinweis ein, dass dies eine wiederhergestellte Session ist
  const sessionNoteEl = document.createElement('div');
  sessionNoteEl.classList.add('session-note');
  sessionNoteEl.innerHTML = 'Chat-Verlauf wiederhergestellt';
  messagesContainer.appendChild(sessionNoteEl);
  
  // Durchlaufe alle gespeicherten Nachrichten und zeige sie im Chat an
  conversation.forEach((msg, index) => {
    if (msg.role === 'user') {
      appendMessage(msg.content, 'user');
    } else if (msg.role === 'assistant') {
      // Alle Bot-Nachrichten werden jetzt gleich behandelt
      appendMessage(msg.content, 'claude', null, false); // false = keine Animation für gespeicherte Nachrichten
    }
  });
  
  // Scrolle nach unten, um die neueste Nachricht anzuzeigen
  setTimeout(() => {
    const container = document.getElementById('messages');
    container.scrollTop = container.scrollHeight;
  }, 100);
}