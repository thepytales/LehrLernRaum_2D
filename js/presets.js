/* Grundausstattung des Raums und Tischanordnungen aus der
   „Handreichung zur Anordnung der Tische“ (LLR, TUD ZLSB). */
(function (LLR) {
  'use strict';
  const G = LLR.G;
  const T = LLR.TYPES;

  LLR.DEFAULT_SETTINGS = {
    tableBase: 120,
    tableHeight: 60,
    chairW: 46,
    chairD: 50,
    passage: 90,
    turning: 150,
    chairsBlock: true,
    snap: true,
    angleSnap: 15,
    carryChairs: true,
    grid: 50,
    gridSnap: false,
  };

  LLR.DEFAULT_ROOM = { w: 630, l: 800 };

  let uid = 0;
  LLR.newId = () => 'o' + Date.now().toString(36) + (uid++).toString(36) + Math.floor(Math.random() * 1e4).toString(36);

  const mk = (type, x, y, rot, extra) => Object.assign({ id: LLR.newId(), type, x, y, rot: G.normAngle(rot || 0) }, extra || {});

  /* ---------- Grundausstattung (fest bzw. selten bewegt) ---------- */
  LLR.roomFurniture = function (room) {
    const W = room.w;
    const L = room.l;
    return [
      mk('iat', Math.min(W - 200, Math.max(200, W * 0.57)), 0, 180, { locked: true }),
      mk('desk', 85, 45, 180, { w: 140, d: 70 }),
      mk('officeChair', 55, 112, 0),
      mk('coatRack', W - 35, 45, 0),
      mk('door', W, 150, -90, { w: 100 }),
      mk('drawerTower', W - 20, 245, -90),
      mk('cabinet', W - 22.5, 335, -90, { w: 100, d: 45, locked: true }),
      mk('cabinet', W - 22.5, 435, -90, { w: 100, d: 45, locked: true }),
      mk('cabinet', W - 22.5, 535, -90, { w: 100, d: 45, locked: true }),
      mk('screen', W, 435, -90, { w: 120 }),
      ...LLR.parkedShelves(room),
      mk('bookshelf', W - 58, L - 17.5, 0, { w: 110, d: 35 }),
      mk('rollContainer', W - 155, L - 22.5, 0),
      mk('tablets', W - 160, L, 0),
      mk('lamp', 268, L - 25, 0),
      mk('sofaCorner', 42.5, L - 42.5, 0),
      mk('sofa2', 165, L - 42.5, 0),
      mk('sofa2', 42.5, L - 165, 90),
      mk('rug', 165, L - 160, 0, { w: 160, d: 160 }),
      mk('beanbag', 125, L - 195, 0, { color: 'gruen' }),
      mk('beanbag', 170, L - 128, 30, { color: 'gelb' }),
      mk('beanbag', 205, L - 200, -20, { color: 'orange' }),
      mk('partition', 150, L - 265, 0, { w: 120, d: 40 }),
      mk('radiator', 6, 150, 90, { w: 180, d: 12, locked: true }),
      mk('radiator', 6, 370, 90, { w: 180, d: 12, locked: true }),
      mk('window', 0, 105, 90, { w: 170 }),
      mk('window', 0, 295, 90, { w: 170 }),
      mk('window', 0, 485, 90, { w: 170 }),
      mk('window', 0, 675, 90, { w: 170 }),
    ];
  };

  /* Halbrunde Regale in ihrer Parkposition (an rechter Wand und Rückwand) */
  LLR.parkedShelves = (room) => [mk('shelfRound', room.w - 2, room.l - 130, -90), mk('shelfRound', 365 + (room.w - 630) / 2, room.l - 2, 0)];

  /* ---------- Bausteine für Tischgruppen ---------- */
  function tableWorld(t, S) {
    return G.toWorld(LLR.tablePoly(S), t);
  }

  /* Tisch so platzieren, dass die Mitte der langen Seite bei (hx, hy) liegt
     und die Spitze (rechter Winkel) in Richtung (ax, ay) zeigt */
  function tri(S, hx, hy, ax, ay) {
    const d = G.norm({ x: ax, y: ay });
    return mk('table', hx + (d.x * S.tableHeight) / 3, hy + (d.y * S.tableHeight) / 3, G.rotFacing(d));
  }

  /* Zick-Zack-Reihe aus n Tischen, waagerecht und zentriert.
     Lange Kanten der Tische 0, 2, … oben, der Tische 1, 3, … unten. */
  function strip(S, n) {
    const b = S.tableBase;
    const h = S.tableHeight;
    const out = [];
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * (b / 2);
      if (k % 2 === 0) out.push(tri(S, x, -h / 2, 0, 1));
      else out.push(tri(S, x, h / 2, 0, -1));
    }
    return out;
  }

  /* Quadrat aus 2 Tischen (Diagonalfuge). diamond = auf der Spitze stehend */
  function square2(S, diamond) {
    if (diamond) return [tri(S, 0, 0, -1, 0), tri(S, 0, 0, 1, 0)];
    return [tri(S, 0, 0, -1, -1), tri(S, 0, 0, 1, 1)];
  }

  /* Großes Dreieck aus 4 Tischen: lange Seite unten, Spitze oben */
  function bigTri4(S) {
    const b = S.tableBase;
    const h = S.tableHeight;
    return [tri(S, -b / 2, 0, 0, -1), tri(S, b / 2, 0, 0, -1), tri(S, 0, -h, 0, -1), tri(S, 0, -h, 0, 1)];
  }

  /* Dreieck aus 2 Tischen (an einer kurzen Seite verbunden): Spitze oben, lange Seite unten */
  function bigTri2(S) {
    const L = Math.hypot(S.tableBase / 2, S.tableHeight);
    const apex = { x: 0, y: -L / 2 };
    const left = { x: -L, y: L / 2 };
    const right = { x: L, y: L / 2 };
    const mid = { x: 0, y: L / 2 };
    const h1 = G.lerp(apex, left, 0.5);
    const h2 = G.lerp(apex, right, 0.5);
    return [tri(S, h1.x, h1.y, mid.x - h1.x, mid.y - h1.y), tri(S, h2.x, h2.y, mid.x - h2.x, mid.y - h2.y)];
  }

  /* Längliches Sechseck aus 6 Tischen (zwei Zick-Zack-Reihen), waagerecht */
  function hexagon6(S) {
    const h = S.tableHeight;
    return place(strip(S, 3), 0, h / 2, 0).concat(place(strip(S, 3), 0, -h / 2, 180));
  }

  /* Gruppe drehen und verschieben */
  function place(objs, x, y, rot) {
    return objs.map((o) => {
      const p = G.rot({ x: o.x, y: o.y }, rot);
      return Object.assign({}, o, { x: p.x + x, y: p.y + y, rot: G.normAngle((o.rot || 0) + rot) });
    });
  }

  function verts(tables, S) {
    const pts = [];
    for (const t of tables) pts.push(...tableWorld(t, S));
    return pts;
  }

  function center(tables, S) {
    const bb = G.bbox(verts(tables, S));
    const cx = (bb.minX + bb.maxX) / 2;
    const cy = (bb.minY + bb.maxY) / 2;
    return tables.map((t) => Object.assign({}, t, { x: t.x - cx, y: t.y - cy }));
  }

  function hull(points) {
    const pts = points.map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }));
    pts.sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-6) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-6) upper.pop();
      upper.push(p);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  function seatAt(S, a, b, n, u, type) {
    const off = type === 'stool' ? 20 : S.chairD / 2 + 2;
    const p = G.add(G.lerp(a, b, u), G.mul(n, off));
    return mk(type || 'chair', p.x, p.y, G.rotFacing(G.mul(n, -1)));
  }

  /* Sitzplätze an der Außenkontur einer Tischgruppe (Gruppe vor dem Drehen).
     specs: [richtung, u | [u…], typ?] – Richtung der Kanten-Außennormale in Grad:
     -90 = oben, 0 = rechts, 90 = unten, 180 = links, ±45/±135 = schräg */
  function seats(tables, S, specs) {
    const hp = hull(verts(tables, S));
    const out = [];
    for (const spec of specs) {
      const us = Array.isArray(spec[1]) ? spec[1] : [spec[1] === undefined ? 0.5 : spec[1]];
      let best = -1;
      let bestDiff = Infinity;
      for (let i = 0; i < hp.length; i++) {
        if (G.dist(hp[i], hp[(i + 1) % hp.length]) < 20) continue;
        const diff = Math.abs(G.normAngle(G.angle(G.edgeNormal(hp, i)) - spec[0]));
        if (diff < bestDiff - 0.01) {
          bestDiff = diff;
          best = i;
        }
      }
      if (bestDiff > 10) throw new Error('Keine Kante in Richtung ' + spec[0]);
      for (const u of us) out.push(seatAt(S, hp[best], hp[(best + 1) % hp.length], G.edgeNormal(hp, best), u, spec[2]));
    }
    return out;
  }

  /* Tischgruppe inklusive Sitzplätzen an Position x,y mit Drehung rot */
  function group(S, tables, seatSpecs, x, y, rot) {
    const t = center(tables, S);
    const s = seats(t, S, seatSpecs || []);
    return place(t.concat(s), x, y, rot || 0);
  }

  /* Sitzplatz an einer bestimmten Tischkante (0 = lange Seite, 1/2 = kurze Seiten) */
  function seatAtEdge(S, t, edge, u, type) {
    const p = tableWorld(t, S);
    return seatAt(S, p[edge], p[(edge + 1) % 3], G.edgeNormal(p, edge), u === undefined ? 0.5 : u, type);
  }

  /* Ring aus n Tischen, lange Seiten außen. tilt dreht jeden Tisch um seine Mitte
     (Windrad). Der Radius wird so klein gewählt, dass sich nichts überschneidet. */
  function ring(S, n, tilt, gap) {
    const build = (R) => {
      const out = [];
      for (let k = 0; k < n; k++) {
        const a = G.rad(-90 + (k * 360) / n);
        const o = { x: Math.cos(a), y: Math.sin(a) };
        const c = G.mul(o, R);
        const t = mk('table', c.x, c.y, G.rotFacing(G.mul(o, -1)) + tilt);
        out.push(t);
      }
      return out;
    };
    let lo = S.tableHeight * 0.5;
    let hi = S.tableBase * 3;
    for (let it = 0; it < 40; it++) {
      const R = (lo + hi) / 2;
      const r = build(R);
      const p0 = G.inset(tableWorld(r[0], S), -gap / 2);
      const p1 = G.inset(tableWorld(r[1], S), -gap / 2);
      const pl = G.inset(tableWorld(r[n - 1], S), -gap / 2);
      if (G.satDepth(p0, p1) > 0 || G.satDepth(p0, pl) > 0) lo = R;
      else hi = R;
    }
    return build(hi);
  }

  /* Tisch b so drehen/verschieben, dass seine Kante j genau an Kante i von Tisch a liegt */
  function attach(S, a, i, j) {
    const pa = tableWorld(a, S);
    const a0 = pa[i];
    const a1 = pa[(i + 1) % 3];
    const lp = LLR.tablePoly(S);
    const l0 = lp[j];
    const l1 = lp[(j + 1) % 3];
    const rot = G.normAngle(G.angle(G.sub(a0, a1)) - G.angle(G.sub(l1, l0)));
    const w1 = G.rot(l1, rot);
    const c = G.sub(a0, w1);
    return mk('table', c.x, c.y, rot);
  }

  /* Gebogene Zick-Zack-Kette: jeder Tisch hängt an einer kurzen Seite des vorigen,
     an Fuge k wird um bends[k] Grad (im Uhrzeigersinn) abgeknickt. */
  function curvedChain(S, n, bends) {
    const out = [tri(S, 0, -S.tableHeight / 2, 0, 1)];
    let turn = 0;
    for (let k = 0; k < n - 1; k++) {
      const prev = out[k];
      const edge = k % 2 === 0 ? 2 : 1;
      let next = attach(S, prev, edge, edge);
      const d = bends[k] || 0;
      if (d) {
        const pp = tableWorld(prev, S);
        const e0 = pp[edge];
        const e1 = pp[(edge + 1) % 3];
        const inner = G.rot({ x: 0, y: 1 }, turn);
        const pivot = G.dot(e0, inner) > G.dot(e1, inner) ? e0 : e1;
        const c = G.add(pivot, G.rot(G.sub(next, pivot), d));
        next = mk('table', c.x, c.y, next.rot + d);
      }
      turn += d;
      out.push(next);
    }
    return out;
  }

  /* Mittelpunkt der Arbeitsfläche (Raum zwischen Tafel und Sofaecke) */
  function anchor(room) {
    return { x: room.w / 2 - 15, y: 300 + (room.l - 800) * 0.3, dx: (room.w - 630) / 2, dy: (room.l - 800) * 0.3 };
  }

  /* Rückzugsplatz: Einzeltisch zwischen den beiden halbrunden Regalen */
  function retreat(S, cx, cy) {
    const t = tri(S, cx - 25, cy, 1, 0);
    return [t, seatAtEdge(S, t, 0), mk('shelfRound', cx - 55, cy, -90), mk('shelfRound', cx + 55, cy, 90)];
  }

  /* ---------- Anordnungen aus der Handreichung ---------- */
  const P = [];

  P.push({
    id: 'seminar1',
    name: 'Seminarsitzordnung I',
    persons: '21–24 Personen',
    page: 4,
    note: '21 Arbeitsplätze mit 19 Stühlen und 2 Hockern; mit drei zusätzlichen Stühlen aus anderen Räumen sind maximal 24 möglich. Für gute Sicht alle drei Präsentationsflächen nutzen.',
    build(S, room) {
      const { dx, dy } = anchor(room);
      const sq = square2(S, false);
      const dm = square2(S, true);
      return [
        ...group(S, sq, [[0], [90], [180]], dx + 112, dy + 205, 0),
        ...group(S, sq, [[-90], [0], [90], [180]], dx + 112, dy + 415, 0),
        ...group(S, dm, [[-135, 0.5, 'stool'], [-45], [45], [135]], dx + 307, dy + 185, 0),
        ...group(S, dm, [[-135], [-45, 0.5, 'stool'], [45], [135]], dx + 307, dy + 400, 0),
        ...group(S, dm, [[-135], [45], [135]], dx + 492, dy + 292, 0),
        ...group(S, sq, [[0], [90], [180]], dx + 470, dy + 520, 0),
      ];
    },
  });

  P.push({
    id: 'seminar2',
    name: 'Seminarsitzordnung II',
    persons: '21 Personen',
    page: 5,
    note: 'Vier Dreiergruppen aus je drei Tischen. Für gute Sicht alle drei Präsentationsflächen nutzen.',
    build(S, room) {
      const { dx, dy } = anchor(room);
      const s3 = strip(S, 3);
      return [
        ...group(S, s3, [[-90, [1 / 6, 0.5, 5 / 6]], [135], [45]], dx + 72, dy + 330, 90),
        ...group(S, s3, [[-90, [1 / 6, 0.5, 5 / 6]], [135], [45]], dx + 530, dy + 360, -90),
        ...group(S, s3, [[-90, [0.25, 0.75]], [90], [135], [45]], dx + 301, dy + 190, 0),
        ...group(S, s3, [[-90, [0.25, 0.75]], [90, [0.3, 0.7]], [135, 0.5, 'stool'], [45, 0.5, 'stool']], dx + 301, dy + 425, 180),
      ];
    },
  });

  P.push({
    id: 'seminar3',
    name: 'Seminarsitzordnung III',
    persons: '17 Personen',
    page: 6,
    note: 'Gemischte Gruppen und ein Rückzugsplatz zwischen den halbrunden Bücherregalen. Für gute Sicht alle drei Präsentationsflächen nutzen.',
    shelves: true,
    build(S, room) {
      const { dx, dy } = anchor(room);
      const single = tri(S, dx + 470, dy + 490, 0, -1);
      return [
        ...group(S, strip(S, 2), [[-90, [0.3, 0.7]], [-45], [135]], dx + 65, dy + 320, 90),
        ...group(S, hexagon6(S), [[-90], [90], [-45], [-135], [45], [135]], dx + 270, dy + 300, 90),
        ...group(S, square2(S, true), [[-135], [-45], [45], [135]], dx + 470, dy + 300, 0),
        single,
        seatAtEdge(S, single, 0, 0.3),
        seatAtEdge(S, single, 0, 0.7),
        ...retreat(S, dx + 440, room.l - 150),
      ];
    },
  });

  P.push({
    id: 'kreis',
    name: 'Gesprächskreis',
    persons: '8 Personen (erweiterbar)',
    page: 7,
    note: 'Acht Tische als geschlossener Ring (Windrad), alle sitzen außen und sehen sich an.',
    build(S, room) {
      const a = anchor(room);
      const r = ring(S, 8, 24, 1);
      return place(r.concat(r.map((t) => seatAtEdge(S, t, 0))), a.x, a.y + 30, 0);
    },
  });

  P.push({
    id: 'stern',
    name: 'Gesprächskreis als Stern',
    persons: '8 Personen (erweiterbar)',
    page: 8,
    note: 'Die langen Tischseiten bilden ein Achteck, die Spitzen zeigen zur Mitte.',
    build(S, room) {
      const a = anchor(room);
      const r = ring(S, 8, 0, 1);
      return place(r.concat(r.map((t) => seatAtEdge(S, t, 0))), a.x, a.y + 30, 0);
    },
  });

  P.push({
    id: 'schmal',
    name: 'Schmale Tafel',
    persons: '10 Personen (erweiterbar)',
    page: 9,
    note: 'Vier Quadrate (je zwei Tische) in einer langen Reihe.',
    build(S, room) {
      const a = anchor(room);
      const L = Math.hypot(S.tableBase / 2, S.tableHeight);
      const tables = [];
      for (let i = 0; i < 4; i++) tables.push(...place(square2(S, false), 0, (i - 1.5) * L, i % 2 ? 90 : 0));
      return group(S, tables, [[180, [0.125, 0.375, 0.625, 0.875]], [0, [0.125, 0.375, 0.625, 0.875]], [-90], [90]], a.x, a.y + 30, 0);
    },
  });

  P.push({
    id: 'kompakt',
    name: 'Kompakte Tafel',
    persons: '10 Personen',
    page: 10,
    note: 'Sechs Quadrate (je zwei Tische) als großer Block.',
    build(S, room) {
      const a = anchor(room);
      const L = Math.hypot(S.tableBase / 2, S.tableHeight);
      const tables = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 2; c++) tables.push(...place(square2(S, false), (c - 0.5) * L, (r - 1) * L, (r + c) % 2 ? 90 : 0));
      }
      return group(S, tables, [[-90, [0.25, 0.75]], [90, [0.25, 0.75]], [180, [1 / 6, 0.5, 5 / 6]], [0, [1 / 6, 0.5, 5 / 6]]], a.x, a.y + 30, 0);
    },
  });

  P.push({
    id: 'uform',
    name: 'Plenum in U-Form',
    persons: '12 Personen',
    page: 11,
    note: 'Drei Zick-Zack-Reihen als U (wie in der Handreichung), alle sitzen außen und sehen sich an.',
    build(S, room) {
      const { dx, dy } = anchor(room);
      const len = 5 * (S.tableBase / 2);
      const h = S.tableHeight;
      const us = [0.125, 0.375, 0.625, 0.875];
      const cx = dx + 300;
      const top = dy + 172;
      return [
        ...group(S, strip(S, 4), [[-90, us]], cx, top, 0),
        ...group(S, strip(S, 4), [[90, us]], cx - len / 2 - h / 2, top + len / 2 + h / 2 - 5, 90),
        ...group(S, strip(S, 4), [[90, us]], cx + len / 2 + h / 2, top + len / 2 + h / 2 - 5, -90),
      ];
    },
  });

  P.push({
    id: 'oval',
    name: 'Plenum im Oval',
    persons: '9 Personen',
    page: 12,
    note: 'Zwölf Tische als Kette in Ovalform, Öffnung zur Tafel; neun Plätze außen.',
    build(S, room) {
      const a = anchor(room);
      const bends = [10, 14, 24, 30, 30, 30, 30, 24, 14, 10, 0];
      const total = bends.reduce((x, y) => x + y, 0);
      // symmetrisch ausrichten: Scheitel unten, Öffnung zur Tafel
      let tables = place(curvedChain(S, 12, bends), 0, 0, 180 - total / 2);
      tables = center(tables, S);
      const c = G.centroid(verts(tables, S));
      // Kandidaten: alle freien Außenkanten (nicht an einem Nachbartisch anliegend)
      const polys = tables.map((t) => tableWorld(t, S));
      const cand = [];
      polys.forEach((p, ti) => {
        for (let e = 0; e < 3; e++) {
          const n = G.edgeNormal(p, e);
          const m = G.lerp(p[e], p[(e + 1) % 3], 0.5);
          if (G.dot(G.norm(G.sub(m, c)), n) < 0.55) continue;
          const probe = G.add(m, G.mul(n, 6));
          if (polys.some((q, qi) => qi !== ti && G.pointInConvex(G.inset(q, -4), probe))) continue;
          cand.push({ m, n, ang: G.angle(G.sub(m, c)) });
        }
      });
      const off = S.chairD / 2 + 2;
      const partsOf = (o) => G.toWorld(T.chair.parts(o, S)[0], o);
      const mkChair = (ch) => {
        const q = G.add(ch.m, G.mul(ch.n, off));
        return mk('chair', q.x, q.y, G.rotFacing(G.mul(ch.n, -1)));
      };
      // 9 Plätze gleichmäßig über den Bogen verteilen
      const angs = cand.map((x) => x.ang);
      const lo = Math.min(...angs);
      const hi = Math.max(...angs);
      const chairs = [];
      const used = new Set();
      for (let i = 0; i < 9; i++) {
        const target = lo + ((hi - lo) * i) / 8;
        const order = cand.map((x, k) => k).filter((k) => !used.has(k)).sort((k, j) => Math.abs(cand[k].ang - target) - Math.abs(cand[j].ang - target));
        for (const k of order) {
          const chair = mkChair(cand[k]);
          const mine = G.inset(partsOf(chair), -3);
          if (chairs.some((o) => G.satDepth(mine, partsOf(o)) > 0)) continue;
          used.add(k);
          chairs.push(chair);
          break;
        }
      }
      return place(tables.concat(chairs), a.x + 15, a.y + 15, 0);
    },
  });

  P.push({
    id: 'hexdrei',
    name: 'Gruppentischkombination Hexagon und Dreieck',
    persons: '12 Personen',
    page: 13,
    note: 'Ein Sechseck aus sechs Tischen und ein großes Dreieck aus vier Tischen.',
    build(S, room) {
      const { dx, dy } = anchor(room);
      return [
        ...group(S, hexagon6(S), [[-90], [90], [-45], [-135], [45], [135]], dx + 205, dy + 240, -30),
        ...group(S, bigTri4(S), [[90, [0.3, 0.7]], [-45, [0.3, 0.7]], [-135, [0.3, 0.7]]], dx + 410, dy + 450, 165),
      ];
    },
  });

  P.push({
    id: 'quadrat',
    name: 'Großer Gruppentisch als Quadrat',
    persons: '8 Personen',
    page: 14,
    note: 'Vier Quadrate (acht Tische) als großer quadratischer Gruppentisch.',
    build(S, room) {
      const a = anchor(room);
      const L = Math.hypot(S.tableBase / 2, S.tableHeight);
      const tables = [];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) tables.push(...place(square2(S, false), (c - 0.5) * L, (r - 0.5) * L, (r + c) % 2 ? 90 : 0));
      }
      return group(S, tables, [[-90, [0.25, 0.75]], [90, [0.25, 0.75]], [180, [0.25, 0.75]], [0, [0.25, 0.75]]], a.x, a.y + 30, 0);
    },
  });

  P.push({
    id: 'zweier',
    name: 'Verschiedene Zweiertischkonstellationen',
    persons: '12 Personen',
    page: 15,
    note: 'Sechs Zweiertische: nebeneinander (Dreieck), gegenüber (Zick-Zack) und über Eck (Quadrat).',
    build(S, room) {
      const { dx, dy } = anchor(room);
      const t2 = bigTri2(S);
      const st = strip(S, 2);
      const sq = square2(S, false);
      return [
        ...group(S, t2, [[90, [0.3, 0.7]]], dx + 125, dy + 215, 0),
        ...group(S, st, [[-90], [90]], dx + 310, dy + 205, 0),
        ...group(S, sq, [[90], [180]], dx + 480, dy + 265, 0),
        ...group(S, sq, [[90], [0]], dx + 115, dy + 418, 0),
        ...group(S, st, [[-90], [90]], dx + 310, dy + 430, 0),
        ...group(S, t2, [[90, [0.3, 0.7]]], dx + 470, dy + 450, 0),
      ];
    },
  });

  P.push({
    id: 'einzel',
    name: 'Verschiedene Einzelarbeitsplätze',
    persons: '12 Personen',
    page: 16,
    note: 'Einzelplätze in Reihe, Rücken an Rücken, mit Blick zum Fenster bzw. Bildschirm und als Rückzugsplatz zwischen den halbrunden Regalen.',
    shelves: true,
    build(S, room) {
      const { dx, dy } = anchor(room);
      const b = S.tableBase;
      const out = [];
      const single = (hx, hy, ax, ay) => {
        const t = tri(S, hx, hy, ax, ay);
        out.push(t, seatAtEdge(S, t, 0));
      };
      // Reihe mit Blick zur Tafel
      for (let i = 0; i < 3; i++) single(dx + 205 + i * (b + 8), dy + 200, 0, -1);
      // Rücken an Rücken (Windrad)
      const c = { x: dx + 300, y: dy + 415 };
      for (let k = 0; k < 4; k++) {
        const a = G.rad(k * 90 - 45);
        const o = { x: Math.cos(a), y: Math.sin(a) };
        single(c.x + o.x * 78, c.y + o.y * 78, o.x, o.y);
      }
      // Fensterplätze
      single(dx + 85, dy + 300, -1, 0);
      single(dx + 85, dy + 430, -1, 0);
      // Blick zum Wandbildschirm
      single(dx + 497, dy + 345, 1, 0);
      single(dx + 497, dy + 480, 1, 0);
      // Rückzugsplatz
      out.push(...retreat(S, dx + 440, room.l - 150));
      return out;
    },
  });

  LLR.PRESETS = P;
  LLR.presetHelpers = { attach, curvedChain, tri, strip, square2, bigTri4, bigTri2, hexagon6, place, group, seats, seatAtEdge, ring, hull, mk };

  /* Farben verteilen (jeder vierte Stuhl grün) */
  LLR.colorChairs = function (objs) {
    let i = 0;
    for (const o of objs) {
      if (o.type === 'chair') {
        o.color = i % 4 === 3 ? 'gruen' : 'rot';
        i++;
      }
    }
    return objs;
  };
})((window.LLR = window.LLR || {}));
