// page-side road router (island units). window.__route(opts) -> {pts:[[x,z,h]], cost}
window.__route = function (o) {
  const I = WG.isle, g = (x, z) => I.groundH(x, z);
  const C = o.cell || 3, [x0, z0, x1, z1] = o.box, NX = Math.ceil((x1 - x0) / C), NZ = Math.ceil((z1 - z0) / C);
  const H = new Float32Array(NX * NZ), B = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = x0 + (i + 0.5) * C, z = z0 + (j + 0.5) * C, h = g(x, z), k = j * NX + i;
    H[k] = h;
    B[k] = h < 2.5 || I.hitsBuilding(x, h + 1.5, z, o.clear || 4.5) ? 1 : 0;
    if (o.keepOut) for (const [kx, kz, kr] of o.keepOut) if (Math.hypot(x - kx, z - kz) < kr) B[k] = 1;
  }
  const idx = (x, z) => { const i = Math.floor((x - x0) / C), j = Math.floor((z - z0) / C); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : j * NX + i; };
  const D = [];
  for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if ((di || dj) && (Math.abs(di) < 2 || Math.abs(dj) < 2 || false) && !(Math.abs(di) === 2 && Math.abs(dj) === 2) && !(Math.abs(di) === 2 && dj === 0) && !(Math.abs(dj) === 2 && di === 0)) D.push([di, dj]);
  const goal = o.goal; // [x,z]
  const gi = idx(goal[0], goal[1]);
  const G = new Float32Array(NX * NZ).fill(Infinity), F = new Int32Array(NX * NZ).fill(-1);
  const heap = [], push = (k, f) => { heap.push([f, k]); let a = heap.length - 1; while (a > 0) { const p = (a - 1) >> 1; if (heap[p][0] <= heap[a][0]) break; [heap[p], heap[a]] = [heap[a], heap[p]]; a = p; } };
  const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let a = 0; for (;;) { const L = 2 * a + 1, R = L + 1; let m = a; if (L < heap.length && heap[L][0] < heap[m][0]) m = L; if (R < heap.length && heap[R][0] < heap[m][0]) m = R; if (m === a) break; [heap[m], heap[a]] = [heap[a], heap[m]]; a = m; } } return t; };
  const hx = (k) => Math.hypot((k % NX) * C + x0 - goal[0], ((k / NX) | 0) * C + z0 - goal[1]);
  for (const s of o.starts) { const k = idx(s[0], s[1]); if (k >= 0) { G[k] = 0; B[k] = 0; push(k, hx(k)); } }
  B[gi] = 0;
  const maxG = o.grade || 0.25;
  let found = false, it = 0;
  while (heap.length && it++ < 3e6) {
    const [, k] = pop();
    if (k === gi) { found = true; break; }
    const i = k % NX, j = (k / NX) | 0;
    for (const [di, dj] of D) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const m = nj * NX + ni; if (B[m]) continue;
      if (Math.abs(di) + Math.abs(dj) > 2) { const mi = (j + Math.round(dj / 2)) * NX + i + Math.round(di / 2); if (B[mi] || B[j * NX + ni] && B[nj * NX + i]) continue; }
      const L = Math.hypot(di, dj) * C, gr = Math.abs(H[m] - H[k]) / L;
      if (gr > maxG) continue;
      let c = L * (1 + (o.gradeK || 4) * gr * gr);
      const pf = F[k];
      if (pf >= 0) { const pi = pf % NX, pj = (pf / NX) | 0, ax = i - pi, az = j - pj, cos = (ax * di + az * dj) / (Math.hypot(ax, az) * Math.hypot(di, dj)); c += (1 - cos) * (o.turnK || 6); }
      const ng = G[k] + c;
      if (ng < G[m]) { G[m] = ng; F[m] = k; push(m, ng + hx(m)); }
    }
  }
  if (!found) return { pts: null, it };
  const pts = [];
  for (let k = gi; k >= 0; k = F[k]) pts.push([x0 + ((k % NX) + 0.5) * C, z0 + (((k / NX) | 0) + 0.5) * C]);
  pts.reverse();
  // simplify: keep a point when the chord strays from the path, is too steep or hits something
  const ok = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 2); let prev = g(a[0], a[1]); for (let q = 1; q <= n; q++) { const x = a[0] + (b[0] - a[0]) * q / n, z = a[1] + (b[1] - a[1]) * q / n, h = g(x, z); if (Math.abs(h - prev) / (L / n) > maxG * 1.25 || I.hitsBuilding(x, h + 1.5, z, (o.clear || 4.5) - 1)) return false; prev = h; } return true; };
  const out = [pts[0]];
  let a = 0;
  while (a < pts.length - 1) {
    let b = pts.length - 1;
    for (; b > a + 1; b--) {
      const A = pts[a], Bp = pts[b], L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]);
      let dev = 0; for (let q = a + 1; q < b; q++) { const P = pts[q]; dev = Math.max(dev, Math.abs((Bp[0] - A[0]) * (A[1] - P[1]) - (A[0] - P[0]) * (Bp[1] - A[1])) / L); }
      if (dev < (o.tol || 3) && ok(A, Bp)) break;
    }
    out.push(pts[b]); a = b;
  }
  return { pts: out.map(p => [Math.round(p[0]), Math.round(p[1]), +g(p[0], p[1]).toFixed(1)]), it, cost: G[gi] };
};
// a grade-limited walker: heads for the goal, turning (to side +1 / -1) along the slope when the direct line is too steep
window.__walk = function (o) {
  const I = WG.isle, g = (x, z) => I.groundH(x, z);
  const step = o.step || 4, maxG = o.grade || 0.18, side = o.side || 1, clear = o.clear || 4.5, maxTurn = (o.maxTurn || 14) * Math.PI / 180;
  const blocked = (x, z) => { const h = g(x, z); if (h < 2.5) return true; if (I.hitsBuilding(x, h + 1.5, z, clear)) return true; for (const [kx, kz, kr] of o.keepOut || []) if (Math.hypot(x - kx, z - kz) < kr) return true; return false; };
  let [x, z] = o.start, hd = o.heading !== undefined ? o.heading : Math.atan2(o.goal[1] - z, o.goal[0] - x);
  const pts = [[x, z]];
  for (let n = 0; n < (o.maxSteps || 600); n++) {
    const dg = Math.hypot(o.goal[0] - x, o.goal[1] - z);
    if (dg < (o.arrive || step * 1.5)) { pts.push([o.goal[0], o.goal[1]]); return { pts: fin(pts), ok: true }; }
    const gb = Math.atan2(o.goal[1] - z, o.goal[0] - x), h0 = g(x, z);
    const ok = (a) => { const nx = x + Math.cos(a) * step, nz = z + Math.sin(a) * step; if (blocked(nx, nz)) return false; if (Math.abs(g(nx, nz) - h0) / step > maxG) return false;
      for (let q = 0; q < pts.length - 8; q++) if (Math.hypot(nx - pts[q][0], nz - pts[q][1]) < (o.sep || 16)) return false; return true; };
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    let best = null;
    // the direction nearest the goal's bearing (turning to the preferred side first) within the turn limit
    for (let k = 0; k <= 72 && best === null; k++) for (const sg of [side, -side]) {
      const a = gb + sg * k * Math.PI / 72; if (Math.abs(wrap(a - hd)) <= maxTurn && ok(a)) { best = a; break; }
    }
    // nothing within the turn limit: a hairpin, the smallest turn that works
    if (best === null) for (let k = 1; k <= 36 && best === null; k++) for (const sg of [side, -side]) { const a = hd + sg * k * Math.PI / 36; if (ok(a)) { best = a; break; } }
    if (best === null) return { pts: fin(pts), ok: false, why: 'stuck' };
    hd = best; x += Math.cos(hd) * step; z += Math.sin(hd) * step; pts.push([x, z]);
  }
  return { pts: fin(pts), ok: false, why: 'steps' };
  function fin(P) {
    // simplify to chords no more than tol off the walk and at least minLen long
    const tol = o.tol || 1.5, minLen = o.minLen || 11, out = [P[0]];
    let a = 0;
    while (a < P.length - 1) {
      let b = P.length - 1;
      for (; b > a + 1; b--) { const A = P[a], B = P[b], L = Math.hypot(B[0] - A[0], B[1] - A[1]); let dev = 0;
        for (let q = a + 1; q < b; q++) { const Q = P[q]; dev = Math.max(dev, Math.abs((B[0] - A[0]) * (A[1] - Q[1]) - (A[0] - Q[0]) * (B[1] - A[1])) / L); }
        if (dev < tol || L < minLen) break; }
      out.push(P[b]); a = b;
    }
    return out.map(p => [Math.round(p[0]), Math.round(p[1]), +g(p[0], p[1]).toFixed(1)]);
  }
};
