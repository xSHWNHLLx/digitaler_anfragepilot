import { sendMessage, generateUserId } from './apiClient.js';
import { 
  appendMessage, 
  showTyping, 
  hideTyping, 
  showPreemptiveResponse, 
  replacePreemptiveWithActual
} from './chatUI.js';

// Benutzer-ID für die Session generieren
const userId = localStorage.getItem('inquiryUserId') || generateUserId();
localStorage.setItem('inquiryUserId', userId);

const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
let conversation = [];

// Begrüßungsnachricht hinzufügen
function addWelcomeMessage() {
  const welcomeMessage = document.querySelector('.message.claude');
  if (welcomeMessage) {
    conversation.push({ 
      role: 'assistant', 
      content: welcomeMessage.textContent.trim() 
    });
  }
}

// Beim Laden der Seite
document.addEventListener('DOMContentLoaded', () => {
  // Chat initialized with existing welcome message
  addWelcomeMessage();
  
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
  
  helpButton.addEventListener('click', () => {
    const helpText = 'Willkommen beim Anfragepiloten der OsnabrückHalle! ' +
                     'Hier können Sie eine Anfrage für Ihre Veranstaltung stellen. ' +
                     'Ich führe Sie Schritt für Schritt durch den Prozess. ' +
                     'Sie können jederzeit Fragen zur OsnabrückHalle stellen oder ' +
                     'Informationen zu unseren Räumen, Ausstattung oder Services erfragen.';
    
    appendMessage(helpText, 'claude');
    conversation.push({ role: 'assistant', content: helpText });
  });
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