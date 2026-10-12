/* Analysen: Rollstuhl-Befahrbarkeit, Sicht auf Präsentationsflächen,
   Überschneidungen und Abstände. */
(function (LLR) {
  'use strict';
  const G = LLR.G;
  const T = LLR.TYPES;

  const A = {};

  A.def = (o) => T[o.type];

  A.worldParts = (o, S) => {
    const d = T[o.type];
    if (!d) return [];
    return d.parts(o, S).map((p) => G.toWorld(p, o));
  };

  A.isObstacle = (o, S, ignoreSeats) => {
    const d = T[o.type];
    if (!d || !d.obstacle) return false;
    if (ignoreSeats && (o.type === 'chair' || o.type === 'stool')) return false;
    return true;
  };

  /* ---------- Rollstuhl-Analyse ---------- */
  A.access = function (doc, opts) {
    opts = opts || {};
    const S = doc.settings;
    const W = doc.room.w;
    const L = doc.room.l;
    const g = Math.max(3, Math.ceil(Math.sqrt((W * L) / 45000)));
    const nx = Math.ceil(W / g);
    const ny = Math.ceil(L / g);
    const NX = nx + 2;
    const NY = ny + 2;
    const N = NX * NY;
    const r = S.passage / 2;
    const rt = S.turning / 2;

    const cellX = (i) => (i - 1 + 0.5) * g;
    const cellY = (j) => (j - 1 + 0.5) * g;

    const rasterize = (ignoreSeats) => {
      const occ = new Uint8Array(N);
      for (let i = 0; i < NX; i++) {
        occ[i] = 1;
        occ[(NY - 1) * NX + i] = 1;
      }
      for (let j = 0; j < NY; j++) {
        occ[j * NX] = 1;
        occ[j * NX + NX - 1] = 1;
      }
      for (const o of doc.objects) {
        if (!A.isObstacle(o, S, ignoreSeats)) continue;
        for (const poly of A.worldParts(o, S)) {
          const bb = G.bbox(poly);
          const i0 = Math.max(1, Math.floor(bb.minX / g) + 1);
          const i1 = Math.min(NX - 2, Math.ceil(bb.maxX / g) + 1);
          const j0 = Math.max(1, Math.floor(bb.minY / g) + 1);
          const j1 = Math.min(NY - 2, Math.ceil(bb.maxY / g) + 1);
          for (let j = j0; j <= j1; j++) {
            const y = cellY(j);
            for (let i = i0; i <= i1; i++) {
              const k = j * NX + i;
              if (occ[k]) continue;
              if (G.pointInConvex(poly, { x: cellX(i), y })) occ[k] = 1;
            }
          }
        }
      }
      return occ;
    };

    const distanceFrom = (mask) => {
      const f = new Float64Array(N);
      for (let k = 0; k < N; k++) f[k] = mask[k] ? 0 : Infinity;
      G.edt(f, NX, NY);
      return f;
    };

    const doors = doc.objects.filter((o) => o.type === 'door');

    const reachFrom = (clear, occ) => {
      const free = new Uint8Array(N);
      for (let k = 0; k < N; k++) free[k] = !occ[k] && clear[k] >= r ? 1 : 0;
      const reach = new Uint8Array(N);
      const queue = new Int32Array(N);
      let qh = 0;
      let qt = 0;
      const doorInfo = [];
      for (const d of doors) {
        const w = d.w || 100;
        let seeded = 0;
        for (let ly = -2; ly >= -(r + 45); ly -= g / 2) {
          for (let lx = -w / 2 + 2; lx <= w / 2 - 2; lx += g / 2) {
            const p = G.add(G.rot({ x: lx, y: ly }, d.rot || 0), { x: d.x, y: d.y });
            const i = Math.floor(p.x / g) + 1;
            const j = Math.floor(p.y / g) + 1;
            if (i < 1 || j < 1 || i > NX - 2 || j > NY - 2) continue;
            const k = j * NX + i;
            if (free[k] && !reach[k]) {
              reach[k] = 1;
              queue[qt++] = k;
              seeded++;
            }
          }
        }
        doorInfo.push({ id: d.id, ok: seeded > 0, narrow: w < S.passage });
      }
      const nb = [1, -1, NX, -NX, NX + 1, NX - 1, -NX + 1, -NX - 1];
      while (qh < qt) {
        const k = queue[qh++];
        for (const o of nb) {
          const m = k + o;
          if (free[m] && !reach[m]) {
            reach[m] = 1;
            queue[qt++] = m;
          }
        }
      }
      return { reach, doorInfo };
    };

    const occ = rasterize(!S.chairsBlock);
    const d2 = distanceFrom(occ);
    const clear = new Float64Array(N);
    for (let k = 0; k < N; k++) clear[k] = Math.sqrt(d2[k]) * g - g / 2;
    const { reach, doorInfo } = reachFrom(clear, occ);

    const dReach = distanceFrom(reach);
    const swept = new Uint8Array(N);
    let sweptCount = 0;
    let freeCount = 0;
    for (let k = 0; k < N; k++) {
      if (occ[k]) continue;
      freeCount++;
      if (Math.sqrt(dReach[k]) * g <= r + g * 0.5) {
        swept[k] = 1;
        sweptCount++;
      }
    }

    const turnCenter = new Uint8Array(N);
    let turnCount = 0;
    for (let k = 0; k < N; k++) {
      if (reach[k] && clear[k] >= rt) {
        turnCenter[k] = 1;
        turnCount++;
      }
    }
    const dTurn = distanceFrom(turnCenter);
    const turnSwept = new Uint8Array(N);
    if (turnCount) {
      for (let k = 0; k < N; k++) if (!occ[k] && Math.sqrt(dTurn[k]) * g <= rt + g * 0.5) turnSwept[k] = 1;
    }

    /* Nicht erreichbare freie Flächen (nur größere zusammenhängende Bereiche) */
    const blocked = new Uint8Array(N);
    const seen = new Uint8Array(N);
    const minCells = Math.ceil(1500 / (g * g));
    const stack = new Int32Array(N);
    for (let k = 0; k < N; k++) {
      if (occ[k] || swept[k] || seen[k]) continue;
      let sp = 0;
      const comp = [];
      stack[sp++] = k;
      seen[k] = 1;
      while (sp) {
        const c = stack[--sp];
        comp.push(c);
        for (const o of [1, -1, NX, -NX]) {
          const m = c + o;
          if (!occ[m] && !swept[m] && !seen[m]) {
            seen[m] = 1;
            stack[sp++] = m;
          }
        }
      }
      if (comp.length >= minCells) for (const c of comp) blocked[c] = 1;
    }

    /* Rollstuhlplätze an Tischen */
    let reachNoSeats = null;
    if (S.chairsBlock) {
      const occ2 = rasterize(true);
      const d22 = distanceFrom(occ2);
      const clear2 = new Float64Array(N);
      for (let k = 0; k < N; k++) clear2[k] = Math.sqrt(d22[k]) * g - g / 2;
      reachNoSeats = reachFrom(clear2, occ2).reach;
    }
    const cellAt = (p) => {
      const i = Math.floor(p.x / g) + 1;
      const j = Math.floor(p.y / g) + 1;
      if (i < 1 || j < 1 || i > NX - 2 || j > NY - 2) return -1;
      return j * NX + i;
    };
    const tables = [];
    for (const o of doc.objects) {
      if (o.type !== 'table') continue;
      const poly = A.worldParts(o, S)[0];
      const spots = [];
      for (let e = 0; e < 3; e++) {
        const a = poly[e];
        const b = poly[(e + 1) % 3];
        const n = G.edgeNormal(poly, e);
        let found = null;
        let foundLater = null;
        for (const u of [0.5, 0.38, 0.62, 0.28, 0.72]) {
          const p = G.add(G.lerp(a, b, u), G.mul(n, r + 4));
          const k = cellAt(p);
          if (k < 0) continue;
          if (reach[k]) {
            found = p;
            break;
          }
          if (!foundLater && reachNoSeats && reachNoSeats[k]) foundLater = p;
        }
        const edgeAnchor = G.add(G.lerp(a, b, 0.5), G.mul(n, 16));
        if (found) spots.push({ edge: e, p: found, anchor: edgeAnchor, now: true });
        else if (foundLater) spots.push({ edge: e, p: foundLater, anchor: edgeAnchor, now: false });
      }
      tables.push({ id: o.id, spots, now: spots.some((s) => s.now), later: spots.some((s) => !s.now) });
    }

    /* Bild erzeugen */
    let image = null;
    if (opts.image !== false && typeof document !== 'undefined') {
      const cv = document.createElement('canvas');
      cv.width = nx;
      cv.height = ny;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(nx, ny);
      for (let j = 1; j <= ny; j++) {
        for (let i = 1; i <= nx; i++) {
          const k = j * NX + i;
          const p = ((j - 1) * nx + (i - 1)) * 4;
          let c = null;
          if (turnSwept[k]) c = [47, 158, 68, 110];
          else if (swept[k]) c = [116, 205, 132, 90];
          else if (blocked[k]) c = [224, 49, 49, 95];
          if (c) {
            img.data[p] = c[0];
            img.data[p + 1] = c[1];
            img.data[p + 2] = c[2];
            img.data[p + 3] = c[3];
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      image = { url: cv.toDataURL(), w: nx * g, h: ny * g };
    }

    const area = (n) => (n * g * g) / 10000;
    if (opts.debug) return { g, NX, NY, occ, clear, reach, swept };
    return {
      image,
      grid: g,
      doors: doorInfo,
      hasDoor: doors.length > 0,
      doorOk: doorInfo.some((d) => d.ok),
      sweptArea: area(sweptCount),
      freeArea: area(freeCount),
      turnPossible: turnCount > 0,
      tables,
      tablesNow: tables.filter((t) => t.now).length,
      tablesLater: tables.filter((t) => !t.now && t.later).length,
    };
  };

  /* ---------- Sicht auf Präsentationsflächen ---------- */
  const TALL = { partition: 1, shelfRound: 1, bookshelf: 1, coatRack: 1, drawerTower: 1 };

  A.surfaces = (doc) => {
    const out = [];
    for (const o of doc.objects) {
      const d = T[o.type];
      if (!d || !d.present || !d.surface) continue;
      const s = d.surface(o);
      out.push({
        id: o.id,
        name: d.short,
        p: G.add(G.rot(s.p, o.rot || 0), { x: o.x, y: o.y }),
        n: G.rot(s.n, o.rot || 0),
      });
    }
    return out;
  };

  const segHitsPoly = (a, b, poly) => {
    if (G.pointInConvex(poly, a) || G.pointInConvex(poly, b)) return true;
    for (let i = 0; i < poly.length; i++) {
      const c = poly[i];
      const d = poly[(i + 1) % poly.length];
      const d1 = G.cross(G.sub(b, a), G.sub(c, a));
      const d2 = G.cross(G.sub(b, a), G.sub(d, a));
      const d3 = G.cross(G.sub(d, c), G.sub(a, c));
      const d4 = G.cross(G.sub(d, c), G.sub(b, c));
      if (d1 * d2 < 0 && d3 * d4 < 0) return true;
    }
    return false;
  };

  A.sight = function (doc) {
    const S = doc.settings;
    const surfaces = A.surfaces(doc);
    const blockers = [];
    for (const o of doc.objects) if (TALL[o.type]) blockers.push({ id: o.id, polys: A.worldParts(o, S) });
    const seats = [];
    for (const o of doc.objects) {
      if (o.type !== 'chair' && o.type !== 'stool' && o.type !== 'wheelchair') continue;
      const face = G.rot({ x: 0, y: -1 }, o.rot || 0);
      let best = null;
      for (const s of surfaces) {
        const v = G.sub(o, s.p);
        if (G.dot(v, s.n) < 20) continue;
        let hidden = false;
        for (const bl of blockers) {
          for (const poly of bl.polys) {
            if (segHitsPoly(s.p, { x: o.x, y: o.y }, poly)) {
              hidden = true;
              break;
            }
          }
          if (hidden) break;
        }
        if (hidden) continue;
        const to = G.sub(s.p, o);
        // Hocker sind drehbar: Blickrichtung frei
        const ang = o.type === 'stool' ? 0 : Math.abs(G.normAngle(G.angle(to) - G.angle(face)));
        const dist = G.len(to);
        if (!best || ang < best.ang - 1 || (Math.abs(ang - best.ang) <= 1 && dist < best.dist)) best = { ang, dist, target: s };
      }
      let cat = 'none';
      if (best) cat = best.ang <= 40 ? 'good' : best.ang <= 95 ? 'side' : 'back';
      seats.push({ id: o.id, x: o.x, y: o.y, best, cat });
    }
    return {
      seats,
      surfaces,
      good: seats.filter((s) => s.cat === 'good').length,
      side: seats.filter((s) => s.cat === 'side').length,
      back: seats.filter((s) => s.cat === 'back' || s.cat === 'none').length,
    };
  };

  /* ---------- Überschneidungen & Raumgrenzen ---------- */
  A.problems = function (doc) {
    const S = doc.settings;
    const W = doc.room.w;
    const L = doc.room.l;
    const items = [];
    for (const o of doc.objects) {
      const d = T[o.type];
      if (!d) continue;
      if (!d.obstacle && !d.collide) continue;
      const polys = A.worldParts(o, S);
      const bb = G.bbox([].concat(...polys));
      items.push({ o, d, polys, bb });
    }
    const bad = new Map();
    const flag = (id, why) => {
      if (!bad.has(id)) bad.set(id, new Set());
      bad.get(id).add(why);
    };
    for (const it of items) {
      if (it.d.wall) continue;
      if (it.bb.minX < -1 || it.bb.minY < -1 || it.bb.maxX > W + 1 || it.bb.maxY > L + 1) flag(it.o.id, 'out');
    }
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j];
        if (a.bb.maxX < b.bb.minX || b.bb.maxX < a.bb.minX || a.bb.maxY < b.bb.minY || b.bb.maxY < a.bb.minY) continue;
        const ka = a.d.kind;
        const kb = b.d.kind;
        if ((ka === 'seat' && kb === 'table') || (kb === 'seat' && ka === 'table')) continue;
        let tol = 1.5;
        if ((ka === 'wheelchair' && kb === 'table') || (kb === 'wheelchair' && ka === 'table')) tol = 28;
        if ((ka === 'wheelchair' && kb === 'seat') || (kb === 'wheelchair' && ka === 'seat')) tol = 1.5;
        let depth = 0;
        for (const pa of a.polys) {
          for (const pb of b.polys) {
            depth = Math.max(depth, G.satDepth(pa, pb));
            if (depth > tol) break;
          }
          if (depth > tol) break;
        }
        if (depth > tol) {
          flag(a.o.id, 'overlap');
          flag(b.o.id, 'overlap');
        }
      }
    }
    return bad;
  };

  /* ---------- Abstände des ausgewählten Objekts ---------- */
  A.clearances = function (doc, id) {
    const S = doc.settings;
    const W = doc.room.w;
    const L = doc.room.l;
    const self = doc.objects.find((o) => o.id === id);
    if (!self) return [];
    const sd = T[self.type];
    if (!sd || sd.wall || sd.kind === 'label' || sd.kind === 'floor') return [];
    const mine = A.worldParts(self, S);
    const sectors = [null, null, null, null];
    const consider = (d, p, q, otherId) => {
      if (d <= 2 || d > 320) return;
      const ang = G.angle(G.sub(q, p));
      const s = ((Math.round(ang / 90) % 4) + 4) % 4;
      if (!sectors[s] || d < sectors[s].d) sectors[s] = { d, p, q, other: otherId };
    };
    for (const o of doc.objects) {
      if (o.id === id) continue;
      if (!A.isObstacle(o, S, false)) continue;
      const polys = A.worldParts(o, S);
      let best = null;
      for (const a of mine) {
        for (const b of polys) {
          const r = G.polyDistance(a, b);
          if (!best || r.d < best.d) best = r;
        }
      }
      if (best && best.d > 2) consider(best.d, best.p, best.q, o.id);
    }
    const all = [].concat(...mine);
    const walls = [
      { pick: (p) => p.x, q: (p) => ({ x: 0, y: p.y }) },
      { pick: (p) => W - p.x, q: (p) => ({ x: W, y: p.y }) },
      { pick: (p) => p.y, q: (p) => ({ x: p.x, y: 0 }) },
      { pick: (p) => L - p.y, q: (p) => ({ x: p.x, y: L }) },
    ];
    for (const w of walls) {
      let best = null;
      for (const p of all) {
        const d = w.pick(p);
        if (!best || d < best.d) best = { d, p };
      }
      if (best) consider(best.d, best.p, w.q(best.p), 'wall');
    }
    return sectors.filter(Boolean);
  };

  /* Objekte, die beim Verschieben eines Tisches mitgenommen werden (angestellte Stühle) */
  A.attachedSeats = function (doc, tableIds) {
    const S = doc.settings;
    const tables = doc.objects.filter((o) => o.type === 'table');
    const polys = new Map(tables.map((t) => [t.id, A.worldParts(t, S)[0]]));
    const out = [];
    for (const o of doc.objects) {
      if (o.type !== 'chair' && o.type !== 'stool') continue;
      const cp = A.worldParts(o, S);
      let best = null;
      for (const t of tables) {
        const tp = polys.get(t.id);
        if (Math.abs(t.x - o.x) > 200 || Math.abs(t.y - o.y) > 200) continue;
        let d = Infinity;
        for (const p of cp) d = Math.min(d, G.polyDistance(p, tp).d);
        if (!best || d < best.d) best = { d, id: t.id };
      }
      if (best && best.d <= 14 && tableIds.has(best.id)) out.push(o.id);
    }
    return out;
  };

  LLR.analysis = A;
})((window.LLR = window.LLR || {}));
