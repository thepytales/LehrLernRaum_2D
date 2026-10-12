/* Kern des Raumplaners: Zustand, Darstellung und Bedienung */
(function (LLR) {
  'use strict';
  const G = LLR.G;
  const T = LLR.TYPES;
  const A = LLR.analysis;
  const NS = 'http://www.w3.org/2000/svg';
  const KEY_AUTO = 'llr2d.autosave.v1';
  const WALL = 20;
  /* Bedien-Einstellungen: gelten sofort und gehören nicht zum Rückgängig-Verlauf */
  const PREF_KEYS = ['snap', 'carryChairs', 'angleSnap', 'grid', 'gridSnap'];
  const GRID_MAJOR = { 10: 50, 20: 100, 25: 100, 50: 100, 100: 500 };
  const HATCH = '<pattern id="hatch-wall" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#5B6168"/><line x1="0" y1="0" x2="0" y2="8" stroke="#6E747B" stroke-width="3"/></pattern>';
  const SIGHT_COLORS = { good: '#2F9E44', side: '#F59F00', back: '#E03131', none: '#E03131', hidden: '#E03131' };

  const app = {
    doc: null,
    sel: new Set(),
    undoStack: [],
    redoStack: [],
    view: { x: 0, y: 0, w: 800, h: 900 },
    mode: 'select',
    multi: false,
    overlay: { access: false, sight: false, grid: true, dims: true },
    measure: null,
    drag: null,
    pointers: new Map(),
    clipboard: null,
    access: null,
    problems: new Map(),
    listeners: {},
    els: {},
    nodes: new Map(),
  };
  LLR.app = app;

  const f = (v) => Math.round(v * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const def = (o) => T[o.type];
  const S = () => app.doc.settings;
  const byId = (id) => app.doc.objects.find((o) => o.id === id);
  const isTable = A.isTable;

  app.on = (ev, fn) => (app.listeners[ev] = app.listeners[ev] || []).push(fn);
  app.emit = (ev, data) => (app.listeners[ev] || []).forEach((fn) => fn(data));
  app.byId = byId;
  app.def = def;

  /* ---------- Geometrie je Objekt ---------- */
  app.localParts = (o) => def(o).parts(o, S());
  app.worldParts = (o) => app.localParts(o).map((p) => G.toWorld(p, o));
  app.localBounds = (o) => {
    const d = def(o);
    if (d.bounds) return d.bounds(o, S());
    const bb = G.bbox([].concat(...app.localParts(o)));
    return [
      { x: bb.minX, y: bb.minY },
      { x: bb.maxX, y: bb.minY },
      { x: bb.maxX, y: bb.maxY },
      { x: bb.minX, y: bb.maxY },
    ];
  };
  app.worldBounds = (o) => G.toWorld(app.localBounds(o), o);

  /* ---------- Dokument ---------- */
  app.buildPreset = function (preset, doc) {
    const objs = preset.build(doc.settings, doc.room);
    return LLR.colorChairs(objs.map((o) => Object.assign({}, o, { id: LLR.newId() })));
  };

  app.createDoc = function (presetId) {
    const room = Object.assign({}, LLR.DEFAULT_ROOM);
    const settings = Object.assign({}, LLR.DEFAULT_SETTINGS);
    const doc = { v: 1, name: 'Neuer Raumplan', room, settings, objects: LLR.roomFurniture(room) };
    const preset = LLR.PRESETS.find((p) => p.id === (presetId || 'seminar1'));
    if (preset) {
      if (preset.shelves) doc.objects = doc.objects.filter((o) => o.type !== 'shelfRound');
      doc.objects = doc.objects.concat(app.buildPreset(preset, doc));
      doc.name = preset.name;
    }
    return doc;
  };

  app.normalizeDoc = function (raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.objects)) throw new Error('Ungültige Plandatei');
    const room = Object.assign({}, LLR.DEFAULT_ROOM, raw.room || {});
    room.w = clamp(Number(room.w) || LLR.DEFAULT_ROOM.w, 200, 3000);
    room.l = clamp(Number(room.l) || LLR.DEFAULT_ROOM.l, 200, 3000);
    const settings = Object.assign({}, LLR.DEFAULT_SETTINGS, raw.settings || {});
    settings.grid = clamp(Math.round(Number(settings.grid)) || LLR.DEFAULT_SETTINGS.grid, 5, 500);
    settings.gridSnap = !!settings.gridSnap;
    const objects = [];
    for (const o of raw.objects) {
      if (!o || !T[o.type]) continue;
      const c = Object.assign({}, o);
      c.id = typeof c.id === 'string' && c.id ? c.id : LLR.newId();
      c.x = Number(c.x) || 0;
      c.y = Number(c.y) || 0;
      c.rot = G.normAngle(Number(c.rot) || 0);
      objects.push(c);
    }
    const ids = new Set();
    for (const o of objects) {
      if (ids.has(o.id)) o.id = LLR.newId();
      ids.add(o.id);
    }
    return { v: 1, name: String(raw.name || 'Raumplan').slice(0, 120), room, settings, objects };
  };

  app.serialize = () => JSON.stringify(app.doc);

  app.setDoc = function (doc, opts) {
    app.doc = app.normalizeDoc(doc);
    app.sel = new Set([...app.sel].filter((id) => byId(id)));
    if (!opts || !opts.keepHistory) {
      app.undoStack = [];
      app.redoStack = [];
    }
    app.measure = null;
    app.renderRoom();
    if (!opts || !opts.keepView) app.fitView();
    app.changed({ skipHistory: true });
    app.emit('select');
  };

  app.pushHistory = function (before) {
    if (before === undefined || before === app.serialize()) return;
    app.undoStack.push(before);
    if (app.undoStack.length > 200) app.undoStack.shift();
    app.redoStack = [];
    app.emit('history');
  };

  /* Änderung mit Undo-Eintrag durchführen */
  app.mutate = function (fn, opts) {
    const before = app.serialize();
    const roomBefore = JSON.stringify(app.doc.room) + JSON.stringify(app.doc.settings);
    fn(app.doc);
    const roomAfter = JSON.stringify(app.doc.room) + JSON.stringify(app.doc.settings);
    if (roomBefore !== roomAfter) app.renderRoom();
    app.pushHistory(before);
    app.changed(opts);
  };

  const keepPrefs = (next) => {
    for (const k of PREF_KEYS) if (k in app.doc.settings) next.settings[k] = app.doc.settings[k];
    return next;
  };

  app.undo = function () {
    if (!app.undoStack.length) return;
    app.redoStack.push(app.serialize());
    app.doc = keepPrefs(JSON.parse(app.undoStack.pop()));
    app.sel = new Set([...app.sel].filter((id) => byId(id)));
    app.renderRoom();
    app.changed({ skipHistory: true });
    app.emit('select');
    app.emit('history');
  };

  app.redo = function () {
    if (!app.redoStack.length) return;
    app.undoStack.push(app.serialize());
    app.doc = keepPrefs(JSON.parse(app.redoStack.pop()));
    app.sel = new Set([...app.sel].filter((id) => byId(id)));
    app.renderRoom();
    app.changed({ skipHistory: true });
    app.emit('select');
    app.emit('history');
  };

  /* Bedien-Einstellung umschalten (Einrasten, Stühle mitnehmen, Raster) */
  app.setPref = function (key, val) {
    app.doc.settings[key] = val;
    if (key === 'grid') app.renderRoom();
    app.autosave();
    app.renderOverlay();
    app.emit('prefs');
  };

  let saveTimer = null;
  app.autosave = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY_AUTO, app.serialize());
      } catch (e) {
        /* Speicher nicht verfügbar */
      }
    }, 400);
  };
  app.loadAutosave = function () {
    try {
      const s = localStorage.getItem(KEY_AUTO);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  };

  /* Nach jeder Änderung: neu zeichnen, analysieren, speichern */
  app.changed = function (opts) {
    opts = opts || {};
    app.renderObjects();
    app.problems = A.problems(app.doc);
    app.scheduleAnalysis(opts.fast ? 140 : 0);
    app.renderOverlay();
    if (!opts.live) {
      app.autosave();
      app.emit('change');
    } else {
      app.emit('live');
    }
  };

  /* ---------- SVG-Grundgerüst ---------- */
  const el = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  app.mount = function (svg) {
    app.svg = svg;
    svg.innerHTML = '';
    app.els.defs = el('defs', {}, svg);
    app.els.defs.innerHTML = HATCH;
    app.els.floor = el('g', { id: 'layer-floor' }, svg);
    app.els.analysis = el('g', { id: 'layer-analysis' }, svg);
    app.els.walls = el('g', { id: 'layer-walls' }, svg);
    app.els.objects = el('g', { id: 'layer-objects' }, svg);
    app.els.tags = el('g', { id: 'layer-tags' }, svg);
    app.els.marks = el('g', { id: 'layer-marks', 'pointer-events': 'none' }, svg);
    app.els.overlay = el('g', { id: 'layer-overlay' }, svg);
    app.nodes = new Map();
    bindPointer(svg);
    new ResizeObserver(() => app.syncAspect()).observe(svg);
  };

  app.renderRoom = function () {
    const W = app.doc.room.w;
    const L = app.doc.room.l;
    const g = S().grid || 50;
    const M = GRID_MAJOR[g] || g * 4;
    app.els.defs.innerHTML =
      `<pattern id="grid-s" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><path d="M${g} 0H0V${g}" fill="none" stroke="#D9D4C8" stroke-width="${g < 25 ? 0.45 : 0.6}"/></pattern>` +
      `<pattern id="grid-l" width="${M}" height="${M}" patternUnits="userSpaceOnUse"><rect width="${M}" height="${M}" fill="url(#grid-s)"/><path d="M${M} 0H0V${M}" fill="none" stroke="#C9C2B3" stroke-width="1"/></pattern>` +
      HATCH;
    const fl = app.els.floor;
    fl.innerHTML =
      `<rect x="0" y="0" width="${W}" height="${L}" fill="#FBF8F2"/>` +
      (app.overlay.grid ? `<rect x="0" y="0" width="${W}" height="${L}" fill="url(#grid-l)"/>` : '');
    let w = `<path fill-rule="evenodd" fill="url(#hatch-wall)" stroke="#3F444A" stroke-width="1" d="M${-WALL} ${-WALL}H${W + WALL}V${L + WALL}H${-WALL}Z M0 0V${L}H${W}V0Z"/>`;
    // Wände ziehen = Raumgröße ändern (unsichtbare Griffflächen)
    const band = (x, y, bw, bh, hx, hy) => {
      const cur = hx && hy ? (hx === hy ? 'nwse-resize' : 'nesw-resize') : hx ? 'ew-resize' : 'ns-resize';
      return `<rect data-handle="room" data-hx="${hx}" data-hy="${hy}" x="${x}" y="${y}" width="${bw}" height="${bh}" fill="transparent" style="cursor:${cur}"/>`;
    };
    w += band(0, -WALL, W, WALL, 0, -1) + band(0, L, W, WALL, 0, 1) + band(-WALL, 0, WALL, L, -1, 0) + band(W, 0, WALL, L, 1, 0);
    w += band(-WALL, -WALL, WALL, WALL, -1, -1) + band(W, -WALL, WALL, WALL, 1, -1) + band(-WALL, L, WALL, WALL, -1, 1) + band(W, L, WALL, WALL, 1, 1);
    if (app.overlay.dims) {
      const ty = -WALL - 22;
      const lx = -WALL - 22;
      w += `<g font-family="system-ui, sans-serif" font-size="15" fill="#495057" text-anchor="middle">`;
      w += `<line x1="0" y1="${ty}" x2="${W}" y2="${ty}" stroke="#868E96" stroke-width="1"/>`;
      w += `<line x1="0" y1="${ty - 6}" x2="0" y2="${ty + 6}" stroke="#868E96"/><line x1="${W}" y1="${ty - 6}" x2="${W}" y2="${ty + 6}" stroke="#868E96"/>`;
      w += `<text x="${W / 2}" y="${ty - 7}" paint-order="stroke" stroke="#F1F3F5" stroke-width="5">Raumbreite ${fmtM(W)}</text>`;
      w += `<line x1="${lx}" y1="0" x2="${lx}" y2="${L}" stroke="#868E96" stroke-width="1"/>`;
      w += `<line x1="${lx - 6}" y1="0" x2="${lx + 6}" y2="0" stroke="#868E96"/><line x1="${lx - 6}" y1="${L}" x2="${lx + 6}" y2="${L}" stroke="#868E96"/>`;
      w += `<text transform="translate(${lx - 7} ${L / 2}) rotate(-90)" paint-order="stroke" stroke="#F1F3F5" stroke-width="5">Raumlänge ${fmtM(L)}</text>`;
      w += `<text x="${W / 2}" y="${L + WALL + 26}" font-size="14" fill="#868E96">${fmtArea(W * L)} · Raster ${g} cm</text>`;
      w += `</g>`;
    }
    app.els.walls.innerHTML = w;
  };

  const fmtM = (cm) => (cm / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
  const fmtArea = (cm2) => (cm2 / 10000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' m²';
  app.fmtM = fmtM;
  app.fmtArea = fmtArea;

  /* ---------- Objekte zeichnen ---------- */
  const shapeKey = (o) => {
    const s = S();
    return [
      o.type, o.w, o.d, o.color, o.foot, o.mirror, o.outward, o.text, o.size, o.label,
      o.type === 'table' ? s.tableBase + 'x' + s.tableHeight : '',
      o.type === 'chair' ? s.chairW + 'x' + s.chairD : '',
    ].join('|');
  };

  function buildNode(n, o) {
    const d = def(o);
    let html = '<g class="shape">' + d.draw(o, S()) + '</g>';
    if (d.hitPad) {
      const b = G.bbox(app.localBounds(o));
      html += `<rect x="${f(b.minX - 4)}" y="${f(b.minY - 4)}" width="${f(b.w + 8)}" height="${f(b.h + 8)}" fill="transparent"/>`;
    }
    if (o.label && d.kind !== 'label' && d.kind !== 'zone') {
      const fs = d.kind === 'seat' ? 10 : 13;
      html += `<g class="lbl"><text x="0" y="0" font-size="${fs}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-weight="700" fill="#111" paint-order="stroke" stroke="#fff" stroke-width="3" stroke-linejoin="round">${LLR.esc(o.label)}</text></g>`;
    }
    n.g.innerHTML = html;
    n.lbl = n.g.querySelector('.lbl');
    // Namensschild (Zonen) in eigener Ebene über den Möbeln
    if (d.tag) {
      if (!n.tag) n.tag = el('g', { 'data-id': o.id, class: 'obj' }, app.els.tags);
      n.tag.innerHTML = d.tag(o, S());
    } else if (n.tag) {
      n.tag.remove();
      n.tag = null;
    }
  }

  function setTransform(n, o) {
    const tf = `translate(${f(o.x)} ${f(o.y)}) rotate(${f(o.rot || 0)})`;
    n.g.setAttribute('transform', tf);
    if (n.tag) n.tag.setAttribute('transform', tf);
    if (n.lbl) n.lbl.setAttribute('transform', `rotate(${f(-(o.rot || 0))})`);
  }

  app.renderObjects = function () {
    const layer = app.els.objects;
    const seen = new Set();
    const sorted = app.doc.objects
      .map((o, i) => ({ o, i }))
      .sort((a, b) => def(a.o).layer - def(b.o).layer || a.i - b.i)
      .map((x) => x.o);
    let idx = 0;
    for (const o of sorted) {
      seen.add(o.id);
      let n = app.nodes.get(o.id);
      if (!n) {
        n = { g: el('g', { 'data-id': o.id, class: 'obj' }), key: null };
        app.nodes.set(o.id, n);
      }
      const key = shapeKey(o);
      if (n.key !== key) {
        buildNode(n, o);
        n.key = key;
      }
      n.g.classList.toggle('locked', !!o.locked);
      if (n.tag) n.tag.classList.toggle('locked', !!o.locked);
      n.g.setAttribute('aria-label', def(o).name + (o.label ? ': ' + o.label : ''));
      setTransform(n, o);
      if (layer.children[idx] !== n.g) layer.insertBefore(n.g, layer.children[idx] || null);
      idx++;
    }
    for (const [id, n] of app.nodes) {
      if (!seen.has(id)) {
        n.g.remove();
        if (n.tag) n.tag.remove();
        app.nodes.delete(id);
      }
    }
  };

  app.updateTransforms = function (ids) {
    for (const id of ids) {
      const n = app.nodes.get(id);
      const o = byId(id);
      if (n && o) setTransform(n, o);
    }
  };

  /* ---------- Analyse-Ebene ---------- */
  let anaTimer = null;
  let anaLast = 0;
  app.scheduleAnalysis = function (throttle) {
    if (!app.overlay.access) {
      app.access = null;
      app.els.analysis.innerHTML = '';
      return;
    }
    const run = () => {
      anaTimer = null;
      anaLast = performance.now();
      app.access = A.access(app.doc);
      const im = app.access.image;
      app.els.analysis.innerHTML = im ? `<image href="${im.url}" x="0" y="0" width="${im.w}" height="${im.h}" preserveAspectRatio="none" opacity="1"/>` : '';
      app.renderMarks();
      app.emit('analysis');
    };
    if (!throttle) {
      clearTimeout(anaTimer);
      anaTimer = null;
      run();
      return;
    }
    if (anaTimer) return;
    const wait = Math.max(0, throttle - (performance.now() - anaLast));
    anaTimer = setTimeout(run, wait);
  };

  /* Markierungen: Rollstuhlplätze und Sicht */
  app.renderMarks = function () {
    const k = app.px();
    let h = '';
    if (app.overlay.access && app.access) {
      for (const t of app.access.tables) {
        for (const s of t.spots) {
          const p = s.anchor;
          const sc = s.now ? 1 : 0.72;
          h += `<g transform="translate(${f(p.x)} ${f(p.y)}) scale(${sc})" opacity="${s.now ? 1 : 0.85}">`;
          h += `<circle r="9.5" fill="${s.now ? '#1F6FEB' : '#ffffff'}" stroke="#1F6FEB" stroke-width="${s.now ? 1.6 : 1.4}" ${s.now ? '' : 'stroke-dasharray="3 2"'}/>`;
          h += `<path d="M-1.5 -5.2 a1.6 1.6 0 1 1 0.01 0 M-1.8 -2.6 v4 h4.5 l2 4 M-1.8 -0.5 h3.5 M-3.2 -0.8 a4.2 4.2 0 1 0 5.6 5" fill="none" stroke="${s.now ? '#fff' : '#1F6FEB'}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;
          h += `</g>`;
        }
      }
    }
    if (app.overlay.sight) {
      const sight = A.sight(app.doc);
      app.sightResult = sight;
      const col = SIGHT_COLORS;
      // Sichtkegel nur für ausgewählte Sitzplätze, sonst wird es unübersichtlich
      const coneIds = [...app.sel].filter((id) => {
        const o = byId(id);
        return o && A.isSeat(o);
      });
      if (coneIds.length <= 8) for (const id of coneIds) h += coneMarkup(A.sightCone(app.doc, id), k);
      for (const s of sight.seats) {
        const c = col[s.cat];
        h += `<circle cx="${f(s.x)}" cy="${f(s.y)}" r="7" fill="${c}" stroke="#fff" stroke-width="1.6"/>`;
        if (s.cat === 'good') h += `<path d="M${f(s.x - 3.2)} ${f(s.y)} l2.2 2.4 l4.2 -4.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
        else if (s.cat === 'side') h += `<path d="M${f(s.x - 3)} ${f(s.y)} h6 m-2.4 -2.6 l2.4 2.6 l-2.4 2.6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
        else h += `<path d="M${f(s.x - 2.6)} ${f(s.y - 2.6)} l5.2 5.2 m0 -5.2 l-5.2 5.2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`;
      }
    } else {
      app.sightResult = null;
    }
    app.els.marks.innerHTML = h;
  };

  /* Sichtkegel eines Sitzplatzes: Blickfeld (±40°) und je Präsentationsfläche
     ein Dreieck vom Platz zur Fläche – sichtbare Teile farbig, verdeckte rot gestrichelt */
  function coneMarkup(cone, k) {
    if (!cone) return '';
    const e = cone.eye;
    const pt = (p) => `${f(p.x)} ${f(p.y)}`;
    let h = '';
    if (!cone.free) {
      const R = 110;
      const a0 = G.add(e, G.rot(G.mul(cone.face, R), -40));
      const a1 = G.add(e, G.rot(G.mul(cone.face, R), 40));
      h += `<path d="M${pt(e)} L${pt(a0)} A${R} ${R} 0 0 1 ${pt(a1)} Z" fill="#4DABF7" fill-opacity="0.16" stroke="#1C7ED6" stroke-width="${f(k)}" stroke-dasharray="${f(4 * k)} ${f(3 * k)}"/>`;
    }
    const views = cone.views.slice().sort((x, y) => (x === cone.best) - (y === cone.best));
    for (const v of views) {
      const strong = v === cone.best;
      const c = SIGHT_COLORS[v.turn];
      const op = strong ? 0.3 : 0.12;
      for (const r of v.runs) {
        const p0 = G.lerp(v.s.a, v.s.b, r.t0);
        const p1 = G.lerp(v.s.a, v.s.b, r.t1);
        if (r.vis) h += `<path d="M${pt(e)} L${pt(p0)} L${pt(p1)} Z" fill="${c}" fill-opacity="${op}"/>`;
        else h += `<path d="M${pt(e)} L${pt(p0)} L${pt(p1)} Z" fill="#E03131" fill-opacity="${f(op * 0.7)}" stroke="#E03131" stroke-width="${f(0.9 * k)}" stroke-dasharray="${f(3 * k)} ${f(3 * k)}" stroke-opacity="0.8"/>`;
      }
      const lc = v.cat === 'hidden' ? '#E03131' : c;
      const lo = strong ? 0.9 : 0.45;
      h += `<path d="M${pt(v.s.a)} L${pt(e)} L${pt(v.s.b)}" fill="none" stroke="${lc}" stroke-opacity="${lo}" stroke-width="${f(1.3 * k)}"/>`;
      h += `<line x1="${f(v.s.a.x)}" y1="${f(v.s.a.y)}" x2="${f(v.s.b.x)}" y2="${f(v.s.b.y)}" stroke="${lc}" stroke-opacity="${lo}" stroke-width="${f(4 * k)}" stroke-linecap="round"/>`;
      let label = `${v.s.name} · ${fmtM(v.dist)}`;
      if (!cone.free) label += ` · ${Math.round(v.ang)}°`;
      if (v.frac < 0.999) label += ` · ${Math.round(v.frac * 100)} % sichtbar`;
      const m = G.lerp(e, v.s.p, 0.62);
      const wpx = label.length * 6.3 + 16;
      const bg = strong ? lc : '#ffffff';
      const fg = strong ? '#ffffff' : lc;
      h += `<g transform="translate(${pt(m)}) scale(${f(k)})"><rect x="${f(-wpx / 2)}" y="-10" width="${f(wpx)}" height="20" rx="10" fill="${bg}" stroke="${lc}" stroke-width="1.2"/><text y="0.5" font-size="11.5" font-weight="700" fill="${fg}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif">${LLR.esc(label)}</text></g>`;
    }
    return h;
  }

  /* Griffe zum Ändern der Größe (Kanten und Ecken) */
  function resizeHandles(o, k) {
    const d = def(o);
    if (!d.resizable || d.wall || o.locked) return '';
    const lb = G.bbox(app.localBounds(o));
    const showX = d.handles !== 'd';
    const showY = d.handles !== 'w' && !d.widthOnly;
    const corners = showX && showY && !d.round;
    const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
    let h = '';
    for (const hx of [-1, 0, 1]) {
      for (const hy of [-1, 0, 1]) {
        if ((!hx && !hy) || (hx && !showX) || (hy && !showY)) continue;
        if (hx && hy && !corners) continue;
        // bei kleinen Objekten nur die Ecken
        if (corners && !hx && lb.w / k < 34) continue;
        if (corners && !hy && lb.h / k < 34) continue;
        const local = { x: hx < 0 ? lb.minX : hx > 0 ? lb.maxX : (lb.minX + lb.maxX) / 2, y: hy < 0 ? lb.minY : hy > 0 ? lb.maxY : (lb.minY + lb.maxY) / 2 };
        const p = G.toWorld([local], o)[0];
        const ang = ((G.angle(G.rot({ x: hx, y: hy }, o.rot || 0)) % 180) + 180) % 180;
        const cur = cursors[Math.round(ang / 45) % 4];
        h += `<g data-handle="resize" data-hx="${hx}" data-hy="${hy}" transform="translate(${f(p.x)} ${f(p.y)}) scale(${f(k)}) rotate(${f(o.rot || 0)})" style="cursor:${cur}"><circle r="13" fill="transparent"/><rect x="-5" y="-5" width="10" height="10" rx="2" fill="#fff" stroke="#1971C2" stroke-width="1.8"/></g>`;
      }
    }
    return h;
  }

  /* Griffe an den Wänden zum Ändern der Raumgröße */
  function roomHandles(k) {
    const W = app.doc.room.w;
    const L = app.doc.room.l;
    const m = WALL / 2;
    const pts = [
      [0, -1, W / 2, -m], [0, 1, W / 2, L + m], [-1, 0, -m, L / 2], [1, 0, W + m, L / 2],
      [-1, -1, -m, -m], [1, -1, W + m, -m], [-1, 1, -m, L + m], [1, 1, W + m, L + m],
    ];
    const st = 'fill="#fff" stroke="#1971C2" stroke-width="1.8"';
    let h = '';
    for (const [hx, hy, x, y] of pts) {
      const cur = hx && hy ? (hx === hy ? 'nwse-resize' : 'nesw-resize') : hx ? 'ew-resize' : 'ns-resize';
      let shape;
      if (hx && hy) shape = `<rect x="-6" y="-6" width="12" height="12" rx="2.5" ${st}/>`;
      else if (hy) shape = `<rect x="-18" y="-6" width="36" height="12" rx="6" ${st}/><path d="M-7 -2h14M-7 2h14" stroke="#1971C2" stroke-width="1.4" stroke-linecap="round"/>`;
      else shape = `<rect x="-6" y="-18" width="12" height="36" rx="6" ${st}/><path d="M-2 -7v14M2 -7v14" stroke="#1971C2" stroke-width="1.4" stroke-linecap="round"/>`;
      h += `<g data-handle="room" data-hx="${hx}" data-hy="${hy}" transform="translate(${f(x)} ${f(y)}) scale(${f(k)})" style="cursor:${cur}"><circle r="16" fill="transparent"/>${shape}</g>`;
    }
    return h;
  }

  /* Kleines Etikett (z. B. Maße beim Ziehen) */
  function chip(p, k, text, color) {
    const wpx = text.length * 7 + 18;
    return `<g transform="translate(${f(p.x)} ${f(p.y)}) scale(${f(k)})" pointer-events="none"><rect x="${f(-wpx / 2)}" y="-12" width="${f(wpx)}" height="24" rx="12" fill="${color || '#1971C2'}"/><text y="0.5" font-size="12.5" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif">${LLR.esc(text)}</text></g>`;
  }

  /* ---------- Overlay: Auswahl, Griffe, Abstände ---------- */
  app.px = function () {
    const r = app.svg.getBoundingClientRect();
    return r.width ? app.view.w / r.width : 1;
  };

  app.renderOverlay = function () {
    if (!app.doc) return;
    const k = app.px();
    let h = '';
    const sw = f(1.5 * k);
    // Probleme (Überschneidungen / außerhalb)
    for (const [id, why] of app.problems) {
      const o = byId(id);
      if (!o) continue;
      for (const poly of app.worldParts(o)) {
        h += `<path d="${G.polyPath(poly)}" fill="#E03131" fill-opacity="0.18" stroke="#E03131" stroke-width="${f(2 * k)}" pointer-events="none"/>`;
      }
      void why;
    }
    // Wendekreise von Rollstühlen
    for (const o of app.doc.objects) {
      if (o.type !== 'wheelchair' || !o.turn) continue;
      const r = S().turning / 2;
      const circle = G.circlePoly(r, 32, o.x, o.y);
      let hit = false;
      const W = app.doc.room.w;
      const L = app.doc.room.l;
      if (o.x - r < 0 || o.y - r < 0 || o.x + r > W || o.y + r > L) hit = true;
      if (!hit) {
        for (const other of app.doc.objects) {
          if (other.id === o.id || !A.isObstacle(other, S(), !S().chairsBlock)) continue;
          if (Math.abs(other.x - o.x) > r + 200 || Math.abs(other.y - o.y) > r + 200) continue;
          for (const p of app.worldParts(other)) {
            if (G.satDepth(circle, p) > 1) {
              hit = true;
              break;
            }
          }
          if (hit) break;
        }
      }
      const c = hit ? '#E03131' : '#2F9E44';
      h += `<circle cx="${f(o.x)}" cy="${f(o.y)}" r="${r}" fill="${c}" fill-opacity="0.08" stroke="${c}" stroke-width="${f(1.6 * k)}" stroke-dasharray="${f(8 * k)} ${f(5 * k)}" pointer-events="none"/>`;
      h += `<text x="${f(o.x)}" y="${f(o.y - r - 6 * k)}" font-size="${f(12 * k)}" text-anchor="middle" fill="${c}" font-family="system-ui, sans-serif" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="${f(3 * k)}" pointer-events="none">Wendekreis Ø ${S().turning} cm ${hit ? '– zu eng' : '– passt'}</text>`;
    }
    // Auswahl
    const selObjs = [...app.sel].map(byId).filter(Boolean);
    for (const o of selObjs) {
      const b = app.worldBounds(o);
      h += `<path d="${G.polyPath(b)}" fill="none" stroke="#1971C2" stroke-width="${sw}" stroke-dasharray="${f(5 * k)} ${f(3 * k)}" pointer-events="none"/>`;
      if (o.locked) {
        const c = b[1];
        h += `<g transform="translate(${f(c.x)} ${f(c.y)}) scale(${f(k)})" pointer-events="none"><circle r="9" fill="#495057"/><path d="M-3.5 -0.5h7v5h-7z M-2 -0.5v-2.2a2 2 0 0 1 4 0v2.2" fill="none" stroke="#fff" stroke-width="1.4"/></g>`;
      }
    }
    const movable = selObjs.filter((o) => !o.locked && !def(o).wall);
    if (movable.length && app.mode === 'select') {
      let hp;
      let anchor;
      if (movable.length === 1 && selObjs.length === 1) {
        const o = movable[0];
        const lb = G.bbox(app.localBounds(o));
        const top = G.toWorld([{ x: (lb.minX + lb.maxX) / 2, y: lb.minY }], o)[0];
        const dir = G.rot({ x: 0, y: -1 }, o.rot || 0);
        anchor = top;
        hp = G.add(top, G.mul(dir, 30 * k));
      } else {
        const bb = G.bbox([].concat(...movable.map((o) => app.worldBounds(o))));
        h += `<rect x="${f(bb.minX)}" y="${f(bb.minY)}" width="${f(bb.w)}" height="${f(bb.h)}" fill="none" stroke="#1971C2" stroke-width="${f(1 * k)}" pointer-events="none"/>`;
        anchor = { x: (bb.minX + bb.maxX) / 2, y: bb.minY };
        hp = { x: anchor.x, y: bb.minY - 30 * k };
      }
      h += `<line x1="${f(anchor.x)}" y1="${f(anchor.y)}" x2="${f(hp.x)}" y2="${f(hp.y)}" stroke="#1971C2" stroke-width="${sw}" pointer-events="none"/>`;
      h += `<g data-handle="rotate" transform="translate(${f(hp.x)} ${f(hp.y)}) scale(${f(k)})" style="cursor:grab"><circle r="16" fill="transparent"/><circle r="10" fill="#fff" stroke="#1971C2" stroke-width="2"/><path d="M-4.5 1.5a4.8 4.8 0 1 0 1.2 -4.6 M-3.6 -6.2v3.4h3.4" fill="none" stroke="#1971C2" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    }
    if (selObjs.length === 1 && app.mode === 'select') h += resizeHandles(selObjs[0], k);
    const dragKind = app.drag && app.drag.kind;
    if (dragKind === 'resize') {
      const o = app.drag.o;
      h += chip(o, k, def(o).round ? `Ø ${Math.round(o.w)} cm` : `${Math.round(o.w)} × ${Math.round(o.d)} cm`);
    }
    // Raumgröße: Griffe an den Wänden, solange nichts ausgewählt ist
    if (app.mode === 'select' && !app.multi && !selObjs.length && (!dragKind || dragKind === 'room' || dragKind === 'pan')) h += roomHandles(k);
    if (dragKind === 'room') {
      const R = app.doc.room;
      h += chip({ x: R.w / 2, y: R.l / 2 }, k, `${fmtM(R.w)} × ${fmtM(R.l)} · ${fmtArea(R.w * R.l)}`);
    }
    // Abstände des ausgewählten Objekts
    if (selObjs.length === 1 && app.overlay.dims) {
      const lines = A.clearances(app.doc, selObjs[0].id);
      const need = S().passage;
      for (const ln of lines) {
        const ok = ln.d >= need;
        const c = ok ? '#2B8A3E' : ln.d >= 70 ? '#E67700' : '#C92A2A';
        const m = G.lerp(ln.p, ln.q, 0.5);
        const txt = Math.round(ln.d) + ' cm';
        h += `<line x1="${f(ln.p.x)}" y1="${f(ln.p.y)}" x2="${f(ln.q.x)}" y2="${f(ln.q.y)}" stroke="${c}" stroke-width="${sw}" pointer-events="none"/>`;
        h += `<circle cx="${f(ln.p.x)}" cy="${f(ln.p.y)}" r="${f(2.5 * k)}" fill="${c}" pointer-events="none"/><circle cx="${f(ln.q.x)}" cy="${f(ln.q.y)}" r="${f(2.5 * k)}" fill="${c}" pointer-events="none"/>`;
        h += `<g transform="translate(${f(m.x)} ${f(m.y)}) scale(${f(k)})" pointer-events="none"><rect x="-25" y="-10" width="50" height="20" rx="10" fill="${c}"/><text y="0.5" font-size="11.5" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif">${txt}</text></g>`;
      }
    }
    // Messwerkzeug
    if (app.measure) {
      const { a, b } = app.measure;
      const d = G.dist(a, b);
      const m = G.lerp(a, b, 0.5);
      const ok = d >= S().passage;
      h += `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="#7048E8" stroke-width="${f(2 * k)}" pointer-events="none"/>`;
      h += `<circle cx="${f(a.x)}" cy="${f(a.y)}" r="${f(4 * k)}" fill="#7048E8" pointer-events="none"/><circle cx="${f(b.x)}" cy="${f(b.y)}" r="${f(4 * k)}" fill="#7048E8" pointer-events="none"/>`;
      if (d > 1) {
        const label = Math.round(d) + ' cm' + (ok ? ' ✓ Rollstuhl' : '');
        const wpx = label.length * 7 + 16;
        h += `<g transform="translate(${f(m.x)} ${f(m.y)}) scale(${f(k)})" pointer-events="none"><rect x="${-wpx / 2}" y="-12" width="${wpx}" height="24" rx="12" fill="#7048E8"/><text y="0.5" font-size="12.5" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif">${label}</text></g>`;
      }
    }
    // Auswahlrahmen
    if (app.drag && app.drag.kind === 'marquee' && app.drag.rect) {
      const r = app.drag.rect;
      h += `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="#1971C2" fill-opacity="0.08" stroke="#1971C2" stroke-width="${sw}" stroke-dasharray="${f(4 * k)} ${f(3 * k)}" pointer-events="none"/>`;
    }
    app.els.overlay.innerHTML = h;
    app.renderMarks();
  };

  /* ---------- Ansicht (Zoom/Pan) ---------- */
  app.applyView = function () {
    const v = app.view;
    app.svg.setAttribute('viewBox', `${f(v.x)} ${f(v.y)} ${f(v.w)} ${f(v.h)}`);
    app.renderOverlay();
    app.emit('view');
  };

  app.syncAspect = function () {
    if (!app.doc) return;
    const r = app.svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const v = app.view;
    const cy = v.y + v.h / 2;
    v.h = v.w * (r.height / r.width);
    v.y = cy - v.h / 2;
    if (!app._fitted) {
      app._fitted = true;
      app.fitView();
      return;
    }
    app.applyView();
  };

  app.fitView = function () {
    const r = app.svg.getBoundingClientRect();
    const W = app.doc.room.w;
    const L = app.doc.room.l;
    const pad = 50;
    const bx = -WALL - pad;
    const by = -WALL - pad;
    const bw = W + 2 * (WALL + pad);
    const bh = L + 2 * (WALL + pad);
    // oben Platz für die Werkzeugleiste lassen (in Bildschirmpixeln)
    const rail = document.querySelector('.tool-rail');
    const topPx = rail ? Math.min(r.height * 0.25, rail.getBoundingClientRect().height + 10) : 0;
    const availH = Math.max(50, (r.height || 1) - topPx);
    const sw = r.width ? bw / r.width : 1;
    const sh = r.height ? bh / availH : 1;
    const s = Math.max(sw, sh);
    const w = (r.width || bw) * s;
    const h = (r.height || bh) * s;
    const offY = topPx * s;
    app.view = { x: bx + bw / 2 - w / 2, y: by - offY - (h - offY - bh) / 2, w, h };
    app.applyView();
  };

  app.zoomAt = function (pt, factor) {
    const v = app.view;
    const nw = clamp(v.w * factor, 60, 6000);
    const s = nw / v.w;
    v.x = pt.x - (pt.x - v.x) * s;
    v.y = pt.y - (pt.y - v.y) * s;
    v.w = nw;
    v.h *= s;
    app.applyView();
  };

  app.zoomBy = function (factor) {
    const v = app.view;
    app.zoomAt({ x: v.x + v.w / 2, y: v.y + v.h / 2 }, factor);
  };

  app.toWorld = function (cx, cy) {
    const pt = app.svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const m = app.svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  /* ---------- Objekte hinzufügen / bearbeiten ---------- */
  app.fits = function (o, ignore) {
    const W = app.doc.room.w;
    const L = app.doc.room.l;
    const d = def(o);
    const parts = app.worldParts(o);
    if (!d.wall) {
      const bb = G.bbox([].concat(...parts));
      if (bb.minX < 0 || bb.minY < 0 || bb.maxX > W || bb.maxY > L) return false;
    }
    if (!d.obstacle && !d.collide) return true;
    for (const other of app.doc.objects) {
      if (other === o || (ignore && ignore.has(other.id))) continue;
      const od = def(other);
      if (!od.obstacle) continue;
      if (Math.abs(other.x - o.x) > 300 || Math.abs(other.y - o.y) > 300) continue;
      for (const p of app.worldParts(other)) for (const q of parts) if (G.satDepth(p, q) > 0.5) return false;
    }
    return true;
  };

  app.findFreeSpot = function (o) {
    const x0 = o.x;
    const y0 = o.y;
    if (app.fits(o)) return;
    for (let r = 20; r <= 600; r += 20) {
      const n = Math.max(8, Math.round((2 * Math.PI * r) / 25));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        o.x = x0 + Math.cos(a) * r;
        o.y = y0 + Math.sin(a) * r;
        if (app.fits(o)) return;
      }
    }
    o.x = x0;
    o.y = y0;
  };

  app.viewCenterInRoom = function () {
    const v = app.view;
    return {
      x: clamp(v.x + v.w / 2, 60, app.doc.room.w - 60),
      y: clamp(v.y + v.h / 2, 60, app.doc.room.l - 60),
    };
  };

  app.addObject = function (type, at, extra) {
    const d = T[type];
    if (!d) return null;
    const p = at || app.viewCenterInRoom();
    const o = { id: LLR.newId(), type, x: p.x, y: p.y, rot: 0 };
    if (d.defaultSize) {
      o.w = d.defaultSize.w;
      o.d = d.defaultSize.d;
    }
    if (d.defaultColor) o.color = d.defaultColor;
    if (type === 'label') {
      o.text = 'Text';
      o.size = 22;
    }
    if (type === 'wheelchair') o.turn = true;
    Object.assign(o, extra || {});
    if (d.wall) snapToWall(o, p);
    else app.findFreeSpot(o);
    app.mutate((doc) => doc.objects.push(o));
    app.select([o.id]);
    return o;
  };

  app.select = function (ids, additive) {
    if (!additive) app.sel = new Set();
    for (const id of ids) app.sel.add(id);
    app.renderOverlay();
    app.emit('select');
  };

  app.clearSelection = function () {
    if (!app.sel.size) return;
    app.sel = new Set();
    app.renderOverlay();
    app.emit('select');
  };

  app.selectedObjects = () => [...app.sel].map(byId).filter(Boolean);

  app.deleteSelected = function () {
    const objs = app.selectedObjects();
    const del = objs.filter((o) => !o.locked);
    if (!del.length) {
      if (objs.length) app.emit('toast', 'Gesperrte Objekte können nicht gelöscht werden. Erst entsperren.');
      return;
    }
    const ids = new Set(del.map((o) => o.id));
    app.mutate((doc) => (doc.objects = doc.objects.filter((o) => !ids.has(o.id))));
    app.sel = new Set([...app.sel].filter((id) => !ids.has(id)));
    app.emit('select');
    if (del.length < objs.length) app.emit('toast', 'Gesperrte Objekte wurden nicht gelöscht.');
  };

  app.duplicateSelected = function (objs, offset) {
    objs = objs || app.selectedObjects();
    if (!objs.length) return;
    const off = offset === undefined ? 30 : offset;
    const copies = objs.map((o) => {
      const c = JSON.parse(JSON.stringify(o));
      c.id = LLR.newId();
      delete c.locked;
      if (def(c).wall) {
        const along = G.rot({ x: 1, y: 0 }, c.rot || 0);
        c.x += along.x * off * 2;
        c.y += along.y * off * 2;
        snapToWall(c, c);
      } else {
        c.x += off;
        c.y += off;
      }
      return c;
    });
    if (copies.length === 1 && !def(copies[0]).wall) app.findFreeSpot(copies[0]);
    app.mutate((doc) => doc.objects.push(...copies));
    app.select(copies.map((c) => c.id));
  };

  app.copy = function () {
    const objs = app.selectedObjects();
    if (objs.length) app.clipboard = JSON.parse(JSON.stringify(objs));
  };
  app.paste = function () {
    if (app.clipboard) app.duplicateSelected(app.clipboard, 40);
  };

  /* Stühle, die an den gewählten Tischen stehen und mitwandern */
  function carriedSeats(objs) {
    const tableIds = new Set(objs.filter(isTable).map((o) => o.id));
    if (!tableIds.size || !S().carryChairs) return [];
    const ids = new Set(objs.map((o) => o.id));
    return A.attachedSeats(app.doc, tableIds).filter((id) => !ids.has(id)).map(byId).filter((o) => o && !o.locked);
  }

  app.rotateSelected = function (delta) {
    const objs = app.selectedObjects().filter((o) => !o.locked && !def(o).wall);
    if (!objs.length) return;
    const all = objs.concat(carriedSeats(objs));
    const c = objs.length === 1 ? { x: objs[0].x, y: objs[0].y } : bboxCenter(objs);
    app.mutate(() => {
      for (const o of all) {
        const p = G.add(c, G.rot(G.sub(o, c), delta));
        o.x = p.x;
        o.y = p.y;
        o.rot = G.normAngle((o.rot || 0) + delta);
      }
    });
  };

  app.moveSelected = function (dx, dy) {
    const objs = app.selectedObjects().filter((o) => !o.locked);
    if (!objs.length) return;
    const now = performance.now();
    const before = app.serialize();
    for (const o of objs.concat(carriedSeats(objs))) {
      if (def(o).wall) {
        const along = G.rot({ x: 1, y: 0 }, o.rot || 0);
        const t = dx * along.x + dy * along.y;
        snapToWall(o, { x: o.x + along.x * t, y: o.y + along.y * t });
      } else {
        o.x += dx;
        o.y += dy;
      }
    }
    if (!app._lastKeyMove || now - app._lastKeyMove > 800) app.pushHistory(before);
    app._lastKeyMove = now;
    app.changed({ fast: true });
  };

  /* Zusammenhängende Gruppe auswählen: berührende Tische samt angestellter Stühle
     bzw. zusammengesteckte Trennwände */
  app.selectGroup = function (id) {
    const start = byId(id);
    if (!start) return;
    let members;
    let linked;
    if (isTable(start)) {
      members = app.doc.objects.filter(isTable);
      const polys = new Map(members.map((t) => [t.id, tableWorld(t)]));
      const reach = new Map(members.map((t) => [t.id, A.reach(polys.get(t.id), t)]));
      linked = (a, b) =>
        Math.hypot(a.x - b.x, a.y - b.y) <= reach.get(a.id) + reach.get(b.id) + 3 && G.polyDistance(polys.get(a.id), polys.get(b.id)).d < 3;
    } else if (start.type === 'partition') {
      members = app.doc.objects.filter((o) => o.type === 'partition');
      linked = A.partitionsJoined;
    } else return;
    const group = new Set([id]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      for (const m of members) {
        if (group.has(m.id) || !linked(cur, m)) continue;
        group.add(m.id);
        queue.push(m);
      }
    }
    const seats = isTable(start) ? A.attachedSeats(app.doc, group) : [];
    app.select([...group, ...seats]);
  };

  app.toggleLock = function () {
    const objs = app.selectedObjects();
    if (!objs.length) return;
    const lock = objs.some((o) => !o.locked);
    app.mutate(() => objs.forEach((o) => (lock ? (o.locked = true) : delete o.locked)));
    app.emit('select');
  };

  app.applyPreset = function (id) {
    const preset = LLR.PRESETS.find((p) => p.id === id);
    if (!preset) return;
    app.mutate((doc) => {
      doc.objects = doc.objects.filter((o) => !(isTable(o) || o.type === 'chair' || o.type === 'stool' || (preset.shelves && o.type === 'shelfRound')));
      const added = app.buildPreset(preset, doc);
      if (!preset.shelves) {
        // Halbrunde Regale, die im Weg stehen, zurück an ihren Parkplatz
        const parks = LLR.parkedShelves(doc.room);
        const addedParts = added.map((o) => app.worldParts(o));
        const shelves = doc.objects.filter((o) => o.type === 'shelfRound');
        const blocked = shelves.some((sh) => app.worldParts(sh).some((p) => addedParts.some((ps) => ps.some((q) => G.satDepth(p, q) > 0.5))));
        if (blocked) shelves.forEach((sh, i) => parks[i] && Object.assign(sh, { x: parks[i].x, y: parks[i].y, rot: parks[i].rot }));
      }
      doc.objects.push(...added);
      if (!doc.name || doc.name === 'Neuer Raumplan' || LLR.PRESETS.some((x) => x.name === doc.name)) doc.name = preset.name;
    });
    app.sel = new Set();
    app.emit('select');
  };

  /* ---------- Raumgröße ---------- */
  app.roomSnapshot = () => ({
    w: app.doc.room.w,
    l: app.doc.room.l,
    objs: app.doc.objects.map((o) => ({ o, x: o.x, y: o.y, bb: def(o).wall ? null : G.bbox([].concat(...app.worldParts(o))) })),
  });

  /* sides: { l, t, r, b } in cm, positiv = Wand nach außen. Möbel an einer Wand
     wandern mit dieser Wand, alles andere bleibt an seinem Platz im Raum. */
  app.applyRoomResize = function (snap, sides) {
    const W = snap.w + sides.l + sides.r;
    const L = snap.l + sides.t + sides.b;
    app.doc.room.w = W;
    app.doc.room.l = L;
    for (const s of snap.objs) {
      const o = s.o;
      if (!s.bb) {
        o.x = Math.abs(s.x) < 1 ? 0 : Math.abs(s.x - snap.w) < 1 ? W : s.x + sides.l;
        o.y = Math.abs(s.y) < 1 ? 0 : Math.abs(s.y - snap.l) < 1 ? L : s.y + sides.t;
        snapToWall(o, { x: o.x, y: o.y });
        continue;
      }
      o.x = s.bb.minX < 4 ? s.x : snap.w - s.bb.maxX < 4 ? s.x + sides.l + sides.r : s.x + sides.l;
      o.y = s.bb.minY < 4 ? s.y : snap.l - s.bb.maxY < 4 ? s.y + sides.t + sides.b : s.y + sides.t;
    }
  };

  function bboxCenter(objs) {
    const bb = G.bbox([].concat(...objs.map((o) => app.worldBounds(o))));
    return { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 };
  }

  /* ---------- Einrasten ---------- */
  function snapToWall(o, p) {
    const W = app.doc.room.w;
    const L = app.doc.room.l;
    const lb = G.bbox(app.localBounds(Object.assign({}, o, { rot: 0, x: 0, y: 0 })));
    const half = Math.max(Math.abs(lb.minX), Math.abs(lb.maxX));
    const dists = [
      { wall: 'top', d: p.y },
      { wall: 'bottom', d: L - p.y },
      { wall: 'left', d: p.x },
      { wall: 'right', d: W - p.x },
    ].sort((a, b) => a.d - b.d);
    const wall = dists[0].wall;
    if (wall === 'top') Object.assign(o, { x: clamp(p.x, half, W - half), y: 0, rot: 180 });
    else if (wall === 'bottom') Object.assign(o, { x: clamp(p.x, half, W - half), y: L, rot: 0 });
    else if (wall === 'left') Object.assign(o, { x: 0, y: clamp(p.y, half, L - half), rot: 90 });
    else Object.assign(o, { x: W, y: clamp(p.y, half, L - half), rot: -90 });
  }
  app.snapToWall = snapToWall;

  /* Tischfläche (Dreieck oder Rechteck) als konvexes Polygon, immer gleich
     umlaufend – nur dann liegen anstoßende Kanten gegenläufig */
  const tableWorld = (o) => {
    const p = app.worldParts(o)[0];
    return G.signedArea(p) > 0 ? p.slice().reverse() : p;
  };

  function findTableSnaps(primaries, exclude, allowRot) {
    const moving = primaries.filter(isTable);
    if (!moving.length) return [];
    const statics = app.doc.objects.filter((o) => isTable(o) && !exclude.has(o.id)).map((o) => ({ st: o, sp: tableWorld(o) }));
    const TH = 12 * Math.max(1, app.px());
    const ANG = allowRot ? 12 : 1.5;
    const found = [];
    for (const mt of moving) {
      const mp = tableWorld(mt);
      const mr = A.reach(mp, mt);
      for (let i = 0; i < mp.length; i++) {
        const a = mp[i];
        const b = mp[(i + 1) % mp.length];
        const angA = G.angle(G.sub(b, a));
        const midA = G.lerp(a, b, 0.5);
        for (const { st, sp } of statics) {
          if (Math.hypot(st.x - mt.x, st.y - mt.y) > mr + A.reach(sp, st) + TH) continue;
          for (let j = 0; j < sp.length; j++) {
            const c = sp[j];
            const d = sp[(j + 1) % sp.length];
            const dAng = G.normAngle(G.angle(G.sub(c, d)) - angA);
            if (Math.abs(dAng) > ANG) continue;
            const nS = G.edgeNormal(sp, j);
            const perp = G.dot(G.sub(midA, c), nS);
            if (perp < -TH || perp > TH) continue;
            const dir = G.norm(G.sub(d, c));
            const lenB = G.dist(c, d);
            const ta = G.dot(G.sub(a, c), dir);
            const tb = G.dot(G.sub(b, c), dir);
            const lo = Math.max(0, Math.min(ta, tb));
            const hi = Math.min(lenB, Math.max(ta, tb));
            if (hi - lo < 12) continue;
            found.push({ score: Math.abs(perp) + Math.abs(dAng) * 0.8, mt, i, st, j, dAng });
          }
        }
      }
    }
    return found.sort((x, y) => x.score - y.score);
  }

  /* Prüft, ob sich bewegte Tische mit stehenden Tischen überschneiden */
  function tablesOverlap(items, exclude) {
    const moving = items.filter(isTable).map(tableWorld);
    if (!moving.length) return false;
    for (const st of app.doc.objects) {
      if (!isTable(st) || exclude.has(st.id)) continue;
      const sp = tableWorld(st);
      for (const mp of moving) if (G.satDepth(mp, sp) > 1) return true;
    }
    return false;
  }

  /* Trennwände Ende an Ende (gerade, im 45°- oder 90°-Winkel) oder als T an
     der Wandlinie einer anderen Trennwand zusammenstecken */
  function snapPartition(p, exclude) {
    const TH = 14 * Math.max(1, app.px());
    const ends = A.partitionEnds(p);
    let best = null;
    for (const s of app.doc.objects) {
      if (s.type !== 'partition' || exclude.has(s.id)) continue;
      if (Math.hypot(s.x - p.x, s.y - p.y) > ((s.w || 120) + (p.w || 120)) / 2 + TH) continue;
      const se = A.partitionEnds(s);
      for (let i = 0; i < 2; i++) {
        for (const q of se) {
          const d = G.dist(ends[i], q);
          if (d < TH && (!best || d < best.d)) best = { d, i, s, target: q, tee: false };
        }
        const q = G.closestOnSeg(ends[i], se[0], se[1]);
        const d = G.dist(ends[i], q);
        if (q.t > 0.05 && q.t < 0.95 && d < TH && (!best || d < best.d - 3)) best = { d, i, s, target: { x: q.x, y: q.y }, tee: true };
      }
    }
    if (!best) return false;
    const rel = G.normAngle((p.rot || 0) - (best.s.rot || 0));
    const goal = best.tee ? (rel >= 0 ? 90 : -90) : Math.round(rel / 45) * 45;
    const dAng = G.normAngle(goal - rel);
    if (Math.abs(dAng) < (best.tee ? 20 : 12)) {
      const pivot = ends[best.i];
      const c = G.add(pivot, G.rot(G.sub(p, pivot), dAng));
      p.x = c.x;
      p.y = c.y;
      p.rot = G.normAngle((p.rot || 0) + dAng);
    }
    const e = A.partitionEnds(p)[best.i];
    p.x += best.target.x - e.x;
    p.y += best.target.y - e.y;
    return true;
  }

  function applySnap(primaries, items, e) {
    if (!primaries.length || (e && e.altKey)) return;
    const magnet = S().snap;
    if (!magnet && !S().gridSnap) return;
    const exclude = new Set(items.map((o) => o.id));
    const shiftAll = (dx, dy) => {
      for (const o of items) {
        o.x += dx;
        o.y += dy;
      }
    };
    const single = primaries.length === 1 ? primaries[0] : null;
    let snapped = false;
    let joined = false;
    const snaps = magnet ? findTableSnaps(primaries, exclude, !!single) : [];
    const saved = items.map((o) => ({ o, x: o.x, y: o.y, rot: o.rot }));
    const restore = () => saved.forEach((r) => Object.assign(r.o, { x: r.x, y: r.y, rot: r.rot }));
    for (const sn of snaps.slice(0, 8)) {
      if (single && Math.abs(sn.dAng) > 1e-6) {
        const c = { x: single.x, y: single.y };
        for (const o of items) {
          const p = G.add(c, G.rot(G.sub(o, c), sn.dAng));
          o.x = p.x;
          o.y = p.y;
          o.rot = G.normAngle((o.rot || 0) + sn.dAng);
        }
      }
      const mp = tableWorld(sn.mt);
      const a = mp[sn.i];
      const b = mp[(sn.i + 1) % mp.length];
      const sp = tableWorld(sn.st);
      const c = sp[sn.j];
      const d = sp[(sn.j + 1) % sp.length];
      const nS = G.edgeNormal(sp, sn.j);
      const perp = G.dot(G.sub(G.lerp(a, b, 0.5), c), nS);
      shiftAll(-nS.x * perp, -nS.y * perp);
      const dir = G.norm(G.sub(d, c));
      const opts = [
        G.dot(G.sub(d, a), dir),
        G.dot(G.sub(c, b), dir),
        G.dot(G.sub(G.lerp(c, d, 0.5), G.lerp(a, b, 0.5)), dir),
      ];
      let bestShift = null;
      for (const sh of opts) if (Math.abs(sh) < 10 * Math.max(1, app.px()) && (bestShift === null || Math.abs(sh) < Math.abs(bestShift))) bestShift = sh;
      if (bestShift !== null) shiftAll(dir.x * bestShift, dir.y * bestShift);
      if (!tablesOverlap(items, exclude)) {
        snapped = true;
        break;
      }
      restore();
    }
    // Stuhl zum nächsten Tisch ausrichten
    if (magnet && !snapped && single && (single.type === 'chair' || single.type === 'wheelchair')) {
      let best = null;
      for (const t of app.doc.objects) {
        if (!isTable(t)) continue;
        const p = tableWorld(t);
        if (Math.hypot(t.x - single.x, t.y - single.y) > A.reach(p, t) + 100) continue;
        for (let i = 0; i < p.length; i++) {
          const q = G.closestOnSeg(single, p[i], p[(i + 1) % p.length]);
          if (q.t < 0.06 || q.t > 0.94) continue;
          const n = G.edgeNormal(p, i);
          const dist = G.dot(G.sub(single, q), n);
          const depth = single.type === 'wheelchair' ? (single.d || 120) / 2 : S().chairD / 2;
          if (dist < depth - 30 || dist > depth + 30) continue;
          if (!best || Math.abs(dist - depth) < Math.abs(best.dist - best.depth)) best = { q, n, dist, depth };
        }
      }
      if (best) {
        single.rot = G.rotFacing(G.mul(best.n, -1));
        const target = single.type === 'wheelchair' ? best.depth - 22 : best.depth + 2;
        if (Math.abs(best.dist - target) < 9) {
          single.x += best.n.x * (target - best.dist);
          single.y += best.n.y * (target - best.dist);
        }
        snapped = true;
      }
    }
    if (magnet && !snapped && single && single.type === 'partition') snapped = joined = snapPartition(single, exclude);
    // Am Raster einrasten (linke obere Ecke der Auswahl auf eine Rasterlinie)
    if (!snapped && S().gridSnap) {
      const g = S().grid || 50;
      const gb = G.bbox([].concat(...primaries.map((o) => app.worldParts(o)).flat()));
      shiftAll(Math.round(gb.minX / g) * g - gb.minX, Math.round(gb.minY / g) * g - gb.minY);
    }
    if (!magnet || joined) return;
    // An Wände anlegen
    const W = app.doc.room.w;
    const L = app.doc.room.l;
    const bb = G.bbox([].concat(...primaries.map((o) => app.worldParts(o)).flat()));
    const th = 10 * Math.max(1, app.px());
    let dx = 0;
    let dy = 0;
    if (Math.abs(bb.minX) < th) dx = -bb.minX;
    else if (Math.abs(W - bb.maxX) < th) dx = W - bb.maxX;
    if (Math.abs(bb.minY) < th) dy = -bb.minY;
    else if (Math.abs(L - bb.maxY) < th) dy = L - bb.maxY;
    if (dx || dy) shiftAll(dx, dy);
  }

  /* ---------- Zeiger-Bedienung ---------- */
  let spaceDown = false;
  const EDIT_DRAGS = new Set(['move', 'rotate', 'resize', 'room']);

  function bindPointer(svg) {
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('lostpointercapture', (e) => {
      if (app.pointers.has(e.pointerId)) onUp(e);
    });
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !isTyping(e)) spaceDown = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') spaceDown = false;
    });
  }

  function isTyping(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }
  app.isTyping = isTyping;

  function startPinch() {
    const pts = [...app.pointers.values()];
    if (app.drag && EDIT_DRAGS.has(app.drag.kind) && app.drag.moved) finishMove();
    app.drag = {
      kind: 'pinch',
      d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
      c0: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      view0: Object.assign({}, app.view),
      world0: app.toWorld((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2),
    };
  }

  function snapMeasurePoint(p, e) {
    const k = app.px();
    const th = 10 * k;
    let best = null;
    const W = app.doc.room.w;
    const L = app.doc.room.l;
    for (const o of app.doc.objects) {
      if (!def(o).obstacle) continue;
      if (Math.abs(o.x - p.x) > 200 || Math.abs(o.y - p.y) > 200) continue;
      for (const poly of app.worldParts(o)) {
        for (let i = 0; i < poly.length; i++) {
          const q = G.closestOnSeg(p, poly[i], poly[(i + 1) % poly.length]);
          const d = G.dist(p, q);
          if (d < th && (!best || d < best.d)) best = { d, q: { x: q.x, y: q.y } };
        }
      }
    }
    const walls = [
      { d: Math.abs(p.x), q: { x: 0, y: p.y } },
      { d: Math.abs(W - p.x), q: { x: W, y: p.y } },
      { d: Math.abs(p.y), q: { x: p.x, y: 0 } },
      { d: Math.abs(L - p.y), q: { x: p.x, y: L } },
    ];
    for (const w of walls) if (w.d < th && (!best || w.d < best.d)) best = w;
    if (e && e.altKey) return p;
    return best ? best.q : p;
  }

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    app.svg.setPointerCapture(e.pointerId);
    app.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (app.pointers.size === 2) {
      startPinch();
      return;
    }
    if (app.pointers.size > 2) return;
    const p = app.toWorld(e.clientX, e.clientY);
    const base = { pointerId: e.pointerId, startClient: { x: e.clientX, y: e.clientY }, start: p, moved: false, touch: e.pointerType !== 'mouse' };
    app.drag = null;

    if ((e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) || spaceDown) {
      app.drag = Object.assign(base, { kind: 'pan', view0: Object.assign({}, app.view), k0: app.px(), tapClears: false });
      return;
    }
    if (app.mode === 'measure') {
      const a = snapMeasurePoint(p, e);
      app.measure = { a, b: a };
      app.drag = Object.assign(base, { kind: 'measure' });
      app.renderOverlay();
      return;
    }
    const handle = e.target.closest('[data-handle]');
    if (handle) {
      const kind = handle.getAttribute('data-handle');
      const hx = Number(handle.getAttribute('data-hx')) || 0;
      const hy = Number(handle.getAttribute('data-hy')) || 0;
      if (kind === 'rotate') startRotate(base, p);
      else if (kind === 'resize') startResize(base, hx, hy);
      else if (kind === 'room' && !app.multi && !e.shiftKey) startRoomResize(base, hx, hy);
      if (app.drag) return;
    }
    const objEl = e.target.closest('[data-id]');
    if (objEl) {
      const id = objEl.getAttribute('data-id');
      const additive = e.shiftKey || e.ctrlKey || e.metaKey || app.multi;
      if (additive) {
        if (app.sel.has(id)) {
          app.sel.delete(id);
          app.renderOverlay();
          app.emit('select');
          app.drag = Object.assign(base, { kind: 'none' });
          return;
        }
        app.sel.add(id);
      } else if (!app.sel.has(id)) {
        app.sel = new Set([id]);
      }
      app.renderOverlay();
      app.emit('select');
      startMove(base, id);
      app.drag.tapId = id;
      return;
    }
    if (e.shiftKey || app.multi) {
      app.drag = Object.assign(base, { kind: 'marquee', rect: null, additive: e.shiftKey || app.multi, sel0: new Set(app.sel) });
      return;
    }
    app.drag = Object.assign(base, { kind: 'pan', view0: Object.assign({}, app.view), k0: app.px(), tapClears: true });
  }

  function collectItems(primaries) {
    return primaries.concat(carriedSeats(primaries));
  }

  function startMove(base, id) {
    const primaries = app.selectedObjects().filter((o) => !o.locked);
    if (!primaries.length) {
      const o = byId(id);
      if (o && o.locked) app.emit('toast', 'Dieses Objekt ist gesperrt (Schloss im Eigenschaften-Bereich öffnen).');
      app.drag = Object.assign(base, { kind: 'none' });
      return;
    }
    const items = collectItems(primaries);
    app.drag = Object.assign(base, {
      kind: 'move',
      primaries,
      items,
      orig: items.map((o) => ({ o, x: o.x, y: o.y, rot: o.rot || 0 })),
      before: app.serialize(),
    });
  }

  function startRotate(base, p) {
    const primaries = app.selectedObjects().filter((o) => !o.locked && !def(o).wall);
    if (!primaries.length) return;
    const items = collectItems(primaries);
    const c = primaries.length === 1 ? { x: primaries[0].x, y: primaries[0].y } : bboxCenter(primaries);
    app.drag = Object.assign(base, {
      kind: 'rotate',
      primaries,
      items,
      center: c,
      a0: G.angle(G.sub(p, c)),
      orig: items.map((o) => ({ o, x: o.x, y: o.y, rot: o.rot || 0 })),
      before: app.serialize(),
    });
  }

  function startResize(base, hx, hy) {
    const o = app.selectedObjects()[0];
    if (!o || o.locked) return;
    const d = def(o);
    const lb = G.bbox(app.localParts(o).flat());
    app.drag = Object.assign(base, {
      kind: 'resize',
      o,
      hx,
      hy,
      o0: { x: o.x, y: o.y, rot: o.rot || 0, w: o.w || lb.w, d: o.d || (d.round ? o.w : lb.h) || lb.h },
      before: app.serialize(),
    });
  }

  function startRoomResize(base, hx, hy) {
    app.drag = Object.assign(base, {
      kind: 'room',
      hx,
      hy,
      snap: app.roomSnapshot(),
      view0: Object.assign({}, app.view),
      k0: app.px(),
      before: app.serialize(),
      tapClears: true,
    });
  }

  /* Größe per Griff ändern: die gegenüberliegende Kante bleibt stehen */
  function resizeTo(dr, p, e) {
    const o = dr.o;
    const o0 = dr.o0;
    const d = def(o);
    const ms = d.minSize || { w: 5, d: 5 };
    const q = G.toLocal(p, o0);
    const step = e.altKey ? 1 : 5;
    const size = (v, min) => clamp(Math.round(v / step) * step, min, 2000);
    let w = o0.w;
    let dd = o0.d;
    if (d.round) {
      w = dd = size((dr.hx ? dr.hx * q.x : dr.hy * q.y) + o0.w / 2, ms.w);
    } else {
      if (dr.hx) w = size(dr.hx * q.x + o0.w / 2, ms.w);
      if (dr.hy) dd = size(dr.hy * q.y + o0.d / 2, ms.d);
      if (e.shiftKey && dr.hx && dr.hy) {
        const sc = Math.max(w / o0.w, dd / o0.d);
        w = size(o0.w * sc, ms.w);
        dd = size(o0.d * sc, ms.d);
      }
    }
    const c = G.add(G.rot({ x: (dr.hx * (w - o0.w)) / 2, y: (dr.hy * (dd - o0.d)) / 2 }, o0.rot), o0);
    o.x = c.x;
    o.y = c.y;
    o.w = w;
    o.d = dd;
    app.renderObjects();
    app.problems = A.problems(app.doc);
    app.renderOverlay();
    app.scheduleAnalysis(150);
    app.emit('live');
  }

  /* Raumgröße per Wand/Griff ändern (5-cm-Schritte, Alt = 1 cm) */
  function resizeRoomTo(dr, dxC, dyC, e) {
    const step = e.altKey ? 1 : 5;
    const fit = (size0, delta) => clamp(Math.round((size0 + delta) / step) * step, 200, 3000) - size0;
    const sides = { l: 0, t: 0, r: 0, b: 0 };
    if (dr.hx) sides[dr.hx > 0 ? 'r' : 'l'] = fit(dr.snap.w, dr.hx * dxC * dr.k0);
    if (dr.hy) sides[dr.hy > 0 ? 'b' : 't'] = fit(dr.snap.l, dr.hy * dyC * dr.k0);
    app.applyRoomResize(dr.snap, sides);
    // Ansicht mitschieben, damit die gegenüberliegende Wand stehen bleibt
    app.view.x = dr.view0.x + sides.l;
    app.view.y = dr.view0.y + sides.t;
    app.renderRoom();
    app.renderObjects();
    app.problems = A.problems(app.doc);
    app.scheduleAnalysis(150);
    app.applyView();
    app.emit('live');
  }

  function onMove(e) {
    if (!app.pointers.has(e.pointerId)) return;
    app.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const dr = app.drag;
    if (!dr) return;
    if (dr.kind === 'pinch') {
      const pts = [...app.pointers.values()];
      if (pts.length < 2) return;
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const c = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const v0 = dr.view0;
      const s = clamp(dr.d0 / d, 60 / v0.w, 6000 / v0.w);
      const r = app.svg.getBoundingClientRect();
      const k = (v0.w * s) / r.width;
      app.view = {
        w: v0.w * s,
        h: v0.h * s,
        x: dr.world0.x - (c.x - r.left) * k,
        y: dr.world0.y - (c.y - r.top) * k,
      };
      app.applyView();
      return;
    }
    if (e.pointerId !== dr.pointerId) return;
    const dxC = e.clientX - dr.startClient.x;
    const dyC = e.clientY - dr.startClient.y;
    if (!dr.moved) {
      const th = dr.touch ? 7 : 3;
      if (Math.hypot(dxC, dyC) < th) return;
      dr.moved = true;
    }
    const p = app.toWorld(e.clientX, e.clientY);
    if (dr.kind === 'pan') {
      app.view.x = dr.view0.x - dxC * dr.k0;
      app.view.y = dr.view0.y - dyC * dr.k0;
      app.applyView();
    } else if (dr.kind === 'move') {
      const dx = p.x - dr.start.x;
      const dy = p.y - dr.start.y;
      for (const r of dr.orig) {
        r.o.x = r.x + dx;
        r.o.y = r.y + dy;
        r.o.rot = r.rot;
      }
      const wallItems = dr.primaries.filter((o) => def(o).wall);
      if (wallItems.length === dr.primaries.length && wallItems.length === 1) {
        snapToWall(wallItems[0], { x: wallItems[0].x, y: wallItems[0].y });
      } else {
        for (const o of dr.items) if (def(o).wall) snapToWall(o, { x: o.x, y: o.y });
        applySnap(dr.primaries.filter((o) => !def(o).wall), dr.items.filter((o) => !def(o).wall), e);
      }
      liveUpdate(dr.items);
    } else if (dr.kind === 'rotate') {
      const a = G.angle(G.sub(p, dr.center));
      let delta = G.normAngle(a - dr.a0);
      const step = S().angleSnap || 15;
      if (dr.primaries.length === 1) {
        let target = dr.orig.find((r) => r.o === dr.primaries[0]).rot + delta;
        if (!e.shiftKey) target = Math.round(target / step) * step;
        delta = target - dr.orig.find((r) => r.o === dr.primaries[0]).rot;
      } else if (!e.shiftKey) {
        delta = Math.round(delta / step) * step;
      }
      for (const r of dr.orig) {
        const q = G.add(dr.center, G.rot({ x: r.x - dr.center.x, y: r.y - dr.center.y }, delta));
        r.o.x = q.x;
        r.o.y = q.y;
        r.o.rot = G.normAngle(r.rot + delta);
      }
      dr.angle = delta;
      liveUpdate(dr.items);
    } else if (dr.kind === 'resize') {
      resizeTo(dr, p, e);
    } else if (dr.kind === 'room') {
      resizeRoomTo(dr, dxC, dyC, e);
    } else if (dr.kind === 'marquee') {
      const x = Math.min(dr.start.x, p.x);
      const y = Math.min(dr.start.y, p.y);
      dr.rect = { x, y, w: Math.abs(p.x - dr.start.x), h: Math.abs(p.y - dr.start.y) };
      const inside = app.doc.objects.filter((o) => {
        const b = G.bbox(app.worldBounds(o));
        const cx = (b.minX + b.maxX) / 2;
        const cy = (b.minY + b.maxY) / 2;
        return cx >= x && cx <= x + dr.rect.w && cy >= y && cy <= y + dr.rect.h;
      });
      app.sel = new Set(dr.additive ? [...dr.sel0] : []);
      inside.forEach((o) => app.sel.add(o.id));
      app.renderOverlay();
      app.emit('select');
    } else if (dr.kind === 'measure') {
      let b = snapMeasurePoint(p, e);
      if (e.shiftKey) {
        const v = G.sub(b, app.measure.a);
        const ang = Math.round(G.angle(v) / 45) * 45;
        const l = G.len(v);
        b = G.add(app.measure.a, G.rot({ x: l, y: 0 }, ang));
      }
      app.measure.b = b;
      app.renderOverlay();
      app.emit('measure');
    }
  }

  function liveUpdate(items) {
    app.updateTransforms(items.map((o) => o.id));
    app.problems = A.problems(app.doc);
    app.renderOverlay();
    app.scheduleAnalysis(150);
    app.emit('live');
  }

  function finishMove() {
    const dr = app.drag;
    if (!dr) return;
    app.pushHistory(dr.before);
    app.changed();
  }

  function onUp(e) {
    const had = app.pointers.has(e.pointerId);
    app.pointers.delete(e.pointerId);
    try {
      app.svg.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* bereits freigegeben */
    }
    const dr = app.drag;
    if (!dr || !had) return;
    if (dr.kind === 'pinch') {
      if (app.pointers.size === 0) app.drag = null;
      return;
    }
    if (e.pointerId !== dr.pointerId) return;
    if (EDIT_DRAGS.has(dr.kind) && dr.moved) finishMove();
    else if (dr.tapId && !dr.moved) {
      // Doppelklick / Doppeltipp auf ein Objekt
      const now = performance.now();
      const last = app._lastTap;
      if (last && last.id === dr.tapId && now - last.t < 420) {
        app._lastTap = null;
        const o = byId(dr.tapId);
        if (o && (isTable(o) || o.type === 'partition')) app.selectGroup(o.id);
        else if (o) app.emit('edit', o.id);
      } else app._lastTap = { id: dr.tapId, t: now };
    } else if ((dr.kind === 'pan' || dr.kind === 'room') && !dr.moved && dr.tapClears) {
      app.clearSelection();
      if (app.measure) {
        app.measure = null;
        app.renderOverlay();
      }
    } else if (dr.kind === 'marquee') {
      // Mehrfachauswahl: Tippen ins Leere hebt die Auswahl auf
      if (!dr.moved && app.multi) app.clearSelection();
      dr.rect = null;
    } else if (dr.kind === 'measure') {
      if (G.dist(app.measure.a, app.measure.b) < 2) app.measure = null;
      app.emit('measure');
    }
    app.drag = null;
    app.renderOverlay();
  }

  function onWheel(e) {
    e.preventDefault();
    const p = app.toWorld(e.clientX, e.clientY);
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    if (e.deltaMode === 2) dy *= 400;
    const factor = Math.exp(clamp(dy, -200, 200) * (e.ctrlKey ? 0.01 : 0.0015));
    app.zoomAt(p, factor);
  }

  /* ---------- Tastatur ---------- */
  app.onKey = function (e) {
    if (isTyping(e)) return;
    if (document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (mod && (k === 'z' || k === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) app.redo();
      else app.undo();
    } else if (mod && (k === 'y' || k === 'Y')) {
      e.preventDefault();
      app.redo();
    } else if (mod && (k === 'd' || k === 'D')) {
      e.preventDefault();
      app.duplicateSelected();
    } else if (mod && (k === 'c' || k === 'C')) {
      app.copy();
    } else if (mod && (k === 'v' || k === 'V')) {
      e.preventDefault();
      app.paste();
    } else if (mod && (k === 'a' || k === 'A')) {
      e.preventDefault();
      app.select(app.doc.objects.filter((o) => !o.locked).map((o) => o.id));
    } else if (k === 'Delete' || k === 'Backspace') {
      if (app.sel.size) {
        e.preventDefault();
        app.deleteSelected();
      }
    } else if (k === 'Escape') {
      const had = app.sel.size;
      if (app.mode !== 'select') app.setMode('select');
      app.measure = null;
      app.clearSelection();
      // zweites Esc beendet die Mehrfachauswahl
      if (!had && app.multi) {
        app.multi = false;
        app.emit('mode');
      }
      app.renderOverlay();
    } else if (k.startsWith('Arrow') && app.sel.size) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[k];
      app.moveSelected(d[0], d[1]);
    } else if ((k === 'r' || k === 'R') && !mod) {
      const step = e.altKey ? 1 : S().angleSnap || 15;
      app.rotateSelected(e.shiftKey ? -step : step);
    } else if (k === '+' || k === '=') {
      app.zoomBy(1 / 1.25);
    } else if (k === '-' || k === '_') {
      app.zoomBy(1.25);
    } else if (k === '0' && !mod) {
      app.fitView();
    } else if ((k === 'm' || k === 'M') && !mod) {
      app.setMode(app.mode === 'measure' ? 'select' : 'measure');
    } else if ((k === 'l' || k === 'L') && !mod) {
      app.toggleLock();
    }
  };

  app.setMode = function (mode) {
    app.mode = mode;
    if (mode !== 'measure') app.measure = null;
    app.svg.classList.toggle('measuring', mode === 'measure');
    app.renderOverlay();
    app.emit('mode');
  };

  app.setOverlay = function (key, val) {
    app.overlay[key] = val;
    if (key === 'grid' || key === 'dims') app.renderRoom();
    app.scheduleAnalysis(0);
    app.renderOverlay();
    app.emit('overlay');
  };

  /* ---------- Statistik ---------- */
  app.stats = function () {
    const count = {};
    for (const o of app.doc.objects) count[o.type] = (count[o.type] || 0) + 1;
    let seats = 0;
    let lounge = 0;
    for (const o of app.doc.objects) {
      const d = def(o);
      if (d.seats) seats += d.seats;
      if (d.lounge) lounge += d.lounge;
    }
    return { count, seats, lounge, wheelchairs: count.wheelchair || 0 };
  };
})((window.LLR = window.LLR || {}));
