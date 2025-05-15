// Debug-Hilfsskript zur Diagnose von CSS-Problemen
document.addEventListener('DOMContentLoaded', () => {
  // Sofort ausführen
  applyDebug();
  
  // Mehrfach prüfen, um auch dynamisch geladene Inhalte zu erfassen
  setTimeout(applyDebug, 500);
  setTimeout(applyDebug, 2000);
  
  // MutationObserver um nur neue Nachrichten zu beobachten (keine Style-Änderungen mehr)
  const observer = new MutationObserver((mutations) => {
    // Prüfe, ob eine neue Nachricht hinzugefügt wurde (nur bei childList-Änderungen)
    let newMessageAdded = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        newMessageAdded = true;
        break;
      }
    }
    
    // Nur bei neuen Nachrichten Styles anwenden, nicht bei Style-Änderungen
    if (newMessageAdded) {
      console.log('New message detected - applying styles');
      // Warte kurz, damit die neuen Elemente vollständig gerendert sind
      setTimeout(() => {
        // Deaktiviere Observer temporär während der Style-Änderungen
        observer.disconnect();
        applyDebug();
        // Reaktiviere Observer nachdem Styles angewendet wurden
        observer.observe(document.getElementById('messages'), {
          childList: true,
          subtree: false // Nur oberste Ebene beobachten
        });
      }, 50);
    }
  });
  
  // Observer konfigurieren - nur auf neue Elemente achten, nicht auf Style-Änderungen
  observer.observe(document.getElementById('messages'), {
    childList: true,
    subtree: false, // Nur oberste Ebene beobachten
    attributes: false // Keine Attribut-Änderungen mehr beobachten
  });
  
  // Flag um zu vermeiden, dass applyDebug zu oft aufgerufen wird
  let isApplyingDebug = false;
  
  function applyDebug() {
    // Vermeide Mehrfachausführungen
    if (isApplyingDebug) {
      console.log('Already applying debug, skipping...');
      return;
    }
    
    isApplyingDebug = true;
    console.log('Running debug at', new Date().toISOString());
    
    try {
      // Direktes Überschreiben aller Styling-Regeln durch ein neues Style-Element in <head>
      let styleOverride = document.getElementById('force-style-override');
      if (!styleOverride) {
        styleOverride = document.createElement('style');
        styleOverride.id = 'force-style-override';
        document.head.appendChild(styleOverride);
      }
      
      // Diese CSS-Regeln haben höchste Priorität - NUR EINMAL SETZEN
      if (!styleOverride.textContent) {
        styleOverride.textContent = `
          /* Aggressives Reset für alle Bot-Nachrichten */
          .message.claude,
          .bot-message-content .message,
          .message-with-avatar:not(.user-message) .message {
            background-color: #f2f2f2 !important;
            background: #f2f2f2 !important;
            border-left: 3px solid #3DAE2B !important;
            box-shadow: 0 3px 8px rgba(0,0,0,0.15) !important;
            color: #333333 !important;
          }
          
          /* Sicherstellen dass Benutzer-Nachrichten grün bleiben */
          .message.user,
          .user-message .message {
            background-color: #e8f5e6 !important;
            background: #e8f5e6 !important;
          }
          
          /* Debug-Highlighter für Bot-Nachrichten */
          .debug-highlight {
            outline: 2px solid red !important;
          }
        `;
      }
      
      // Nur neue Nachrichten suchen, die noch nicht verarbeitet wurden
      // Der data-styled Attribut verhindert wiederholtes Styling
      const allMessages = document.querySelectorAll('.message:not([data-styled])');
      console.log('New messages found:', allMessages.length);
      
      if (allMessages.length === 0) {
        console.log('No new messages to style');
        isApplyingDebug = false;
        return;
      }
      
      allMessages.forEach((msg, index) => {
        const isClaudeMsg = msg.classList.contains('claude');
        const isInBotContent = msg.closest('.bot-message-content') !== null;
        const isNotUserMessage = msg.closest('.message-with-avatar:not(.user-message)') !== null;
        const isUserMessage = msg.classList.contains('user') || msg.closest('.user-message') !== null;
        
        console.log(`Message ${index}:`, {
          isClaudeMsg,
          isInBotContent,
          isNotUserMessage,
          isUserMessage,
          classList: [...msg.classList],
        });
        
        // Markiere als bereits verarbeitet
        msg.setAttribute('data-styled', 'true');
        
        // Wenn es eine Bot-Nachricht ist, erzwinge grauen Hintergrund
        if (isClaudeMsg || isInBotContent || isNotUserMessage) {
          console.log(`Styling bot message ${index}`);
          msg.classList.add('claude'); // Stelle sicher, dass die Claude-Klasse vorhanden ist
          
          // Inline-Styles nur einmal anwenden
          msg.style.backgroundColor = '#f2f2f2';
          msg.style.borderLeft = '3px solid #3DAE2B';
        } else if (isUserMessage) {
          // Für User-Nachrichten grüne Farbe sicherstellen
          msg.style.backgroundColor = '#e8f5e6';
        }
      });
    
      // Spezielle Behandlung für die erste Nachricht (Willkommensnachricht)
      const firstBotMsg = document.querySelector('.message-with-avatar:first-child .message');
      if (firstBotMsg && !firstBotMsg.hasAttribute('data-styled')) {
        console.log('First bot message found, direct style manipulation');
        firstBotMsg.setAttribute('data-styled', 'true');
        firstBotMsg.style.backgroundColor = '#f2f2f2';
        firstBotMsg.style.borderLeft = '3px solid #3DAE2B';
      }
    } catch (error) {
      console.error('Error in applyDebug:', error);
    } finally {
      // Immer zurücksetzen, um neue Aufrufe zu ermöglichen
      isApplyingDebug = false;
    }
  }
});
