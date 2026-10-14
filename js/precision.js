/* Werkzeuge für genaues Arbeiten und Schnellaktionen: Ausrichten, Verteilen,
   Spiegeln, Abstand setzen, Auswahl auf Maß verschieben, Bausteine einfügen,
   Stühle an freie Tischkanten stellen oder wegnehmen, Objekte der Reihe nach
   auswählen. Erweitert LLR.app (js/app.js). */
(function (LLR) {
  'use strict';
  const G = LLR.G;
  const T = LLR.TYPES;
  const A = LLR.analysis;
  const app = LLR.app;
  const def = (o) => T[o.type];
  const S = () => app.doc.settings;
  const isTable = A.isTable;

  const bboxOf = (items) => G.bbox([].concat(...items.map((o) => app.worldBounds(o))));
  const unit = (items) => ({ items, bb: bboxOf(items) });

  /* Tischfläche als Polygon in Weltkoordinaten */
  const tablePoly = (t) => app.worldParts(t)[0];

  /* Auswahl in Einheiten zerlegen: zusammenhängende Tische samt angestellter
     Stühle bilden eine Einheit, alle anderen Objekte je eine eigene. So bleiben
     Tischgruppen beim Ausrichten und Verteilen zusammen. */
  app.units = function (objs) {
    objs = (objs || app.selectedObjects()).filter((o) => !o.locked && !def(o).wall);
    const ids = new Set(objs.map((o) => o.id));
    const tables = objs.filter(isTable);
    const parent = new Map(tables.map((t) => [t.id, t.id]));
    const find = (id) => {
      while (parent.get(id) !== id) id = parent.get(id);
      return id;
    };
    const polys = new Map(tables.map((t) => [t.id, tablePoly(t)]));
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        const a = tables[i];
        const b = tables[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) > A.reach(polys.get(a.id), a) + A.reach(polys.get(b.id), b) + 3) continue;
        if (G.polyDistance(polys.get(a.id), polys.get(b.id)).d < 3) parent.set(find(a.id), find(b.id));
      }
    }
    const comps = new Map();
    for (const t of tables) {
      const r = find(t.id);
      if (!comps.has(r)) comps.set(r, []);
      comps.get(r).push(t);
    }
    const used = new Set();
    const out = [];
    for (const comp of comps.values()) {
      const tid = new Set(comp.map((t) => t.id));
      const seats = A.attachedSeats(app.doc, tid)
        .map(app.byId)
        .filter((o) => o && !o.locked && !used.has(o.id) && (ids.has(o.id) || S().carryChairs));
      const items = comp.concat(seats);
      items.forEach((o) => used.add(o.id));
      out.push(unit(items));
    }
    for (const o of objs) {
      if (used.has(o.id)) continue;
      used.add(o.id);
      out.push(unit([o]));
    }
    return out;
  };

  const shiftUnit = (u, dx, dy) => {
    for (const o of u.items) {
      o.x += dx;
      o.y += dy;
    }
  };

  /* Ausrichten: links, Mitte (waagerecht), rechts, oben, Mitte (senkrecht), unten.
     Bei einer einzelnen Einheit gilt der Raum als Bezug. */
  app.alignSel = function (edge) {
    const units = app.units();
    if (!units.length) return 0;
    const W = app.doc.room.w;
    const L = app.doc.room.l;
    const ref = units.length === 1 ? { minX: 0, minY: 0, maxX: W, maxY: L } : G.bbox(units.map((u) => [{ x: u.bb.minX, y: u.bb.minY }, { x: u.bb.maxX, y: u.bb.maxY }]).flat());
    app.mutate(() => {
      for (const u of units) {
        const b = u.bb;
        let dx = 0;
        let dy = 0;
        if (edge === 'left') dx = ref.minX - b.minX;
        else if (edge === 'right') dx = ref.maxX - b.maxX;
        else if (edge === 'hcenter') dx = (ref.minX + ref.maxX) / 2 - (b.minX + b.maxX) / 2;
        else if (edge === 'top') dy = ref.minY - b.minY;
        else if (edge === 'bottom') dy = ref.maxY - b.maxY;
        else if (edge === 'vcenter') dy = (ref.minY + ref.maxY) / 2 - (b.minY + b.maxY) / 2;
        shiftUnit(u, dx, dy);
      }
    }, { label: `${units.length === 1 ? 'Im Raum' : 'Auswahl'} ausgerichtet (${{ left: 'links', right: 'rechts', hcenter: 'waagerecht mittig', top: 'oben', bottom: 'unten', vcenter: 'senkrecht mittig' }[edge]})` });
    return units.length;
  };

  /* Verteilen entlang einer Achse: gleiche Abstände zwischen erster und
     letzter Einheit – oder mit festem Abstand gap (in cm) aneinanderreihen. */
  app.distributeSel = function (axis, gap) {
    const units = app.units();
    const fixed = typeof gap === 'number' && isFinite(gap);
    if (units.length < (fixed ? 2 : 3)) return 0;
    const lo = axis === 'x' ? 'minX' : 'minY';
    const hi = axis === 'x' ? 'maxX' : 'maxY';
    units.sort((a, b) => a.bb[lo] + a.bb[hi] - (b.bb[lo] + b.bb[hi]));
    const sizes = units.map((u) => u.bb[hi] - u.bb[lo]);
    let g = gap;
    if (!fixed) {
      const span = units[units.length - 1].bb[hi] - units[0].bb[lo];
      g = (span - sizes.reduce((a, b) => a + b, 0)) / (units.length - 1);
    }
    app.mutate(() => {
      let pos = units[0].bb[lo];
      units.forEach((u, i) => {
        const d = pos - u.bb[lo];
        if (axis === 'x') shiftUnit(u, d, 0);
        else shiftUnit(u, 0, d);
        pos += sizes[i] + g;
      });
    }, { label: fixed ? `${axis === 'x' ? 'Nebeneinander' : 'Untereinander'} mit ${Math.round(g)} cm Abstand` : `${axis === 'x' ? 'Waagerecht' : 'Senkrecht'} gleichmäßig verteilt` });
    return units.length;
  };

  /* Spiegeln an der senkrechten (axis 'x': links ↔ rechts) oder waagerechten
     Mittellinie der Auswahl. Tische und Stühle sind symmetrisch, daher genügt
     es, Lage und Drehung zu spiegeln. */
  app.mirrorSel = function (axis) {
    const units = app.units();
    if (!units.length) return 0;
    const items = units.flatMap((u) => u.items);
    const bb = G.bbox(units.map((u) => [{ x: u.bb.minX, y: u.bb.minY }, { x: u.bb.maxX, y: u.bb.maxY }]).flat());
    const cx = (bb.minX + bb.maxX) / 2;
    const cy = (bb.minY + bb.maxY) / 2;
    app.mutate(() => {
      for (const o of items) {
        if (axis === 'x') {
          o.x = 2 * cx - o.x;
          o.rot = G.normAngle(-(o.rot || 0));
        } else {
          o.y = 2 * cy - o.y;
          o.rot = G.normAngle(180 - (o.rot || 0));
        }
      }
    }, { label: axis === 'x' ? 'Gespiegelt (links ↔ rechts)' : 'Gespiegelt (oben ↔ unten)' });
    return items.length;
  };

  /* Auswahl so verschieben, dass ihre linke obere Ecke bei (x, y) liegt */
  app.moveSelTo = function (x, y) {
    const units = app.units();
    if (!units.length) return;
    const bb = G.bbox(units.map((u) => [{ x: u.bb.minX, y: u.bb.minY }, { x: u.bb.maxX, y: u.bb.maxY }]).flat());
    const dx = x === null || x === undefined ? 0 : x - bb.minX;
    const dy = y === null || y === undefined ? 0 : y - bb.minY;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
    app.mutate(() => units.forEach((u) => shiftUnit(u, dx, dy)), { label: 'Auswahl auf Maß verschoben' });
  };

  /* Rahmen der Auswahl (für die Zahlenfelder bei Mehrfachauswahl) */
  app.selBox = function () {
    const units = app.units();
    if (!units.length) return null;
    return G.bbox(units.map((u) => [{ x: u.bb.minX, y: u.bb.minY }, { x: u.bb.maxX, y: u.bb.maxY }]).flat());
  };

  /* ---------- Bausteine einfügen ---------- */
  app.addGroup = function (objs, at, label) {
    objs = LLR.colorChairs(objs.map((o) => Object.assign({}, o, { id: LLR.newId() })));
    const bb = bboxOf(objs);
    const target = at || app.viewCenterInRoom();
    const move = (dx, dy) => objs.forEach((o) => ((o.x += dx), (o.y += dy)));
    move(target.x - (bb.minX + bb.maxX) / 2, target.y - (bb.minY + bb.maxY) / 2);
    const fitsAll = () => objs.every((o) => app.fits(o));
    if (!fitsAll()) {
      const base = objs.map((o) => ({ o, x: o.x, y: o.y }));
      const reset = () => base.forEach((b) => ((b.o.x = b.x), (b.o.y = b.y)));
      let found = false;
      for (let r = 25; r <= 700 && !found; r += 25) {
        const n = Math.max(8, Math.round((2 * Math.PI * r) / 40));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          reset();
          move(Math.cos(a) * r, Math.sin(a) * r);
          if (fitsAll()) {
            found = true;
            break;
          }
        }
      }
      if (!found) reset();
    }
    app.mutate((doc) => doc.objects.push(...objs), { label });
    app.select(objs.map((o) => o.id));
    return objs;
  };

  /* ---------- Stühle an freie Tischkanten ----------
     An jede freie Kante ab 70 cm kommt ein Stuhl, ab 150 cm zwei – sofern
     dort noch kein Sitzplatz steht und der Stuhl nirgends aneckt. */
  app.chairSpots = function (tables) {
    const S0 = S();
    const W = app.doc.room.w;
    const L = app.doc.room.l;
    const all = app.doc.objects.filter(isTable);
    const polys = new Map(all.map((t) => [t.id, tablePoly(t)]));
    const seats = app.doc.objects.filter(A.isSeat);
    const others = app.doc.objects.filter((o) => def(o).obstacle && !isTable(o) && !A.isSeat(o));
    const out = [];
    const off = S0.chairD / 2 + 2;
    for (const t of tables) {
      const p = polys.get(t.id);
      for (let i = 0; i < p.length; i++) {
        const a = p[i];
        const b = p[(i + 1) % p.length];
        const len = G.dist(a, b);
        if (len < 70) continue;
        const n = G.edgeNormal(p, i);
        // Kante an einem Nachbartisch: dort sitzt niemand
        const mid = G.add(G.lerp(a, b, 0.5), G.mul(n, 6));
        if (all.some((o) => o !== t && G.pointInConvex(G.inset(polys.get(o.id), -3), mid))) continue;
        const us = len >= 150 ? [0.3, 0.7] : [0.5];
        for (const u of us) {
          const m = G.lerp(a, b, u);
          const c = G.add(m, G.mul(n, off));
          if (seats.concat(out).some((s) => G.dist(s, c) < Math.max(28, S0.chairW * 0.7))) continue;
          const chair = { id: LLR.newId(), type: 'chair', x: c.x, y: c.y, rot: G.rotFacing(G.mul(n, -1)) };
          const body = app.worldParts(chair)[0];
          const bb = G.bbox(body);
          if (bb.minX < 0 || bb.minY < 0 || bb.maxX > W || bb.maxY > L) continue;
          const hit = (list) => list.some((o) => Math.abs(o.x - c.x) < 260 && Math.abs(o.y - c.y) < 260 && app.worldParts(o).some((q) => G.satDepth(q, body) > 1));
          if (hit(others) || hit(seats) || hit(out)) continue;
          // nicht in einen anderen Tisch hinein
          if (all.some((o) => o !== t && G.satDepth(polys.get(o.id), body) > 1)) continue;
          out.push(chair);
        }
      }
    }
    return LLR.colorChairs(out);
  };

  app.attachChairs = function () {
    const tables = app.selectedObjects().filter(isTable);
    if (!tables.length) return 0;
    const add = app.chairSpots(tables);
    if (!add.length) return 0;
    app.mutate((doc) => doc.objects.push(...add), { label: `${add.length} ${add.length === 1 ? 'Stuhl' : 'Stühle'} angestellt` });
    app.select([...app.sel, ...add.map((o) => o.id)]);
    return add.length;
  };

  app.removeChairs = function () {
    const tables = app.selectedObjects().filter(isTable);
    if (!tables.length) return 0;
    const ids = new Set(A.attachedSeats(app.doc, new Set(tables.map((t) => t.id))).filter((id) => {
      const o = app.byId(id);
      return o && !o.locked;
    }));
    if (!ids.size) return 0;
    app.mutate((doc) => (doc.objects = doc.objects.filter((o) => !ids.has(o.id))), { label: `${ids.size} ${ids.size === 1 ? 'Sitzplatz' : 'Sitzplätze'} weggenommen` });
    app.sel = new Set([...app.sel].filter((id) => !ids.has(id)));
    app.emit('select');
    return ids.size;
  };

  /* ---------- Objekte der Reihe nach auswählen (Tastatur) ----------
     Reihenfolge wie beim Lesen: von der Tafel nach hinten, links nach rechts. */
  app.selectNext = function (dir) {
    const list = app.doc.objects.filter((o) => def(o).kind !== 'zone').slice();
    if (!list.length) return null;
    list.sort((a, b) => Math.round(a.y / 40) - Math.round(b.y / 40) || a.x - b.x);
    const cur = app.sel.size === 1 ? list.findIndex((o) => app.sel.has(o.id)) : -1;
    const i = cur < 0 ? (dir > 0 ? 0 : list.length - 1) : (cur + dir + list.length) % list.length;
    app.select([list[i].id]);
    return list[i];
  };
})((window.LLR = window.LLR || {}));
