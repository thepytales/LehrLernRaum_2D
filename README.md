# LLR-Raumplaner 2D

2D-Raumplaner (Draufsicht) für den **Lehr-Lern-Raum Inklusion (LLR)** am ZLSB.
Tische, Stühle und weitere Einrichtung lassen sich frei verschieben und drehen,
die Sitzordnungen aus der *Handreichung zur Anordnung der Tische* sind als Vorlagen
hinterlegt, und ein Rollstuhl-Check zeigt, wo ein Rollstuhl durchpasst.

Die App ist eine reine statische Webseite (HTML, CSS, JavaScript ohne Build-Schritt
und ohne externe Bibliotheken) und läuft direkt auf **GitHub Pages**, am Computer,
Tablet und Smartphone.

## Funktionen

- **Raum** in Draufsicht: 6,30 m × 8,00 m (≈ 50 m², Tafel an der kürzeren Seite),
  Maße unter *Raum & Einstellungen* anpassbar. Grundausstattung nach der Room-Tour:
  interaktive Tafel mit Tafelflügeln, Lehrertisch mit PC, Tür, Fenster mit Heizkörpern,
  Schränke mit Wandbildschirm, Ablageturm, Sofa-Ecke mit Teppich und Sitzsäcken,
  halbrunde Bücherregale, mobile Trennwand, Regale, Tablet-Wand.
- **Möbelkatalog** mit Bestandszählern laut Handreichung (12 Dreieckstische,
  19 Stühle, 2 Hocker, Sofa-Elemente …) – Überschreitungen werden markiert.
- **Alle 13 Anordnungen der Handreichung** als Vorlagen (Seminarsitzordnung I–III,
  Gesprächskreis, Stern, schmale/kompakte Tafel, U-Form, Oval, Hexagon & Dreieck,
  großer Gruppentisch, Zweiertische, Einzelarbeitsplätze), danach frei anpassbar.
- **Freies Einrichten**: Ziehen, Drehen (15°-Raster, Umschalt = frei), Duplizieren,
  Sperren, Mehrfachauswahl, Beschriftungen (z. B. Namen für einen Sitzplan),
  freie Objekte und Textnotizen.
- **Magnetisches Einrasten**: Dreieckstische rasten Kante an Kante an,
  angestellte Stühle wandern mit dem Tisch mit, Stühle drehen sich zum Tisch.
  Doppelklick/Doppeltipp auf einen Tisch wählt die ganze Tischgruppe.
- **Rollstuhl-Check** (vereinfacht nach DIN 18040-1): befahrbare Flächen ab der Tür
  (Durchgang ≥ 90 cm), Flächen zum Wenden (Ø 150 cm), zu enge Bereiche,
  Rollstuhlplätze an Tischkanten. Zusätzlich ein Rollstuhl als Prüfobjekt
  (70 × 120 cm, mit Wendekreis), der rot wird, sobald er aneckt.
- **Abstände & Messen**: Abstände des gewählten Objekts zu den Nachbarn
  (grün ≥ 90 cm) und ein Messwerkzeug, das an Kanten einrastet.
- **Sicht-Check**: zeigt je Sitzplatz, ob Tafel, Wandbildschirm oder Beamer-Fläche
  direkt, seitlich oder gar nicht im Blick sind (Regale/Trennwände verdecken).
- **Speichern & Teilen**: automatische Sicherung im Browser, mehrere Pläne,
  Export/Import als `.json`, Teilen-Link (der Plan steckt komplett im Link),
  PNG-Export und Druckansicht (A4, auch als PDF).
- **Bedienung** mit Maus, Touch (Ziehen, Pinch-Zoom) und Tastatur.

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
| Rollstuhl-, Sicht- und Kollisionsprüfung | `js/analysis.js` |

## Annahmen

- Die Dreieckstische sind rechtwinklig-gleichschenklig mit 120 cm langer Seite und
  60 cm Tiefe (zwei Tische ergeben ein Quadrat, vier ein großes Quadrat, acht den Stern).
- Die Raummaße (6,30 × 8,00 m) und die Positionen der festen Einrichtung sind aus
  Fotos geschätzt. Bitte vor Ort nachmessen und in den Einstellungen anpassen.
- Der Rollstuhl-Check ist ein vereinfachtes Modell und ersetzt keine fachliche Prüfung.
