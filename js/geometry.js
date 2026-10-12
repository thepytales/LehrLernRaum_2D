/* Geometrie-Hilfsfunktionen (Einheit: Zentimeter, y-Achse zeigt nach unten) */
(function (LLR) {
  'use strict';

  const G = {};

  G.rad = (d) => (d * Math.PI) / 180;
  G.deg = (r) => (r * 180) / Math.PI;
  G.v = (x, y) => ({ x, y });
  G.add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  G.sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  G.mul = (a, s) => ({ x: a.x * s, y: a.y * s });
  G.dot = (a, b) => a.x * b.x + a.y * b.y;
  G.cross = (a, b) => a.x * b.y - a.y * b.x;
  G.len = (a) => Math.hypot(a.x, a.y);
  G.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  G.norm = (a) => {
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  };
  G.lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  /* Drehung im Uhrzeigersinn (Bildschirmkoordinaten) */
  G.rot = (p, deg) => {
    const a = G.rad(deg);
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
  };

  /* Winkel (Grad) eines Richtungsvektors, 0° = nach rechts, im Uhrzeigersinn */
  G.angle = (v) => G.deg(Math.atan2(v.y, v.x));

  /* Drehung, die die lokale "Vorderseite" (0,-1) in Richtung dir dreht */
  G.rotFacing = (dir) => G.normAngle(G.deg(Math.atan2(dir.x, -dir.y)));

  G.normAngle = (d) => {
    let a = d % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a;
  };

  G.toWorld = (pts, o) => pts.map((p) => G.add(G.rot(p, o.rot || 0), { x: o.x, y: o.y }));
  G.toLocal = (p, o) => G.rot(G.sub(p, { x: o.x, y: o.y }), -(o.rot || 0));

  G.rect = (w, d, cx = 0, cy = 0) => [
    { x: cx - w / 2, y: cy - d / 2 },
    { x: cx + w / 2, y: cy - d / 2 },
    { x: cx + w / 2, y: cy + d / 2 },
    { x: cx - w / 2, y: cy + d / 2 },
  ];

  G.circlePoly = (r, n = 16, cx = 0, cy = 0) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return pts;
  };

  /* Ringsegment (z. B. halbrundes Regal) als Liste konvexer Vierecke */
  G.arcParts = (rOuter, rInner, a0, a1, segments) => {
    const parts = [];
    for (let i = 0; i < segments; i++) {
      const t0 = G.rad(a0 + ((a1 - a0) * i) / segments);
      const t1 = G.rad(a0 + ((a1 - a0) * (i + 1)) / segments);
      parts.push([
        { x: Math.cos(t0) * rOuter, y: Math.sin(t0) * rOuter },
        { x: Math.cos(t1) * rOuter, y: Math.sin(t1) * rOuter },
        { x: Math.cos(t1) * rInner, y: Math.sin(t1) * rInner },
        { x: Math.cos(t0) * rInner, y: Math.sin(t0) * rInner },
      ]);
    }
    return parts;
  };

  G.signedArea = (poly) => {
    let s = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
  };

  G.centroid = (poly) => {
    let x = 0;
    let y = 0;
    for (const p of poly) {
      x += p.x;
      y += p.y;
    }
    return { x: x / poly.length, y: y / poly.length };
  };

  /* Nach außen zeigende Normale der Kante i */
  G.edgeNormal = (poly, i) => {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const d = G.norm(G.sub(b, a));
    return G.signedArea(poly) > 0 ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x };
  };

  G.bbox = (pts) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  };

  G.pointInConvex = (poly, p) => {
    let sign = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (c !== 0) {
        const s = c > 0 ? 1 : -1;
        if (sign === 0) sign = s;
        else if (s !== sign) return false;
      }
    }
    return true;
  };

  G.pointInPoly = (poly, p) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside;
      }
    }
    return inside;
  };

  /* Separating-Axis-Test: liefert Eindringtiefe (> 0 bei Überlappung) */
  G.satDepth = (a, b) => {
    let minOverlap = Infinity;
    const polys = [a, b];
    for (const poly of polys) {
      for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const axis = G.norm({ x: -(p2.y - p1.y), y: p2.x - p1.x });
        let minA = Infinity;
        let maxA = -Infinity;
        let minB = Infinity;
        let maxB = -Infinity;
        for (const p of a) {
          const d = p.x * axis.x + p.y * axis.y;
          if (d < minA) minA = d;
          if (d > maxA) maxA = d;
        }
        for (const p of b) {
          const d = p.x * axis.x + p.y * axis.y;
          if (d < minB) minB = d;
          if (d > maxB) maxB = d;
        }
        const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
        if (overlap <= 0) return 0;
        if (overlap < minOverlap) minOverlap = overlap;
      }
    }
    return minOverlap;
  };

  G.closestOnSeg = (p, a, b) => {
    const ab = G.sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    let t = l2 ? ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + ab.x * t, y: a.y + ab.y * t, t };
  };

  /* Kleinster Abstand zweier konvexer Polygone inkl. der nächsten Punkte */
  G.polyDistance = (a, b) => {
    if (G.satDepth(a, b) > 0) return { d: 0, p: G.centroid(a), q: G.centroid(b) };
    let best = { d: Infinity, p: null, q: null };
    const test = (P, Q, swap) => {
      for (const p of P) {
        for (let i = 0; i < Q.length; i++) {
          const c = G.closestOnSeg(p, Q[i], Q[(i + 1) % Q.length]);
          const d = Math.hypot(p.x - c.x, p.y - c.y);
          if (d < best.d) best = swap ? { d, p: c, q: p } : { d, p, q: c };
        }
      }
    };
    test(a, b, false);
    test(b, a, true);
    return best;
  };

  /* Schnittpunkt zweier Geraden (p + t r) und (q + u s) */
  G.lineIntersect = (p, r, q, s) => {
    const rxs = G.cross(r, s);
    if (Math.abs(rxs) < 1e-9) return null;
    const t = G.cross(G.sub(q, p), s) / rxs;
    return G.add(p, G.mul(r, t));
  };

  /* Konvexes Polygon um d nach innen versetzen */
  G.inset = (poly, d) => {
    const n = poly.length;
    const lines = [];
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      const nrm = G.edgeNormal(poly, i);
      lines.push({ p: G.sub(a, G.mul(nrm, d)), r: G.sub(b, a) });
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const l0 = lines[(i - 1 + n) % n];
      const l1 = lines[i];
      out.push(G.lineIntersect(l0.p, l0.r, l1.p, l1.r) || poly[i]);
    }
    return out;
  };

  /* SVG-Pfad eines Polygons mit abgerundeten Ecken */
  G.roundedPath = (poly, r) => {
    const n = poly.length;
    const f = (v) => Math.round(v * 100) / 100;
    let d = '';
    for (let i = 0; i < n; i++) {
      const prev = poly[(i - 1 + n) % n];
      const cur = poly[i];
      const next = poly[(i + 1) % n];
      const v1 = G.norm(G.sub(prev, cur));
      const v2 = G.norm(G.sub(next, cur));
      const ang = Math.acos(Math.max(-1, Math.min(1, G.dot(v1, v2))));
      let t = r / Math.tan(ang / 2);
      t = Math.min(t, G.dist(prev, cur) * 0.45, G.dist(next, cur) * 0.45);
      const p1 = G.add(cur, G.mul(v1, t));
      const p2 = G.add(cur, G.mul(v2, t));
      d += (i === 0 ? 'M' : 'L') + f(p1.x) + ' ' + f(p1.y) + ' Q' + f(cur.x) + ' ' + f(cur.y) + ' ' + f(p2.x) + ' ' + f(p2.y) + ' ';
    }
    return d + 'Z';
  };

  G.polyPath = (poly) => {
    const f = (v) => Math.round(v * 100) / 100;
    return poly.map((p, i) => (i ? 'L' : 'M') + f(p.x) + ' ' + f(p.y)).join(' ') + ' Z';
  };

  /* Exakte euklidische Distanztransformation (Felzenszwalb & Huttenlocher).
     Eingabe: Float32Array mit 0 (Quelle) bzw. Infinity; Ausgabe: quadrierte Distanzen (Zellen). */
  G.edt = (f, nx, ny) => {
    const INF = 1e20;
    const n = Math.max(nx, ny);
    const z = new Float64Array(n + 1);
    const v = new Int32Array(n);
    const g = new Float64Array(n);
    const out = new Float64Array(n);
    const pass = (get, set, len) => {
      for (let q = 0; q < len; q++) g[q] = get(q);
      let k = 0;
      v[0] = 0;
      z[0] = -INF;
      z[1] = INF;
      for (let q = 1; q < len; q++) {
        let s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) {
          k--;
          s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        }
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < len; q++) {
        while (z[k + 1] < q) k++;
        out[q] = (q - v[k]) * (q - v[k]) + g[v[k]];
      }
      for (let q = 0; q < len; q++) set(q, out[q]);
    };
    for (let i = 0; i < f.length; i++) if (f[i] > INF) f[i] = INF;
    for (let x = 0; x < nx; x++) {
      pass((q) => f[q * nx + x], (q, val) => (f[q * nx + x] = val), ny);
    }
    for (let y = 0; y < ny; y++) {
      const row = y * nx;
      pass((q) => f[row + q], (q, val) => (f[row + q] = val), nx);
    }
    return f;
  };

  LLR.G = G;
})((window.LLR = window.LLR || {}));
