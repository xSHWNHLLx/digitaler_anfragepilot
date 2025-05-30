// Fester Pfad für den Bot-Avatar
const botAvatarPath = 'img/bot-avatar.png';

export function appendMessage(text, sender, options = null) {
  const container = document.getElementById('messages');
  const msgWrapperEl = document.createElement('div');
  msgWrapperEl.classList.add('message-with-avatar');
  
  // Avatar-Element erstellen
  const avatarEl = document.createElement('div');
  avatarEl.classList.add('avatar');
  
  const msgEl = document.createElement('div');
  msgEl.classList.add('message', sender);
  
  // Avatar je nach Sender hinzufügen
  if (sender === 'claude') {
    const avatarImg = document.createElement('img');
    avatarImg.src = botAvatarPath;
    avatarImg.alt = "Assistent";
    avatarEl.appendChild(avatarImg);
    msgWrapperEl.appendChild(avatarEl);
  } else {
    // Für Benutzer entweder kein Avatar oder optional ein Benutzer-Avatar
    msgWrapperEl.classList.add('user-message');
    // Umgekehrte Reihenfolge für Benutzer-Nachrichten (rechts ausgerichtet)
    msgWrapperEl.style.flexDirection = 'row-reverse';
  }
  
  msgWrapperEl.appendChild(msgEl);
  
  // Sofort leeres Element hinzufügen und anzeigen für schnelle UI-Reaktion
  container.appendChild(msgWrapperEl);
  scrollToBottom();
  
  // Text formatieren (Zeilenumbrüche und Listen)
  text = formatMessageText(text);
  
  // Implementiere inkrementelle Textanzeige für natürlichen Eindruck
  if (sender === 'claude') {
    // Schrittweise Textanzeige für Claude-Antworten
    animateText(text, msgEl);
  } else {
    // Sofortige Anzeige für Benutzerinhalte
    msgEl.innerHTML = text;
  }
  
  // Timestamp hinzufügen
  const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  const timeEl = document.createElement('span');
  timeEl.classList.add('timestamp');
  timeEl.textContent = timestamp;
  msgEl.appendChild(timeEl);
  
  // Falls Optionen verfügbar sind, Button-Gruppe hinzufügen
  if (options && options.length > 0) {
    const optionsDiv = document.createElement('div');
    optionsDiv.classList.add('options-buttons');
    
    options.forEach(option => {
      const btn = document.createElement('button');
      btn.classList.add('option-btn');
      btn.textContent = option;
      btn.onclick = () => {
        document.getElementById('user-input').value = option;
        // Senden simulieren
        document.getElementById('chat-form').dispatchEvent(new Event('submit'));
      };
      optionsDiv.appendChild(btn);
    });
    
    msgEl.appendChild(optionsDiv);
  }
  
  // Fade-In Effekt für angenehme UX
  msgWrapperEl.style.opacity = 0;
  msgWrapperEl.style.transition = 'opacity 0.2s';
  
  setTimeout(() => {
    msgWrapperEl.style.opacity = 1;
  }, 10);
  
  return msgWrapperEl;
}

// Typing-Indikator anzeigen
export function showTyping() {
  const container = document.getElementById('messages');
  if (!document.getElementById('typing-indicator')) {
    const typingWrapper = document.createElement('div');
    typingWrapper.classList.add('message-with-avatar');
    
    // Avatar für Typing-Indikator
    const avatarEl = document.createElement('div');
    avatarEl.classList.add('avatar');
    const avatarImg = document.createElement('img');
    avatarImg.src = botAvatarPath;
    avatarImg.alt = "Assistent schreibt...";
    avatarEl.appendChild(avatarImg);
    typingWrapper.appendChild(avatarEl);
    
    const typingEl = document.createElement('div');
    typingEl.id = 'typing-indicator';
    typingEl.classList.add('typing-indicator');
    typingEl.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    typingWrapper.appendChild(typingEl);
    
    container.appendChild(typingWrapper);
    scrollToBottom();
  }
}

// Typing-Indikator entfernen
export function hideTyping() {
  const typingIndicator = document.getElementById('typing-indicator');
  if (typingIndicator) {
    const wrapper = typingIndicator.closest('.message-with-avatar');
    if (wrapper) {
      wrapper.remove();
    } else {
      typingIndicator.remove();
    }
  }
}

function scrollToBottom() {
  const messagesContainer = document.getElementById('messages');
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatMessageText(text) {
  // Hervorhebungen (Fett) für wichtige Hinweise
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Zeilenumbrüche zu <br>
  text = text.replace(/\n/g, '<br>');
  
  // Listen-Formatierung (Aufzählungspunkte mit Bindestrichen)
  let inList = false;
  const lines = text.split('<br>');
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('- ')) {
      if (!inList) {
        lines[i] = '<ul><li>' + lines[i].substring(2) + '</li>';
        inList = true;
      } else {
        lines[i] = '<li>' + lines[i].substring(2) + '</li>';
      }
    } else if (inList) {
      lines[i - 1] += '</ul>';
      inList = false;
    }
  }
  
  if (inList) {
    lines[lines.length - 1] += '</ul>';
  }
  
  return lines.join('<br>');
}

// Funktion für inkrementelle Textanzeige
function animateText(text, element, speed = 10) {
  const htmlContent = text;
  let tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  // Text ohne HTML extrahieren
  const textContent = tempDiv.textContent || tempDiv.innerText;
  
  // HTML-Elemente extrahieren
  const htmlElements = [];
  const walker = document.createTreeWalker(
    tempDiv, 
    NodeFilter.SHOW_ELEMENT, 
    null, 
    false
  );
  
  let currentNode;
  while (currentNode = walker.nextNode()) {
    if (currentNode.nodeName !== 'DIV') {
      htmlElements.push({
        tag: currentNode.nodeName,
        html: currentNode.outerHTML
      });
    }
  }
  
  // Text sofort anzeigen, wenn er kurz ist (unter 100 Zeichen)
  if (textContent.length < 100) {
    element.innerHTML = htmlContent;
    return;
  }
  
  // Ansonsten animieren
  element.innerHTML = ''; // Start leer
  const typingContainer = document.createElement('div');
  element.appendChild(typingContainer);
  
  // Text inkrementell anzeigen
  let i = 0;
  let htmlIndex = 0;
  
  const typeNextChar = () => {
    if (i < htmlContent.length) {
      // Prüfe, ob wir an einer HTML-Tag-Position sind
      if (htmlElements.length > htmlIndex && 
          htmlContent.substring(i).startsWith(htmlElements[htmlIndex].html)) {
        typingContainer.innerHTML += htmlElements[htmlIndex].html;
        i += htmlElements[htmlIndex].html.length;
        htmlIndex++;
      } else {
        typingContainer.innerHTML += htmlContent.charAt(i);
        i++;
      }
      
      scrollToBottom();
      
      // Nächstes Zeichen etwas schneller anzeigen
      setTimeout(typeNextChar, speed);
    }
  };
  
  typeNextChar();
}

// Platzhaltertext, der sofort angezeigt wird
export function showPreemptiveResponse() {
  const msgWrapperEl = document.createElement('div');
  msgWrapperEl.classList.add('message-with-avatar');
  msgWrapperEl.id = 'preemptive-response-wrapper';
  
  // Avatar für Preemptive Response
  const avatarEl = document.createElement('div');
  avatarEl.classList.add('avatar');
  const avatarImg = document.createElement('img');
  avatarImg.src = botAvatarPath;
  avatarImg.alt = "Assistent denkt...";
  avatarEl.appendChild(avatarImg);
  msgWrapperEl.appendChild(avatarEl);
  
  const msgEl = document.createElement('div');
  msgEl.id = 'preemptive-response';
  msgEl.classList.add('message', 'claude', 'preemptive');
  
  // Platzhaltertext mit Animationspunkten
  const typingContainer = document.createElement('div');
  typingContainer.classList.add('typing-preview');
  typingContainer.innerHTML = 'Ich bereite eine Antwort vor';
  msgEl.appendChild(typingContainer);
  
  // Animierte Punkte
  const dots = document.createElement('span');
  dots.classList.add('typing-dots');
  dots.innerHTML = '<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>';
  typingContainer.appendChild(dots);
  
  msgWrapperEl.appendChild(msgEl);
  
  document.getElementById('messages').appendChild(msgWrapperEl);
  scrollToBottom();
  
  // Animation der Punkte starten
  animateDots(dots);
  
  return msgWrapperEl;
}

// Animation für die Punkte
function animateDots(dotsElement) {
  let opacity = 0;
  let direction = 0.1;
  
  const animate = () => {
    const dots = dotsElement.querySelectorAll('.dot');
    dots.forEach((dot, i) => {
      // Versetzt animieren
      const dotOpacity = Math.sin((opacity + i * 0.33) * Math.PI) * 0.5 + 0.5;
      dot.style.opacity = dotOpacity;
    });
    
    opacity += direction;
    if (opacity >= 1 || opacity <= 0) {
      direction *= -1;
    }
    
    // Animation fortsetzen, solange der Platzhalter existiert
    if (document.getElementById('preemptive-response')) {
      requestAnimationFrame(animate);
    }
  };
  
  requestAnimationFrame(animate);
}

// Entferne den Platzhalter und ersetze ihn durch die tatsächliche Antwort
export function replacePreemptiveWithActual(text, options = null) {
  const preemptiveWrapper = document.getElementById('preemptive-response-wrapper');
  const preemptive = document.getElementById('preemptive-response');
  
  if (preemptive && preemptiveWrapper) {
    // Text formatieren (Zeilenumbrüche und Listen)
    const formattedText = formatMessageText(text);
    
    // Direkte Ersetzung ohne Übergang, um Probleme zu vermeiden
    preemptive.innerHTML = formattedText;
    preemptive.id = ''; // ID entfernen, damit er nicht mehr als Platzhalter erkannt wird
    preemptiveWrapper.id = ''; // ID entfernen
    
    // Timestamp hinzufügen
    const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    const timeEl = document.createElement('span');
    timeEl.classList.add('timestamp');
    timeEl.textContent = timestamp;
    preemptive.appendChild(timeEl);
    
    // Falls Optionen verfügbar sind, Button-Gruppe hinzufügen
    if (options && options.length > 0) {
      const optionsDiv = document.createElement('div');
      optionsDiv.classList.add('options-buttons');
      
      options.forEach(option => {
        const btn = document.createElement('button');
        btn.classList.add('option-btn');
        btn.textContent = option;
        btn.onclick = () => {
          document.getElementById('user-input').value = option;
          // Senden simulieren
          document.getElementById('chat-form').dispatchEvent(new Event('submit'));
        };
        optionsDiv.appendChild(btn);
      });
      
      preemptive.appendChild(optionsDiv);
    }
    
    return preemptiveWrapper;
  } else {
    // Fallback: Wenn kein Platzhalter existiert, füge normal ein
    return appendMessage(text, 'claude', options);
  }
}