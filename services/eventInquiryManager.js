const { v4: uuidv4 } = require('uuid');
const inquirySchema = require('./inquirySchema');

// Aktive Anfragen verwalten
const activeInquiries = new Map();

// Funktion, um eine neue Anfrage zu erstellen
function createNewInquiry(userId) {
  const inquiryId = uuidv4();
  const inquiry = {
    id: inquiryId,
    userId,
    data: {},
    currentField: null,
    completed: false,
    steps: Object.keys(inquirySchema),
    currentStep: 0,
    started: new Date(),
    lastUpdate: new Date()
  };
  
  activeInquiries.set(inquiryId, inquiry);
  return inquiry;
}

// Nächstes Feld zur Abfrage bekommen
function getNextPrompt(inquiryId, collectedFields = new Set()) {
  const inquiry = activeInquiries.get(inquiryId);
  if (!inquiry) return null;

  if (inquiry.completed) {
    return {
      completed: true,
      message: "Ihre Anfrage ist komplett. Möchten Sie sie absenden?"
    };
  }

  // Find the next uncollected critical field
  let nextCriticalFieldKey = null;
  for (const fieldKey of inquiry.steps) { // inquiry.steps should ideally be ordered by importance or logical flow
    if (fieldKey.includes('.')) { // Handle nested fields like 'veranstalter.email'
      if (!collectedFields.has(fieldKey)) {
        nextCriticalFieldKey = fieldKey;
        break;
      }
    } else if (inquirySchema[fieldKey] && inquirySchema[fieldKey].critical) {
      if (!collectedFields.has(fieldKey)) {
        nextCriticalFieldKey = fieldKey;
        break;
      }
    }
  }
  
  // If all critical fields are collected, proceed to non-critical or summary
  if (!nextCriticalFieldKey) {
      // Check for any remaining non-critical fields if the schema defines them as such
      // For now, let's assume if critical ones are done, we can complete or summarize.
      // This part can be expanded if non-critical fields also need explicit prompting.
      inquiry.completed = true; // Or move to a summary/confirmation step
      return {
        completed: true,
        message: "Alle wichtigen Informationen wurden gesammelt. Möchten Sie die Anfrage überprüfen und absenden?"
      };
  }

  inquiry.currentField = nextCriticalFieldKey;
  let promptSchema;

  if (nextCriticalFieldKey.includes('.')) {
    const [parent, child] = nextCriticalFieldKey.split('.');
    promptSchema = inquirySchema[parent][child];
  } else {
    promptSchema = inquirySchema[nextCriticalFieldKey];
  }

  return {
    field: nextCriticalFieldKey,
    prompt: promptSchema.prompt,
    options: promptSchema.options || null
  };
}

// Hilfsfunktion zur Erstellung einer Zusammenfassung
function createSummary(inquiry) {
  const data = inquiry.data;
  let summary = "**Zusammenfassung Ihrer bisherigen Angaben für die OsnabrückHalle:**\n\n";
  
  // Nur gefüllte Felder in die Zusammenfassung aufnehmen
  if (data.veranstaltungstitel) summary += `- Veranstaltungstitel: ${data.veranstaltungstitel}\n`;
  if (data.veranstaltungsart) summary += `- Art der Veranstaltung: ${data.veranstaltungsart}\n`;
  if (data.datumVon) summary += `- Datum: ${data.datumVon}`;
  if (data.datumBis && data.datumBis !== data.datumVon) summary += ` bis ${data.datumBis}`;
  if (data.datumVon) summary += `\n`;
  if (data.uhrzeitEinlass) summary += `- Einlass: ${data.uhrzeitEinlass} Uhr\n`;
  if (data.uhrzeitEnde) summary += `- Ende: ${data.uhrzeitEnde} Uhr\n`;
  if (data.besucherzahl) summary += `- Besucherzahl: ${data.besucherzahl} Personen\n`;
  if (data.gesamtbudget) summary += `- Gesamtbudget: ${data.gesamtbudget}€ netto\n`;
  if (data.bestuhlung) summary += `- Bestuhlung: ${data.bestuhlung}\n`;
  
  // Catering-Informationen zusammenfassen, falls vorhanden
  let cateringInfo = "";
  if (data.catering) {
    if (data.catering.getrankeAufTischen === 'ja') cateringInfo += "Getränke auf Tischen, ";
    if (data.catering.begrussungskaffee === 'ja') cateringInfo += "Begrüßungskaffee, ";
    if (data.catering.mittagessen === 'ja') cateringInfo += "Mittagessen, ";
    if (data.catering.nachmittagspause === 'ja') cateringInfo += "Nachmittagspause, ";
    if (data.catering.abendessen === 'ja') cateringInfo += "Abendessen, ";
    if (data.catering.getrankeWahrend === 'ja') cateringInfo += "Getränke während Veranstaltung, ";
    
    if (cateringInfo) {
      cateringInfo = cateringInfo.slice(0, -2); // Letztes Komma und Leerzeichen entfernen
      summary += `- Catering: ${cateringInfo}\n`;
    }
    
    if (data.catering.budgetProPerson) summary += `- Catering-Budget pro Person: ${data.catering.budgetProPerson}€ netto\n`;
  }
  
  return summary;
}

// Antwort speichern und nächste Frage vorbereiten
function processAnswer(inquiryId, field, answer) { // Changed signature to accept field directly
  const inquiry = activeInquiries.get(inquiryId);
  if (!inquiry || inquiry.completed) return null;

  // Antwort im aktuellen Feld speichern
  if (field) { // Use the provided field argument
    if (field.includes('.')) {
      // Für verschachtelte Felder wie catering.xyz oder veranstalter.abc
      const [parent, child] = field.split('.');
      if (!inquiry.data[parent]) inquiry.data[parent] = {};
      inquiry.data[parent][child] = answer;
    } else {
      inquiry.data[field] = answer;
    }
    inquiry.lastUpdate = new Date();
  }
  
  // Nächste Frage vorbereiten - getNextPrompt will now be called by the route handler
  // The route handler will pass the updated set of collectedFields.
  // This function now primarily focuses on saving the data.
  return inquiry; // Return the updated inquiry object
}

// Vollständige Anfragedaten abrufen
function getInquiryData(inquiryId) {
  const inquiry = activeInquiries.get(inquiryId);
  if (!inquiry) return null;
  
  return {
    id: inquiry.id,
    data: inquiry.data,
    completed: inquiry.completed,
    progress: Math.floor((inquiry.currentStep / inquiry.steps.length) * 100)
  };
}

// Anfrage formatieren für E-Mail oder Zusammenfassung
function formatInquiry(inquiryId) {
  const inquiry = activeInquiries.get(inquiryId);
  if (!inquiry) return "Anfrage nicht gefunden";
  
  const data = inquiry.data;
  
  // Wenn kein Veranstaltungstitel vorhanden ist, erstelle einen sinnvollen
  let veranstaltungstitel = data.veranstaltungstitel;
  if (!veranstaltungstitel) {
    if (data.veranstaltungsart) {
      veranstaltungstitel = `${data.veranstaltungsart} in der OsnabrückHalle`;
    } else if (data.veranstalter?.vorname || data.veranstalter?.nachname) {
      const name = `${data.veranstalter?.vorname || ''} ${data.veranstalter?.nachname || ''}`.trim();
      veranstaltungstitel = `Veranstaltung von ${name} in der OsnabrückHalle`;
    } else {
      const datum = data.datumVon || 'Geplanter Termin';
      veranstaltungstitel = `Veranstaltung in der OsnabrückHalle am ${datum}`;
    }
    console.log(`✅ Fehlenden Veranstaltungstitel ergänzt: "${veranstaltungstitel}"`);
  }
  
  let formattedText = `
VERANSTALTUNGSANFRAGE - OSNABRÜCKHALLE

Veranstaltungstitel: ${veranstaltungstitel || 'Neue Veranstaltung in der OsnabrückHalle'}
Art der Veranstaltung: ${data.veranstaltungsart || '-'}
Datum: ${data.datumVon || '-'} bis ${data.datumBis || '-'}
Alternativtermine: ${data.alternativtermine || 'Keine angegeben'}
Uhrzeit Einlass: ${data.uhrzeitEinlass || '-'}
Uhrzeit Ende: ${data.uhrzeitEnde || '-'}

BESCHREIBUNG
${data.kurzbeschreibung || '-'}

BUDGET & TEILNEHMER
Gesamtbudget (netto): ${data.gesamtbudget || '-'} €
Erwartete Besucherzahl: ${data.besucherzahl || '-'} Personen

BESTUHLUNG
${data.bestuhlung || '-'}

ZUSÄTZLICHE ANFORDERUNGEN
${data.zusatzlicheAnforderungen || 'Keine angegeben'}

CATERING
Getränke auf Tischen: ${data.catering?.getrankeAufTischen || '-'}
Begrüßungskaffee: ${data.catering?.begrussungskaffee || '-'}
Mittagessen: ${data.catering?.mittagessen || '-'}
Nachmittagspause: ${data.catering?.nachmittagspause || '-'}
Abendessen: ${data.catering?.abendessen || '-'}
Getränke während Veranstaltung: ${data.catering?.getrankeWahrend || '-'}
Sonstige Catering-Wünsche: ${data.catering?.sonstiges || 'Keine angegeben'}
Catering-Budget pro Person (netto): ${data.catering?.budgetProPerson || '-'} €

VERANSTALTER
Firma/Institut: ${data.veranstalter?.firma || '-'}
Name: ${data.veranstalter?.vorname || '-'} ${data.veranstalter?.nachname || '-'}
Adresse: ${data.veranstalter?.strasse || '-'}, ${data.veranstalter?.plz || '-'} ${data.veranstalter?.ort || '-'}
Telefon: ${data.veranstalter?.telefon || '-'}
E-Mail: ${data.veranstalter?.email || '-'}
`;

  return formattedText;
}

module.exports = {
  createNewInquiry,
  getNextPrompt,
  processAnswer,
  getInquiryData,
  formatInquiry
};