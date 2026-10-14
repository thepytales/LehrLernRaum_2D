/* Analysen: Rollstuhl-Befahrbarkeit, Sicht auf Präsentationsflächen,
   Überschneidungen und Abstände. */
(function (LLR) {
  'use strict';
  const G = LLR.G;
  const T = LLR.TYPES;

  const A = {};

  A.def = (o) => T[o.type];

  /* ---------- Prüfregeln ----------
     Alle Grenzwerte und Gewichte der Prüfungen. Fünf davon stehen wie bisher
     direkt in den Einstellungen (top), alle anderen in settings.rules – dort
     nur, wenn sie vom Standard abweichen. Prüfprofile setzen mehrere Werte. */
  A.RULES = [
    { key: 'passage', group: 'Rollstuhl', label: 'Durchgang für Rollstühle mindestens', unit: 'cm', min: 60, max: 200, step: 5, def: 90, top: true },
    { key: 'turning', group: 'Rollstuhl', label: 'Wendekreis (Durchmesser)', unit: 'cm', min: 100, max: 250, step: 5, def: 150, top: true },
    { key: 'chairsBlock', group: 'Rollstuhl', label: 'Stühle und Hocker zählen als Hindernis', type: 'bool', def: true, top: true },
    { key: 'walk', group: 'Wege & Lehrkraft', label: 'Bequemer Durchgang zum Gehen', unit: 'cm', min: 35, max: 120, step: 5, def: 50, top: true },
    { key: 'squeeze', group: 'Wege & Lehrkraft', label: 'Engstelle (seitlich hindurchschieben) ab', unit: 'cm', min: 25, max: 60, step: 1, def: 36 },
    { key: 'teacherWalk', group: 'Wege & Lehrkraft', label: 'Weg der Lehrkraft gilt als weit ab', unit: 'cm', min: 200, max: 2000, step: 50, def: 700 },
    { key: 'faceAngle', group: 'Wege & Lehrkraft', label: 'Gesicht im Blick bis zu einem Winkel von', unit: '°', min: 20, max: 90, step: 5, def: 60 },
    { key: 'profileAngle', group: 'Wege & Lehrkraft', label: 'Profil im Blick bis zu einem Winkel von', unit: '°', min: 60, max: 150, step: 5, def: 110 },
    { key: 'sightPersons', group: 'Sicht', label: 'Sitzende Personen verdecken die Sicht', type: 'bool', def: true, top: true },
    { key: 'sightDirect', group: 'Sicht', label: 'Direkter Blick bis zu einer Kopfdrehung von', unit: '°', min: 15, max: 70, step: 5, def: 40 },
    { key: 'sightSide', group: 'Sicht', label: 'Mit gedrehtem Kopf sichtbar bis', unit: '°', min: 60, max: 135, step: 5, def: 95 },
    { key: 'personLimit', group: 'Sicht', label: 'Eingeschränkt, wenn Personen mindestens so viel verdecken', unit: '%', min: 5, max: 80, step: 5, def: 25 },
    { key: 'wDoor', group: 'Ruhe & Reize', label: 'Gewicht: Tür in der Nähe', unit: 'Punkte', min: 0, max: 60, step: 1, def: 30 },
    { key: 'wLounge', group: 'Ruhe & Reize', label: 'Gewicht: Lounge in der Nähe', unit: 'Punkte', min: 0, max: 60, step: 1, def: 20 },
    { key: 'wTraffic', group: 'Ruhe & Reize', label: 'Gewicht: Laufwege anderer', unit: 'Punkte', min: 0, max: 60, step: 1, def: 25 },
    { key: 'wCrowd', group: 'Ruhe & Reize', label: 'Gewicht: viele Plätze direkt daneben', unit: 'Punkte', min: 0, max: 60, step: 1, def: 15 },
    { key: 'wWindow', group: 'Ruhe & Reize', label: 'Gewicht: Blick aus dem Fenster', unit: 'Punkte', min: 0, max: 60, step: 1, def: 10 },
    { key: 'wGlare', group: 'Ruhe & Reize', label: 'Gewicht: Spiegelung des Fensters', unit: 'Punkte', min: 0, max: 60, step: 1, def: 10 },
    { key: 'wQuiet', group: 'Ruhe & Reize', label: 'Abzug: Platz in einer Ruhezone', unit: 'Punkte', min: 0, max: 60, step: 1, def: 20 },
    { key: 'calmMax', group: 'Ruhe & Reize', label: 'Ruhiger Platz unter', unit: 'Punkte', min: 5, max: 80, step: 1, def: 25 },
    { key: 'busyMin', group: 'Ruhe & Reize', label: 'Unruhiger Platz ab', unit: 'Punkte', min: 10, max: 100, step: 1, def: 50 },
    { key: 'seeDist', group: 'Bedarfe & Belegung', label: 'Sehen: Präsentationsfläche höchstens', unit: 'cm', min: 100, max: 800, step: 25, def: 300 },
    { key: 'hearDist', group: 'Bedarfe & Belegung', label: 'Hören: Tafel und Lehrkraft höchstens', unit: 'cm', min: 150, max: 1000, step: 25, def: 550 },
    { key: 'exitDist', group: 'Bedarfe & Belegung', label: 'Ausgang: Weg zur Tür höchstens', unit: 'cm', min: 100, max: 1000, step: 25, def: 350 },
    { key: 'maxSeats', group: 'Bedarfe & Belegung', label: 'Empfohlene Höchstzahl an Arbeitsplätzen', unit: 'Plätze', min: 1, max: 60, step: 1, def: 24 },
  ];
  A.RULE = Object.fromEntries(A.RULES.map((r) => [r.key, r]));

  /* Wert einer Regel für einen Plan */
  A.rule = (S, key) => {
    const r = A.RULE[key];
    if (!r) return undefined;
    if (r.top) return S && S[key] !== undefined ? S[key] : r.def;
    const v = S && S.rules ? S.rules[key] : undefined;
    return v !== undefined ? v : r.def;
  };

  /* Nur bekannte Regeln im erlaubten Bereich (Datei, Link, Profil) */
  A.cleanRules = (raw) => {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [k, v] of Object.entries(raw)) {
      const r = A.RULE[k];
      if (!r || r.top) continue;
      if (r.type === 'bool') out[k] = !!v;
      else {
        const n = Number(v);
        if (isFinite(n)) out[k] = Math.max(r.min, Math.min(r.max, n));
      }
    }
    return out;
  };

  /* Prüfprofile: setzen die genannten Regeln, alle übrigen auf den Standard */
  A.PROFILES = [
    { id: 'standard', name: 'Standard (LLR)', desc: 'Die Werte der Handreichung und von DIN 18040-1 in vereinfachter Form.', values: {} },
    {
      id: 'streng',
      name: 'Streng: mehr Bewegungsfläche',
      desc: 'Breitere Wege für Rollstühle und Personen, Sicht und Blickkontakt enger bewertet – z. B. für Lerngruppen mit mehreren Rollstuhl- oder Rollatornutzenden.',
      values: { passage: 120, turning: 150, walk: 60, squeeze: 45, sightDirect: 30, personLimit: 15, faceAngle: 45, teacherWalk: 500 },
    },
    {
      id: 'reizarm',
      name: 'Reizarm (z. B. Autismus-Spektrum, ADHS)',
      desc: 'Tür, Laufwege, Fensterblick und Spiegelungen zählen stärker; ruhig gilt ein Platz erst bei weniger Punkten.',
      values: { wDoor: 40, wLounge: 25, wTraffic: 35, wCrowd: 20, wWindow: 15, wGlare: 15, wQuiet: 25, calmMax: 20, busyMin: 40 },
    },
    {
      id: 'sinne',
      name: 'Hören & Sehen',
      desc: 'Kürzere Entfernungen zu Tafel und Lehrkraft, Gesicht der Lehrkraft nur bei kleinem Winkel im Blick, Personen im Blickfeld schneller störend.',
      values: { seeDist: 250, hearDist: 400, faceAngle: 45, sightDirect: 30, personLimit: 15 },
    },
    {
      id: 'grundschule',
      name: 'Grundschule',
      desc: 'Kürzere Wege für die Lehrkraft und mehr Gewicht auf Gedränge und Laufwege.',
      values: { teacherWalk: 500, wCrowd: 20, wTraffic: 30, seeDist: 300, exitDist: 300 },
    },
  ];

  /* Alle Regelwerte eines Profils (fehlende = Standard) */
  A.profileValues = (values) => {
    const out = {};
    for (const r of A.RULES) out[r.key] = values && values[r.key] !== undefined ? values[r.key] : r.def;
    return out;
  };

  /* Regelwerte in die Einstellungen eines Plans schreiben */
  A.applyRules = (S, values, profileId) => {
    const all = A.profileValues(values);
    const rules = {};
    for (const r of A.RULES) {
      if (r.top) S[r.key] = all[r.key];
      else if (all[r.key] !== r.def) rules[r.key] = all[r.key];
    }
    if (Object.keys(rules).length) S.rules = rules;
    else delete S.rules;
    if (profileId) S.profile = profileId;
    else delete S.profile;
  };

  /* Aktuelle Werte eines Plans (alle Regeln) */
  A.currentRules = (S) => Object.fromEntries(A.RULES.map((r) => [r.key, A.rule(S, r.key)]));

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
    const PAL = LLR.prefs ? LLR.prefs.pal() : { turn: [47, 158, 68, 110], free: [116, 205, 132, 90], blocked: [224, 49, 49, 95] };
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
          if (turnSwept[k]) c = PAL.turn;
          else if (swept[k]) c = PAL.free;
          else if (blocked[k]) c = PAL.blocked;
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
    for (const o of doc.objects) if (TALL[o.type] || (T[o.type] && T[o.type].tall)) out.push(...A.worldParts(o, doc.settings));
    return out;
  };

  const blocked = (eye, q, blockers) => blockers.some((poly) => segHitsPoly(q, eye, poly));


  const viewAngle = (o, s) => {
    // Hocker sind drehbar: Blickrichtung frei
    if (o.type === 'stool') return 0;
    const face = G.rot({ x: 0, y: -1 }, o.rot || 0);
    return Math.abs(G.normAngle(G.angle(G.sub(s.p, o)) - G.angle(face)));
  };

  const sightCat = (ang, ctx) => (ang <= ctx.direct ? 'good' : ang <= ctx.side ? 'side' : 'back');

  /* Gemeinsame Grundlage für alle Sitzplätze eines Plans */
  const sightContext = (doc) => ({
    surfaces: A.surfaces(doc),
    blockers: sightBlockers(doc),
    persons: doc.settings.sightPersons === false ? [] : doc.objects.filter(A.isSeat).map((o) => ({ id: o.id, x: o.x, y: o.y })),
    direct: A.rule(doc.settings, 'sightDirect'),
    side: A.rule(doc.settings, 'sightSide'),
    personLimit: A.rule(doc.settings, 'personLimit') / 100,
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
    v.turn = sightCat(v.ang, ctx);
    v.cat = v.frac < 0.5 ? 'hidden' : v.turn;
    v.person = v.cat !== 'hidden' && v.personFrac >= ctx.personLimit;
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
    if (!sd || sd.wall || sd.kind === 'label' || sd.kind === 'floor' || sd.kind === 'zone' || sd.kind === 'dim') return [];
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

  /* ---------- Laufraster für Personen ----------
     Wie beim Rollstuhl-Check, aber für eine gehende Person: bequem begehbar
     ist eine Zelle, wenn dort settings.walk (Standard 50 cm) frei sind;
     seitlich durchquetschen geht ab 36 cm. Stühle, Hocker und Rollstühle
     sind besetzt und zählen als Hindernis. */
  A.walkGrid = function (doc) {
    const S = doc.settings;
    const W = doc.room.w;
    const L = doc.room.l;
    const g = Math.max(4, Math.ceil(Math.sqrt((W * L) / 30000)));
    const NX = Math.ceil(W / g) + 2;
    const NY = Math.ceil(L / g) + 2;
    const N = NX * NY;
    const cellX = (i) => (i - 1 + 0.5) * g;
    const cellY = (j) => (j - 1 + 0.5) * g;
    const cellPt = (k) => ({ x: cellX(k % NX), y: cellY(Math.floor(k / NX)) });
    const cellAt = (p) => {
      const i = Math.floor(p.x / g) + 1;
      const j = Math.floor(p.y / g) + 1;
      if (i < 1 || j < 1 || i > NX - 2 || j > NY - 2) return -1;
      return j * NX + i;
    };
    const occ = new Uint8Array(N);
    for (let i = 0; i < NX; i++) occ[i] = occ[(NY - 1) * NX + i] = 1;
    for (let j = 0; j < NY; j++) occ[j * NX] = occ[j * NX + NX - 1] = 1;
    for (const o of doc.objects) {
      if (!A.isObstacle(o, S, false) && o.type !== 'wheelchair') continue;
      // Stühle lassen sich beim Vorbeigehen etwas heranrücken: nur die Sitzfläche zählt
      const soft = isMovableSeat(o) ? (S.chairGive === undefined ? 6 : S.chairGive) : 0;
      for (const raw of A.worldParts(o, S)) {
        const poly = soft ? G.inset(raw, soft) : raw;
        const bb = G.bbox(poly);
        const i0 = Math.max(1, Math.floor(bb.minX / g) + 1);
        const i1 = Math.min(NX - 2, Math.ceil(bb.maxX / g) + 1);
        const j0 = Math.max(1, Math.floor(bb.minY / g) + 1);
        const j1 = Math.min(NY - 2, Math.ceil(bb.maxY / g) + 1);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (G.pointInConvex(poly, { x: cellX(i), y: cellY(j) })) occ[j * NX + i] = 1;
      }
    }
    const d2 = new Float64Array(N);
    for (let k = 0; k < N; k++) d2[k] = occ[k] ? 0 : Infinity;
    G.edt(d2, NX, NY);
    const r = (S.walk || 50) / 2;
    const rt = Math.min(r, A.rule(S, 'squeeze') / 2);
    // free = bequem begehbar, tight = seitlich durchquetschen (ab 36 cm)
    const free = new Uint8Array(N);
    const tight = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      if (occ[k]) continue;
      const c = Math.sqrt(d2[k]) * g - g / 2;
      if (c >= r) free[k] = 1;
      if (c >= rt) tight[k] = 1;
    }
    return { g, NX, NY, N, occ, free, tight, cellPt, cellAt, r };
  };

  /* Kürzeste Wege im Laufraster (Dijkstra, 8 Nachbarn) ab mehreren Startzellen */
  function heapPush(h, k, d) {
    h.push({ k, d });
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p].d <= h[i].d) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  }
  function heapPop(h) {
    const top = h[0];
    const last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && h[l].d < h[m].d) m = l;
        if (r < h.length && h[r].d < h[m].d) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }

  /* Engstellen sind passierbar, kosten aber das Vierfache – Wege nutzen sie nur, wenn es nicht anders geht */
  A.walkField = function (grid, seeds) {
    const { N, NX, g, free, tight } = grid;
    const dist = new Float64Array(N).fill(Infinity);
    const parent = new Int32Array(N).fill(-1);
    const h = [];
    for (const k of seeds) {
      if (k < 0 || !tight[k] || dist[k] === 0) continue;
      dist[k] = 0;
      heapPush(h, k, 0);
    }
    const nb = [
      [1, g], [-1, g], [NX, g], [-NX, g],
      [NX + 1, g * Math.SQRT2], [NX - 1, g * Math.SQRT2], [-NX + 1, g * Math.SQRT2], [-NX - 1, g * Math.SQRT2],
    ];
    while (h.length) {
      const { k, d } = heapPop(h);
      if (d > dist[k]) continue;
      for (const [o, c] of nb) {
        const m = k + o;
        if (!tight[m]) continue;
        const nd = d + (free[m] ? c : c * 4);
        if (nd < dist[m]) {
          dist[m] = nd;
          parent[m] = k;
          heapPush(h, m, nd);
        }
      }
    }
    return { dist, parent };
  };

  /* Startzellen um einen Punkt (nächste freie Zellen im Umkreis) */
  A.seedsNear = function (grid, p, maxR) {
    const { g, NX, NY, tight: free, cellPt } = grid;
    const ci = Math.floor(p.x / g) + 1;
    const cj = Math.floor(p.y / g) + 1;
    for (let rr = 0; rr <= (maxR || 80); rr += g) {
      const rc = Math.ceil(rr / g);
      const out = [];
      for (let j = Math.max(1, cj - rc); j <= Math.min(NY - 2, cj + rc); j++) {
        for (let i = Math.max(1, ci - rc); i <= Math.min(NX - 2, ci + rc); i++) {
          const k = j * NX + i;
          if (free[k] && G.dist(cellPt(k), p) <= rr + g) out.push(k);
        }
      }
      if (out.length) return out;
    }
    return [];
  };

  /* Bester erreichbarer Standplatz neben einem Sitz (Umkreis R) */
  A.reachSeat = function (grid, field, p, R) {
    const { g, NX, NY, tight: free, cellPt } = grid;
    const rc = Math.ceil(R / g);
    const ci = Math.floor(p.x / g) + 1;
    const cj = Math.floor(p.y / g) + 1;
    let best = -1;
    let bd = Infinity;
    for (let j = Math.max(1, cj - rc); j <= Math.min(NY - 2, cj + rc); j++) {
      for (let i = Math.max(1, ci - rc); i <= Math.min(NX - 2, ci + rc); i++) {
        const k = j * NX + i;
        if (!free[k] || field.dist[k] === Infinity) continue;
        if (G.dist(cellPt(k), p) > R) continue;
        if (field.dist[k] < bd) {
          bd = field.dist[k];
          best = k;
        }
      }
    }
    if (best < 0) return null;
    // Länge des Wegs und ob er durch eine Engstelle führt
    let len = 0;
    let squeeze = false;
    for (let c = best; field.parent[c] !== -1; c = field.parent[c]) {
      len += G.dist(cellPt(c), cellPt(field.parent[c]));
      if (!grid.free[c]) squeeze = true;
    }
    return { k: best, d: len, squeeze };
  };

  /* Weg als geglättete Linie (Start → Zelle k → Ziel) */
  A.walkRoute = function (grid, field, k, start, end) {
    const { tight: free, cellPt, cellAt, g } = grid;
    const cells = [];
    for (let c = k; c !== -1; c = field.parent[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map(cellPt);
    const los = (a, b) => {
      const n = Math.ceil(G.dist(a, b) / (g / 2));
      for (let s = 1; s < n; s++) {
        const c = cellAt(G.lerp(a, b, s / n));
        if (c < 0 || !free[c]) return false;
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
    if (start && G.dist(start, out[0]) > 1) out.unshift(start);
    if (end && G.dist(end, out[out.length - 1]) > 1) out.push(end);
    return out;
  };

  const seatRadius = (o, S) => {
    let r = 0;
    for (const p of A.worldParts(o, S)) for (const q of p) r = Math.max(r, G.dist(q, o));
    return r;
  };
  const faceDir = (o) => G.rot({ x: 0, y: -1 }, o.rot || 0);
  /* Winkel zwischen Blickrichtung eines Platzes und einer Richtung (Hocker: frei drehbar) */
  const turnTo = (o, p) => (o.type === 'stool' ? 0 : Math.abs(G.normAngle(G.angle(G.sub(p, o)) - G.angle(faceDir(o)))));

  /* ---------- Lehrkraft-Check ----------
     Laufwege der Lehrkraft zu jedem Platz und Blickkontakt (sieht die
     Lehrkraft das Gesicht?). Standorte sind Objekte vom Typ „teacher“;
     ohne solche wird ein Standort vor der Tafel angenommen. */
  /* Standort vor der Tafel: von den Punkten 0,9–2,6 m vor der Fläche der,
     von dem aus die meisten Plätze erreichbar sind */
  A.teacherDefault = function (doc, grid) {
    const s = A.surfaces(doc).find((x) => doc.objects.find((o) => o.id === x.id && o.type === 'iat')) || A.surfaces(doc)[0];
    const W = doc.room.w;
    const L = doc.room.l;
    const clampP = (p) => ({ x: Math.max(40, Math.min(W - 40, p.x)), y: Math.max(40, Math.min(L - 40, p.y)) });
    // Die Normale einer Präsentationsfläche zeigt in den Raum
    const cands = s ? [95, 140, 190, 260].map((d) => clampP(G.add(s.p, G.mul(s.n, d)))) : [clampP({ x: W / 2, y: 120 })];
    if (!grid || cands.length === 1) return cands[0];
    const seats = doc.objects.filter(A.isSeat);
    let best = null;
    for (const p of cands) {
      const seeds = A.seedsNear(grid, p, 60);
      if (!seeds.length) continue;
      const fd = A.walkField(grid, seeds);
      const n = seats.filter((o) => A.reachSeat(grid, fd, o, seatRadius(o, doc.settings) + 40)).length;
      if (!best || n > best.n) best = { p, n };
      if (n === seats.length) break;
    }
    return best ? best.p : cands[0];
  };

  A.teacher = function (doc, opts) {
    opts = opts || {};
    const S = doc.settings;
    const grid = A.walkGrid(doc);
    const marks = doc.objects.filter((o) => o.type === 'teacher');
    const positions = marks.length ? marks.map((o) => ({ id: o.id, x: o.x, y: o.y, rot: o.rot || 0 })) : [Object.assign({ id: null, implicit: true }, A.teacherDefault(doc, grid))];
    const fields = positions.map((p) => {
      const seeds = A.seedsNear(grid, p, 90);
      return { p, seeds, field: A.walkField(grid, seeds) };
    });
    const blockers = sightBlockers(doc);
    const LIMIT = A.rule(S, 'teacherWalk');
    const FACE = A.rule(S, 'faceAngle');
    const PROFILE = Math.max(FACE, A.rule(S, 'profileAngle'));
    const seats = [];
    for (const o of doc.objects) {
      if (!A.isSeat(o)) continue;
      // Standplatz neben dem Platz, sonst gegenüber über den Tisch hinweg
      const R = seatRadius(o, S) + 40;
      let reach = null;
      for (const [rad, across] of [[R, false], [R + 80, true]]) {
        fields.forEach((fd, i) => {
          if (!fd.seeds.length) return;
          const r = A.reachSeat(grid, fd.field, o, rad);
          if (r && (!reach || r.d < reach.d)) reach = Object.assign(r, { pi: i, across });
        });
        if (reach) break;
      }
      // Blickkontakt: bester Standort (Gesicht vor Profil vor Rücken)
      let eye = null;
      positions.forEach((p, i) => {
        const hidden = blocked(o, p, blockers);
        const ang = turnTo(o, p);
        const kind = hidden ? 'blocked' : ang <= FACE ? 'face' : ang <= PROFILE ? 'profile' : 'back';
        const rank = { face: 0, profile: 1, back: 2, blocked: 3 }[kind];
        const d = G.dist(o, p);
        if (!eye || rank < eye.rank || (rank === eye.rank && d < eye.d)) eye = { kind, rank, ang, d, pi: i };
      });
      let cat = 'good';
      if (!reach || eye.kind === 'blocked') cat = 'none';
      else if (eye.kind === 'back') cat = 'back';
      else if (eye.kind === 'profile' || reach.d > LIMIT || reach.squeeze || reach.across) cat = 'side';
      seats.push({ id: o.id, x: o.x, y: o.y, reach, eye, cat, walk: reach ? reach.d : Infinity });
    }
    const reached = seats.filter((s) => s.reach);
    const walks = reached.map((s) => s.walk);
    const n = (k) => seats.filter((s) => s.eye && s.eye.kind === k).length;
    const res = {
      grid,
      positions,
      implicit: !marks.length,
      seats,
      reachable: reached.length,
      far: reached.filter((s) => s.walk > LIMIT).length,
      tight: reached.filter((s) => s.reach.squeeze).length,
      across: reached.filter((s) => s.reach.across).length,
      limit: LIMIT,
      avgWalk: walks.length ? walks.reduce((a, b) => a + b, 0) / walks.length : 0,
      maxWalk: walks.length ? Math.max(...walks) : 0,
      face: n('face'),
      profile: n('profile'),
      back: n('back'),
      hidden: n('blocked'),
      stuck: fields.some((fd) => !fd.seeds.length),
    };
    res.route = (seatId) => {
      const s = seats.find((x) => x.id === seatId);
      if (!s || !s.reach) return null;
      const fd = fields[s.reach.pi];
      const o = doc.objects.find((x) => x.id === seatId);
      return A.walkRoute(grid, fd.field, s.reach.k, fd.p, o);
    };
    if (opts.image !== false && typeof document !== 'undefined') {
      // Reichweite der Lehrkraft: je dunkler, desto näher
      const { NX, NY, free } = grid;
      const nx = NX - 2;
      const ny = NY - 2;
      const cv = document.createElement('canvas');
      cv.width = nx;
      cv.height = ny;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(nx, ny);
      for (let j = 1; j <= ny; j++) {
        for (let i = 1; i <= nx; i++) {
          const k = j * NX + i;
          if (!free[k]) continue;
          let d = Infinity;
          for (const fd of fields) d = Math.min(d, fd.field.dist[k]);
          if (d === Infinity) continue;
          const t = Math.min(1, d / (LIMIT * 1.3));
          const q = ((j - 1) * nx + (i - 1)) * 4;
          img.data[q] = 12;
          img.data[q + 1] = 133;
          img.data[q + 2] = 153;
          img.data[q + 3] = Math.round(95 - 70 * t);
        }
      }
      ctx.putImageData(img, 0, 0);
      res.image = { url: cv.toDataURL(), w: nx * grid.g, h: ny * grid.g };
    }
    return res;
  };

  /* ---------- Reiz- & Ruhe-Check ----------
     Bewertet jeden Platz nach möglichen Störquellen: Nähe zur Tür, zur
     Lounge, Laufwege von Mitschülerinnen und Mitschülern hinter dem Platz,
     Gedränge, Blick aus dem Fenster und Spiegelungen auf den
     Präsentationsflächen. Hohe Möbel (Regale, Trennwände) dämpfen. */
  const LOUNGE = { sofa2: 1, sofaCorner: 1, beanbag: 1 };
  const QUIET = /ruh|rückzug|still|leise|entspann/i;

  /* Fenster als Strecken an der Wand */
  A.windows = (doc) =>
    doc.objects
      .filter((o) => o.type === 'window')
      .map((o) => {
        const w = o.w || 180;
        const e = G.toWorld([{ x: -w / 2, y: 0 }, { x: w / 2, y: 0 }], o);
        return { id: o.id, a: e[0], b: e[1], c: { x: o.x, y: o.y } };
      });

  const rayHitsSeg = (p, dir, a, b) => {
    const s = G.sub(b, a);
    const den = G.cross(dir, s);
    if (Math.abs(den) < 1e-9) return null;
    const ap = G.sub(a, p);
    const t = G.cross(ap, s) / den;
    const u = G.cross(ap, dir) / den;
    return t > 1 && u >= 0 && u <= 1 ? t : null;
  };

  /* Spiegelung: Fällt in der Fläche s von Platz o aus das Spiegelbild eines Fensters? */
  A.glare = function (o, s, wins) {
    const hits = [];
    for (let i = 0; i <= 6; i++) {
      const P = G.lerp(s.a, s.b, 0.08 + (0.84 * i) / 6);
      const d = G.norm(G.sub(P, o));
      const n = s.n;
      const r = G.sub(d, G.mul(n, 2 * G.dot(d, n)));
      for (const w of wins) {
        const t = rayHitsSeg(P, r, w.a, w.b);
        if (t !== null) hits.push({ P, w, Q: G.add(P, G.mul(r, t)) });
      }
    }
    return hits;
  };

  A.calm = function (doc) {
    const S = doc.settings;
    const R = A.currentRules(S);
    const grid = A.walkGrid(doc);
    const seatsO = doc.objects.filter(A.isSeat);
    const doors = doc.objects.filter((o) => o.type === 'door');
    const doorPts = doors.map((d) => G.add(d, G.mul(G.rot({ x: 0, y: -1 }, d.rot || 0), 35)));
    const seeds = [];
    for (const p of doorPts) seeds.push(...A.seedsNear(grid, p, 90));
    const field = A.walkField(grid, seeds);
    const blockers = sightBlockers(doc);
    const lounge = doc.objects.filter((o) => LOUNGE[o.type]);
    const zones = doc.objects.filter((o) => T[o.type].kind === 'zone' && QUIET.test(o.label || ''));
    const wins = A.windows(doc);
    const surfaces = A.surfaces(doc);
    /* Wege von der Tür zu allen Plätzen */
    const paths = new Map();
    for (const o of seatsO) {
      const r = A.reachSeat(grid, field, o, seatRadius(o, S) + 40) || A.reachSeat(grid, field, o, seatRadius(o, S) + 120);
      if (!r) continue;
      const cells = [];
      for (let c = r.k; c !== -1; c = field.parent[c]) cells.push(c);
      paths.set(o.id, { cells, walk: r.d, pts: null, k: r.k });
    }
    const near = (o, rad) => {
      const out = new Set();
      const { g, NX, NY, cellPt } = grid;
      const rc = Math.ceil(rad / g);
      const ci = Math.floor(o.x / g) + 1;
      const cj = Math.floor(o.y / g) + 1;
      for (let j = Math.max(1, cj - rc); j <= Math.min(NY - 2, cj + rc); j++) {
        for (let i = Math.max(1, ci - rc); i <= Math.min(NX - 2, ci + rc); i++) {
          const k = j * NX + i;
          if (G.dist(cellPt(k), o) <= rad) out.add(k);
        }
      }
      return out;
    };
    const others = Math.max(1, seatsO.length - 1);
    const seats = [];
    const shield = (o, p) => (blocked(o, p, blockers) ? 0.5 : 1);
    for (const o of seatsO) {
      const factors = [];
      const add = (key, label, pts, detail, at) => {
        if (pts > 0.5 || pts < -0.5) factors.push({ key, label, pts: Math.round(pts), detail, at });
      };
      // Tür
      let dd = Infinity;
      let dp = null;
      doors.forEach((d, i) => {
        const x = G.dist(o, doorPts[i]);
        if (x < dd) {
          dd = x;
          dp = doorPts[i];
        }
      });
      if (dp) {
        const v = Math.max(0, Math.min(1, (380 - dd) / 260)) * R.wDoor * shield(o, dp);
        add('door', 'Tür in der Nähe', v, `${(dd / 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} m`, dp);
      }
      // Lounge
      let ld = Infinity;
      let lp = null;
      for (const l of lounge) {
        for (const poly of A.worldParts(l, S)) {
          const x = pointPolyDist(o, poly);
          if (x < ld) {
            ld = x;
            lp = { x: l.x, y: l.y };
          }
        }
      }
      if (lp) add('lounge', 'Lounge in der Nähe', Math.max(0, Math.min(1, (300 - ld) / 220)) * R.wLounge * shield(o, lp), `${(ld / 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} m`, lp);
      // Laufwege anderer hinter oder neben dem Platz
      const around = near(o, seatRadius(o, S) + 30);
      let passers = 0;
      for (const [id, pth] of paths) {
        if (id === o.id) continue;
        if (pth.cells.some((c) => around.has(c))) passers++;
      }
      const share = passers / others;
      add('traffic', 'Laufweg anderer am Platz vorbei', Math.min(1, share / 0.35) * R.wTraffic, `${passers} von ${others}`);
      // Gedränge: andere Plätze in Armlänge
      const crowd = seatsO.filter((x) => x !== o && G.dist(x, o) < 115).length;
      add('crowd', 'Viele Plätze direkt daneben', Math.max(0, Math.min(1, (crowd - 2) / 3)) * R.wCrowd, `${crowd} Nachbarplätze`);
      // Blick aus dem Fenster
      let wv = null;
      for (const w of wins) {
        const ang = turnTo(o, w.c);
        const d = G.dist(o, w.c);
        if (o.type !== 'stool' && ang <= 40 && d <= 380 && (!wv || d < wv.d)) wv = { d, at: w.c };
      }
      if (wv) add('window', 'Blick aus dem Fenster', R.wWindow, `${(wv.d / 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} m`, wv.at);
      // Spiegelungen auf Flächen, die der Platz sieht
      const glare = [];
      for (const s of surfaces) {
        if (G.dot(G.sub(o, s.p), s.n) < 20) continue;
        if (turnTo(o, s.p) > 95) continue;
        const hits = A.glare(o, s, wins);
        if (hits.length) glare.push({ s, hits });
      }
      if (glare.length) add('glare', 'Spiegelung des Fensters', R.wGlare, glare.map((x) => x.s.name).join(', '));
      // Ruhezone
      const inQuiet = zones.some((z) => G.pointInPoly(A.worldParts(z, S)[0], o));
      if (inQuiet) add('quiet', 'In einer Ruhezone', -R.wQuiet, '');
      let score = factors.reduce((a, b) => a + b.pts, 0);
      score = Math.max(0, Math.min(100, score));
      const cat = score < R.calmMax ? 'calm' : score < Math.max(R.calmMax, R.busyMin) ? 'mid' : 'busy';
      seats.push({ id: o.id, x: o.x, y: o.y, score, cat, factors: factors.sort((a, b) => b.pts - a.pts), glare, doorWalk: paths.has(o.id) ? paths.get(o.id).walk : Infinity, doorDist: dd });
    }
    const res = {
      grid,
      seats,
      doors: doorPts,
      lounge: lounge.map((l) => ({ x: l.x, y: l.y })),
      calm: seats.filter((s) => s.cat === 'calm').length,
      mid: seats.filter((s) => s.cat === 'mid').length,
      busy: seats.filter((s) => s.cat === 'busy').length,
      glareSeats: seats.filter((s) => s.glare.length).length,
      hasDoor: doors.length > 0,
    };
    res.paths = () => {
      const out = [];
      for (const [id, p] of paths) {
        if (!p.pts) {
          const o = doc.objects.find((x) => x.id === id);
          p.pts = A.walkRoute(grid, field, p.k, null, o);
        }
        out.push(p.pts);
      }
      return out;
    };
    return res;
  };

  /* ---------- Umbau zwischen zwei Phasen ----------
     Vergleicht die Objekte zweier Anordnungen (gleiche IDs = gleiches
     Möbelstück) und schätzt den Aufwand grob ab. */
  const EFFORT = { table: 15, tableRect: 15, chair: 6, stool: 5, beanbag: 6, shelfRound: 25, partition: 20, sofa2: 45, sofaCorner: 40, rug: 30, rugRect: 30, officeChair: 6 };
  const SKIP = { teacher: 1, label: 1, zone: 1, zoneRound: 1, wheelchair: 1 };
  A.rebuild = function (prev, cur) {
    const before = new Map(prev.filter((o) => !SKIP[o.type]).map((o) => [o.id, o]));
    const moved = [];
    const added = [];
    let sec = 0;
    const cost = (o, dist) => (EFFORT[o.type] || 20) + dist / 80;
    for (const o of cur) {
      if (SKIP[o.type]) continue;
      const p = before.get(o.id);
      if (!p || p.type !== o.type) {
        added.push(o);
        sec += cost(o, 300);
        continue;
      }
      before.delete(o.id);
      const dist = G.dist(p, o);
      const drot = Math.abs(G.normAngle((o.rot || 0) - (p.rot || 0)));
      if (dist < 5 && drot < 3) continue;
      moved.push({ id: o.id, type: o.type, from: p, to: o, dist, drot });
      sec += dist < 5 ? 4 : cost(o, dist);
    }
    const removed = [...before.values()];
    for (const o of removed) sec += cost(o, 300);
    const by = (list, kind) => list.filter((x) => (x.type || '') && (kind === 'table' ? T[x.type].kind === 'table' : kind === 'seat' ? x.type === 'chair' || x.type === 'stool' : T[x.type].kind !== 'table' && x.type !== 'chair' && x.type !== 'stool')).length;
    const distSum = moved.reduce((a, m) => a + m.dist, 0);
    return {
      moved,
      added,
      removed,
      tables: by(moved, 'table') + by(added, 'table') + by(removed, 'table'),
      seats: by(moved, 'seat') + by(added, 'seat') + by(removed, 'seat'),
      other: by(moved, 'other') + by(added, 'other') + by(removed, 'other'),
      distSum,
      sec,
      changes: moved.length + added.length + removed.length,
    };
  };

  /* ---------- Sitzplan: Bedarfe der Lernenden ---------- */
  A.NEEDS = [
    { key: 'hear', label: 'Hören', long: 'Hörbeeinträchtigung', hint: 'Nah an Tafel und Lehrkraft, Gesicht der Lehrkraft gut sichtbar (Lippenlesen), eher ruhig.' },
    { key: 'see', label: 'Sehen', long: 'Sehbeeinträchtigung', hint: 'Direkter Blick auf eine Präsentationsfläche, höchstens 3 m entfernt.' },
    { key: 'wheel', label: 'Rollstuhl', long: 'Nutzt einen Rollstuhl', hint: 'Rollstuhlplatz (Test-Rollstuhl im Plan), der von der Tür aus erreichbar ist.' },
    { key: 'calm', label: 'Ruhe', long: 'Braucht einen reizarmen Platz', hint: 'Ruhiger Platz laut Reiz- & Ruhe-Check (z. B. Autismus-Spektrum, Konzentration).' },
    { key: 'move', label: 'Bewegung', long: 'Braucht Bewegung', hint: 'Wackelhocker oder Platz mit Bewegungsraum dahinter (z. B. ADHS).' },
    { key: 'help', label: 'Unterstützung', long: 'Braucht häufig Unterstützung', hint: 'Die Lehrkraft erreicht den Platz schnell und hat Blickkontakt.' },
    { key: 'exit', label: 'Ausgang', long: 'Kurzer Weg zur Tür', hint: 'Höchstens 3,5 m Weg zur Tür (z. B. für Pausen oder medizinische Gründe).' },
  ];
  A.NEED = Object.fromEntries(A.NEEDS.map((n) => [n.key, n]));

  /* Kennzahlen je Sitzplatz aus allen Prüfungen */
  A.seatInfo = function (doc, pre) {
    pre = pre || {};
    const S = doc.settings;
    const sight = pre.sight || A.sight(doc);
    const teacher = pre.teacher || A.teacher(doc, { image: false });
    const calm = pre.calm || A.calm(doc);
    const access = pre.access || A.access(doc, { image: false });
    const grid = teacher.grid;
    const info = new Map();
    for (const o of doc.objects) {
      if (!A.isSeat(o)) continue;
      const sg = sight.seats.find((x) => x.id === o.id);
      const tc = teacher.seats.find((x) => x.id === o.id);
      const cm = calm.seats.find((x) => x.id === o.id);
      // Bewegungsraum: hinter dem Platz frei begehbar?
      const back = G.rot({ x: 0, y: 1 }, o.rot || 0);
      const behind = [55, 80].map((d) => grid.cellAt(G.add(o, G.mul(back, d))));
      const space = o.type === 'stool' || behind.every((k) => k >= 0 && grid.free[k]);
      // Rollstuhl: Test-Rollstuhl erreichbar oder Tischkante mit Rollstuhlplatz neben diesem Stuhl
      let wheel = 2;
      if (o.type === 'wheelchair') {
        const w = access.wheelchairs.find((x) => x.id === o.id);
        wheel = w && w.ok ? 0 : 2;
      } else {
        for (const t of access.tables) {
          for (const sp of t.spots) {
            if (G.dist(sp.p, o) < S.chairD + 25) wheel = Math.min(wheel, sp.now ? 1 : 2);
          }
        }
      }
      info.set(o.id, {
        id: o.id,
        type: o.type,
        x: o.x,
        y: o.y,
        sightCat: sg ? sg.cat : 'none',
        sightDist: sg && sg.best ? sg.best.dist : Infinity,
        teacherCat: tc ? tc.cat : 'none',
        eye: tc && tc.eye ? tc.eye.kind : 'blocked',
        teacherDist: tc && tc.eye ? tc.eye.d : Infinity,
        walk: tc ? tc.walk : Infinity,
        calmCat: cm ? cm.cat : 'mid',
        calmScore: cm ? cm.score : 50,
        doorWalk: cm ? cm.doorWalk : Infinity,
        space,
        wheel,
      });
    }
    return { info, sight, teacher, calm, access };
  };

  /* Bewertung eines Bedarfs an einem Platz: 0 = passt, 1 = eingeschränkt, 2 = passt nicht */
  const m1 = (cm) => (cm / 100).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' m';
  A.needFit = function (key, si, S) {
    if (!si) return { st: 2, text: 'Kein Platz' };
    const hearD = A.rule(S, 'hearDist');
    const seeD = A.rule(S, 'seeDist');
    const exitD = A.rule(S, 'exitDist');
    if (key === 'hear') {
      let st = 0;
      const why = [];
      if (si.sightCat === 'none' || si.sightCat === 'back') (st = 2), why.push('kein Blick auf Tafel/Bildschirm');
      else if (si.sightCat !== 'good') (st = Math.max(st, 1)), why.push('Sicht eingeschränkt');
      if (si.sightDist > hearD) (st = Math.max(st, 1)), why.push(`Tafel ${m1(si.sightDist)} entfernt`);
      if (si.eye === 'back' || si.eye === 'blocked') (st = Math.max(st, 2)), why.push('Lehrkraft nicht im Blick');
      else if (si.eye === 'profile') (st = Math.max(st, 1)), why.push('Lehrkraft nur seitlich im Blick');
      if (si.teacherDist > hearD - 50) (st = Math.max(st, 1)), why.push(`Lehrkraft ${m1(si.teacherDist)} entfernt`);
      if (si.calmCat === 'busy') (st = Math.max(st, 1)), why.push('unruhiger Platz');
      return { st, text: st ? why.join(', ') : 'nah, gute Sicht auf Tafel und Lehrkraft' };
    }
    if (key === 'see') {
      if (si.sightCat === 'none' || si.sightCat === 'back') return { st: 2, text: 'kein Blick auf eine Präsentationsfläche' };
      if (si.sightCat === 'good' && si.sightDist <= seeD) return { st: 0, text: `direkter Blick, ${m1(si.sightDist)} entfernt` };
      if (si.sightDist > seeD * 1.5) return { st: 2, text: `Präsentationsfläche ${m1(si.sightDist)} entfernt` };
      return { st: 1, text: si.sightCat !== 'good' ? 'Sicht eingeschränkt' : `${m1(si.sightDist)} entfernt (besser ≤ ${m1(seeD)})` };
    }
    if (key === 'wheel') {
      if (si.type === 'wheelchair') return si.wheel === 0 ? { st: 0, text: 'Rollstuhlplatz, von der Tür erreichbar' } : { st: 2, text: 'Rollstuhlplatz ohne Weg von der Tür' };
      if (si.wheel === 1) return { st: 1, text: 'Stuhl gegen Rollstuhl tauschen – Platz ist erreichbar' };
      return { st: 2, text: 'kein Rollstuhlplatz' };
    }
    if (key === 'calm') return si.calmCat === 'calm' ? { st: 0, text: 'ruhiger Platz' } : si.calmCat === 'mid' ? { st: 1, text: 'mittlere Unruhe' } : { st: 2, text: 'unruhiger Platz' };
    if (key === 'move') return si.type === 'stool' ? { st: 0, text: 'Wackelhocker' } : si.space ? { st: 0, text: 'Bewegungsraum hinter dem Platz' } : { st: 1, text: 'wenig Platz hinter dem Stuhl – evtl. Wackelhocker' };
    if (key === 'help') {
      if (si.teacherCat === 'none') return { st: 2, text: 'Lehrkraft kommt nicht hin oder sieht den Platz nicht' };
      if (si.walk > 800 || si.eye === 'back') return { st: 1, text: si.eye === 'back' ? 'sitzt mit dem Rücken zur Lehrkraft' : `Weg ${m1(si.walk)}` };
      if (si.walk > 500 || si.eye === 'profile') return { st: 1, text: si.eye === 'profile' ? 'Lehrkraft nur seitlich im Blick' : `Weg ${m1(si.walk)}` };
      return { st: 0, text: `Weg ${m1(si.walk)}, Blickkontakt` };
    }
    if (key === 'exit') return si.doorWalk <= exitD ? { st: 0, text: `${m1(si.doorWalk)} zur Tür` } : si.doorWalk <= exitD + 200 ? { st: 1, text: `${m1(si.doorWalk)} zur Tür` } : { st: 2, text: si.doorWalk === Infinity ? 'kein Weg zur Tür' : `${m1(si.doorWalk)} zur Tür` };
    return { st: 0, text: '' };
  };

  const NEAR = 160;
  /* Bewertung aller Lernenden mit Platz */
  A.learnerFit = function (doc, si) {
    const seatOf = new Map();
    for (const o of doc.objects) if (o.learner && A.isSeat(o)) seatOf.set(o.learner, o);
    const out = [];
    for (const l of doc.learners || []) {
      const o = seatOf.get(l.id);
      const checks = [];
      if (o) {
        const info = si.info.get(o.id);
        for (const k of l.needs || []) checks.push(Object.assign({ need: k, label: A.NEED[k] ? A.NEED[k].label : k }, A.needFit(k, info, doc.settings)));
        if (o.type === 'wheelchair' && !(l.needs || []).includes('wheel')) checks.push({ need: 'seat', label: 'Platz', st: 1, text: 'Rollstuhlplatz ohne Rollstuhlbedarf' });
        for (const id of l.with || []) {
          const other = seatOf.get(id);
          const nm = (doc.learners.find((x) => x.id === id) || {}).name || '?';
          if (!other) continue;
          const d = G.dist(o, other);
          checks.push({ need: 'with', label: 'neben ' + nm, st: d <= NEAR ? 0 : 1, text: d <= NEAR ? 'sitzt in der Nähe' : `${m1(d)} entfernt` });
        }
        for (const id of l.apart || []) {
          const other = seatOf.get(id);
          const nm = (doc.learners.find((x) => x.id === id) || {}).name || '?';
          if (!other) continue;
          const d = G.dist(o, other);
          checks.push({ need: 'apart', label: 'nicht neben ' + nm, st: d <= NEAR ? 2 : 0, text: d <= NEAR ? 'sitzt zu nah' : `${m1(d)} entfernt` });
        }
      }
      const worst = checks.reduce((a, c) => Math.max(a, c.st), 0);
      out.push({ learner: l, seat: o || null, checks, st: o ? worst : -1 });
    }
    return out;
  };

  /* Automatisch verteilen: Lernende mit den meisten Bedarfen zuerst auf den
     jeweils passendsten freien Platz, danach Verbesserung durch Tauschen. */
  A.autoAssign = function (doc, si) {
    const learners = doc.learners || [];
    const seats = doc.objects.filter(A.isSeat);
    const pen = [0, 1, 4];
    const base = (l, s) => {
      const info = si.info.get(s.id);
      let c = 0;
      const needs = l.needs || [];
      for (const k of needs) c += pen[A.needFit(k, info, doc.settings).st];
      if (s.type === 'wheelchair' && !needs.includes('wheel')) c += 6;
      return c;
    };
    const cost = new Map();
    for (const l of learners) for (const s of seats) cost.set(l.id + '|' + s.id, base(l, s));
    const assign = new Map();
    const order = learners.slice().sort((a, b) => (b.needs || []).length * 2 + (b.with || []).length + (b.apart || []).length - ((a.needs || []).length * 2 + (a.with || []).length + (a.apart || []).length));
    // Plätze von vorn nach hinten (Nähe zur besten Präsentationsfläche)
    const front = seats.slice().sort((a, b) => si.info.get(a.id).sightDist - si.info.get(b.id).sightDist);
    const used = new Set();
    for (const l of order) {
      let best = null;
      for (const s of front) {
        if (used.has(s.id)) continue;
        const c = cost.get(l.id + '|' + s.id);
        if (!best || c < best.c) best = { s, c };
      }
      if (!best) break;
      used.add(best.s.id);
      assign.set(l.id, best.s);
    }
    const rel = (l) => {
      const s = assign.get(l.id);
      if (!s) return 0;
      let c = 0;
      for (const id of l.with || []) {
        const o = assign.get(id);
        if (o && G.dist(s, o) > NEAR) c += 2;
      }
      for (const id of l.apart || []) {
        const o = assign.get(id);
        if (o && G.dist(s, o) <= NEAR) c += 4;
      }
      return c;
    };
    const total = () => {
      let c = 0;
      for (const l of learners) {
        const s = assign.get(l.id);
        c += s ? cost.get(l.id + '|' + s.id) + rel(l) : 50;
      }
      return c;
    };
    // Tauschen (auch mit freien Plätzen), solange es besser wird
    let cur = total();
    for (let round = 0; round < 6; round++) {
      let improved = false;
      for (const l of learners) {
        for (const s of seats) {
          const mine = assign.get(l.id);
          if (mine === s) continue;
          const owner = learners.find((x) => assign.get(x.id) === s);
          if (owner) assign.set(owner.id, mine);
          assign.set(l.id, s);
          const next = total();
          if (next < cur - 1e-9) {
            cur = next;
            improved = true;
          } else {
            assign.set(l.id, mine);
            if (owner) assign.set(owner.id, s);
          }
        }
      }
      if (!improved) break;
    }
    const out = new Map();
    for (const [lid, s] of assign) if (s) out.set(s.id, lid);
    return out;
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
