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

  /* Dreieckstische und Rechtecktische */
  A.isTable = (o) => {
    const d = T[o.type];
    return !!d && d.kind === 'table';
  };

  /* Größter Abstand eines Eckpunkts vom Objektmittelpunkt */
  A.reach = (poly, c) => {
    let r = 0;
    for (const p of poly) r = Math.max(r, Math.hypot(p.x - c.x, p.y - c.y));
    return r;
  };

  /* Trennwand: Endpunkte der Wandlinie */
  A.partitionEnds = (o) => {
    const w = o.w || 120;
    return G.toWorld([{ x: -w / 2, y: 0 }, { x: w / 2, y: 0 }], o);
  };

  /* Zwei Trennwände sind verbunden, wenn ein Ende an der anderen Wand anliegt */
  A.partitionsJoined = (a, b) => {
    const ea = A.partitionEnds(a);
    const eb = A.partitionEnds(b);
    for (const [P, Q] of [[ea, eb], [eb, ea]]) {
      for (const p of P) {
        const q = G.closestOnSeg(p, Q[0], Q[1]);
        if (Math.hypot(p.x - q.x, p.y - q.y) < 4) return true;
      }
    }
    return false;
  };

  A.isObstacle = (o, S, ignoreSeats) => {
    const d = T[o.type];
    if (!d || !d.obstacle) return false;
    if (ignoreSeats && (o.type === 'chair' || o.type === 'stool')) return false;
    return true;
  };

  /* Abstand eines Punkts zu einem konvexen Polygon (0 = innen) */
  const pointPolyDist = (p, poly) => {
    if (G.pointInConvex(poly, p)) return 0;
    let d = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const q = G.closestOnSeg(p, poly[i], poly[(i + 1) % poly.length]);
      d = Math.min(d, Math.hypot(p.x - q.x, p.y - q.y));
    }
    return d;
  };

  const isMovableSeat = (o) => o.type === 'chair' || o.type === 'stool';

  /* ---------- Rollstuhl-Analyse ----------
     Raster über den Raum: frei ist eine Zelle, wenn der Mittelpunkt eines
     Rollstuhls dort mindestens die halbe Durchgangsbreite Abstand zu allen
     Hindernissen hat. Von der Tür aus wird per Breitensuche ermittelt, welche
     Zellen erreichbar sind – mit Rückverweisen, damit sich der Weg zu jedem
     Rollstuhlplatz nachzeichnen lässt. */
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
    const cellPt = (k) => ({ x: cellX(k % NX), y: cellY(Math.floor(k / NX)) });
    const cellAt = (p) => {
      const i = Math.floor(p.x / g) + 1;
      const j = Math.floor(p.y / g) + 1;
      if (i < 1 || j < 1 || i > NX - 2 || j > NY - 2) return -1;
      return j * NX + i;
    };
    const eachCell = (poly, fn) => {
      const bb = G.bbox(poly);
      const i0 = Math.max(1, Math.floor(bb.minX / g) + 1);
      const i1 = Math.min(NX - 2, Math.ceil(bb.maxX / g) + 1);
      const j0 = Math.max(1, Math.floor(bb.minY / g) + 1);
      const j1 = Math.min(NY - 2, Math.ceil(bb.maxY / g) + 1);
      for (let j = j0; j <= j1; j++) {
        const y = cellY(j);
        for (let i = i0; i <= i1; i++) if (G.pointInConvex(poly, { x: cellX(i), y })) fn(j * NX + i);
      }
    };

    /* Belegung: Wände und Möbel; Stühle/Hocker mit Zuordnung, damit sich
       einzelne Stühle probeweise wegstellen lassen */
    const occ = new Uint8Array(N);
    for (let i = 0; i < NX; i++) {
      occ[i] = 1;
      occ[(NY - 1) * NX + i] = 1;
    }
    for (let j = 0; j < NY; j++) {
      occ[j * NX] = 1;
      occ[j * NX + NX - 1] = 1;
    }
    const seats = [];
    for (const o of doc.objects) {
      if (!A.isObstacle(o, S, false)) continue;
      if (isMovableSeat(o)) {
        if (S.chairsBlock) seats.push({ o, polys: A.worldParts(o, S) });
        continue;
      }
      for (const poly of A.worldParts(o, S)) eachCell(poly, (k) => (occ[k] = 1));
    }
    const owner = new Int32Array(N).fill(-1);
    seats.forEach((st, si) => {
      for (const poly of st.polys) {
        eachCell(poly, (k) => {
          if (occ[k]) return;
          owner[k] = owner[k] === -1 || owner[k] === si ? si : -2;
        });
      }
    });
    for (let k = 0; k < N; k++) if (owner[k] !== -1) occ[k] = 1;

    const distanceFrom = (mask) => {
      const f = new Float64Array(N);
      for (let k = 0; k < N; k++) f[k] = mask[k] ? 0 : Infinity;
      G.edt(f, NX, NY);
      return f;
    };

    const d2 = distanceFrom(occ);
    const clear = new Float64Array(N);
    for (let k = 0; k < N; k++) clear[k] = Math.sqrt(d2[k]) * g - g / 2;
    const free = new Uint8Array(N);
    for (let k = 0; k < N; k++) free[k] = !occ[k] && clear[k] >= r ? 1 : 0;

    /* Breitensuche von der Tür */
    const doors = doc.objects.filter((o) => o.type === 'door');
    const reach = new Uint8Array(N);
    const parent = new Int32Array(N).fill(-1);
    const queue = new Int32Array(N);
    let qh = 0;
    let qt = 0;
    const doorInfo = [];
    for (const d of doors) {
      const w = d.w || 100;
      let seeded = 0;
      for (let ly = -2; ly >= -(r + 45); ly -= g / 2) {
        for (let lx = -w / 2 + 2; lx <= w / 2 - 2; lx += g / 2) {
          const k = cellAt(G.add(G.rot({ x: lx, y: ly }, d.rot || 0), { x: d.x, y: d.y }));
          if (k >= 0 && free[k] && !reach[k]) {
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
          parent[m] = k;
          queue[qt++] = m;
        }
      }
    }
    /* Weg von der Tür bis zur Zelle k (Zellindizes) */
    const pathTo = (k) => {
      const out = [];
      for (let c = k; c !== -1; c = parent[c]) out.push(c);
      return out.reverse();
    };

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

    /* Freie Zellen, wenn bestimmte Stühle weggestellt werden. Es ändert sich
       nur die Umgebung der Stühle, daher genügt ein Ausschnitt des Rasters. */
    const pad = Math.ceil(r / g) + 2;
    const altFree = new Map();
    const freeWithout = (ids) => {
      const key = ids.join(',');
      if (altFree.has(key)) return altFree.get(key);
      const bb = G.bbox([].concat(...ids.map((si) => [].concat(...seats[si].polys))));
      const ai0 = Math.max(1, Math.floor(bb.minX / g) + 1 - pad);
      const ai1 = Math.min(NX - 2, Math.ceil(bb.maxX / g) + 1 + pad);
      const aj0 = Math.max(1, Math.floor(bb.minY / g) + 1 - pad);
      const aj1 = Math.min(NY - 2, Math.ceil(bb.maxY / g) + 1 + pad);
      const wi0 = Math.max(0, ai0 - pad);
      const wi1 = Math.min(NX - 1, ai1 + pad);
      const wj0 = Math.max(0, aj0 - pad);
      const wj1 = Math.min(NY - 1, aj1 + pad);
      const wx = wi1 - wi0 + 1;
      const wy = wj1 - wj0 + 1;
      const a = ids[0];
      const b = ids.length > 1 ? ids[1] : a;
      const f = new Float64Array(wx * wy);
      for (let j = wj0; j <= wj1; j++) {
        for (let i = wi0; i <= wi1; i++) {
          const k = j * NX + i;
          f[(j - wj0) * wx + (i - wi0)] = occ[k] && owner[k] !== a && owner[k] !== b ? 0 : Infinity;
        }
      }
      G.edt(f, wx, wy);
      const fr = free.slice();
      const lim = (r + g / 2) / g;
      for (let j = aj0; j <= aj1; j++) {
        for (let i = ai0; i <= ai1; i++) {
          const d = f[(j - wj0) * wx + (i - wi0)];
          fr[j * NX + i] = d > 0 && d >= lim * lim ? 1 : 0;
        }
      }
      altFree.set(key, fr);
      return fr;
    };

    /* Zellen, die nach dem Wegstellen zusätzlich erreichbar werden: Breitensuche
       ab den neu frei gewordenen Zellen am Rand des erreichbaren Bereichs */
    const mark = new Int32Array(N);
    const prev = new Int32Array(N);
    let stamp = 0;
    const extend = (ids, fr) => {
      stamp++;
      const bb = G.bbox([].concat(...ids.map((si) => [].concat(...seats[si].polys))));
      const i0 = Math.max(1, Math.floor(bb.minX / g) + 1 - pad);
      const i1 = Math.min(NX - 2, Math.ceil(bb.maxX / g) + 1 + pad);
      const j0 = Math.max(1, Math.floor(bb.minY / g) + 1 - pad);
      const j1 = Math.min(NY - 2, Math.ceil(bb.maxY / g) + 1 + pad);
      let t = 0;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = j * NX + i;
          if (!fr[k] || reach[k]) continue;
          let from = -1;
          for (const o of nb) if (reach[k + o]) from = k + o;
          if (from < 0) continue;
          mark[k] = stamp;
          prev[k] = from;
          queue[t++] = k;
        }
      }
      for (let h = 0; h < t; h++) {
        const k = queue[h];
        for (const o of nb) {
          const m = k + o;
          if (fr[m] && !reach[m] && mark[m] !== stamp) {
            mark[m] = stamp;
            prev[m] = k;
            queue[t++] = m;
          }
        }
      }
    };
    /* Weg zu einer Zelle, die erst nach dem Wegstellen erreichbar ist */
    const extendedPath = (k) => {
      const tail = [];
      let c = k;
      while (!reach[c]) {
        tail.push(c);
        c = prev[c];
      }
      return pathTo(c).concat(tail.reverse());
    };

    /* Rollstuhlplätze an Tischen: je Tischkante ein Platz, der entweder
       sofort erreichbar ist oder nach Wegstellen von höchstens zwei Stühlen,
       die genau diesen Platz belegen – samt geprüftem Weg von der Tür. */
    const US = [0.5, 0.38, 0.62, 0.28, 0.72];
    const tables = [];
    const pending = new Map();
    for (const o of doc.objects) {
      if (!A.isTable(o)) continue;
      const poly = A.worldParts(o, S)[0];
      const t = { id: o.id, spots: [] };
      tables.push(t);
      for (let e = 0; e < poly.length; e++) {
        const a = poly[e];
        const b = poly[(e + 1) % poly.length];
        const n = G.edgeNormal(poly, e);
        const anchor = G.add(G.lerp(a, b, 0.5), G.mul(n, 16));
        const cands = [];
        for (const u of US) {
          const p = G.add(G.lerp(a, b, u), G.mul(n, r + 4));
          const k = cellAt(p);
          if (k >= 0) cands.push({ p, k });
        }
        const now = cands.find((c) => reach[c.k]);
        if (now) {
          t.spots.push({ edge: e, p: now.p, anchor, now: true, move: [], cells: pathTo(now.k), free });
          continue;
        }
        if (!seats.length || opts.quick) continue;
        const edge = { t, e, anchor, done: false };
        cands.forEach((c, order) => {
          const ids = [];
          seats.forEach((st, si) => {
            if (st.polys.some((pl) => pointPolyDist(c.p, pl) < r)) ids.push(si);
          });
          if (!ids.length || ids.length > 2) return;
          const key = ids.join(',');
          if (!pending.has(key)) pending.set(key, { ids, items: [] });
          pending.get(key).items.push({ edge, c, order });
        });
      }
    }
    /* je Stuhlauswahl einmal suchen, dann alle Plätze dazu auswerten */
    const found = [];
    for (const { ids, items } of pending.values()) {
      const fr = freeWithout(ids);
      extend(ids, fr);
      for (const it of items) {
        if (mark[it.c.k] !== stamp || !fr[it.c.k]) continue;
        found.push({ edge: it.edge, order: it.order, spot: { edge: it.edge.e, p: it.c.p, anchor: it.edge.anchor, now: false, move: ids.map((si) => seats[si].o.id), cells: extendedPath(it.c.k), free: fr } });
      }
    }
    found.sort((x, y) => x.order - y.order || x.spot.move.length - y.spot.move.length);
    for (const f of found) {
      if (f.edge.done) continue;
      f.edge.done = true;
      f.edge.t.spots.push(f.spot);
    }
    for (const t of tables) {
      t.spots.sort((a, b) => a.edge - b.edge);
      const later = t.spots.filter((s) => !s.now);
      t.now = t.spots.some((s) => s.now);
      t.later = later.length > 0;
      t.moveMin = later.length ? Math.min(...later.map((s) => s.move.length)) : 0;
    }

    /* Prüf-Rollstühle: von der Tür aus erreichbar? */
    const wheelchairs = [];
    for (const o of doc.objects) {
      if (o.type !== 'wheelchair') continue;
      const R = 60;
      const rc = Math.ceil(R / g);
      const ci = Math.floor(o.x / g) + 1;
      const cj = Math.floor(o.y / g) + 1;
      let best = -1;
      let bd = Infinity;
      for (let j = Math.max(1, cj - rc); j <= Math.min(NY - 2, cj + rc); j++) {
        for (let i = Math.max(1, ci - rc); i <= Math.min(NX - 2, ci + rc); i++) {
          const k = j * NX + i;
          if (!reach[k]) continue;
          const d = Math.hypot(cellX(i) - o.x, cellY(j) - o.y);
          if (d <= R && d < bd) {
            bd = d;
            best = k;
          }
        }
      }
      wheelchairs.push({ id: o.id, ok: best >= 0, cells: best >= 0 ? pathTo(best) : null, free, end: { x: o.x, y: o.y } });
    }

    /* Weg als geglättete Linie in Raumkoordinaten (Tür → Ziel) */
    const route = (item) => {
      if (!item || !item.cells || !item.cells.length) return null;
      if (item.pts) return item.pts;
      const fr = item.free;
      const pts = item.cells.map(cellPt);
      const los = (a, b) => {
        const n = Math.ceil(G.dist(a, b) / (g / 2));
        for (let s = 1; s < n; s++) {
          const k = cellAt(G.lerp(a, b, s / n));
          if (k < 0 || !fr[k]) return false;
        }
        return true;
      };
      const out = [pts[0]];
      let i = 0;
      while (i < pts.length - 1) {
        let j = i + 1;
        while (j + 1 < pts.length && los(pts[i], pts[j + 1])) j++;
        out.push(pts[j]);
        i = j;
      }
      let door = null;
      for (const d of doors) if (!door || G.dist(d, out[0]) < G.dist(door, out[0])) door = d;
      if (door) out.unshift({ x: door.x, y: door.y });
      const end = item.end || item.p;
      if (end && G.dist(end, out[out.length - 1]) > 1) out.push(end);
      item.pts = out;
      return out;
    };

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
    const laterTables = tables.filter((t) => !t.now && t.later);
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
      tablesLater: laterTables.length,
      laterMove: laterTables.length ? Math.max(...laterTables.map((t) => t.moveMin)) : 0,
      complete: !opts.quick,
      wheelchairs,
      route,
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
      const p = G.add(G.rot(s.p, o.rot || 0), { x: o.x, y: o.y });
      const along = G.rot({ x: (s.w || 100) / 2, y: 0 }, o.rot || 0);
      out.push({
        id: o.id,
        name: d.short,
        p,
        n: G.rot(s.n, o.rot || 0),
        a: G.sub(p, along),
        b: G.add(p, along),
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

  A.isSeat = (o) => o.type === 'chair' || o.type === 'stool' || o.type === 'wheelchair';

  /* Sitzende Person in Augenhöhe, vereinfacht als Kreis (Kopf mit etwas
     Bewegungsspielraum, ca. 32 cm breit) */
  A.PERSON_R = 16;
  /* Höhen in cm: Augenhöhe und Kopfoberkante sitzend, Unter- und Oberkante
     einer Präsentationsfläche. Ein Kopf verdeckt nur den unteren Teil der
     Fläche – je näher die Person am eigenen Platz sitzt, desto mehr. */
  A.HEIGHTS = { eye: 120, head: 135, low: 90, top: 200 };
  /* Ab diesem Anteil der Präsentationsfläche, der hinter Personen liegt,
     gilt die Sicht als eingeschränkt */
  A.PERSON_LIMIT = 0.25;
  const SAMPLES = 24;

  /* Verdeckter Höhenanteil der Fläche durch einen Kopf, der beim Anteil t
     der Strecke vom Auge zur Fläche sitzt */
  const headShade = (t) => {
    const H = A.HEIGHTS;
    const edge = H.eye + (H.head - H.eye) / Math.max(t, 0.01);
    return Math.max(0, Math.min(1, (Math.min(H.top, edge) - H.low) / (H.top - H.low)));
  };

  const sightBlockers = (doc) => {
    const out = [];
    for (const o of doc.objects) if (TALL[o.type]) out.push(...A.worldParts(o, doc.settings));
    return out;
  };

  const blocked = (eye, q, blockers) => blockers.some((poly) => segHitsPoly(q, eye, poly));


  const viewAngle = (o, s) => {
    // Hocker sind drehbar: Blickrichtung frei
    if (o.type === 'stool') return 0;
    const face = G.rot({ x: 0, y: -1 }, o.rot || 0);
    return Math.abs(G.normAngle(G.angle(G.sub(s.p, o)) - G.angle(face)));
  };

  const sightCat = (ang) => (ang <= 40 ? 'good' : ang <= 95 ? 'side' : 'back');

  /* Gemeinsame Grundlage für alle Sitzplätze eines Plans */
  const sightContext = (doc) => ({
    surfaces: A.surfaces(doc),
    blockers: sightBlockers(doc),
    persons: doc.settings.sightPersons === false ? [] : doc.objects.filter(A.isSeat).map((o) => ({ id: o.id, x: o.x, y: o.y })),
  });

  /* Sicht eines Platzes auf eine Präsentationsfläche: Abschnitte, die frei
     (0), teilweise durch sitzende Personen (1) oder durch Möbel (2) verdeckt
     sind. personFrac schätzt den Anteil der Fläche, der hinter Köpfen liegt. */
  const viewOf = (o, s, ctx) => {
    const runs = [];
    const by = new Set();
    const R2 = A.PERSON_R * A.PERSON_R;
    let vis = 0;
    let shade = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const q = G.lerp(s.a, s.b, (i + 0.5) / SAMPLES);
      let st = 0;
      if (blocked(o, q, ctx.blockers)) st = 2;
      else {
        vis++;
        let w = 0;
        for (const pp of ctx.persons) {
          if (pp.id === o.id) continue;
          const c = G.closestOnSeg(pp, o, q);
          if ((c.x - pp.x) * (c.x - pp.x) + (c.y - pp.y) * (c.y - pp.y) >= R2) continue;
          st = 1;
          by.add(pp.id);
          w = Math.max(w, headShade(c.t));
        }
        shade += w;
      }
      const last = runs[runs.length - 1];
      if (last && last.st === st) last.t1 = (i + 1) / SAMPLES;
      else runs.push({ t0: i / SAMPLES, t1: (i + 1) / SAMPLES, st, vis: st !== 2 });
    }
    const v = { s, runs, frac: vis / SAMPLES, personFrac: shade / SAMPLES, persons: [...by], ang: viewAngle(o, s), dist: G.dist(o, s.p) };
    v.turn = sightCat(v.ang);
    v.cat = v.frac < 0.5 ? 'hidden' : v.turn;
    v.person = v.cat !== 'hidden' && v.personFrac >= A.PERSON_LIMIT;
    return v;
  };

  /* Reihenfolge: direkt vor seitlich vor abgewandt, jeweils ohne Personen
     im Blick zuerst; danach kleinerer Winkel, dann kürzere Entfernung */
  const rank = (v) => ({ good: 0, side: 2, back: 4 })[v.turn] + (v.person ? 1 : 0);
  const better = (c, b) => {
    if (!b) return true;
    if (rank(c) !== rank(b)) return rank(c) < rank(b);
    return c.ang < b.ang - 1 || (Math.abs(c.ang - b.ang) <= 1 && c.dist < b.dist);
  };

  const seatViews = (o, ctx) => {
    const views = [];
    let best = null;
    for (const s of ctx.surfaces) {
      if (G.dot(G.sub(o, s.p), s.n) < 20) continue;
      const v = viewOf(o, s, ctx);
      views.push(v);
      if (v.cat !== 'hidden' && better(v, best)) best = v;
    }
    return { views, best };
  };

  /* Kategorie eines Sitzplatzes: good = direkt, side = Kopf drehen,
     person = Person im Blickfeld, back = abgewandt, none = kein Blick */
  A.seatCat = (best) => (!best ? 'none' : best.turn === 'back' ? 'back' : best.turn === 'side' ? 'side' : best.person ? 'person' : 'good');

  A.sight = function (doc) {
    const ctx = sightContext(doc);
    const seats = [];
    for (const o of doc.objects) {
      if (!A.isSeat(o)) continue;
      const { best } = seatViews(o, ctx);
      seats.push({ id: o.id, x: o.x, y: o.y, best, cat: A.seatCat(best) });
    }
    const n = (c) => seats.filter((s) => s.cat === c).length;
    const res = {
      seats,
      surfaces: ctx.surfaces,
      persons: doc.settings.sightPersons !== false,
      good: n('good'),
      side: n('side'),
      person: n('person'),
      back: n('back') + n('none'),
    };
    res.limited = res.side + res.person;
    return res;
  };

  /* Sichtkegel eines Sitzplatzes: je Präsentationsfläche die sichtbaren
     und verdeckten Abschnitte, Entfernung und nötige Kopfdrehung. */
  A.sightCone = function (doc, id) {
    const o = doc.objects.find((x) => x.id === id);
    if (!o || !A.isSeat(o)) return null;
    const { views, best } = seatViews(o, sightContext(doc));
    return {
      eye: { x: o.x, y: o.y },
      face: G.rot({ x: 0, y: -1 }, o.rot || 0),
      free: o.type === 'stool',
      views,
      best,
      cat: A.seatCat(best),
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
        if (a.o.type === 'partition' && b.o.type === 'partition' && A.partitionsJoined(a.o, b.o)) continue;
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
    if (!sd || sd.wall || sd.kind === 'label' || sd.kind === 'floor' || sd.kind === 'zone') return [];
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
    const tables = doc.objects.filter(A.isTable);
    const polys = new Map(tables.map((t) => [t.id, A.worldParts(t, S)[0]]));
    const out = [];
    for (const o of doc.objects) {
      if (o.type !== 'chair' && o.type !== 'stool') continue;
      const cp = A.worldParts(o, S);
      let best = null;
      for (const t of tables) {
        const tp = polys.get(t.id);
        if (Math.hypot(t.x - o.x, t.y - o.y) > A.reach(tp, t) + 80) continue;
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
