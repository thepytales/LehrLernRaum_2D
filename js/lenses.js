/* Prüfansichten im Plan: Lehrkraft-Check, Reiz- & Ruhe-Check, Sitzplan und
   Umbauplan. Jede Funktion liefert SVG-Markup für die Markierungsebene;
   k = Zentimeter je Bildschirmpixel (für gleich große Marken bei jedem Zoom). */
(function (LLR) {
  'use strict';
  const G = LLR.G;
  const T = LLR.TYPES;
  const A = LLR.analysis;
  const app = LLR.app;
  const f = (v) => Math.round(v * 100) / 100;
  const pt = (p) => `${f(p.x)} ${f(p.y)}`;
  const LEVEL = ['#2F9E44', '#F59F00', '#E03131'];
  const TEAL = '#0C8599';
  const ORANGE = '#E8590C';

  /* Statusmarke (Kreis r=7) mit Symbol: Stufe 0 = gut, 1 = eingeschränkt, 2 = Problem */
  const SYM = {
    check: '<path d="M-3.2 0 l2.2 2.4 l4.2 -4.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    bang: '<path d="M0 -3.8 v3.9" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cy="3.2" r="1.1" fill="#fff"/>',
    x: '<path d="M-2.6 -2.6 l5.2 5.2 m0 -5.2 l-5.2 5.2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
    back: '<path d="M2.8 -2.2 A3.6 3.6 0 1 0 3.3 2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M3.6 -4.4 v2.6 h-2.6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    leaf: '<path d="M-3.6 3.6 C-3.8 -1.6 -0.6 -4.2 4 -4 C4.2 0.6 1.6 3.8 -3.6 3.6 Z" fill="#fff"/><path d="M-3 3 L1.6 -1.6" stroke="' + LEVEL[0] + '" stroke-width="0.9" stroke-linecap="round"/>',
    wave: '<path d="M-4.4 0.8 q1.1 -2.4 2.2 0 t2.2 0 t2.2 0 t2.2 0" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
    bolt: '<path d="M0.9 -4.6 L-2.8 0.7 H-0.1 L-0.9 4.6 L2.8 -0.7 H0.1 Z" fill="#fff"/>',
  };
  LLR.statusGlyph = (level, sym) => `<circle r="7" fill="${LEVEL[level]}" stroke="#fff" stroke-width="1.6"/>${SYM[sym] || ''}`;
  LLR.STATUS_COLORS = LEVEL;

  const TEACHER_GLYPH = { good: [0, 'check'], side: [1, 'bang'], back: [1, 'back'], none: [2, 'x'] };
  const CALM_GLYPH = { calm: [0, 'leaf'], mid: [1, 'wave'], busy: [2, 'bolt'] };
  LLR.TEACHER_GLYPH = TEACHER_GLYPH;
  LLR.CALM_GLYPH = CALM_GLYPH;

  /* Marke am aktuellen Ort des Objekts (folgt beim Ziehen) */
  const at = (id, fallback, k, inner) => {
    const o = app.byId(id) || fallback;
    return `<g transform="translate(${pt(o)}) scale(${f(Math.max(1, k))})">${inner}</g>`;
  };

  function route(pts, color, k) {
    if (!pts || pts.length < 2) return '';
    const d = pts.map(pt).join(' L');
    const end = pts[pts.length - 1];
    return (
      `<path d="M${d}" fill="none" stroke="#fff" stroke-opacity="0.9" stroke-width="${f(7 * k)}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M${d}" fill="none" stroke="${color}" stroke-width="${f(3 * k)}" stroke-dasharray="${f(8 * k)} ${f(6 * k)}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${f(end.x)}" cy="${f(end.y)}" r="${f(5 * k)}" fill="${color}" stroke="#fff" stroke-width="${f(1.5 * k)}"/>`
    );
  }

  function chip(p, k, text, color) {
    const wpx = text.length * 6.6 + 16;
    return `<g transform="translate(${pt(p)}) scale(${f(k)})"><rect x="${f(-wpx / 2)}" y="-11" width="${f(wpx)}" height="22" rx="11" fill="${color}"/><text y="0.5" font-size="11.5" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif">${LLR.esc(text)}</text></g>`;
  }

  const selectedSeats = () => app.selectedObjects().filter(A.isSeat);

  /* ---------- Lehrkraft ---------- */
  function teacher(k) {
    const t = app.getTeacher();
    let h = '';
    // Sichtlinien von der Lehrkraft zu den Plätzen (Farbe = Blickkontakt)
    const eyeCol = { face: LEVEL[0], profile: LEVEL[1], back: LEVEL[1], blocked: LEVEL[2] };
    for (const s of t.seats) {
      if (!s.eye) continue;
      const p = t.positions[s.eye.pi];
      const o = app.byId(s.id) || s;
      h += `<line x1="${f(p.x)}" y1="${f(p.y)}" x2="${f(o.x)}" y2="${f(o.y)}" stroke="${eyeCol[s.eye.kind]}" stroke-opacity="0.32" stroke-width="${f(1.4 * k)}" ${s.eye.kind === 'blocked' ? `stroke-dasharray="${f(4 * k)} ${f(3 * k)}"` : ''}/>`;
    }
    // Weg zu ausgewählten Plätzen
    const sel = selectedSeats();
    if (sel.length && sel.length <= 6) for (const o of sel) h += route(t.route(o.id), TEAL, k);
    // angenommener Standort (ohne Lehrkraft-Objekt im Plan)
    for (const p of t.positions) {
      if (!p.implicit) continue;
      h += `<g transform="translate(${pt(p)})" opacity="0.85"><circle r="24" fill="${TEAL}" fill-opacity="0.12" stroke="${TEAL}" stroke-width="${f(1.6 * k)}" stroke-dasharray="${f(5 * k)} ${f(3 * k)}"/><circle r="9" fill="${TEAL}" fill-opacity="0.5"/></g>`;
      h += chip({ x: p.x, y: p.y - 24 - 14 * k }, k, 'angenommener Standort der Lehrkraft', TEAL);
    }
    for (const s of t.seats) {
      const [lv, sym] = TEACHER_GLYPH[s.cat];
      h += at(s.id, s, k, LLR.statusGlyph(lv, sym));
    }
    return h;
  }

  /* ---------- Reiz & Ruhe ---------- */
  /* Unter den Möbeln: Störquellen (Tür, Lounge) und Laufwege von der Tür */
  function calmFloor() {
    const c = app.getCalm();
    let h = `<defs><radialGradient id="calm-halo"><stop offset="0" stop-color="${ORANGE}" stop-opacity="0.2"/><stop offset="0.6" stop-color="${ORANGE}" stop-opacity="0.07"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></radialGradient></defs>`;
    for (const p of c.doors) h += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="300" fill="url(#calm-halo)"/>`;
    for (const p of c.lounge) h += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="200" fill="url(#calm-halo)"/>`;
    // je mehr Wege übereinander liegen, desto kräftiger
    for (const pts of c.paths()) {
      if (pts.length < 2) continue;
      h += `<path d="M${pts.map(pt).join(' L')}" fill="none" stroke="${ORANGE}" stroke-opacity="0.08" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return h;
  }

  function calm(k) {
    const c = app.getCalm();
    let h = '';
    // ausgewählter Platz: Linien zu den Störquellen und Spiegelungen
    const sel = selectedSeats();
    if (sel.length === 1) {
      const s = c.seats.find((x) => x.id === sel[0].id);
      if (s) {
        const o = sel[0];
        for (const fc of s.factors) {
          if (!fc.at || fc.pts <= 0) continue;
          h += `<line x1="${f(o.x)}" y1="${f(o.y)}" x2="${f(fc.at.x)}" y2="${f(fc.at.y)}" stroke="${ORANGE}" stroke-width="${f(2 * k)}" stroke-dasharray="${f(6 * k)} ${f(4 * k)}"/>`;
          h += chip(G.lerp(o, fc.at, 0.55), k, `${fc.label} · ${fc.detail}`, ORANGE);
        }
        for (const gl of s.glare) {
          const hit = gl.hits[Math.floor(gl.hits.length / 2)];
          h += `<path d="M${pt(o)} L${pt(hit.P)} L${pt(hit.Q)}" fill="none" stroke="#F59F00" stroke-width="${f(2 * k)}" stroke-dasharray="${f(3 * k)} ${f(3 * k)}"/>`;
          h += `<circle cx="${f(hit.P.x)}" cy="${f(hit.P.y)}" r="${f(5 * k)}" fill="#FFD43B" stroke="#F59F00" stroke-width="${f(1.4 * k)}"/>`;
          h += chip(G.lerp(hit.P, hit.Q, 0.5), k, `Spiegelung auf ${gl.s.name}`, '#E67700');
        }
      }
    }
    for (const s of c.seats) {
      const [lv, sym] = CALM_GLYPH[s.cat];
      h += at(s.id, s, k, LLR.statusGlyph(lv, sym));
    }
    return h;
  }

  /* ---------- Sitzplan & Bedarfe ---------- */
  function seating(k) {
    const fit = app.getLearnerFit();
    let h = '';
    for (const r of fit) {
      if (!r.seat) continue;
      const o = app.byId(r.seat.id) || r.seat;
      const rad = Math.max(30, (o.type === 'wheelchair' ? 45 : 30));
      if (r.checks.length) {
        h += `<circle cx="${f(o.x)}" cy="${f(o.y)}" r="${rad}" fill="${LEVEL[r.st]}" fill-opacity="0.12" stroke="${LEVEL[r.st]}" stroke-width="${f(2.2 * k)}"/>`;
        const sym = r.st === 0 ? 'check' : r.st === 1 ? 'bang' : 'x';
        h += `<g transform="translate(${f(o.x + rad * 0.72)} ${f(o.y - rad * 0.72)}) scale(${f(Math.max(1, k))})">${LLR.statusGlyph(r.st, sym)}</g>`;
      } else {
        h += `<circle cx="${f(o.x)}" cy="${f(o.y)}" r="${rad}" fill="#1F4AA8" fill-opacity="0.06" stroke="#1F4AA8" stroke-opacity="0.45" stroke-width="${f(1.4 * k)}"/>`;
      }
    }
    // Beziehungen: gestrichelt grün = möchte neben, rot = nicht neben
    const seatOf = new Map(fit.filter((r) => r.seat).map((r) => [r.learner.id, app.byId(r.seat.id) || r.seat]));
    const done = new Set();
    for (const r of fit) {
      const a = seatOf.get(r.learner.id);
      if (!a) continue;
      for (const [list, col] of [[r.learner.with || [], LEVEL[0]], [r.learner.apart || [], LEVEL[2]]]) {
        for (const id of list) {
          const b = seatOf.get(id);
          const key = [r.learner.id, id].sort().join('|') + col;
          if (!b || done.has(key)) continue;
          done.add(key);
          h += `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="${col}" stroke-opacity="0.7" stroke-width="${f(2 * k)}" stroke-dasharray="${f(5 * k)} ${f(4 * k)}"/>`;
        }
      }
    }
    return h;
  }

  /* ---------- Umbauplan (von der vorigen Phase) ---------- */
  function rebuild(k) {
    const rb = app.rebuildFromPrev();
    if (!rb) return '';
    let h = `<defs><marker id="rb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#5F3DC4"/></marker></defs>`;
    const S = app.doc.settings;
    const ghost = (o, col, dash) => {
      let s = '';
      for (const poly of A.worldParts(o, S)) s += `<path d="${G.polyPath(poly)}" fill="${col}" fill-opacity="0.08" stroke="${col}" stroke-width="${f(1.3 * k)}" stroke-dasharray="${f(dash * k)} ${f(dash * 0.7 * k)}"/>`;
      return s;
    };
    for (const m of rb.moved) h += ghost(m.from, '#5F3DC4', 4);
    for (const o of rb.removed) h += ghost(o, '#E03131', 5);
    // Pfeile: Tische und große Möbel kräftig und nummeriert, Stühle zart
    let n = 0;
    const big = rb.moved.filter((m) => m.type !== 'chair' && m.type !== 'stool' && m.dist >= 5).sort((a, b) => b.dist - a.dist);
    const small = rb.moved.filter((m) => (m.type === 'chair' || m.type === 'stool') && m.dist >= 5);
    for (const m of small) h += `<line x1="${f(m.from.x)}" y1="${f(m.from.y)}" x2="${f(m.to.x)}" y2="${f(m.to.y)}" stroke="#7950F2" stroke-opacity="0.55" stroke-width="${f(1.4 * k)}" marker-end="url(#rb-arrow)"/>`;
    for (const m of big) {
      h += `<line x1="${f(m.from.x)}" y1="${f(m.from.y)}" x2="${f(m.to.x)}" y2="${f(m.to.y)}" stroke="#fff" stroke-opacity="0.85" stroke-width="${f(6 * k)}" stroke-linecap="round"/>`;
      h += `<line x1="${f(m.from.x)}" y1="${f(m.from.y)}" x2="${f(m.to.x)}" y2="${f(m.to.y)}" stroke="#5F3DC4" stroke-width="${f(2.6 * k)}" marker-end="url(#rb-arrow)"/>`;
      n++;
      h += `<g transform="translate(${pt(m.from)}) scale(${f(k)})"><circle r="10" fill="#5F3DC4" stroke="#fff" stroke-width="2"/><text y="0.5" font-size="11" font-weight="800" fill="#fff" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif">${n}</text></g>`;
    }
    // nur gedreht
    for (const m of rb.moved) if (m.dist < 5) h += `<g transform="translate(${pt(m.to)}) scale(${f(k)})"><circle r="9" fill="#5F3DC4"/><path d="M-3.5 1.5a4 4 0 1 0 1 -4 M-3 -4.8v2.8h2.8" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    for (const o of rb.added) h += `<g transform="translate(${pt(o)}) scale(${f(k)})"><circle r="9" fill="#2F9E44" stroke="#fff" stroke-width="1.6"/><path d="M-4 0h8M0 -4v8" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></g>`;
    for (const o of rb.removed) h += `<g transform="translate(${pt(o)}) scale(${f(k)})"><circle r="9" fill="#E03131" stroke="#fff" stroke-width="1.6"/><path d="M-3 -3l6 6M3 -3l-6 6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></g>`;
    return h;
  }

  /* Umbau-Schritte als Text (Druck und Panel) */
  LLR.rebuildSteps = function (rb) {
    const name = (o) => (T[o.type] ? T[o.type].short : o.type);
    const dir = (m) => {
      const d = G.sub(m.to, m.from);
      const parts = [];
      if (Math.abs(d.y) >= 10) parts.push(`${Math.round(Math.abs(d.y))} cm ${d.y < 0 ? 'zur Tafel' : 'nach hinten'}`);
      if (Math.abs(d.x) >= 10) parts.push(`${Math.round(Math.abs(d.x))} cm nach ${d.x < 0 ? 'links' : 'rechts'}`);
      if (m.drot >= 3) parts.push(`${Math.round(m.drot)}° drehen`);
      return parts.join(', ') || 'leicht verschieben';
    };
    const big = rb.moved.filter((m) => m.type !== 'chair' && m.type !== 'stool' && m.dist >= 5).sort((a, b) => b.dist - a.dist);
    return big.map((m, i) => ({ n: i + 1, text: `${name(m)}: ${dir(m)}` }));
  };

  LLR.lenses = { teacher, calm, seating, rebuild, calmFloor };
})((window.LLR = window.LLR || {}));
