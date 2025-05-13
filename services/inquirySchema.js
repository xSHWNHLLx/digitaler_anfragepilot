// Die Struktur der erforderlichen Felder mit verbesserten Prompts und Beispielen
const inquirySchema = {
    veranstaltungstitel: { 
      required: true, 
      prompt: "Beginnen wir mit dem Titel Ihrer Veranstaltung. Dieser wird für alle Unterlagen und Beschilderungen in der OsnabrückHalle verwendet. Beispiele sind 'Jahrestagung 2025 der XYZ GmbH', 'Sommerball des Vereins ABC' oder 'Produktpräsentation Neuheiten 2026'. Wie lautet der Titel Ihrer Veranstaltung?" 
    },
    veranstaltungsart: { 
      required: true, 
      prompt: "Die Art der Veranstaltung hilft uns, den passenden Raum und die richtige Ausstattung in der OsnabrückHalle vorzubereiten. Bei einer Tagung benötigen wir z.B. mehr Präsentationstechnik, während bei einem Ball die Tanzfläche im Mittelpunkt steht. Welche Art von Veranstaltung planen Sie?\n\nZur Auswahl stehen:\n- Tagung/Kongress (Vorträge, Diskussionen, Workshops)\n- Messe/Ausstellung (Stände, Präsentationsflächen)\n- Konzert/Show (Bühne, Zuschauerränge)\n- Ball/Fest (Tanzfläche, festliches Ambiente)\n- Sonstige Veranstaltung (bitte kurz beschreiben)", 
      options: ["Tagung/Kongress", "Messe/Ausstellung", "Konzert/Show", "Ball/Fest", "Sonstige Veranstaltung"]
    },
    datumVon: { 
      required: true, 
      prompt: "Der Veranstaltungstermin ist entscheidend für die Verfügbarkeit unserer Räume in der OsnabrückHalle. Bitte geben Sie das Startdatum im Format TT.MM.JJJJ an (z.B. '15.10.2025'). An welchem Datum soll Ihre Veranstaltung beginnen?" 
    },
    datumBis: { 
      required: true, 
      prompt: "Falls Ihre Veranstaltung mehrere Tage dauert, benötigen wir auch das Enddatum. Bei eintägigen Veranstaltungen geben Sie bitte das gleiche Datum wie beim Startdatum an. An welchem Datum soll Ihre Veranstaltung enden? (Format: TT.MM.JJJJ)" 
    },
    alternativtermine: { 
      required: false, 
      prompt: "Die OsnabrückHalle ist ein beliebter Veranstaltungsort und manchmal sind Wunschtermine bereits ausgebucht. Alternative Termine erhöhen die Chance, dass wir Ihnen einen passenden Raum anbieten können. Beispiele wären '16.10.2025 - 17.10.2025' oder 'jedes Wochenende im November'. Haben Sie alternative Termine, falls Ihr Wunschtermin nicht verfügbar ist? Falls nicht, können Sie dieses Feld mit 'Keine' beantworten." 
    },
    uhrzeitEinlass: { 
      required: true, 
      prompt: "Die Einlasszeit bestimmt, ab wann Ihre Gäste die OsnabrückHalle betreten können. Typischerweise planen Veranstalter den Einlass etwa 30-60 Minuten vor Veranstaltungsbeginn. Unser Haus öffnet frühestens um 7:00 Uhr. Beispiele: '08:30', '18:00'. Um wie viel Uhr soll der Einlass für Ihre Gäste beginnen?" 
    },
    uhrzeitEnde: { 
      required: true, 
      prompt: "Das geplante Ende Ihrer Veranstaltung hilft uns bei der Personalplanung und bei eventuellen Folgeveranstaltungen in der OsnabrückHalle. Bitte beachten Sie, dass nach 22:00 Uhr ggf. Zuschläge anfallen können. Um wie viel Uhr soll Ihre Veranstaltung enden? (Format: 'HH:MM', z.B. '16:30')" 
    },
    kurzbeschreibung: { 
      required: true, 
      prompt: "Eine kurze Beschreibung Ihrer Veranstaltung hilft uns, Ihre speziellen Anforderungen in der OsnabrückHalle besser zu verstehen. Bitte beschreiben Sie in 2-3 Sätzen den Ablauf und Zweck Ihrer Veranstaltung. Beispiel: 'Jährliche Mitarbeiterversammlung mit Präsentationen am Vormittag und Workshops am Nachmittag. Abschließend findet ein gemeinsames Abendessen statt.'" 
    },
    gesamtbudget: { 
      required: true, 
      prompt: "Das Budget ist wichtig, damit wir ein passendes Angebot erstellen können. Für eine Tagung mit 50 Personen inkl. Catering liegt der übliche Rahmen in der OsnabrückHalle beispielsweise zwischen 3.000€ und 5.000€ netto. Für eine Abendveranstaltung mit 100 Gästen etwa zwischen 8.000€ und 12.000€. Wie hoch ist Ihr Gesamtbudget für die Veranstaltung? (netto in €, z.B. '5000')" 
    },
    besucherzahl: { 
      required: true, 
      prompt: "Die Anzahl der Teilnehmer bestimmt, welche Räume in der OsnabrückHalle für Ihre Veranstaltung in Frage kommen. Unser Europa-Saal fasst bis zu 1.800 Personen (bestuhlt), der Kongress-Saal bis zu 600 Personen, während unsere kleineren Räume für 20-400 Teilnehmer ausgelegt sind. Mit wie vielen Besuchern rechnen Sie bei Ihrer Veranstaltung?" 
    },
    zusatzlicheAnforderungen: { 
      required: false, 
      prompt: "Besondere Anforderungen helfen uns, Ihre Veranstaltung in der OsnabrückHalle optimal zu planen. Beispiele wären: 'Podiumsdiskussion mit 5 Personen', 'Ausstellungsfläche für 10 Roll-Ups', 'Tanzfläche für ca. 100 Personen', 'separater Raum für VIP-Empfang', 'besondere Beleuchtung in Firmenfarben'. Haben Sie zusätzliche Anforderungen an räumliche und technische Ausstattung, Ausstellungsbereiche etc.? Falls nicht, können Sie mit 'Keine' antworten." 
    },
    catering: {
      getrankeAufTischen: { 
        required: false, 
        prompt: "Nun zu Ihren Catering-Wünschen in der OsnabrückHalle. Unsere beiden Catering-Partner Food et Event (bio-zertifiziert) und Wißmann bieten verschiedene Optionen an. Sollen Getränke (Wasser, Säfte, etc.) vorab auf den Tischen für die Teilnehmer bereitgestellt werden? Dies ist vor allem bei Tagungen üblich. (Bitte mit 'ja' oder 'nein' antworten)" 
      },
      begrussungskaffee: { 
        required: false, 
        prompt: "Ein Begrüßungskaffee mit kleinen Snacks kann den Start Ihrer Veranstaltung angenehmer gestalten. Typischerweise wird dieser 30 Minuten vor Veranstaltungsbeginn angeboten und umfasst Kaffee, Tee, Wasser und kleine Gebäckstücke. Wünschen Sie einen Begrüßungskaffee? (ja/nein)" 
      },
      mittagessen: { 
        required: false, 
        prompt: "Bei ganztägigen Veranstaltungen in der OsnabrückHalle empfehlen wir ein Mittagessen. Dies kann als Buffet, Menü oder als Fingerfood serviert werden. Preislich beginnt dies bei etwa 25€ pro Person für ein einfaches Büffet. Soll ein Mittagessen angeboten werden? (ja/nein)" 
      },
      nachmittagspause: { 
        required: false, 
        prompt: "Eine Nachmittagspause mit Kaffee, Tee und kleinen Snacks wie Kuchen oder Obst hilft, die Konzentration der Teilnehmer zu erhalten. Unsere Caterer können verschiedene Varianten anbieten. Wünschen Sie eine Nachmittagspause mit Verpflegung? (ja/nein)" 
      },
      abendessen: { 
        required: false, 
        prompt: "Ein Abendessen kann Ihre Veranstaltung in der OsnabrückHalle angenehm abrunden. Möglich sind z.B. ein festliches Dinner, ein Buffet oder ein Stehempfang mit Fingerfood. Soll ein Abendessen angeboten werden? (ja/nein)" 
      },
      getrankeWahrend: { 
        required: false, 
        prompt: "Sollen während der gesamten Veranstaltung Getränke wie Wasser, Säfte, Softdrinks, Kaffee oder auch alkoholische Getränke angeboten werden? Dies kann pauschal oder nach Verbrauch abgerechnet werden. (ja/nein)" 
      },
      sonstiges: { 
        required: false, 
        prompt: "Unsere Catering-Partner können auf verschiedene Ernährungsformen eingehen. Haben Sie weitere spezielle Catering-Wünsche, wie vegetarische/vegane Optionen, Allergikeranforderungen oder besondere Getränkewünsche? Falls nicht, antworten Sie bitte mit 'Keine'." 
      },
      budgetProPerson: { 
        required: true, 
        prompt: "Um ein passendes Catering-Angebot für Ihre Veranstaltung in der OsnabrückHalle zu erstellen, benötigen wir Ihr Budget pro Person. Als Orientierung: Ein einfaches Catering mit Getränken und Snacks beginnt bei ca. 20-30€ pro Person, ein vollständiges Catering mit Mahlzeiten liegt typischerweise bei 50-80€ pro Person. Wie hoch ist Ihr Catering-Budget pro Person? (netto in €)" 
      },
    },
    bestuhlung: { 
      required: true, 
      prompt: "Die richtige Bestuhlung ist entscheidend für die Atmosphäre und den Erfolg Ihrer Veranstaltung in der OsnabrückHalle. Hier die Optionen:\n\n- Reihe: Wie im Kino, ideal für Vorträge und Präsentationen\n- Parlamentarisch: Tische und Stühle in Reihen, gut für Tagungen mit Notizenmöglichkeit\n- Bankett Tafel: Lange Tische, traditionell für festliche Dinner\n- Bankett Runde Tische: Gesellig für Feste und Networking\n- Sonstige: Haben Sie spezielle Wünsche?\n\nWelche Bestuhlung wünschen Sie für Ihre Veranstaltung?",
      options: ["Reihe", "Parlamentarisch", "Bankett Tafel", "Bankett Runde Tische", "Sonstige"]
    },
    veranstalter: {
      firma: { 
        required: true, 
        prompt: "Jetzt benötigen wir noch einige Angaben zu Ihnen als Veranstalter. Diese Informationen erscheinen auf dem Angebot und der späteren Rechnung für Ihre Veranstaltung in der OsnabrückHalle. Wie lautet der Name Ihrer Firma oder Organisation?" 
      },
      vorname: { 
        required: true, 
        prompt: "Wie lautet Ihr Vorname? Diese Information wird für die persönliche Ansprache in unserer Kommunikation verwendet." 
      },
      nachname: { 
        required: true, 
        prompt: "Wie lautet Ihr Nachname? Dies wird für die formelle Ansprache in Angeboten und Verträgen für die Veranstaltung in der OsnabrückHalle benötigt." 
      },
      strasse: { 
        required: true, 
        prompt: "Wie lautet Ihre Straße und Hausnummer? Diese Information wird für die Rechnungsstellung benötigt." 
      },
      plz: { 
        required: true, 
        prompt: "Wie lautet Ihre Postleitzahl? Dies wird für die korrekte Zustellung von Angeboten und Rechnungen benötigt." 
      },
      ort: { 
        required: true, 
        prompt: "In welchem Ort oder welcher Stadt befindet sich Ihr Firmensitz? Dies vervollständigt Ihre Adresse für die Rechnungsstellung." 
      },
      telefon: { 
        required: true, 
        prompt: "Unter welcher Telefonnummer kann das Team der OsnabrückHalle Sie bei Rückfragen erreichen? Bitte geben Sie eine Nummer an, unter der Sie gut erreichbar sind." 
      },
      email: { 
        required: true, 
        prompt: "Wie lautet Ihre E-Mail-Adresse? An diese Adresse senden wir die Bestätigung Ihrer Anfrage und später das Angebot für Ihre Veranstaltung in der OsnabrückHalle." 
      },
    }
  };
  
  module.exports = inquirySchema;