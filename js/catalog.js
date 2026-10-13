/* Möbelkatalog: Maße, Kollisionsformen und Draufsicht-Grafiken.
   Lokales Koordinatensystem: Ursprung = Objektmitte, Vorderseite = -y, Rückseite = +y.
   Wandobjekte (wall: true): Ursprung liegt auf der Wandlinie, der Raum liegt bei -y.
   Farben und Formen nach den Fotos der Handreichung: Buche-Tischplatten,
   Schalenstühle (orange-rot / hellgrün) mit Griffloch auf grauem Kufengestell,
   dunkelblaue Wackelhocker, schwarze Ledersofas, Regale in Buche. */
(function (LLR) {
  'use strict';
  const G = LLR.G;

  const f = (v) => Math.round(v * 100) / 100;
  const rectEl = (x, y, w, h, attrs) =>
    `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" ${attrs || ''}/>`;
  const circ = (cx, cy, r, attrs) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${attrs || ''}/>`;
  const ell = (cx, cy, rx, ry, attrs) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" ${attrs || ''}/>`;
  const line = (x1, y1, x2, y2, attrs) =>
    `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" ${attrs || ''}/>`;
  const path = (d, attrs) => `<path d="${d}" ${attrs || ''}/>`;
  const pt = (p) => `${f(p.x)} ${f(p.y)}`;
  /* Glanzlicht über einer Form (gleiche Geometrie, halbtransparente Füllung) */
  const SHEEN = 'fill="url(#f-sheen)"';
  const DISH = 'fill="url(#f-dish)"';

  const COLORS = {
    wood: '#E8C793',
    woodDark: '#A97E48',
    woodEdge: '#B98F59',
    ink: '#37352F',
    frame: '#A7AEB5',
    frameDark: '#6F767E',
  };

  /* Verläufe für die Möbel. Sie liegen in den <defs> des Plans und gelten
     dokumentweit, also auch für die Vorschaubilder im Katalog. */
  LLR.FURN_DEFS =
    '<linearGradient id="f-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3DBB0"/><stop offset="0.55" stop-color="#EACB98"/><stop offset="1" stop-color="#DDB57C"/></linearGradient>' +
    '<linearGradient id="f-wood2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EBCB96"/><stop offset="1" stop-color="#CDA166"/></linearGradient>' +
    '<radialGradient id="f-sheen" cx="0.34" cy="0.28" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="f-dish" cx="0.5" cy="0.45" r="0.62"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></radialGradient>' +
    '<linearGradient id="f-leather" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#4A4E55"/><stop offset="1" stop-color="#2A2C31"/></linearGradient>' +
    '<linearGradient id="f-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E1E5E9"/><stop offset="1" stop-color="#A3AAB2"/></linearGradient>' +
    '<linearGradient id="f-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F1F9FF"/><stop offset="1" stop-color="#B7DAF5"/></linearGradient>' +
    '<linearGradient id="f-screen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2F6DB0"/><stop offset="0.45" stop-color="#4C8FD6"/><stop offset="1" stop-color="#1D4A80"/></linearGradient>' +
    '<linearGradient id="f-panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A62C9"/><stop offset="1" stop-color="#1C3C93"/></linearGradient>' +
    '<linearGradient id="f-dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3E4146"/><stop offset="1" stop-color="#25272B"/></linearGradient>' +
    '<linearGradient id="f-red" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E85A55"/><stop offset="1" stop-color="#B9302C"/></linearGradient>' +
    '<radialGradient id="f-lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFFBE6"/><stop offset="0.45" stop-color="#F8DC7A"/><stop offset="1" stop-color="#C79A22"/></radialGradient>' +
    '<radialGradient id="f-seat-blue" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#4F72D0"/><stop offset="1" stop-color="#22408F"/></radialGradient>';

  const CHAIR_COLORS = {
    rot: { seat: '#EC6A40', back: '#CF4D2C', edge: '#9C3517', label: 'Rot' },
    gruen: { seat: '#94CC46', back: '#72A92E', edge: '#4E7C1B', label: 'Grün' },
  };
  const BEANBAG_COLORS = {
    gruen: { fill: '#8CC63F', dark: '#5E8F22', label: 'Grün' },
    gelb: { fill: '#F6C343', dark: '#C6901A', label: 'Gelb' },
    orange: { fill: '#F28C28', dark: '#BC5F0E', label: 'Orange' },
  };
  const FREE_COLORS = {
    grau: { fill: '#CFD4DA', label: 'Grau' },
    blau: { fill: '#9EC5FE', label: 'Blau' },
    gruen: { fill: '#A3CFBB', label: 'Grün' },
    gelb: { fill: '#FFE69C', label: 'Gelb' },
    rot: { fill: '#F1AEB5', label: 'Rot' },
    holz: { fill: COLORS.wood, label: 'Holz' },
  };
  const RUG_COLORS = {
    beige: { fill: '#D8B794', line: '#8C6A4F', label: 'Beige' },
    grau: { fill: '#B9C0C7', line: '#6C757D', label: 'Grau' },
    blau: { fill: '#9BBEE6', line: '#3B6EA8', label: 'Blau' },
    gruen: { fill: '#A9D3AC', line: '#4F8A5B', label: 'Grün' },
    rot: { fill: '#E9AFAF', line: '#A94442', label: 'Rot' },
  };
  const ZONE_COLORS = {
    blau: { fill: '#4DABF7', ink: '#1864AB', label: 'Blau' },
    gruen: { fill: '#69DB7C', ink: '#2B8A3E', label: 'Grün' },
    gelb: { fill: '#FFD43B', ink: '#8F5F00', label: 'Gelb' },
    orange: { fill: '#FFA94D', ink: '#C2410C', label: 'Orange' },
    rot: { fill: '#FF8787', ink: '#C92A2A', label: 'Rot' },
    lila: { fill: '#B197FC', ink: '#5F3DC4', label: 'Lila' },
    grau: { fill: '#ADB5BD', ink: '#495057', label: 'Grau' },
  };
  const BOOKS = ['#C0392B', '#2E86C1', '#F4D03F', '#27AE60', '#8E44AD', '#E67E22', '#16A085', '#D35400'];

  /* Holzmaserung: leicht geschwungene Linien zwischen zwei Kanten (a0→a1 und b0→b1) */
  function grain(a0, a1, b0, b1, n) {
    let s = '';
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1) + (i % 2 ? 0.02 : -0.015);
      const p = G.lerp(a0, b0, t);
      const q = G.lerp(a1, b1, t);
      const d = G.sub(q, p);
      const nrm = G.mul(G.norm({ x: -d.y, y: d.x }), i % 2 ? 1.6 : -1.2);
      const c1 = G.add(G.lerp(p, q, 0.33), nrm);
      const c2 = G.sub(G.lerp(p, q, 0.68), nrm);
      s += path(`M${pt(p)} C${pt(c1)} ${pt(c2)} ${pt(q)}`, `fill="none" stroke="#B5864B" stroke-opacity="${i % 3 ? 0.22 : 0.32}" stroke-width="0.7" stroke-linecap="round"`);
    }
    return s;
  }

  /* Tischplatte: Holz mit Kantenband und Lichtkante */
  function woodTop(poly, r) {
    const d = G.roundedPath(poly, r);
    return (
      path(d, `fill="url(#f-wood)" stroke="${COLORS.woodEdge}" stroke-width="1.4"`) +
      path(G.roundedPath(G.inset(poly, 2.2), Math.max(1, r - 2)), `fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="0.8"`)
    );
  }

  /* ---------- Dreieckstisch ---------- */
  function tablePoly(S) {
    const b = S.tableBase;
    const h = S.tableHeight;
    return [
      { x: -b / 2, y: h / 3 },
      { x: b / 2, y: h / 3 },
      { x: 0, y: (-2 * h) / 3 },
    ];
  }

  const T = {};

  T.table = {
    name: 'Dreieckstisch',
    label: 'Dreiecks\u00ADtisch',
    short: 'Tisch',
    cat: 'tische',
    inv: 12,
    layer: 2,
    obstacle: true,
    kind: 'table',
    desc: 'Rechtwinkliger Dreieckstisch mit Buche-Platte (Standard 120 × 60 cm). Zwei Tische ergeben ein Quadrat.',
    parts: (o, S) => [tablePoly(S)],
    draw(o, S) {
      const poly = G.inset(tablePoly(S), 0.7);
      // Maserung parallel zur langen Seite, innerhalb der Platte
      const ins = G.inset(poly, 7);
      return woodTop(poly, 7) + grain(ins[0], ins[1], ins[2], ins[2], 4);
    },
  };

  T.tableRect = {
    name: 'Rechtecktisch',
    label: 'Rechteck\u00ADtisch',
    short: 'Rechtecktisch',
    cat: 'tische',
    layer: 2,
    obstacle: true,
    kind: 'table',
    resizable: true,
    defaultSize: { w: 120, d: 60 },
    minSize: { w: 40, d: 30 },
    desc: 'Rechteckiger Tisch (Standard 120 × 60 cm, Größe frei einstellbar). Rastet wie die Dreieckstische Kante an Kante ein.',
    parts: (o) => [G.rect(o.w || 120, o.d || 60)],
    draw(o) {
      const w = o.w || 120;
      const d = o.d || 60;
      const poly = G.rect(w - 1.4, d - 1.4);
      const n = Math.max(2, Math.min(7, Math.round(d / 13)));
      const m = Math.min(8, w * 0.08);
      return woodTop(poly, 5) + grain({ x: -w / 2 + m, y: -d / 2 }, { x: w / 2 - m, y: -d / 2 }, { x: -w / 2 + m, y: d / 2 }, { x: w / 2 - m, y: d / 2 }, n);
    },
  };

  /* ---------- Sitzmöbel ---------- */
  /* Schalenstuhl in Draufsicht: Kufengestell, Sitzschale, Rückenlehne mit Griffloch */
  function chairShell(w, d, c) {
    const hw = w / 2;
    const hd = d / 2;
    const y0 = -hd + 3;
    const y1 = hd - 10;
    let s = '';
    // Kufengestell (seitlich sichtbar) mit Gleitern
    for (const sx of [-1, 1]) {
      s += line(sx * (hw - 1.6), -hd + 1.5, sx * (hw - 1.6), hd - 3, `stroke="url(#f-metal)" stroke-width="2.6" stroke-linecap="round"`);
      s += circ(sx * (hw - 1.6), -hd + 1.5, 1.5, `fill="${COLORS.frameDark}"`) + circ(sx * (hw - 1.6), hd - 3, 1.5, `fill="${COLORS.frameDark}"`);
    }
    const seat = `M${f(-hw + 7)} ${f(y0)} Q0 ${f(y0 - 3.2)} ${f(hw - 7)} ${f(y0)} Q${f(hw - 3)} ${f(y0 + 0.6)} ${f(hw - 3)} ${f(y0 + 6)} L${f(hw - 2.4)} ${f(y1)} L${f(-hw + 2.4)} ${f(y1)} L${f(-hw + 3)} ${f(y0 + 6)} Q${f(-hw + 3)} ${f(y0 + 0.6)} ${f(-hw + 7)} ${f(y0)} Z`;
    s += path(seat, `fill="${c.seat}" stroke="${c.edge}" stroke-width="0.9" stroke-linejoin="round"`);
    s += path(seat, DISH) + path(seat, SHEEN);
    const back = `M${f(-hw + 1.4)} ${f(hd - 13)} Q0 ${f(hd - 20)} ${f(hw - 1.4)} ${f(hd - 13)} Q${f(hw - 0.2)} ${f(hd - 5.5)} ${f(hw - 3)} ${f(hd - 1.5)} Q0 ${f(hd - 7)} ${f(-hw + 3)} ${f(hd - 1.5)} Q${f(-hw + 0.2)} ${f(hd - 5.5)} ${f(-hw + 1.4)} ${f(hd - 13)} Z`;
    s += path(back, `fill="${c.back}" stroke="${c.edge}" stroke-width="0.9" stroke-linejoin="round"`);
    s += path(`M${f(-hw + 5)} ${f(hd - 13.2)} Q0 ${f(hd - 19.2)} ${f(hw - 5)} ${f(hd - 13.2)}`, `fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="0.9" stroke-linecap="round"`);
    // Griffloch in der Lehne
    s += path(`M-6 ${f(hd - 8.6)} Q0 ${f(hd - 11.2)} 6 ${f(hd - 8.6)}`, `fill="none" stroke="#2B1A12" stroke-opacity="0.55" stroke-width="3.2" stroke-linecap="round"`);
    return s;
  }

  T.chair = {
    name: 'Stuhl',
    label: 'Stuhl',
    short: 'Stuhl',
    cat: 'sitze',
    inv: 19,
    layer: 3,
    obstacle: true,
    kind: 'seat',
    seats: 1,
    colors: CHAIR_COLORS,
    defaultColor: 'rot',
    options: [{ key: 'foot', label: 'Mit Fußstütze' }],
    desc: 'Schalenstuhl auf Kufengestell (ca. 46 × 50 cm), orange-rot oder grün. Teilweise mit höhenverstellbarer Fußstütze.',
    parts(o, S) {
      const w = S.chairW;
      const d = S.chairD;
      const parts = [G.rect(w, d)];
      if (o.foot) parts.push(G.rect(w - 6, 24, 0, -d / 2 - 10));
      return parts;
    },
    draw(o, S) {
      const w = S.chairW;
      const d = S.chairD;
      const c = CHAIR_COLORS[o.color] || CHAIR_COLORS.rot;
      let s = '';
      if (o.foot) {
        // höhenverstellbare Fußstütze (blau) vor dem Stuhl
        const x = w / 2 - 6;
        s += line(-x, -d / 2 - 20, -x, -d / 2 + 3, `stroke="url(#f-metal)" stroke-width="2.2" stroke-linecap="round"`);
        s += line(x, -d / 2 - 20, x, -d / 2 + 3, `stroke="url(#f-metal)" stroke-width="2.2" stroke-linecap="round"`);
        s += line(-x, -d / 2 - 19, x, -d / 2 - 19, `stroke="#2F5BC1" stroke-width="2.8" stroke-linecap="round"`);
        s += line(-x + 2, -d / 2 - 12.5, x - 2, -d / 2 - 12.5, `stroke="#2F5BC1" stroke-width="2.4" stroke-linecap="round"`);
      }
      return s + chairShell(w, d, c);
    },
  };

  T.stool = {
    name: 'Hocker (höhenverstellbar)',
    label: 'Wackel\u00ADhocker',
    short: 'Hocker',
    cat: 'sitze',
    inv: 2,
    layer: 3,
    obstacle: true,
    kind: 'seat',
    seats: 1,
    desc: 'Dunkelblauer, höhenverstellbarer Hocker mit beweglichem Standfuß (Ø ca. 36 cm).',
    parts: () => [G.circlePoly(18, 14)],
    draw: () =>
      circ(0, 0, 18, `fill="#1B2752" stroke="#121A38" stroke-width="0.9"`) +
      circ(0, 0, 15.2, `fill="url(#f-seat-blue)" stroke="#16245A" stroke-width="0.8"`) +
      circ(0, 0, 11.6, `fill="none" stroke="#C9D4F5" stroke-opacity="0.5" stroke-width="0.7" stroke-dasharray="1.6 1.6"`) +
      circ(0, 0, 15.2, SHEEN) +
      circ(0, 0, 2.4, `fill="#16245A"`),
  };

  T.wheelchair = {
    name: 'Rollstuhl (Prüfobjekt)',
    label: 'Rollstuhl',
    short: 'Rollstuhl',
    cat: 'sitze',
    layer: 4,
    obstacle: false,
    collide: true,
    kind: 'wheelchair',
    seats: 1,
    resizable: true,
    defaultSize: { w: 70, d: 120 },
    minSize: { w: 50, d: 80 },
    options: [{ key: 'turn', label: 'Wendekreis (Ø) anzeigen' }],
    desc: 'Rollstuhl in Draufsicht (Standard 70 × 120 cm). Zeigt rot, wenn er irgendwo aneckt.',
    parts: (o) => [G.rect(o.w || 70, o.d || 120)],
    draw(o) {
      const w = o.w || 70;
      const d = o.d || 120;
      const blue = '#1F6FEB';
      let s = '';
      s += rectEl(-w / 2, -d / 2, w, d, `rx="10" fill="${blue}" fill-opacity="0.08" stroke="${blue}" stroke-width="1.2" stroke-dasharray="4 3"`);
      // Fußrasten und Lenkräder vorn
      s += rectEl(-w / 2 + 14, -d / 2 + 3, w / 2 - 17, 9, `rx="2" fill="#7B8794" stroke="#4B5563" stroke-width="0.6"`);
      s += rectEl(3, -d / 2 + 3, w / 2 - 17, 9, `rx="2" fill="#7B8794" stroke="#4B5563" stroke-width="0.6"`);
      s += line(-w / 2 + 17, -d * 0.14, -w / 2 + 17, -d / 2 + 11, `stroke="url(#f-metal)" stroke-width="2.4"`);
      s += line(w / 2 - 17, -d * 0.14, w / 2 - 17, -d / 2 + 11, `stroke="url(#f-metal)" stroke-width="2.4"`);
      s += ell(-w / 2 + 15, -d * 0.27, 3, 5, `fill="#2D3238"`) + ell(w / 2 - 15, -d * 0.27, 3, 5, `fill="#2D3238"`);
      // Antriebsräder mit Greifreifen
      for (const sx of [-1, 1]) {
        const x = sx > 0 ? w / 2 - 9 : -w / 2 + 1;
        s += rectEl(x, -d * 0.14, 8, d * 0.52, `rx="4" fill="#2D3238"`);
        s += line(x + 4, -d * 0.12, x + 4, d * 0.36, `stroke="#5B6470" stroke-width="1.2" stroke-dasharray="2 2.4"`);
        s += line(x + (sx > 0 ? -1.4 : 9.4), -d * 0.1, x + (sx > 0 ? -1.4 : 9.4), d * 0.34, `stroke="#C3CAD2" stroke-width="1.3" stroke-linecap="round"`);
      }
      // Sitzkissen und Rückenlehne
      const seat = { x: -w / 2 + 12, y: -d * 0.12, w: w - 24, h: d * 0.42 };
      s += rectEl(seat.x, seat.y, seat.w, seat.h, `rx="6" fill="${blue}" fill-opacity="0.9" stroke="#174EA6" stroke-width="0.8"`);
      s += rectEl(seat.x, seat.y, seat.w, seat.h, `rx="6" ${SHEEN}`);
      s += rectEl(-w / 2 + 11, d * 0.29, w - 22, 8, `rx="3.5" fill="#174EA6"`);
      s += circ(-w / 2 + 13, d * 0.36, 3, `fill="#2D3238"`) + circ(w / 2 - 13, d * 0.36, 3, `fill="#2D3238"`);
      return s;
    },
  };

  T.officeChair = {
    name: 'Bürostuhl',
    label: 'Büro\u00ADstuhl',
    short: 'Bürostuhl',
    cat: 'sitze',
    layer: 3,
    obstacle: true,
    kind: 'furniture',
    desc: 'Drehstuhl am Lehrertisch (Ø ca. 60 cm).',
    parts: () => [G.circlePoly(30, 14)],
    draw() {
      let s = '';
      for (let i = 0; i < 5; i++) {
        const a = G.rad(i * 72 - 90);
        s += line(0, 0, Math.cos(a) * 27, Math.sin(a) * 27, `stroke="#4A4E54" stroke-width="3.4" stroke-linecap="round"`);
        s += circ(Math.cos(a) * 27.5, Math.sin(a) * 27.5, 2.8, `fill="#24262A"`);
      }
      // Armlehnen
      s += rectEl(-24, -12, 5, 22, `rx="2.5" fill="#2E3034"`) + rectEl(19, -12, 5, 22, `rx="2.5" fill="#2E3034"`);
      s += rectEl(-19, -19, 38, 34, `rx="12" fill="#B83227" stroke="#7A1A14" stroke-width="0.9"`);
      s += rectEl(-19, -19, 38, 34, `rx="12" ${DISH}`) + rectEl(-19, -19, 38, 34, `rx="12" ${SHEEN}`);
      s += path('M-21 11 Q0 3 21 11 L20 22 Q0 16 -20 22 Z', `fill="#8A241B" stroke="#5E140F" stroke-width="0.9"`);
      s += path('M-17 11.5 Q0 5.5 17 11.5', `fill="none" stroke="#fff" stroke-opacity="0.3" stroke-width="0.9"`);
      return s;
    },
  };

  T.teacher = {
    name: 'Lehrkraft (Position)',
    label: 'Lehrkraft',
    short: 'Lehrkraft',
    cat: 'sitze',
    layer: 4,
    obstacle: false,
    kind: 'marker',
    desc: 'Standort der Lehrkraft für den Lehrkraft-Check (Laufwege und Blickkontakt). Mehrere Positionen sind möglich, z. B. für Doppelbesetzung oder Schulbegleitung.',
    parts: () => [G.circlePoly(24, 14)],
    draw() {
      let s = '';
      s += ell(-14, -11, 4.5, 5.5, `fill="#E9B98F" stroke="#B9835A" stroke-width="0.6"`) + ell(14, -11, 4.5, 5.5, `fill="#E9B98F" stroke="#B9835A" stroke-width="0.6"`);
      s += path('M-23 3 Q-24 -8 -13 -9 L13 -9 Q24 -8 23 3 Q22 11 0 11 Q-22 11 -23 3 Z', `fill="#0B7285" stroke="#085462" stroke-width="0.9"`);
      s += path('M-23 3 Q-24 -8 -13 -9 L13 -9 Q24 -8 23 3 Q22 11 0 11 Q-22 11 -23 3 Z', SHEEN);
      s += circ(0, 0, 9.5, `fill="#5C4033" stroke="#3B281F" stroke-width="0.8"`) + circ(0, 0, 9.5, SHEEN);
      s += ell(0, -9.3, 2.4, 1.8, `fill="#E9B98F"`);
      return s;
    },
  };

  /* Ledersofa: Sockel, Lehne, Armlehnen und Sitzkissen mit Naht */
  function cushion(x, y, w, h) {
    return (
      rectEl(x, y, w, h, `rx="6" fill="url(#f-leather)" stroke="#141517" stroke-width="0.8"`) +
      rectEl(x, y, w, h, `rx="6" ${SHEEN}`) +
      rectEl(x + 3, y + 3, w - 6, h - 6, `rx="4" fill="none" stroke="#6B7078" stroke-opacity="0.55" stroke-width="0.6" stroke-dasharray="2 1.6"`)
    );
  }

  T.sofa2 = {
    name: 'Sofa-Element (2-Sitzer)',
    label: 'Sofa (2er)',
    short: 'Sofa',
    cat: 'lounge',
    inv: 2,
    layer: 1,
    obstacle: true,
    kind: 'lounge',
    lounge: 2,
    desc: 'Schwarzes Leder-Sofaelement für zwei Personen (ca. 160 × 85 cm).',
    parts: () => [G.rect(160, 85)],
    draw() {
      let s = rectEl(-80, -42.5, 160, 85, `rx="8" fill="#26282C" stroke="#0E0F10" stroke-width="1"`);
      s += rectEl(-80, 21, 160, 21.5, `rx="7" fill="url(#f-leather)" stroke="#0E0F10" stroke-width="0.8"`) + rectEl(-80, 21, 160, 21.5, `rx="7" ${SHEEN}`);
      s += rectEl(-79, -41, 19, 63, `rx="7" fill="url(#f-leather)" stroke="#0E0F10" stroke-width="0.8"`) + rectEl(60, -41, 19, 63, `rx="7" fill="url(#f-leather)" stroke="#0E0F10" stroke-width="0.8"`);
      s += cushion(-58, -38, 57, 58) + cushion(1, -38, 57, 58);
      return s;
    },
  };

  T.sofaCorner = {
    name: 'Sofa-Eckelement',
    label: 'Sofa-Ecke',
    short: 'Sofa-Ecke',
    cat: 'lounge',
    inv: 1,
    layer: 1,
    obstacle: true,
    kind: 'lounge',
    desc: 'Eckelement, verbindet zwei Sofa-Elemente zu einer L-Form (85 × 85 cm).',
    parts: () => [G.rect(85, 85)],
    draw() {
      let s = rectEl(-42.5, -42.5, 85, 85, `rx="8" fill="#26282C" stroke="#0E0F10" stroke-width="1"`);
      s += path('M-42.5 -34.5 Q-42.5 -42.5 -34.5 -42.5 L-22 -42.5 L-22 21 L42.5 21 L42.5 34.5 Q42.5 42.5 34.5 42.5 L-34.5 42.5 Q-42.5 42.5 -42.5 34.5 Z', `fill="url(#f-leather)" stroke="#0E0F10" stroke-width="0.8"`);
      s += cushion(-20, -40, 60, 59);
      return s;
    },
  };

  T.beanbag = {
    name: 'Sitzsack',
    label: 'Sitzsack',
    short: 'Sitzsack',
    cat: 'lounge',
    inv: 3,
    layer: 3,
    obstacle: true,
    kind: 'lounge',
    lounge: 1,
    colors: BEANBAG_COLORS,
    defaultColor: 'gruen',
    desc: 'Sitzsack (Ø ca. 75 cm).',
    parts: () => [G.circlePoly(37, 16)],
    draw(o) {
      const c = BEANBAG_COLORS[o.color] || BEANBAG_COLORS.gruen;
      const blob = 'M-36 4 C-38 -24 -16 -38 4 -36 C26 -35 39 -18 36 6 C34 26 18 37 -2 36 C-22 36 -35 24 -36 4 Z';
      return (
        path(blob, `fill="${c.fill}" stroke="${c.dark}" stroke-width="1"`) +
        path(blob, DISH) +
        // Sitzmulde und Falten
        path('M-16 2 C-14 -12 2 -18 13 -9 C22 -1 17 14 4 17 C-8 20 -18 13 -16 2 Z', `fill="${c.dark}" fill-opacity="0.22"`) +
        path('M-30 -12 C-24 -6 -22 2 -26 10 M24 -26 C18 -18 20 -12 28 -8 M-6 30 C-2 24 6 24 12 30', `fill="none" stroke="${c.dark}" stroke-opacity="0.45" stroke-width="1.2" stroke-linecap="round"`) +
        path(blob, SHEEN)
      );
    },
  };

  T.rug = {
    name: 'Teppich (rund)',
    label: 'Teppich rund',
    short: 'Teppich',
    cat: 'lounge',
    layer: 0,
    obstacle: false,
    kind: 'floor',
    resizable: true,
    round: true,
    defaultSize: { w: 160, d: 160 },
    minSize: { w: 60, d: 60 },
    colors: RUG_COLORS,
    defaultColor: 'beige',
    desc: 'Runder Teppich (kein Hindernis für die Rollstuhl-Analyse).',
    parts: (o) => [G.circlePoly((o.w || 160) / 2, 24)],
    draw(o) {
      const r = (o.w || 160) / 2;
      const c = RUG_COLORS[o.color] || RUG_COLORS.beige;
      let s = circ(0, 0, r, `fill="${c.fill}" fill-opacity="0.75" stroke="${c.line}" stroke-width="1.2"`);
      s += circ(0, 0, r * 0.9, `fill="none" stroke="${c.line}" stroke-opacity="0.55" stroke-width="${f(r * 0.05)}"`);
      s += circ(0, 0, r * 0.78, `fill="none" stroke="${c.line}" stroke-opacity="0.5" stroke-width="1" stroke-dasharray="3 3"`);
      s += circ(0, 0, r * 0.52, `fill="none" stroke="${c.line}" stroke-opacity="0.45" stroke-width="1" stroke-dasharray="1.5 4"`);
      for (let i = 0; i < 8; i++) {
        const a = G.rad(i * 45 + 22.5);
        s += ell(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65, r * 0.06, r * 0.035, `transform="rotate(${f(i * 45 + 22.5)} ${f(Math.cos(a) * r * 0.65)} ${f(Math.sin(a) * r * 0.65)})" fill="${c.line}" fill-opacity="0.35"`);
      }
      return s + circ(0, 0, r * 0.16, `fill="${c.line}" fill-opacity="0.25"`);
    },
  };

  T.rugRect = {
    name: 'Teppich (eckig)',
    label: 'Teppich eckig',
    short: 'Teppich',
    cat: 'lounge',
    layer: 0,
    obstacle: false,
    kind: 'floor',
    resizable: true,
    defaultSize: { w: 200, d: 140 },
    minSize: { w: 40, d: 40 },
    colors: RUG_COLORS,
    defaultColor: 'beige',
    desc: 'Rechteckiger Teppich, Größe frei einstellbar (kein Hindernis für die Rollstuhl-Analyse).',
    parts: (o) => [G.rect(o.w || 200, o.d || 140)],
    draw(o) {
      const w = o.w || 200;
      const d = o.d || 140;
      const c = RUG_COLORS[o.color] || RUG_COLORS.beige;
      const m = Math.min(w, d) * 0.1;
      let s = rectEl(-w / 2, -d / 2, w, d, `rx="3" fill="${c.fill}" fill-opacity="0.75" stroke="${c.line}" stroke-width="1.2"`);
      s += rectEl(-w / 2 + m * 0.45, -d / 2 + m * 0.45, w - m * 0.9, d - m * 0.9, `rx="2" fill="none" stroke="${c.line}" stroke-opacity="0.5" stroke-width="${f(m * 0.35)}"`);
      s += rectEl(-w / 2 + m, -d / 2 + m, w - 2 * m, d - 2 * m, `rx="2" fill="none" stroke="${c.line}" stroke-opacity="0.55" stroke-width="1" stroke-dasharray="3 3"`);
      const dm = Math.min(w, d) * 0.22;
      s += path(`M0 ${f(-dm)} L${f(dm * 1.3)} 0 L0 ${f(dm)} L${f(-dm * 1.3)} 0 Z`, `fill="${c.line}" fill-opacity="0.18" stroke="${c.line}" stroke-opacity="0.45" stroke-width="1"`);
      // Fransen an den kurzen Seiten
      const alongX = w < d;
      const len = alongX ? w : d;
      const edge = (alongX ? d : w) / 2;
      for (let t = -len / 2 + 4; t <= len / 2 - 4; t += 5) {
        for (const sg of [-1, 1]) {
          s += alongX
            ? line(t, sg * (edge - 0.5), t, sg * (edge + 4), `stroke="${c.line}" stroke-width="0.8" opacity="0.55"`)
            : line(sg * (edge - 0.5), t, sg * (edge + 4), t, `stroke="${c.line}" stroke-width="0.8" opacity="0.55"`);
        }
      }
      return s;
    },
  };

  /* ---------- Raumelemente / Stauraum ---------- */
  T.shelfRound = {
    name: 'Halbrundes Bücherregal (mobil)',
    label: 'Halbrund-Regal',
    short: 'Halbrund-Regal',
    cat: 'stauraum',
    inv: 2,
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    desc: 'Mobiles halbrundes Regal in Buche auf Rollen (Radius ca. 70 cm). Zwei Regale bilden einen Rückzugsbereich. Drehpunkt = Kreismittelpunkt.',
    parts: () => G.arcParts(70, 36, 180, 360, 6),
    draw() {
      const R = 70;
      const r = 36;
      const ring = `M-${R} 0 A${R} ${R} 0 0 1 ${R} 0 L${r} 0 A${r} ${r} 0 0 0 -${r} 0 Z`;
      let s = path(ring, `fill="url(#f-wood2)" stroke="${COLORS.woodDark}" stroke-width="1.3"`);
      // Bücher in den Fächern (Buchrücken nach außen)
      for (let i = 0; i < 22; i++) {
        const a = G.rad(184 + i * 8.1);
        const len = 9 + ((i * 7) % 5);
        const rr = R - 5;
        s += line(Math.cos(a) * (rr - len), Math.sin(a) * (rr - len), Math.cos(a) * rr, Math.sin(a) * rr, `stroke="${BOOKS[(i * 5) % BOOKS.length]}" stroke-width="${i % 3 ? 3.2 : 4}" stroke-opacity="0.8"`);
      }
      // Fachböden und Deckplatte
      for (let i = 0; i <= 4; i++) {
        const a = G.rad(180 + i * 45);
        s += line(Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * R, Math.sin(a) * R, `stroke="${COLORS.woodDark}" stroke-width="${i % 4 ? 1.6 : 2.4}" stroke-linecap="round"`);
      }
      s += path(`M-${R - 1.5} 0 A${R - 1.5} ${R - 1.5} 0 0 1 ${R - 1.5} 0`, `fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="0.9"`);
      s += path(`M-${r + 3} 0 A${r + 3} ${r + 3} 0 0 1 ${r + 3} 0`, `fill="none" stroke="${COLORS.woodDark}" stroke-opacity="0.5" stroke-width="0.8"`);
      return s;
    },
  };

  T.partition = {
    name: 'Mobile Trennwand',
    label: 'Trennwand',
    short: 'Trennwand',
    cat: 'stauraum',
    inv: 2,
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    resizable: true,
    defaultSize: { w: 120, d: 40 },
    minSize: { w: 60, d: 30 },
    handles: 'w',
    hitPad: true,
    desc: 'Blaue mobile Stellwand mit Standfüßen (ca. 120 cm breit). Mehrere Trennwände rasten an den Enden aneinander ein.',
    parts(o) {
      const w = o.w || 120;
      const d = o.d || 40;
      return [G.rect(w, 5), G.rect(6, d, -w / 2 + 3, 0), G.rect(6, d, w / 2 - 3, 0)];
    },
    draw(o) {
      const w = o.w || 120;
      const d = o.d || 40;
      let s = rectEl(-w / 2, -d / 2, 6, d, `rx="3" fill="url(#f-metal)" stroke="#7D858E" stroke-width="0.6"`) + rectEl(w / 2 - 6, -d / 2, 6, d, `rx="3" fill="url(#f-metal)" stroke="#7D858E" stroke-width="0.6"`);
      s += rectEl(-w / 2, -3, w, 6, `rx="2" fill="url(#f-panel)" stroke="#0F2466" stroke-width="0.8"`);
      s += line(-w / 2 + 4, -1.2, w / 2 - 4, -1.2, `stroke="#fff" stroke-opacity="0.35" stroke-width="0.8"`);
      return s;
    },
  };

  T.desk = {
    name: 'Lehrertisch mit PC',
    label: 'Lehrer\u00ADtisch',
    short: 'Lehrertisch',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    resizable: true,
    defaultSize: { w: 140, d: 70 },
    minSize: { w: 60, d: 40 },
    desc: 'Arbeitsplatz der Lehrkraft mit PC, Monitoren und HDMI-Umschalter.',
    parts: (o) => [G.rect(o.w || 140, o.d || 70)],
    draw(o) {
      const w = o.w || 140;
      const d = o.d || 70;
      let s = rectEl(-w / 2, -d / 2, w, d, `rx="2.5" fill="#EEECE7" stroke="#8D8A82" stroke-width="1.1"`);
      s += rectEl(-w / 2 + 2, -d / 2 + 2, w - 4, d - 4, `rx="1.5" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="0.8"`);
      // zwei Monitore an der Rückseite (+y), Standfüße davor
      for (const x0 of [-w * 0.33, w * 0.03]) {
        s += rectEl(x0 + w * 0.1, d / 2 - 15, w * 0.1, 6, `rx="1.5" fill="#9AA1A9"`);
        s += rectEl(x0, d / 2 - 11, w * 0.3, 4.2, `rx="1.2" fill="#1E2125"`);
        s += line(x0 + 2, d / 2 - 10.6, x0 + w * 0.3 - 2, d / 2 - 10.6, `stroke="#4C8FD6" stroke-opacity="0.7" stroke-width="0.8"`);
      }
      // Tastatur und Maus
      s += rectEl(-w * 0.17, -d * 0.18, w * 0.34, d * 0.17, `rx="2" fill="#D3D7DC" stroke="#8F969E" stroke-width="0.6"`);
      for (let i = 1; i < 4; i++) s += line(-w * 0.17 + 2, -d * 0.18 + (i * d * 0.17) / 4, w * 0.17 - 2, -d * 0.18 + (i * d * 0.17) / 4, `stroke="#A9B0B8" stroke-width="0.5"`);
      s += ell(w * 0.26, -d * 0.1, 3.4, 5, `fill="#D3D7DC" stroke="#8F969E" stroke-width="0.6"`);
      // HDMI-Umschalter
      s += rectEl(-w * 0.43, -d * 0.2, w * 0.1, d * 0.12, `rx="1.5" fill="#33373C"`) + circ(-w * 0.38, -d * 0.14, 1.2, `fill="#51CF66"`);
      return s;
    },
  };

  T.cabinet = {
    name: 'Schrank (niedrig)',
    label: 'Schrank',
    short: 'Schrank',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    resizable: true,
    defaultSize: { w: 100, d: 45 },
    minSize: { w: 30, d: 20 },
    desc: 'Anthrazitfarbener Unterschrank mit hellem Regalaufsatz.',
    parts: (o) => [G.rect(o.w || 100, o.d || 45)],
    draw(o) {
      const w = o.w || 100;
      const d = o.d || 45;
      const front = Math.min(14, d * 0.32);
      let s = rectEl(-w / 2, -d / 2, w, d, `rx="1.5" fill="url(#f-dark)" stroke="#111" stroke-width="1"`);
      // heller Regalaufsatz hinten, davor die Deckplatte des Unterschranks
      s += rectEl(-w / 2 + 1.5, -d / 2 + front, w - 3, d - front - 1.5, `rx="1" fill="#F0EDE7" stroke="#B9AE9C" stroke-width="0.7"`);
      const n = Math.max(1, Math.round(w / 34));
      for (let i = 1; i < n; i++) s += line(-w / 2 + (i * w) / n, -d / 2 + front + 1, -w / 2 + (i * w) / n, d / 2 - 2, `stroke="#CFC6B6" stroke-width="0.9"`);
      // Material auf dem Aufsatz
      for (let i = 0; i < n; i++) {
        const cx = -w / 2 + ((i + 0.5) * w) / n;
        s += rectEl(cx - 7, -d / 2 + front + 4, 14, Math.max(4, (d - front) * 0.35), `rx="1" fill="${BOOKS[(i * 3 + 1) % BOOKS.length]}" fill-opacity="0.55"`);
      }
      s += line(-w / 2 + 3, -d / 2 + 2.5, w / 2 - 3, -d / 2 + 2.5, `stroke="#fff" stroke-opacity="0.18" stroke-width="0.8"`);
      return s;
    },
  };

  T.bookshelf = {
    name: 'Bücherregal',
    label: 'Bücher\u00ADregal',
    short: 'Regal',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    resizable: true,
    defaultSize: { w: 80, d: 35 },
    minSize: { w: 30, d: 20 },
    desc: 'Offenes Regal in Buche mit Büchern und Material.',
    parts: (o) => [G.rect(o.w || 80, o.d || 35)],
    draw(o) {
      const w = o.w || 80;
      const d = o.d || 35;
      let s = rectEl(-w / 2, -d / 2, w, d, `rx="1.5" fill="url(#f-wood2)" stroke="${COLORS.woodDark}" stroke-width="1.1"`);
      s += rectEl(-w / 2 + 3, -d / 2 + 2.5, w - 6, d - 5.5, `fill="#C99C62"`);
      // Bücher mit unterschiedlicher Breite und Tiefe
      let x = -w / 2 + 3.5;
      let i = 0;
      while (x < w / 2 - 5) {
        const bw = 2.6 + ((i * 7) % 4) * 0.8;
        const depth = d - 9 - ((i * 5) % 4) * 1.6;
        s += rectEl(x, d / 2 - 3.5 - depth, Math.min(bw, w / 2 - 3.5 - x), depth, `fill="${BOOKS[(i * 5) % BOOKS.length]}" fill-opacity="0.85"`);
        x += bw + 0.5;
        i++;
      }
      const n = Math.max(1, Math.round(w / 40));
      for (let k = 1; k < n; k++) s += rectEl(-w / 2 + (k * w) / n - 1, -d / 2 + 1, 2, d - 2, `fill="${COLORS.woodDark}"`);
      return s;
    },
  };

  T.drawerTower = {
    name: 'Ablageturm (Schübe)',
    label: 'Ablage\u00ADturm',
    short: 'Ablageturm',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    desc: 'Transparenter Schubladenturm für Material (ca. 60 × 40 cm).',
    parts: () => [G.rect(60, 40)],
    draw() {
      let s = rectEl(-30, -20, 60, 40, `rx="2.5" fill="url(#f-metal)" stroke="#6F7C88" stroke-width="1"`);
      s += rectEl(-27, -17, 26, 34, `rx="1.5" fill="#E8F1F8" fill-opacity="0.9" stroke="#8FA3B5" stroke-width="0.6"`) + rectEl(1, -17, 26, 34, `rx="1.5" fill="#E8F1F8" fill-opacity="0.9" stroke="#8FA3B5" stroke-width="0.6"`);
      s += rectEl(-23, -9, 9, 14, `rx="1" fill="#F4D03F" fill-opacity="0.55"`) + rectEl(-12, -4, 8, 12, `rx="1" fill="#2E86C1" fill-opacity="0.45"`) + rectEl(6, -10, 16, 9, `rx="1" fill="#E67E22" fill-opacity="0.45"`);
      s += rectEl(-21, -20.5, 14, 3, `rx="1.5" fill="#5C6B78"`) + rectEl(7, -20.5, 14, 3, `rx="1.5" fill="#5C6B78"`);
      return s;
    },
  };

  T.rollContainer = {
    name: 'Rollcontainer (rot)',
    label: 'Roll\u00ADcontainer',
    short: 'Rollcontainer',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    desc: 'Roter Schubladen-Rollcontainer (ca. 60 × 45 cm).',
    parts: () => [G.rect(60, 45)],
    draw: () =>
      rectEl(-30, -22.5, 60, 45, `rx="3" fill="url(#f-red)" stroke="#7E1F1C" stroke-width="1"`) +
      rectEl(-30, -22.5, 60, 45, `rx="3" ${SHEEN}`) +
      rectEl(-27, -20, 54, 5, `rx="2" fill="#F3A19D" fill-opacity="0.8"`) +
      rectEl(-10, -21.5, 20, 2.4, `rx="1.2" fill="#5E1714"`) +
      line(-26, 17, 26, 17, `stroke="#7E1F1C" stroke-opacity="0.45" stroke-width="0.8"`),
  };

  T.coatRack = {
    name: 'Garderobe',
    label: 'Garde\u00ADrobe',
    short: 'Garderobe',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    desc: 'Garderobenständer (Ø ca. 50 cm).',
    parts: () => [G.circlePoly(25, 12)],
    draw() {
      let s = circ(0, 0, 24, `fill="#F1F3F5" fill-opacity="0.7" stroke="#868E96" stroke-width="1" stroke-dasharray="3 2"`);
      const coats = ['#3B5BDB', '#C92A2A', '#2F9E44'];
      for (let i = 0; i < 3; i++) {
        const a = G.rad(i * 120 + 30);
        s += ell(Math.cos(a) * 14, Math.sin(a) * 14, 9, 6, `transform="rotate(${f(i * 120 + 120)} ${f(Math.cos(a) * 14)} ${f(Math.sin(a) * 14)})" fill="${coats[i]}" fill-opacity="0.75" stroke="#212529" stroke-opacity="0.4" stroke-width="0.6"`);
      }
      for (let i = 0; i < 6; i++) {
        const a = G.rad(i * 60);
        s += line(0, 0, Math.cos(a) * 17, Math.sin(a) * 17, `stroke="#495057" stroke-width="1.8" stroke-linecap="round"`);
      }
      return s + circ(0, 0, 5, `fill="#343A40"`) + circ(0, 0, 5, SHEEN);
    },
  };

  T.lamp = {
    name: 'Stehlampe',
    label: 'Steh\u00ADlampe',
    short: 'Lampe',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    desc: 'Stehlampe mit Dreibein und schwarzem Schirm (Ø ca. 45 cm).',
    parts: () => [G.circlePoly(22, 12)],
    draw() {
      let s = '';
      for (let i = 0; i < 3; i++) {
        const a = G.rad(i * 120 - 90);
        s += line(0, 0, Math.cos(a) * 22, Math.sin(a) * 22, `stroke="#2B2F33" stroke-width="2.2" stroke-linecap="round"`);
      }
      return s + circ(0, 0, 16, `fill="#1A1C1F" stroke="#000" stroke-width="0.8"`) + circ(0, 0, 13, `fill="url(#f-lamp)"`) + circ(0, 0, 4, `fill="#fff"`);
    },
  };

  T.radiator = {
    name: 'Heizkörper',
    label: 'Heiz\u00ADkörper',
    short: 'Heizkörper',
    cat: 'raum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    resizable: true,
    defaultSize: { w: 180, d: 12 },
    minSize: { w: 40, d: 6 },
    hitPad: true,
    desc: 'Heizkörper unter dem Fenster (Hindernis an der Wand).',
    parts: (o) => [G.rect(o.w || 180, o.d || 12)],
    draw(o) {
      const w = o.w || 180;
      const d = o.d || 12;
      let s = rectEl(-w / 2, -d / 2, w, d, `rx="1.5" fill="#FBFCFD" stroke="#868E96" stroke-width="0.8"`);
      for (let x = -w / 2 + 5; x < w / 2 - 2; x += 5) s += line(x, -d / 2 + 1.5, x, d / 2 - 1.5, `stroke="#ADB5BD" stroke-width="0.9"`);
      return s + circ(-w / 2 + 4, 0, Math.min(3, d / 3), `fill="#DEE2E6" stroke="#868E96" stroke-width="0.6"`);
    },
  };

  /* ---------- Wandobjekte ---------- */
  T.iat = {
    name: 'Interaktive Tafel (IAT)',
    label: 'Tafel (IAT)',
    short: 'Tafel',
    cat: 'raum',
    layer: 1,
    obstacle: true,
    kind: 'wall',
    wall: true,
    present: true,
    hitPad: true,
    desc: 'Digitale Tafel (Display ca. 200 cm) auf Standfuß, links und rechts grüne Tafelflügel.',
    parts: () => [G.rect(200, 10, 0, -5), G.rect(100, 58, 0, -29)],
    bounds: () => G.rect(400, 60, 0, -27),
    surface: () => ({ p: { x: 0, y: -8 }, n: { x: 0, y: -1 }, w: 200 }),
    draw() {
      let s = '';
      // Tafelflügel (Kreidetafel) links und rechts
      for (const x of [-200, 100]) {
        s += rectEl(x, -5, 100, 5, `rx="1" fill="#2F5B3A" stroke="#1D3A25" stroke-width="0.8"`);
        s += line(x + 3, -2.6, x + 97, -2.6, `stroke="#6E9C78" stroke-opacity="0.6" stroke-width="0.8"`);
      }
      // Standfuß
      s += rectEl(-50, -58, 100, 52, `rx="6" fill="none" stroke="#868E96" stroke-width="1.6"`);
      s += line(-45, -56, -45, -8, `stroke="url(#f-metal)" stroke-width="5.5" stroke-linecap="round"`);
      s += line(45, -56, 45, -8, `stroke="url(#f-metal)" stroke-width="5.5" stroke-linecap="round"`);
      s += rectEl(-38, -15, 18, 9, `rx="1.5" fill="#212529"`) + rectEl(20, -15, 18, 9, `rx="1.5" fill="#212529"`);
      // Display mit Rahmen
      s += rectEl(-101, -11, 202, 11, `rx="2" fill="#16181B"`);
      s += rectEl(-97, -8.6, 194, 4.6, `rx="1" fill="url(#f-screen)"`);
      s += line(-90, -7.4, 30, -7.4, `stroke="#fff" stroke-opacity="0.35" stroke-width="0.8"`);
      return s;
    },
  };

  T.screen = {
    name: 'Bildschirm (Wand)',
    label: 'Bild\u00ADschirm',
    short: 'Bildschirm',
    cat: 'raum',
    layer: 5,
    obstacle: false,
    kind: 'wall',
    wall: true,
    present: true,
    hitPad: true,
    resizable: true,
    defaultSize: { w: 120, d: 8 },
    minSize: { w: 40, d: 4 },
    desc: 'Wandbildschirm als zusätzliche Präsentationsfläche (spiegelt die IAT).',
    parts: (o) => [G.rect(o.w || 120, 8, 0, -4)],
    bounds: (o) => G.rect(o.w || 120, 14, 0, -6),
    surface: (o) => ({ p: { x: 0, y: -6 }, n: { x: 0, y: -1 }, w: o.w || 120 }),
    draw(o) {
      const w = o.w || 120;
      return rectEl(-w / 2, -8, w, 8, `rx="2" fill="#16181B"`) + rectEl(-w / 2 + 3, -6.4, w - 6, 3.4, `rx="0.8" fill="url(#f-screen)"`) + line(-w / 2 + 6, -5.6, w * 0.1, -5.6, `stroke="#fff" stroke-opacity="0.35" stroke-width="0.7"`);
    },
  };

  T.projection = {
    name: 'Projektionsfläche (Beamer)',
    label: 'Beamer-Fläche',
    short: 'Beamer-Fläche',
    cat: 'raum',
    layer: 5,
    obstacle: false,
    kind: 'wall',
    wall: true,
    present: true,
    hitPad: true,
    resizable: true,
    defaultSize: { w: 200, d: 6 },
    minSize: { w: 60, d: 4 },
    desc: 'Fläche, auf die der Beamer projiziert (Präsentationsfläche).',
    parts: (o) => [G.rect(o.w || 200, 6, 0, -3)],
    bounds: (o) => G.rect(o.w || 200, 14, 0, -6),
    surface: (o) => ({ p: { x: 0, y: -4 }, n: { x: 0, y: -1 }, w: o.w || 200 }),
    draw(o) {
      const w = o.w || 200;
      return (
        rectEl(-w / 2, -6, w, 6, `rx="1" fill="#FFFFFF" stroke="#5C7CFA" stroke-width="1" stroke-dasharray="4 2"`) +
        line(-w / 2 + 4, -3, w / 2 - 4, -3, `stroke="#BAC8FF" stroke-width="1.6"`) +
        rectEl(-w / 2 - 3, -7, 6, 8, `rx="2" fill="#495057"`) +
        rectEl(w / 2 - 3, -7, 6, 8, `rx="2" fill="#495057"`)
      );
    },
  };

  T.tablets = {
    name: 'Tablet-Wand',
    label: 'Tablet-Wand',
    short: 'Tablets',
    cat: 'raum',
    layer: 5,
    obstacle: false,
    kind: 'wall',
    wall: true,
    hitPad: true,
    desc: 'An der Wand montierte Tablets/Bildschirme.',
    parts: () => [G.rect(220, 6, 0, -3)],
    bounds: () => G.rect(220, 12, 0, -6),
    draw() {
      let s = '';
      for (let i = 0; i < 5; i++) s += rectEl(-106 + i * 44, -6.5, 36, 6.5, `rx="1.5" fill="#16181B"`) + rectEl(-104 + i * 44, -5.2, 32, 3.4, `rx="0.6" fill="url(#f-screen)"`);
      return s;
    },
  };

  T.door = {
    name: 'Tür',
    label: 'Tür',
    short: 'Tür',
    cat: 'raum',
    layer: 5,
    obstacle: false,
    kind: 'wall',
    wall: true,
    resizable: true,
    widthOnly: true,
    defaultSize: { w: 100, d: 10 },
    minSize: { w: 70, d: 10 },
    options: [
      { key: 'mirror', label: 'Anschlag spiegeln' },
      { key: 'outward', label: 'Öffnet nach außen' },
    ],
    hitPad: true,
    desc: 'Tür (lichte Breite einstellbar). Startpunkt der Rollstuhl-Analyse.',
    parts: (o) => [G.rect(o.w || 100, 20, 0, 10)],
    bounds: (o) => {
      const w = o.w || 100;
      return o.outward ? G.rect(w, w + 20, 0, (w + 20) / 2 - 20 + 20) : G.rect(w, w + 20, 0, -(w + 20) / 2 + 20);
    },
    draw(o) {
      const w = o.w || 100;
      const m = o.mirror ? -1 : 1;
      const dir = o.outward ? 1 : -1;
      const hx = (-w / 2) * m;
      const off = o.outward ? 20 : 0;
      let s = rectEl(-w / 2, 0, w, 20, `fill="#FBF8F2"`);
      s += rectEl(-w / 2 - 3, 0, 4, 20, `fill="#6C7178"`) + rectEl(w / 2 - 1, 0, 4, 20, `fill="#6C7178"`);
      const hy = off;
      const sweep = (m > 0) === (dir < 0) ? 1 : 0;
      s += path(`M${f(hx)} ${f(hy)} L${f(hx)} ${f(hy + dir * w)} A${f(w)} ${f(w)} 0 0 ${sweep} ${f(-hx)} ${f(hy)} Z`, `fill="#F59F00" fill-opacity="0.07"`);
      s += path(`M${f(hx)} ${f(hy + dir * w)} A${f(w)} ${f(w)} 0 0 ${sweep} ${f(-hx)} ${f(hy)}`, `fill="none" stroke="#E8590C" stroke-opacity="0.75" stroke-width="1" stroke-dasharray="4 3"`);
      // Türblatt (Holz) mit Drücker
      s += rectEl(hx - 2, Math.min(hy, hy + dir * w), 4, w, `rx="1" fill="url(#f-wood2)" stroke="#8B6434" stroke-width="0.8"`);
      s += circ(hx + m * 4.5, hy + dir * (w - 8), 1.8, `fill="#868E96"`);
      return s;
    },
  };

  T.window = {
    name: 'Fenster',
    label: 'Fenster',
    short: 'Fenster',
    cat: 'raum',
    layer: 5,
    obstacle: false,
    kind: 'wall',
    wall: true,
    resizable: true,
    widthOnly: true,
    defaultSize: { w: 180, d: 20 },
    minSize: { w: 40, d: 20 },
    hitPad: true,
    desc: 'Fenster in der Außenwand mit Lamellenvorhang (für den Reiz- & Ruhe-Check: Blick nach draußen, Spiegelungen).',
    parts: (o) => [G.rect(o.w || 180, 20, 0, 10)],
    draw(o) {
      const w = o.w || 180;
      let s = rectEl(-w / 2, 0, w, 20, `fill="#F8F9FA" stroke="#5C6D7E" stroke-width="0.8"`);
      s += rectEl(-w / 2 + 2, 7, w - 4, 6, `fill="url(#f-glass)" stroke="#4C6EF5" stroke-width="0.7"`);
      const n = Math.max(1, Math.round(w / 90));
      for (let i = 1; i < n; i++) s += rectEl(-w / 2 + (i * w) / n - 1.2, 6, 2.4, 8, `fill="#5C6D7E"`);
      s += line(-w / 2 + 6, 8.6, -w / 2 + w * 0.3, 8.6, `stroke="#fff" stroke-opacity="0.8" stroke-width="0.8"`);
      // Fensterbank innen
      s += rectEl(-w / 2, -2.5, w, 3, `rx="1" fill="#E9ECEF" stroke="#ADB5BD" stroke-width="0.5"`);
      return s;
    },
  };

  /* ---------- Freie Objekte ---------- */
  T.rect = {
    name: 'Freies Objekt (eckig)',
    label: 'Objekt eckig',
    short: 'Objekt',
    cat: 'frei',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    resizable: true,
    defaultSize: { w: 100, d: 60 },
    minSize: { w: 5, d: 5 },
    colors: FREE_COLORS,
    defaultColor: 'grau',
    desc: 'Beliebiges rechteckiges Objekt mit frei wählbarer Größe und Beschriftung.',
    parts: (o) => [G.rect(o.w || 100, o.d || 60)],
    draw(o) {
      const c = (FREE_COLORS[o.color] || FREE_COLORS.grau).fill;
      const w = o.w || 100;
      const d = o.d || 60;
      return rectEl(-w / 2, -d / 2, w, d, `rx="3" fill="${c}" stroke="${COLORS.ink}" stroke-width="1"`) + rectEl(-w / 2, -d / 2, w, d, `rx="3" ${SHEEN}`);
    },
  };

  T.circle = {
    name: 'Freies Objekt (rund)',
    label: 'Objekt rund',
    short: 'Objekt',
    cat: 'frei',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    resizable: true,
    round: true,
    defaultSize: { w: 80, d: 80 },
    minSize: { w: 5, d: 5 },
    colors: FREE_COLORS,
    defaultColor: 'grau',
    desc: 'Beliebiges rundes Objekt (z. B. Stehtisch, Pflanze).',
    parts: (o) => [G.circlePoly((o.w || 80) / 2, 20)],
    draw(o) {
      const c = (FREE_COLORS[o.color] || FREE_COLORS.grau).fill;
      const r = (o.w || 80) / 2;
      return circ(0, 0, r, `fill="${c}" stroke="${COLORS.ink}" stroke-width="1"`) + circ(0, 0, r, SHEEN);
    },
  };

  T.label = {
    name: 'Textnotiz',
    label: 'Text\u00ADnotiz',
    short: 'Text',
    cat: 'frei',
    layer: 6,
    obstacle: false,
    kind: 'label',
    desc: 'Beschriftung auf dem Plan (z. B. „Gruppe A“).',
    parts(o) {
      const size = o.size || 20;
      const w = Math.max(20, String(o.text || 'Text').length * size * 0.56);
      return [G.rect(w + 8, size * 1.4)];
    },
    draw(o) {
      const size = o.size || 20;
      const t = LLR.esc(o.text || 'Text');
      return `<text x="0" y="0" font-size="${size}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-weight="600" fill="#1F2933" paint-order="stroke" stroke="#ffffff" stroke-width="${f(size * 0.18)}">${t}</text>`;
    },
  };

  /* ---------- Zonen ----------
     Die Fläche lässt Klicks durch (Ansicht verschieben, Möbel darin greifen),
     angefasst wird eine Zone am Rand oder am Namensschild. Das Namensschild
     (tag) liegt in einer eigenen Ebene über den Möbeln. */
  const zoneArea = (o) => {
    const a = (o.w || 0) * (o.d || 0) * (T[o.type].ellipse ? Math.PI / 4 : 1);
    return (a / 10000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' m²';
  };

  function zoneMarkup(o, shape) {
    const c = ZONE_COLORS[o.color] || ZONE_COLORS.blau;
    let s = shape(`fill="${c.fill}" fill-opacity="0.15" stroke="none" pointer-events="none"`);
    s += shape(`fill="none" stroke="${c.ink}" stroke-width="2" stroke-dasharray="9 5" stroke-opacity="0.75" pointer-events="none"`);
    return s + shape(`fill="none" stroke="transparent" stroke-width="16" pointer-events="stroke"`);
  }

  function zoneTag(o, w, d, round) {
    const c = ZONE_COLORS[o.color] || ZONE_COLORS.blau;
    const name = String(o.label || 'Zone');
    const area = zoneArea(o);
    const fs = Math.max(11, Math.min(18, Math.min(w, d) * 0.11));
    const tw = name.length * fs * 0.6 + area.length * fs * 0.42 + fs * 1.6;
    const th = fs * 1.7;
    const x = round ? -tw / 2 : -w / 2 + 8;
    const y = round ? -d / 2 + d * 0.12 : -d / 2 + 8;
    let s = `<g class="zone-tag" pointer-events="all">`;
    s += rectEl(x, y, tw, th, `rx="${f(th / 2)}" fill="#ffffff" fill-opacity="0.9" stroke="${c.ink}" stroke-width="1"`);
    s += `<text x="${f(x + fs * 0.6)}" y="${f(y + th / 2)}" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="${f(fs)}" fill="${c.ink}"><tspan font-weight="700">${LLR.esc(name)}</tspan><tspan font-size="${f(fs * 0.75)}" dx="${f(fs * 0.4)}" fill-opacity="0.85">${area}</tspan></text>`;
    return s + `</g>`;
  }

  T.zone = {
    name: 'Zone (eckig)',
    label: 'Zone eckig',
    short: 'Zone',
    cat: 'zonen',
    layer: -1,
    obstacle: false,
    kind: 'zone',
    resizable: true,
    defaultSize: { w: 240, d: 180 },
    minSize: { w: 40, d: 40 },
    colors: ZONE_COLORS,
    defaultColor: 'blau',
    desc: 'Bereich im Raum markieren, z. B. Ruhezone, Präsentation oder Gruppenarbeit. Anfassen am Rand oder am Namensschild. Plätze in einer Zone namens „Ruhezone“ oder „Rückzug“ gelten im Reiz- & Ruhe-Check als ruhiger.',
    parts: (o) => [G.rect(o.w || 240, o.d || 180)],
    draw(o) {
      const w = o.w || 240;
      const d = o.d || 180;
      return zoneMarkup(o, (attrs) => rectEl(-w / 2, -d / 2, w, d, `rx="8" ${attrs}`));
    },
    tag: (o) => zoneTag(o, o.w || 240, o.d || 180, false),
  };

  T.zoneRound = {
    name: 'Zone (rund)',
    label: 'Zone rund',
    short: 'Zone',
    cat: 'zonen',
    layer: -1,
    obstacle: false,
    kind: 'zone',
    resizable: true,
    ellipse: true,
    defaultSize: { w: 220, d: 180 },
    minSize: { w: 40, d: 40 },
    colors: ZONE_COLORS,
    defaultColor: 'gruen',
    desc: 'Runder bzw. ovaler Bereich, z. B. für einen Gesprächskreis oder die Lounge.',
    parts: (o) => [G.ellipsePoly((o.w || 220) / 2, (o.d || 180) / 2, 28)],
    draw(o) {
      const w = o.w || 220;
      const d = o.d || 180;
      return zoneMarkup(o, (attrs) => `<ellipse cx="0" cy="0" rx="${f(w / 2)}" ry="${f(d / 2)}" ${attrs}/>`);
    },
    tag: (o) => zoneTag(o, o.w || 220, o.d || 180, true),
  };

  /* Schattenwurf: nur für Möbel, die über dem Boden stehen */
  for (const k in T) {
    const d = T[k];
    if (d.shadow === undefined) d.shadow = !d.wall && d.kind !== 'zone' && d.kind !== 'label' && d.kind !== 'floor' && d.kind !== 'wheelchair';
  }

  LLR.zoneArea = zoneArea;

  LLR.esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  LLR.CATEGORIES = [
    { id: 'tische', name: 'Tische' },
    { id: 'sitze', name: 'Sitzplätze & Personen' },
    { id: 'lounge', name: 'Lounge' },
    { id: 'stauraum', name: 'Möbel & Stauraum' },
    { id: 'raum', name: 'Raum & Technik' },
    { id: 'zonen', name: 'Zonen' },
    { id: 'frei', name: 'Freie Objekte' },
  ];

  LLR.TYPES = T;
  LLR.COLORS = COLORS;
  LLR.tablePoly = tablePoly;
})((window.LLR = window.LLR || {}));
