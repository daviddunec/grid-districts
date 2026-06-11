// S5 RECURSIVE SPLITLINE — the academic compactness baseline (panel #2).
// split(region, s): a = floor(s/2), b = s - a; four cut families as half-plane
// predicates over (row, col); minimize |popA - (a/s)*popR|; ties -> shortest cut
// -> V < H < D1 < D2 -> lower threshold. Side A (west/north/NW/NE) gets a seats.
// Depth-first numbering, A-side first. Disconnected halves are allowed -> repair.

export function runSplitline(grid, meta) {
  const { rows, cols, inState, pop } = grid;
  const n = rows * cols;
  const district = new Int16Array(n).fill(-1);
  const anchors = [];
  let nextDistrict = 1;

  const all = [];
  for (let i = 0; i < n; i++) if (inState[i]) all.push(i);

  const KEYS = {
    V: (r, c) => c,
    H: (r, c) => r,
    D1: (r, c) => r + c,
    D2: (r, c) => r - c,
  };
  const FAMILY_ORDER = ['V', 'H', 'D1', 'D2'];

  function bestCut(cells, a, s) {
    const popR = cells.reduce((acc, i) => acc + pop[i], 0);
    const want = (a / s) * popR;
    const inRegion = new Set(cells);
    let best = null; // {err, cutLen, famIdx, t, fam}
    for (let f = 0; f < FAMILY_ORDER.length; f++) {
      const fam = FAMILY_ORDER[f];
      const key = KEYS[fam];
      const byKey = new Map();
      // Pre-bucket rook edges by the threshold they straddle: every in-region rook edge has
      // |k1-k2| ∈ {0,1} for all four families, so it straddles exactly t = min(k1,k2) when keys
      // differ. One O(cells) pass replaces the O(keys*cells) rescan (code review M3).
      const edgeCountByT = new Map();
      for (const i of cells) {
        const r = Math.floor(i / cols), c = i % cols;
        const k1 = key(r, c);
        byKey.set(k1, (byKey.get(k1) || 0) + pop[i]);
        for (const [nr, nc] of [[r, c + 1], [r + 1, c]]) { // east+south: each edge counted once
          if (nr >= rows || nc >= cols) continue;
          const j = nr * cols + nc;
          if (!inRegion.has(j)) continue;
          const k2 = key(nr, nc);
          if (k1 !== k2) {
            const t = Math.min(k1, k2);
            edgeCountByT.set(t, (edgeCountByT.get(t) || 0) + 1);
          }
        }
      }
      const ks = [...byKey.keys()].sort((x, y) => x - y);
      let prefix = 0;
      for (let ki = 0; ki < ks.length - 1; ki++) { // t = ks[ki]; both sides nonempty
        prefix += byKey.get(ks[ki]);
        const err = Math.abs(prefix - want);
        const t = ks[ki];
        const cutLen = edgeCountByT.get(t) || 0;
        if (
          !best || err < best.err ||
          (err === best.err && (cutLen < best.cutLen ||
            (cutLen === best.cutLen && (f < best.famIdx ||
              (f === best.famIdx && t < best.t)))))
        ) best = { err, cutLen, famIdx: f, t, fam };
      }
    }
    return best;
  }

  function split(cells, s) {
    if (s === 1) {
      const d = nextDistrict++;
      let anchor = Infinity;
      for (const i of cells) { district[i] = d; if (i < anchor) anchor = i; }
      anchors.push(anchor);
      return;
    }
    // Guard (code review M4): never recurse into an empty region; if there are fewer cells
    // than seats, give one cell per seat while they last — repair/gates surface the pathology.
    if (cells.length <= s) {
      const sorted = [...cells].sort((x, y) => x - y);
      for (let k = 0; k < s; k++) split(k < sorted.length ? [sorted[k]] : [], 1);
      return; // 0-cell districts surface via the G4-coverage gate, never as a crash
    }
    const a = Math.floor(s / 2), b = s - a;
    const cut = bestCut(cells, a, s);
    if (!cut) { // degenerate single-key region: fall back to index split
      const sorted = [...cells].sort((x, y) => x - y);
      const popR = cells.reduce((acc, i) => acc + pop[i], 0);
      const want = (a / s) * popR;
      let acc = 0, idx = 0;
      for (; idx < sorted.length - 1; idx++) { acc += pop[sorted[idx]]; if (acc >= want) break; }
      split(sorted.slice(0, idx + 1), a);
      split(sorted.slice(idx + 1), b);
      return;
    }
    const key = KEYS[cut.fam];
    const A = [], B = [];
    for (const i of cells) {
      (key(Math.floor(i / cols), i % cols) <= cut.t ? A : B).push(i);
    }
    split(A, a);
    split(B, b);
  }

  split(all, meta.seats);
  return { district, anchors, sealedLog: [] }; // anchors[d-1] = min cell of district d (push order = numbering order)
}
