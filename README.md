# LLR-Raumplaner 2D

2D-Raumplaner (Draufsicht) für den **Lehr-Lern-Raum Inklusion (LLR)** am ZLSB.
Tische, Stühle und weitere Einrichtung lassen sich frei verschieben und drehen,
die Sitzordnungen aus der *Handreichung zur Anordnung der Tische* sind als Vorlagen
hinterlegt, und ein Rollstuhl-Check zeigt, wo ein Rollstuhl durchpasst.

Die App ist eine reine statische Webseite (HTML, CSS, JavaScript ohne Build-Schritt
und ohne externe Bibliotheken) und läuft direkt auf **GitHub Pages**, am Computer,
Tablet und Smartphone.

## Funktionen

### Einfach oder Profi

Oben rechts lässt sich die Ansicht umschalten (am Smartphone im Menü „…“):

| | Einfach | Profi |
| --- | --- | --- |
| Für wen | Gelegenheitsnutzung, schnelle Sitzordnung | genaue Planung, Unterrichtsentwurf, Forschung |
| Prüfungen | als Fragen mit Antwort in Alltagssprache und „Was hilft?“ – z. B. *Sehen alle die Tafel?* | Fachbegriffe mit Zahlen, Legende, Annahmen, Prüfregeln |
| Abstände am Objekt | nur Engstellen („88 cm – zu eng für Rollstuhl“) | alle Abstände in cm |
| Auswahlleiste | große Knöpfe mit Beschriftung (Drehen 90°, Kopie, Stühle, Löschen, Mehr) | kompakte Symbole mit ±15°, Ausrichten, Mitnehmen, Sperren |
| Werkzeuge | Auswählen und die vier Prüfansichten | zusätzlich Mehrfachauswahl, Messen, Menü *Ansicht* (Raster, Einrasten) |
| Katalog | Bausteine, Tische, Sitzplätze, Lounge, Möbel, Zonen | zusätzlich Raum & Technik, freie und eigene Möbel, Maßlinie |
| Einstellungen | Raum, Bedienung, Darstellung | zusätzlich Prüfregeln und Möbelmaße |

Neue Nutzerinnen und Nutzer starten in *Einfach*, wer den Planer schon kannte, in
*Profi* (dort ist alles wie bisher). Die Wahl gilt je Browser.

### Oberfläche

- **Startauswahl „Was möchten Sie tun?“** beim ersten Besuch (und auf Wunsch bei jedem
  Start, sonst über *Datei*): Stunde planen, Sitzplan für meine Klasse, Raum für eine
  Person im Rollstuhl prüfen, Stunde mit mehreren Phasen, frei einrichten.
- **Kopfzeile**: Planname, Rückgängig/Wiederholen, Umschalter *Einfach | Profi*, ein
  **Datei-Menü** (Startauswahl, Assistent, Neu, Pläne, Drucken & Exportieren, Raum &
  Einstellungen, Darstellung & Barrierefreiheit; in Profi zusätzlich Prüfregeln, eigene
  Möbel & Räume, Befehlssuche, Verlauf, Tastenkürzel) sowie „Teilen“.
- **Links** eine Reiterleiste: *Möbel* (mit Suche, fertigen Bausteinen, aufklappbaren
  Gruppen), *Anordnungen* (Filter nach Sozialform, eigene Vorlagen), *Lernende*,
  *Phasen* und *Im Raum* (Profi). Den aktiven Reiter erneut antippen klappt die
  Bibliothek ein.
- **Rechts** „Details | Prüfen“: Mit Auswahl stehen die Details des Objekts vorn –
  samt seinen Prüfergebnissen –, ohne Auswahl Raum und Belegung bzw. die Prüfungen.
- **Im Plan** oben die Werkzeuge, die vier Prüfansichten (Rollstuhl, Sicht,
  Lehrkraft, Ruhe – immer eine zur Zeit) und ein Menü *Ansicht* für Abstände,
  Raummaße, Raster und Einrasten. Bei mehreren Phasen oben rechts ein Umschalter.
- **Kontextmenü**: Rechtsklick (ohne zu ziehen), langes Drücken am Tablet oder
  Umschalt+F10 – mit Drehen um 90°/180°, Kopie, Stühle anstellen/wegnehmen, ganze
  Gruppe wählen, Ausrichten, Sperren, Löschen; auf freier Fläche „Hier einfügen“.
- Kurze **Tipps im richtigen Moment** (z. B. beim ersten ausgewählten Tisch), jeder
  nur einmal.

### Assistent „Stunde planen“

In vier Schritten zur fertigen Sitzordnung: Anzahl der Lernenden und Sozialform
(Einzel-, Partner-, Gruppenarbeit, Gesprächskreis, Plenum) → passende Anordnungen mit
Platzzahl (bei mehreren Phasen in der Reihenfolge antippen) → optional Namen und
Bedarfe → Plätze werden automatisch verteilt, die Prüfungen als Fragen beantwortet und
die passenden Ausdrucke angeboten. Alles zusammen ist ein Schritt im Verlauf.

### Raum und Möbel

- **Raum** in Draufsicht: 6,30 m × 8,00 m (≈ 50 m², Tafel an der kürzeren Seite).
  Die Raumgröße lässt sich im Plan ändern (an einer Wand oder an den blauen Griffen
  ziehen, Möbel an der Wand wandern mit) oder als Maß eintippen. Grundausstattung nach
  der Room-Tour: interaktive Tafel mit Tafelflügeln, Lehrertisch mit PC, Tür, Fenster
  mit Heizkörpern, Schränke mit Wandbildschirm, Ablageturm, Sofa-Ecke mit Teppich und
  Sitzsäcken, halbrunde Bücherregale, mobile Trennwand, Regale, Tablet-Wand.
- **Möbelgrafiken** nach den Fotos der Handreichung: Buche-Tischplatten mit Maserung,
  Schalenstühle (orange-rot/grün) mit Griffloch auf Kufengestell, dunkelblaue
  Wackelhocker, Ledersofas, Regale in Buche – mit weichem Schatten (Licht von links oben).
- **Fertige Bausteine** oben im Katalog, mit einem Zug eingefügt: Einzeltisch,
  Partnertisch (nebeneinander/gegenüber), Gruppentische für 4, 5, 6 und 8,
  Rollstuhlplatz am Tisch, Rückzugsplatz mit Trennwand. Der Baustein sucht sich einen
  freien Platz und bleibt ausgewählt, damit er gleich verschoben werden kann.
- **Möbelkatalog** mit Bestandszählern laut Handreichung (12 Dreieckstische,
  19 Stühle, 2 Hocker, Sofa-Elemente …) – Überschreitungen werden markiert.
  Gruppen: Tische, Sitzplätze, Zum Prüfen, Lounge, Möbel & Stauraum, Zonen & Notizen,
  in Profi auch Raum & Technik (mit **Wandstück** und **Säule** für Nischen, Vorsprünge
  und L-förmige Räume), freie und eigene Möbel.
  Dazu Rechtecktische, Teppiche, Zonen, freie Objekte, Textnotizen und
  **Lehrkraft-Positionen** für den Lehrkraft-Check.
- **Alle 13 Anordnungen der Handreichung** als Vorlagen – in der aktuellen Phase
  übernehmen oder als neue Unterrichtsphase anlegen.
- **Freies Einrichten**: Ziehen, Drehen (15°-Raster, Umschalt = frei, 90° per Knopf
  oder Taste 9), Größe ändern, Duplizieren, Sperren, Mehrfachauswahl, magnetisches
  Einrasten (Tischkanten, Trennwände, Stühle zum Tisch), angestellte Stühle wandern mit,
  Doppelklick wählt die ganze Tischgruppe. **Stühle anstellen**: an jede freie
  Tischkante ab 70 cm kommt ein Stuhl (ab 150 cm zwei), sofern dort Platz ist.
- **Genaues Arbeiten (Profi)**: Ausrichten (links, Mitte, rechts, oben, Mitte, unten –
  bei einer einzelnen Gruppe am Raum), gleichmäßig verteilen, mit festem Abstand in cm
  aneinanderreihen, spiegeln, Lage der Auswahl als Zahl. Tischgruppen zählen dabei
  samt Stühlen als eine Einheit. Gemessene Strecken lassen sich als **Maßlinie**
  behalten (wird mitgedruckt).

### Lernende & Sitzplan

- Namen oder Kürzel einzeln oder als Liste einfügen; je Person **Bedarfe** (Hören,
  Sehen, Rollstuhl, Ruhe, Bewegung, Unterstützung, kurzer Weg zur Tür) und
  **Sitzwünsche** („sitzt gern neben“, „nicht neben“).
- Plätze zuweisen: Person antippen und dann einen Platz, am Computer auch per
  Ziehen – oder **automatisch verteilen** (Personen mit Bedarfen zuerst auf passende
  Plätze, danach Verbesserung durch Tauschen).
- Prüfung je Person mit Begründung, z. B. *Hören*: nah an Tafel und Lehrkraft,
  Gesicht der Lehrkraft im Blick, eher ruhig. Für Rollstuhl-Bedarf lässt sich ein
  Rollstuhlplatz an einer erreichbaren Tischkante einrichten.
- Sitzplan drucken. Die Liste bleibt im Browser; beim Teilen per Link wird sie nur
  auf ausdrücklichen Wunsch mitgeschickt.

### Unterrichtsphasen & Umbau

- Mehrere Anordnungen als **Phasen** einer Stunde (z. B. Stuhlkreis → Gruppenarbeit →
  Präsentation); Raum, Lernende und Einstellungen gelten für alle.
- **Animierter Übergang** beim Wechseln: erst Tische und große Möbel, dann Stühle.
- **Umbauaufwand** je Phase (bewegte Tische/Stühle, Wege, grobe Zeitschätzung) und
  ein **Umbauplan** im Plan und zum Drucken – mit nummerierter Reihenfolge, früheren
  Positionen sowie neu hinzustellenden und wegzuräumenden Möbeln. Bei „Phase aus
  Anordnung“ wandert jedes Möbelstück zur nächstgelegenen neuen Position.

### Prüfungen (je eine Ansicht im Plan)

- **Rollstuhl-Check** (vereinfacht nach DIN 18040-1): befahrbare Flächen ab der Tür
  (Durchgang ≥ 90 cm), Flächen zum Wenden (Ø 150 cm), zu enge Bereiche,
  Rollstuhlplätze an Tischkanten mit geprüftem Weg; Test-Rollstuhl mit Wendekreis.
- **Sicht** auf Tafel, Wandbildschirm und Beamer-Fläche je Sitzplatz – direkt, nur
  mit gedrehtem Kopf, durch Personen eingeschränkt oder gar nicht; Sichtkegel am
  angetippten Platz.
- **Lehrkraft-Check**: Kommt die Lehrkraft an jeden Platz, um zu helfen (bequemer
  Durchgang ≥ 50 cm, Engstellen ab 36 cm, notfalls über den Tisch)? Sieht sie das
  Gesicht, nur das Profil oder den Rücken? Reichweite als Fläche im Plan, Weg zum
  angetippten Platz. Ohne eigene Lehrkraft-Position wird ein Standort vor der Tafel
  angenommen; mehrere Positionen (Doppelbesetzung, Schulbegleitung) sind möglich.
- **Reiz- & Ruhe-Check**: Punkte für Nähe zur Tür und zur Lounge, Laufwege anderer
  am Platz vorbei, viele Nachbarplätze, Blick aus dem Fenster und **Spiegelungen des
  Fensters** auf Tafel und Bildschirmen. Regale und Trennwände dämpfen, Zonen namens
  „Ruhezone“ oder „Rückzug“ gelten als ruhiger. Störquellen und Laufwege erscheinen
  im Plan, am angetippten Platz die Gründe.
- **Sitzplan & Bedarfe** und **Umbau** (bei Phasen) als weitere Ansichten.
- Überschneidungen und Möbel außerhalb des Raums werden immer markiert.

### Prüfregeln & Profile (Profi)

Alle Grenzwerte und Gewichte der Prüfungen sind einstellbar (*Raum & Einstellungen →
Prüfregeln*): Durchgang und Wendekreis, Gehwege und Engstellen, weiter Weg der
Lehrkraft, Blickwinkel für Gesicht/Profil, Winkel und Personen-Grenze beim Sicht-Check,
alle Punkte und Schwellen im Ruhe-Check, Entfernungen für die Bedarfe Hören, Sehen und
Ausgang, Höchstzahl an Arbeitsplätzen. Profile setzen mehrere Werte auf einmal:
*Standard (LLR)*, *Streng: mehr Bewegungsfläche*, *Reizarm*, *Hören & Sehen*,
*Grundschule* – eigene Profile lassen sich speichern. Die Regeln gehören zum Plan und
reisen beim Teilen mit; die Prüfkarten nennen die verwendeten Werte.

### Eigene Vorlagen, Möbel und Räume

- **Eigene Anordnungen**: Tische und Sitzplätze (alle oder nur die Auswahl) als Vorlage
  speichern – mit Name, Notiz und Sozialform. Sie erscheinen unter *Anordnungen*, im
  Assistenten und bei neuen Phasen; in einem anderen Raum werden sie mittig gestellt.
- **Eigene Möbel** (Profi): Name, eckig oder rund, Maße, Farbe, „steht im Weg“ und
  „verdeckt die Sicht“. Sie stehen im Katalog und reisen mit jedem Plan mit (auch im
  Teilen-Link), sodass andere sie ohne eigene Bibliothek sehen.
- **Eigene Räume** (Profi): Raummaße und feste Einrichtung speichern; *Neuer Plan*
  bietet außerdem ein Klassenzimmer, einen breiten Seminarraum, einen kleinen
  Gruppenraum und einen leeren Raum mit frei wählbaren Maßen.
- **Bibliothek teilen**: alle eigenen Möbel, Räume, Anordnungen und Prüfprofile als eine
  Datei exportieren und bei Kolleginnen und Kollegen importieren.

### Drucken: Für wen?

*Datei → Drucken & Exportieren* fragt zuerst nach dem Zweck:

- **Aushang für die Klasse** – Sitzplan mit großen Namen, ohne Bedarfe.
- **Sitzplan für mich (vertraulich)** – mit Bedarfen und Prüfergebnis je Person.
- **Umbaukarte für das Umbau-Team** – Reihenfolge, Wege und Zeitbedarf, auf Wunsch für
  alle Übergänge (je eine Seite); ohne Phasen als Aufbau aus der Grundaufstellung.
- **Für den Unterrichtsentwurf** – Plan mit Belegung und Prüfergebnissen, auf Wunsch
  alle Phasen, eine Prüfansicht im Plan und eine Notiz bzw. Begründung.
- **Bild (PNG)** sowie **Link oder Datei** zum Weiterbearbeiten.

### Befehlssuche und Tastatur

- **Strg+K** öffnet die Befehlssuche: alle Aktionen, Möbel, Bausteine und Anordnungen
  nach Stichwort (z. B. „ausrichten“, „Sicht“, „Stuhl“), zuletzt benutzte oben.
- **?** zeigt alle Tastenkürzel, *Datei → Verlauf* alle Schritte mit Beschreibung
  (ein Klick springt dorthin zurück).
- Neu u. a.: **9** / Umschalt+9 um 90° drehen, **1–6** Prüfansichten, **N** /
  Umschalt+N nächstes/voriges Objekt, **Strg+G** ganze Gruppe, **Strg+S** im Browser
  speichern, **Strg+Umschalt+Pfeil** ausrichten, **Umschalt+H/V** spiegeln,
  **G** Raster, **Bild↑/↓** Phase wechseln, **Eingabe** Messung als Maßlinie behalten.

### Darstellung & Barrierefreiheit

Unter *Datei → Darstellung & Barrierefreiheit* (gilt sofort und je Browser):

- **Kontrast**: wie das System, normal, **hoher Kontrast** (Schwarz auf Weiß, kräftige
  Rahmen, schlichter Boden, schwarz-gelbe Auswahl, größere Marken) oder **dunkle
  Oberfläche** (der Plan bleibt hell).
- **Schriftgröße** der Bedienung: 100 %, 115 % oder 130 % – Marken und Etiketten im Plan
  wachsen mit.
- **Große Schaltflächen** (mindestens 44 × 44 Pixel), **Bewegungen reduzieren** (folgt
  sonst der Systemeinstellung), **Farben bei Farbsehschwäche** (Blau, Orange, Weinrot –
  die Symbole ✓ ! ✕ bleiben, auch in den Statuspunkten), **deutlicher Fokusrahmen**.
- Bildschirmleser: Auswahl, Rückgängig und Ansichtswechsel werden angesagt,
  Prüfergebnisse haben eine Textfassung, Objekte lassen sich mit N der Reihe nach
  auswählen. Automatisch geprüft mit axe-core (WCAG 2.1 AA) in allen Darstellungen und
  Dialogen – ersetzt keinen Test mit Menschen, die darauf angewiesen sind.

### Speichern & Teilen

- Automatische Sicherung im Browser, mehrere Pläne, Export/Import als `.json`,
  Teilen-Link (der Plan steckt komplett im Link, auch mit allen Phasen),
  PNG-Export und Druckansichten (Plan, Umbauplan, Sitzplan; A4, auch als PDF).
- Bedienung mit Maus, Touch (Ziehen, Pinch-Zoom) und Tastatur. Auf dem Tablet
  erscheinen die Seitenleisten als Schubladen, auf dem Smartphone „Details/Prüfen“
  als Blatt von unten.

## Auf GitHub Pages veröffentlichen

1. Den Inhalt dieses Branches nach `main` mergen (oder in den Pages-Einstellungen
   direkt diesen Branch wählen).
2. Im Repository auf **Settings → Pages** gehen.
3. Unter *Build and deployment* bei **Source** „Deploy from a branch“ wählen,
   dann Branch `main` und Ordner `/ (root)` einstellen und speichern.
4. Nach ein bis zwei Minuten ist der Planer unter
   `https://<benutzername>.github.io/<repository>/` erreichbar.

Die Datei `.nojekyll` sorgt dafür, dass GitHub die Dateien unverändert ausliefert.

## Lokal starten

Einfach `index.html` im Browser öffnen – oder für exakt dieselben Bedingungen wie
auf GitHub Pages einen kleinen Webserver starten:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

## Anpassen

| Was | Wo |
| --- | --- |
| Raummaße, Tisch-/Stuhlmaße, Durchgangsbreite, Wendekreis | in der App unter *Raum & Einstellungen* |
| Grundausstattung des Raums (Positionen) | `js/presets.js` → `LLR.roomFurniture` |
| Tischanordnungen | `js/presets.js` → `LLR.PRESETS` |
| Möbeltypen, Maße, Bestand, Grafiken | `js/catalog.js` |
| Rollstuhl-, Sicht-, Lehrkraft-, Ruhe- und Kollisionsprüfung, Bedarfe, Umbau | `js/analysis.js` |
| Darstellung der Prüfansichten im Plan | `js/lenses.js` |
| Lernende, Sitzplan und Phasen (Oberfläche) | `js/ui-class.js` |
| Prüfregeln und Prüfprofile | `js/analysis.js` → `A.RULES`, `A.PROFILES` |
| Bausteine, Sozialformen, Beispielräume | `js/presets.js` → `LLR.BLOCKS`, `LLR.FORMS`, `LLR.ROOMS` |
| Ausrichten, Verteilen, Spiegeln, Stühle anstellen | `js/precision.js` |
| Startauswahl, Assistent, Drucken „Für wen?“, Tipps | `js/assist.js` |
| Befehlssuche, Tastenkürzel, Verlauf, Kontextmenü | `js/commands.js` |
| Eigene Vorlagen, Möbel, Räume und Profile | `js/custom.js` |
| Einfach/Profi und Darstellung (Kontrast, Schrift …) | `js/boot.js`, Farben in `css/style.css` (`:root`) |

## Annahmen

- Die Dreieckstische sind rechtwinklig-gleichschenklig mit 120 cm langer Seite und
  60 cm Tiefe (zwei Tische ergeben ein Quadrat, vier ein großes Quadrat, acht den Stern).
- Die Raummaße (6,30 × 8,00 m) und die Positionen der festen Einrichtung sind aus
  Fotos geschätzt. Bitte vor Ort nachmessen und in den Einstellungen anpassen.
- Der Rollstuhl-Check ist ein vereinfachtes Modell und ersetzt keine fachliche Prüfung.
- Sicht-Check: Eine sitzende Person wird als Kopf von ca. 32 cm Breite angenommen
  (Augenhöhe sitzend 1,20 m, Kopfoberkante 1,35 m, Präsentationsfläche 0,90–2,00 m).
  Je näher eine Person am eigenen Platz sitzt, desto mehr der Fläche verdeckt sie.
  Ab 25 % verdeckter Fläche gilt die Sicht als eingeschränkt. Die Annahme lässt sich
  im Abschnitt „Sicht“ abschalten; die Werte stehen in `js/analysis.js`.
- Lehrkraft-Check und Laufwege: Eine gehende Person braucht bequem 50 cm (in den
  Einstellungen änderbar), seitlich durchschieben geht ab 36 cm. Stühle zählen mit
  ihrer Sitzfläche, weil man sie beim Vorbeigehen etwas heranrücken kann. Blickkontakt:
  bis 60° zwischen Blickrichtung des Platzes und Lehrkraft = Gesicht, bis 110° = Profil.
- Reiz- & Ruhe-Check: Punktwerte (Tür bis 30, Lounge 20, Laufwege 25, Nachbarplätze 15,
  Fensterblick 10, Spiegelung 10, Ruhezone −20); unter 25 Punkten ruhig, ab 50 unruhig.
  Ein Hilfsmittel zum Vergleichen von Anordnungen, keine Diagnose.
- Umbauzeit: grob je Tisch 15 s, je Stuhl 6 s, Sofa 45 s, dazu der Weg (0,8 m/s).
- Alle genannten Grenzwerte und Punkte sind die Standardwerte; in der Profi-Ansicht
  lassen sie sich unter *Prüfregeln* ändern.
