/* Möbelkatalog: Maße, Kollisionsformen und Draufsicht-Grafiken.
   Lokales Koordinatensystem: Ursprung = Objektmitte, Vorderseite = -y, Rückseite = +y.
   Wandobjekte (wall: true): Ursprung liegt auf der Wandlinie, der Raum liegt bei -y. */
(function (LLR) {
  'use strict';
  const G = LLR.G;

  const f = (v) => Math.round(v * 100) / 100;
  const rectEl = (x, y, w, h, attrs) =>
    `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" ${attrs || ''}/>`;
  const circ = (cx, cy, r, attrs) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${attrs || ''}/>`;
  const line = (x1, y1, x2, y2, attrs) =>
    `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" ${attrs || ''}/>`;
  const path = (d, attrs) => `<path d="${d}" ${attrs || ''}/>`;

  const COLORS = {
    wood: '#E9C78F',
    woodDark: '#9B7643',
    ink: '#37352F',
    frame: '#8F969E',
  };

  const CHAIR_COLORS = {
    rot: { seat: '#E0532F', back: '#B23A1C', label: 'Rot' },
    gruen: { seat: '#7DBB3C', back: '#558F23', label: 'Grün' },
  };
  const BEANBAG_COLORS = {
    gruen: { fill: '#8CC63F', label: 'Grün' },
    gelb: { fill: '#F6C343', label: 'Gelb' },
    orange: { fill: '#F28C28', label: 'Orange' },
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
    beige: { fill: '#C9A27E', line: '#8C6A4F', label: 'Beige' },
    grau: { fill: '#ADB5BD', line: '#6C757D', label: 'Grau' },
    blau: { fill: '#8DB4E2', line: '#3B6EA8', label: 'Blau' },
    gruen: { fill: '#9CCB9F', line: '#4F8A5B', label: 'Grün' },
    rot: { fill: '#E3A1A1', line: '#A94442', label: 'Rot' },
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

  function incenter(p) {
    const a = G.dist(p[1], p[2]);
    const b = G.dist(p[0], p[2]);
    const c = G.dist(p[0], p[1]);
    const s = a + b + c;
    return { x: (a * p[0].x + b * p[1].x + c * p[2].x) / s, y: (a * p[0].y + b * p[1].y + c * p[2].y) / s };
  }

  const T = {};

  T.table = {
    name: 'Dreieckstisch',
    short: 'Tisch',
    cat: 'tische',
    inv: 12,
    layer: 2,
    obstacle: true,
    kind: 'table',
    desc: 'Rechtwinkliger Dreieckstisch (Standard 120 × 60 cm). Zwei Tische ergeben ein Quadrat.',
    parts: (o, S) => [tablePoly(S)],
    draw(o, S) {
      const poly = tablePoly(S);
      const ins = G.inset(poly, 0.7);
      const ic = incenter(poly);
      let legs = '';
      for (const v of poly) {
        const p = G.add(v, G.mul(G.norm(G.sub(ic, v)), 13));
        legs += circ(p.x, p.y, 2.2, `fill="${COLORS.frame}" opacity="0.55"`);
      }
      return (
        path(G.roundedPath(ins, 6), `fill="${COLORS.wood}" stroke="${COLORS.woodDark}" stroke-width="1.2"`) + legs
      );
    },
  };

  T.tableRect = {
    name: 'Rechtecktisch',
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
      let s = rectEl(-w / 2 + 0.7, -d / 2 + 0.7, w - 1.4, d - 1.4, `rx="4" fill="${COLORS.wood}" stroke="${COLORS.woodDark}" stroke-width="1.2"`);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) s += circ(sx * (w / 2 - 8), sy * (d / 2 - 8), 2.2, `fill="${COLORS.frame}" opacity="0.55"`);
      return s;
    },
  };

  /* ---------- Sitzmöbel ---------- */
  T.chair = {
    name: 'Stuhl',
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
    desc: 'Freischwinger-Stuhl (ca. 46 × 50 cm). Teilweise mit höhenverstellbarer Fußstütze.',
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
        s += rectEl(-w / 2 + 5, -d / 2 - 21, w - 10, 16, `rx="3" fill="#D5D9DE" stroke="${COLORS.frame}" stroke-width="1"`);
        s += line(-w / 2 + 9, -d / 2 - 15, w / 2 - 9, -d / 2 - 15, `stroke="#2E5AAC" stroke-width="1.2"`);
        s += line(-w / 2 + 9, -d / 2 - 10, w / 2 - 9, -d / 2 - 10, `stroke="#2E5AAC" stroke-width="1.2"`);
      }
      s += line(-w / 2 + 2, -d / 2 + 1, -w / 2 + 2, d / 2 - 4, `stroke="${COLORS.frame}" stroke-width="2.2" stroke-linecap="round"`);
      s += line(w / 2 - 2, -d / 2 + 1, w / 2 - 2, d / 2 - 4, `stroke="${COLORS.frame}" stroke-width="2.2" stroke-linecap="round"`);
      s += rectEl(-w / 2 + 3, -d / 2 + 3, w - 6, d - 13, `rx="9" fill="${c.seat}" stroke="${COLORS.ink}" stroke-width="0.9"`);
      s += path(
        `M${f(-w / 2 + 1)} ${f(d / 2 - 12)} Q0 ${f(d / 2 - 17)} ${f(w / 2 - 1)} ${f(d / 2 - 12)} L${f(w / 2 - 2)} ${f(d / 2 - 2)} Q0 ${f(d / 2 - 6)} ${f(-w / 2 + 2)} ${f(d / 2 - 2)} Z`,
        `fill="${c.back}" stroke="${COLORS.ink}" stroke-width="0.9"`
      );
      s += rectEl(-6, d / 2 - 10, 12, 3.2, `rx="1.6" fill="#00000055"`);
      return s;
    },
  };

  T.stool = {
    name: 'Hocker (höhenverstellbar)',
    short: 'Hocker',
    cat: 'sitze',
    inv: 2,
    layer: 3,
    obstacle: true,
    kind: 'seat',
    seats: 1,
    desc: 'Höhenverstellbarer Hocker mit beweglichem Standfuß (Ø ca. 36 cm).',
    parts: () => [G.circlePoly(18, 14)],
    draw: () =>
      circ(0, 0, 18, `fill="#2F4FA8" stroke="${COLORS.ink}" stroke-width="0.9"`) +
      circ(0, 0, 12, `fill="#4467C4" stroke="#1E3578" stroke-width="0.8"`) +
      circ(0, 0, 3, `fill="#1E3578"`),
  };

  T.wheelchair = {
    name: 'Rollstuhl (Prüfobjekt)',
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
      s += rectEl(-w / 2, -d / 2, w, d, `rx="10" fill="${blue}" fill-opacity="0.10" stroke="${blue}" stroke-width="1.2" stroke-dasharray="4 3"`);
      s += rectEl(-w / 2 + 1, -d * 0.12, 9, d * 0.5, `rx="4" fill="#3A3F45"`);
      s += rectEl(w / 2 - 10, -d * 0.12, 9, d * 0.5, `rx="4" fill="#3A3F45"`);
      s += rectEl(-w / 2 + 13, -d * 0.1, w - 26, d * 0.42, `rx="5" fill="${blue}" fill-opacity="0.85"`);
      s += rectEl(-w / 2 + 12, d * 0.3, w - 24, 6, `rx="3" fill="#174EA6"`);
      s += circ(-w / 2 + 15, -d * 0.3, 4.5, `fill="#3A3F45"`);
      s += circ(w / 2 - 15, -d * 0.3, 4.5, `fill="#3A3F45"`);
      s += rectEl(-w / 2 + 14, -d / 2 + 3, w - 28, 9, `rx="2" fill="#5F6B7A"`);
      s += line(-w / 2 + 18, -d * 0.12, -w / 2 + 18, -d / 2 + 10, `stroke="#5F6B7A" stroke-width="2"`);
      s += line(w / 2 - 18, -d * 0.12, w / 2 - 18, -d / 2 + 10, `stroke="#5F6B7A" stroke-width="2"`);
      return s;
    },
  };

  T.officeChair = {
    name: 'Bürostuhl',
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
        s += line(0, 0, Math.cos(a) * 28, Math.sin(a) * 28, `stroke="#55595F" stroke-width="3" stroke-linecap="round"`);
        s += circ(Math.cos(a) * 28, Math.sin(a) * 28, 2.5, `fill="#2B2D30"`);
      }
      s += rectEl(-21, -19, 42, 36, `rx="12" fill="#B3261E" stroke="${COLORS.ink}" stroke-width="0.9"`);
      s += path('M-22 12 Q0 4 22 12 L21 22 Q0 16 -21 22 Z', `fill="#7A1A14" stroke="${COLORS.ink}" stroke-width="0.9"`);
      return s;
    },
  };

  T.sofa2 = {
    name: 'Sofa-Element (2-Sitzer)',
    short: 'Sofa',
    cat: 'lounge',
    inv: 2,
    layer: 1,
    obstacle: true,
    kind: 'lounge',
    lounge: 2,
    desc: 'Schwarzes Sofa-Element für zwei Personen (ca. 160 × 85 cm).',
    parts: () => [G.rect(160, 85)],
    draw() {
      let s = rectEl(-80, -42.5, 160, 85, `rx="8" fill="#2E3033" stroke="#111" stroke-width="1"`);
      s += rectEl(-80, 22, 160, 20.5, `rx="7" fill="#1E1F21"`);
      s += rectEl(-78, -40, 18, 62, `rx="6" fill="#1E1F21"`);
      s += rectEl(60, -40, 18, 62, `rx="6" fill="#1E1F21"`);
      s += rectEl(-58, -38, 57, 58, `rx="6" fill="#3B3E42" stroke="#18191A" stroke-width="0.8"`);
      s += rectEl(1, -38, 57, 58, `rx="6" fill="#3B3E42" stroke="#18191A" stroke-width="0.8"`);
      return s;
    },
  };

  T.sofaCorner = {
    name: 'Sofa-Eckelement',
    short: 'Sofa-Ecke',
    cat: 'lounge',
    inv: 1,
    layer: 1,
    obstacle: true,
    kind: 'lounge',
    desc: 'Eckelement, verbindet zwei Sofa-Elemente zu einer L-Form (85 × 85 cm).',
    parts: () => [G.rect(85, 85)],
    draw() {
      let s = rectEl(-42.5, -42.5, 85, 85, `rx="8" fill="#2E3033" stroke="#111" stroke-width="1"`);
      s += rectEl(-42.5, 22, 85, 20.5, `rx="7" fill="#1E1F21"`);
      s += rectEl(-42.5, -42.5, 20.5, 85, `rx="7" fill="#1E1F21"`);
      s += rectEl(-20, -40, 60, 60, `rx="6" fill="#3B3E42" stroke="#18191A" stroke-width="0.8"`);
      return s;
    },
  };

  T.beanbag = {
    name: 'Sitzsack',
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
      const c = (BEANBAG_COLORS[o.color] || BEANBAG_COLORS.gruen).fill;
      return (
        path('M-36 4 C-38 -24 -16 -38 4 -36 C26 -35 39 -18 36 6 C34 26 18 37 -2 36 C-22 36 -35 24 -36 4 Z', `fill="${c}" stroke="${COLORS.ink}" stroke-width="0.9"`) +
        path('M-18 -6 C-14 -18 4 -22 14 -14 C20 -8 18 6 8 10 C-4 14 -20 6 -18 -6 Z', `fill="#ffffff" fill-opacity="0.25"`)
      );
    },
  };

  T.rug = {
    name: 'Teppich (rund)',
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
      return (
        circ(0, 0, r, `fill="${c.fill}" fill-opacity="0.55" stroke="${c.line}" stroke-width="1"`) +
        circ(0, 0, r * 0.82, `fill="none" stroke="${c.line}" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"`) +
        circ(0, 0, r * 0.55, `fill="none" stroke="${c.line}" stroke-width="1" stroke-dasharray="2 4" opacity="0.6"`)
      );
    },
  };

  T.rugRect = {
    name: 'Teppich (eckig)',
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
      let s = rectEl(-w / 2, -d / 2, w, d, `rx="3" fill="${c.fill}" fill-opacity="0.55" stroke="${c.line}" stroke-width="1"`);
      s += rectEl(-w / 2 + m, -d / 2 + m, w - 2 * m, d - 2 * m, `rx="2" fill="none" stroke="${c.line}" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"`);
      // Fransen an den kurzen Seiten
      const alongX = w < d;
      const len = alongX ? w : d;
      const edge = (alongX ? d : w) / 2;
      for (let t = -len / 2 + 4; t <= len / 2 - 4; t += 6) {
        for (const sg of [-1, 1]) {
          s += alongX
            ? line(t, sg * (edge - 1), t, sg * (edge - 5), `stroke="${c.line}" stroke-width="0.8" opacity="0.6"`)
            : line(sg * (edge - 1), t, sg * (edge - 5), t, `stroke="${c.line}" stroke-width="0.8" opacity="0.6"`);
        }
      }
      return s;
    },
  };

  /* ---------- Raumelemente / Stauraum ---------- */
  T.shelfRound = {
    name: 'Halbrundes Bücherregal (mobil)',
    short: 'Halbrund-Regal',
    cat: 'stauraum',
    inv: 2,
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    desc: 'Mobiles halbrundes Regal (Radius ca. 70 cm). Zwei Regale bilden einen Rückzugsbereich. Drehpunkt = Kreismittelpunkt.',
    parts: () => G.arcParts(70, 36, 180, 360, 6),
    draw() {
      const R = 70;
      const r = 36;
      let s = path(
        `M-${R} 0 A${R} ${R} 0 0 1 ${R} 0 L${r} 0 A${r} ${r} 0 0 0 -${r} 0 Z`,
        `fill="${COLORS.wood}" stroke="${COLORS.woodDark}" stroke-width="1.2"`
      );
      for (let i = 1; i < 4; i++) {
        const a = G.rad(180 + i * 45);
        s += line(Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * R, Math.sin(a) * R, `stroke="${COLORS.woodDark}" stroke-width="1"`);
      }
      const books = ['#C0392B', '#2E86C1', '#F4D03F', '#27AE60', '#8E44AD'];
      for (let i = 0; i < 14; i++) {
        const a = G.rad(186 + i * 12.4);
        const rr = (R + r) / 2 + 9;
        s += line(Math.cos(a) * (rr - 6), Math.sin(a) * (rr - 6), Math.cos(a) * (rr + 6), Math.sin(a) * (rr + 6), `stroke="${books[i % books.length]}" stroke-width="3" opacity="0.75"`);
      }
      return s;
    },
  };

  T.partition = {
    name: 'Mobile Trennwand',
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
      return (
        rectEl(-w / 2, -d / 2, 6, d, `rx="2" fill="#9AA1A9"`) +
        rectEl(w / 2 - 6, -d / 2, 6, d, `rx="2" fill="#9AA1A9"`) +
        rectEl(-w / 2, -2.5, w, 5, `rx="1.5" fill="#1D3F9E" stroke="#0F2466" stroke-width="0.8"`)
      );
    },
  };

  T.desk = {
    name: 'Lehrertisch mit PC',
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
      let s = rectEl(-w / 2, -d / 2, w, d, `rx="2" fill="#E4E2DD" stroke="${COLORS.ink}" stroke-width="1"`);
      s += rectEl(-w * 0.32, d / 2 - 16, w * 0.28, 4, `rx="1" fill="#26282B"`);
      s += rectEl(w * 0.04, d / 2 - 16, w * 0.28, 4, `rx="1" fill="#26282B"`);
      s += rectEl(-w * 0.18, -d * 0.12, w * 0.36, d * 0.18, `rx="2" fill="#B9BEC4" stroke="#7D838A" stroke-width="0.6"`);
      s += rectEl(w * 0.24, -d * 0.1, 7, 11, `rx="3" fill="#B9BEC4" stroke="#7D838A" stroke-width="0.6"`);
      return s;
    },
  };

  T.cabinet = {
    name: 'Schrank (niedrig)',
    short: 'Schrank',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    resizable: true,
    defaultSize: { w: 100, d: 45 },
    minSize: { w: 30, d: 20 },
    desc: 'Schwarzer Unterschrank mit Regalaufsatz.',
    parts: (o) => [G.rect(o.w || 100, o.d || 45)],
    draw(o) {
      const w = o.w || 100;
      const d = o.d || 45;
      return (
        rectEl(-w / 2, -d / 2, w, d, `fill="#2F3134" stroke="#111" stroke-width="1"`) +
        rectEl(-w / 2 + 2, d / 2 - 12, w - 4, 10, `fill="#EDE6DA" stroke="#B9AE9C" stroke-width="0.6"`) +
        line(0, -d / 2, 0, d / 2 - 12, `stroke="#5A5D61" stroke-width="0.8"`) +
        line(-6, -d / 2 + 5, -6, -d / 2 + 13, `stroke="#9AA0A6" stroke-width="1.5"`) +
        line(6, -d / 2 + 5, 6, -d / 2 + 13, `stroke="#9AA0A6" stroke-width="1.5"`)
      );
    },
  };

  T.bookshelf = {
    name: 'Bücherregal',
    short: 'Regal',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    resizable: true,
    defaultSize: { w: 80, d: 35 },
    minSize: { w: 30, d: 20 },
    desc: 'Offenes Holzregal mit Büchern und Material.',
    parts: (o) => [G.rect(o.w || 80, o.d || 35)],
    draw(o) {
      const w = o.w || 80;
      const d = o.d || 35;
      let s = rectEl(-w / 2, -d / 2, w, d, `fill="${COLORS.wood}" stroke="${COLORS.woodDark}" stroke-width="1"`);
      const books = ['#C0392B', '#2E86C1', '#F4D03F', '#27AE60', '#8E44AD', '#E67E22'];
      const n = Math.max(3, Math.floor((w - 6) / 6));
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + 4 + i * ((w - 8) / n);
        s += rectEl(x, -d / 2 + 4, (w - 8) / n - 1.2, d - 10, `fill="${books[(i * 7) % books.length]}" opacity="0.7"`);
      }
      return s;
    },
  };

  T.drawerTower = {
    name: 'Ablageturm (Schübe)',
    short: 'Ablageturm',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    desc: 'Transparenter Schubladenturm für Material (ca. 60 × 40 cm).',
    parts: () => [G.rect(60, 40)],
    draw() {
      let s = rectEl(-30, -20, 60, 40, `rx="2" fill="#E8EEF3" stroke="#7D8C99" stroke-width="1"`);
      s += line(0, -20, 0, 20, `stroke="#7D8C99" stroke-width="0.8"`);
      s += rectEl(-24, -16, 18, 6, `rx="1.5" fill="#BFD3E6"`);
      s += rectEl(6, -16, 18, 6, `rx="1.5" fill="#BFD3E6"`);
      return s;
    },
  };

  T.rollContainer = {
    name: 'Rollcontainer (rot)',
    short: 'Rollcontainer',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    desc: 'Roter Schubladen-Rollcontainer (ca. 60 × 45 cm).',
    parts: () => [G.rect(60, 45)],
    draw: () =>
      rectEl(-30, -22.5, 60, 45, `rx="3" fill="#D64541" stroke="#7E1F1C" stroke-width="1"`) +
      rectEl(-24, -18, 48, 7, `rx="2" fill="#E8716D"`) +
      rectEl(-24, -8, 48, 7, `rx="2" fill="#E8716D"`),
  };

  T.coatRack = {
    name: 'Garderobe',
    short: 'Garderobe',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    desc: 'Garderobenständer (Ø ca. 50 cm).',
    parts: () => [G.circlePoly(25, 12)],
    draw() {
      let s = circ(0, 0, 25, `fill="#F1F3F5" stroke="#6C757D" stroke-width="1" stroke-dasharray="3 2"`);
      for (let i = 0; i < 6; i++) {
        const a = G.rad(i * 60);
        s += line(0, 0, Math.cos(a) * 18, Math.sin(a) * 18, `stroke="#495057" stroke-width="2" stroke-linecap="round"`);
      }
      return s + circ(0, 0, 5, `fill="#343A40"`);
    },
  };

  T.lamp = {
    name: 'Stehlampe',
    short: 'Lampe',
    cat: 'stauraum',
    layer: 1,
    obstacle: true,
    kind: 'furniture',
    desc: 'Stehlampe mit Dreibein (Ø ca. 45 cm).',
    parts: () => [G.circlePoly(22, 12)],
    draw() {
      let s = '';
      for (let i = 0; i < 3; i++) {
        const a = G.rad(i * 120 - 90);
        s += line(0, 0, Math.cos(a) * 22, Math.sin(a) * 22, `stroke="#343A40" stroke-width="2" stroke-linecap="round"`);
      }
      return s + circ(0, 0, 15, `fill="#212529" fill-opacity="0.85" stroke="#000" stroke-width="0.8"`) + circ(0, 0, 5, `fill="#FFE8A3"`);
    },
  };

  T.radiator = {
    name: 'Heizkörper',
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
      let s = rectEl(-w / 2, -d / 2, w, d, `fill="#F8F9FA" stroke="#868E96" stroke-width="0.8"`);
      for (let x = -w / 2 + 6; x < w / 2; x += 6) s += line(x, -d / 2 + 1.5, x, d / 2 - 1.5, `stroke="#ADB5BD" stroke-width="0.6"`);
      return s;
    },
  };

  /* ---------- Wandobjekte ---------- */
  T.iat = {
    name: 'Interaktive Tafel (IAT)',
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
      s += rectEl(-200, -4, 100, 4, `fill="#2F5B3A" stroke="#1D3A25" stroke-width="0.8"`);
      s += rectEl(100, -4, 100, 4, `fill="#2F5B3A" stroke="#1D3A25" stroke-width="0.8"`);
      s += rectEl(-50, -58, 100, 52, `rx="5" fill="none" stroke="#868E96" stroke-width="1.6"`);
      s += line(-45, -56, -45, -8, `stroke="#9AA0A6" stroke-width="5" stroke-linecap="round"`);
      s += line(45, -56, 45, -8, `stroke="#9AA0A6" stroke-width="5" stroke-linecap="round"`);
      s += rectEl(-36, -14, 16, 8, `fill="#212529"`) + rectEl(20, -14, 16, 8, `fill="#212529"`);
      s += rectEl(-100, -10, 200, 10, `rx="1.5" fill="#1B1D20"`);
      s += rectEl(-96, -8, 192, 3.5, `fill="#5AA9E6"`);
      return s;
    },
  };

  T.screen = {
    name: 'Bildschirm (Wand)',
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
      return rectEl(-w / 2, -8, w, 8, `rx="1.5" fill="#1B1D20"`) + rectEl(-w / 2 + 3, -6.5, w - 6, 3, `fill="#5AA9E6"`);
    },
  };

  T.projection = {
    name: 'Projektionsfläche (Beamer)',
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
      return rectEl(-w / 2, -6, w, 6, `fill="#FFFFFF" stroke="#5C7CFA" stroke-width="1" stroke-dasharray="4 2"`) + line(-w / 2 + 4, -3, w / 2 - 4, -3, `stroke="#BAC8FF" stroke-width="1.5"`);
    },
  };

  T.tablets = {
    name: 'Tablet-Wand',
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
      for (let i = 0; i < 5; i++) s += rectEl(-106 + i * 44, -6, 36, 6, `rx="1" fill="#1B1D20"`);
      return s;
    },
  };

  T.door = {
    name: 'Tür',
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
      s += line(-w / 2, 0, -w / 2, 20, `stroke="#37352F" stroke-width="1.5"`);
      s += line(w / 2, 0, w / 2, 20, `stroke="#37352F" stroke-width="1.5"`);
      const hy = off;
      s += line(hx, hy, hx, hy + dir * w, `stroke="#F08C00" stroke-width="3" stroke-linecap="round"`);
      const sweep = (m > 0) === (dir < 0) ? 1 : 0;
      s += path(`M${f(hx)} ${f(hy + dir * w)} A${f(w)} ${f(w)} 0 0 ${sweep} ${f(-hx)} ${f(hy)}`, `fill="none" stroke="#F08C00" stroke-width="1" stroke-dasharray="4 3"`);
      return s;
    },
  };

  T.window = {
    name: 'Fenster',
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
    desc: 'Fenster in der Außenwand (nur Darstellung).',
    parts: (o) => [G.rect(o.w || 180, 20, 0, 10)],
    draw(o) {
      const w = o.w || 180;
      return (
        rectEl(-w / 2, 0, w, 20, `fill="#E7F5FF" stroke="#4C6EF5" stroke-width="0.8"`) +
        line(-w / 2, 8, w / 2, 8, `stroke="#4C6EF5" stroke-width="0.8"`) +
        line(-w / 2, 12, w / 2, 12, `stroke="#4C6EF5" stroke-width="0.8"`)
      );
    },
  };

  /* ---------- Freie Objekte ---------- */
  T.rect = {
    name: 'Freies Objekt (eckig)',
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
      return rectEl(-(o.w || 100) / 2, -(o.d || 60) / 2, o.w || 100, o.d || 60, `rx="3" fill="${c}" stroke="${COLORS.ink}" stroke-width="1"`);
    },
  };

  T.circle = {
    name: 'Freies Objekt (rund)',
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
      return circ(0, 0, (o.w || 80) / 2, `fill="${c}" stroke="${COLORS.ink}" stroke-width="1"`);
    },
  };

  T.label = {
    name: 'Textnotiz',
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
    desc: 'Bereich im Raum markieren, z. B. Ruhezone, Präsentation oder Gruppenarbeit. Anfassen am Rand oder am Namensschild.',
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

  LLR.zoneArea = zoneArea;

  LLR.esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  LLR.CATEGORIES = [
    { id: 'tische', name: 'Tische' },
    { id: 'sitze', name: 'Sitzplätze' },
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
