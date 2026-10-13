# LLR-Raumplaner 2D

2D-Raumplaner (Draufsicht) für den **Lehr-Lern-Raum Inklusion (LLR)** am ZLSB.
Tische, Stühle und weitere Einrichtung lassen sich frei verschieben und drehen,
die Sitzordnungen aus der *Handreichung zur Anordnung der Tische* sind als Vorlagen
hinterlegt, und ein Rollstuhl-Check zeigt, wo ein Rollstuhl durchpasst.

Die App ist eine reine statische Webseite (HTML, CSS, JavaScript ohne Build-Schritt
und ohne externe Bibliotheken) und läuft direkt auf **GitHub Pages**, am Computer,
Tablet und Smartphone.

## Funktionen

### Oberfläche

- **Kopfzeile**: Planname, Rückgängig/Wiederholen, ein **Datei-Menü** (Neu, Pläne,
  Bild, Drucken, Umbau- und Sitzplan drucken, Raum & Einstellungen) sowie „Teilen“.
- **Links** eine Reiterleiste: *Möbel* (mit Suche, aufklappbaren Gruppen),
  *Anordnungen*, *Lernende*, *Phasen* und *Im Raum*. Den aktiven Reiter erneut
  antippen klappt die Bibliothek ein.
- **Rechts** „Details | Prüfen“: Mit Auswahl stehen die Details des Objekts vorn –
  samt seinen Prüfergebnissen –, ohne Auswahl Raum und Belegung bzw. die Prüfungen.
- **Im Plan** oben die Werkzeuge, die vier Prüfansichten (Rollstuhl, Sicht,
  Lehrkraft, Ruhe – immer eine zur Zeit) und ein Menü *Ansicht* für Abstände,
  Raummaße, Raster und Einrasten. Bei mehreren Phasen oben rechts ein Umschalter.

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
- **Möbelkatalog** mit Bestandszählern laut Handreichung (12 Dreieckstische,
  19 Stühle, 2 Hocker, Sofa-Elemente …) – Überschreitungen werden markiert.
  Dazu Rechtecktische, Teppiche, Zonen, freie Objekte, Textnotizen und
  **Lehrkraft-Positionen** für den Lehrkraft-Check.
- **Alle 13 Anordnungen der Handreichung** als Vorlagen – in der aktuellen Phase
  übernehmen oder als neue Unterrichtsphase anlegen.
- **Freies Einrichten**: Ziehen, Drehen (15°-Raster, Umschalt = frei), Größe ändern,
  Duplizieren, Sperren, Mehrfachauswahl, magnetisches Einrasten (Tischkanten,
  Trennwände, Stühle zum Tisch), angestellte Stühle wandern mit, Doppelklick wählt die
  ganze Tischgruppe.

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
