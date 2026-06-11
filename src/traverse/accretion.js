// S3 SQUARE-BLOCK ACCRETION — the panel's unanimous #1. Two seed arms:
//   west:     boustrophedon band sweep from the west edge (as panel-specified)
//   centroid: districts radiate outward from the state's geometric center
//             (the hybrid 4/5 evaluators flagged — David's center-outward vision)
// Shared greedy cut per INTERFACES.md: never close at P=0; <= acceptance; last district absorbs.

export function runAccretion(grid, meta, arm) {
  const { rows, cols, inState, pop } = grid;
  const n = rows * cols;
  const district = new Int16Array(n).fill(-1);
  const anchors = []; // first-assigned cell per district (repair anchors)

  const inStateCells = [];
  for (let i = 0; i < n; i++) if (inState[i]) inStateCells.push(i);

  // Seed enumeration order
  let seedOrder;
  if (arm === 'west') {
    const rho = meta.residentPop / inStateCells.length;
    const k0 = Math.max(1, Math.round(Math.sqrt(meta.idealTarget / rho)));
    seedOrder = [];
    const nBands = Math.ceil(cols / k0);
    for (let b = 0; b < nBands; b++) {
      const c0 = b * k0, c1 = Math.min(cols, (b + 1) * k0);
      const rowSeq = b % 2 === 0
        ? Array.from({ length: rows }, (_, r) => r)
        : Array.from({ length: rows }, (_, r) => rows - 1 - r);
      for (const r of rowSeq) for (let c = c0; c < c1; c++) {
        const i = r * cols + c;
        if (inState[i]) seedOrder.push(i);
      }
    }
  } else if (arm === 'centroid') {
    let sr = 0, sc = 0;
    for (const i of inStateCells) { sr += Math.floor(i / cols); sc += i % cols; }
    const cr = sr / inStateCells.length, cc = sc / inStateCells.length;
    seedOrder = [...inStateCells].sort((a, b) => {
      const ar = Math.floor(a / cols), ac = a % cols, br = Math.floor(b / cols), bc = b % cols;
      const da = (ar - cr) ** 2 + (ac - cc) ** 2, db = (br - cr) ** 2 + (bc - cc) ** 2;
      return da - db || ar - br || ac - bc;
    });
  } else {
    throw new Error(`Unknown accretion arm: ${arm}`);
  }

  let remainingPop = meta.residentPop;
  let assignedCount = 0;
  let seedPtr = 0;
  const sealedLog = [];

  for (let d = 1; d <= meta.seats; d++) {
    const remainingDistricts = meta.seats - d + 1;
    const T = remainingPop / remainingDistricts;

    while (seedPtr < seedOrder.length && district[seedOrder[seedPtr]] !== -1) seedPtr++;
    if (seedPtr >= seedOrder.length) break; // nothing left (shouldn't happen before last district)
    const seed = seedOrder[seedPtr];

    if (d === meta.seats) {
      // Last district absorbs every remaining cell (contiguity restored by repair if needed)
      anchors.push(seed);
      for (const i of inStateCells) if (district[i] === -1) { district[i] = d; assignedCount++; }
      remainingPop = 0;
      break;
    }

    let sr = Math.floor(seed / cols), sc = seed % cols;
    district[seed] = d;
    anchors.push(seed);
    assignedCount++;
    let P = pop[seed];
    let minR = sr, maxR = sr, minC = sc, maxC = sc;
    const frontier = new Set();
    const addNeighbors = (i) => {
      const r = Math.floor(i / cols), c = i % cols;
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const k = nr * cols + nc;
        if (inState[k] && district[k] === -1) frontier.add(k);
      }
    };
    addNeighbors(seed);

    for (;;) {
      // Lazy-clean: drop frontier cells claimed elsewhere (cannot happen intra-district, kept for safety)
      let best = -1, bestSide = 0, bestCheb = 0;
      for (const i of frontier) {
        if (district[i] !== -1) { frontier.delete(i); continue; }
        const r = Math.floor(i / cols), c = i % cols;
        const side = Math.max(
          Math.max(maxR, r) - Math.min(minR, r) + 1,
          Math.max(maxC, c) - Math.min(minC, c) + 1
        );
        const cheb = Math.max(Math.abs(r - sr), Math.abs(c - sc));
        if (
          best === -1 || side < bestSide || (side === bestSide && (cheb < bestCheb ||
          (cheb === bestCheb && (r < Math.floor(best / cols) || (r === Math.floor(best / cols) && c < best % cols)))))
        ) { best = i; bestSide = side; bestCheb = cheb; }
      }
      if (best === -1) {
        // SEAL → RE-SEED, same district (FL-008). Closing a starved district here is what
        // produced 0-pop districts on Maryland's Chesapeake pockets; instead the district
        // keeps its accumulated pop and continues from the next seed in sweep order.
        // Bbox + Chebyshev reference reset to the new seed (per-pocket squareness).
        while (seedPtr < seedOrder.length && district[seedOrder[seedPtr]] !== -1) seedPtr++;
        if (seedPtr >= seedOrder.length) { sealedLog.push({ district: d, pop: P, reason: 'sealed-exhausted' }); break; }
        const reseed = seedOrder[seedPtr];
        sealedLog.push({ district: d, pop: P, reason: 'sealed-reseeded' });
        district[reseed] = d;
        assignedCount++;
        P += pop[reseed];
        sr = Math.floor(reseed / cols); sc = reseed % cols;
        minR = sr; maxR = sr; minC = sc; maxC = sc;
        frontier.clear();
        addNeighbors(reseed);
        continue;
      }

      const cellPop = pop[best];
      const accept = P === 0 || Math.abs(P + cellPop - T) <= Math.abs(P - T);
      if (!accept) break; // close district at target

      frontier.delete(best);
      district[best] = d;
      assignedCount++;
      P += cellPop;
      const r = Math.floor(best / cols), c = best % cols;
      if (r < minR) minR = r; if (r > maxR) maxR = r;
      if (c < minC) minC = c; if (c > maxC) maxC = c;
      addNeighbors(best);
    }
    remainingPop -= P;
  }

  return { district, anchors, sealedLog };
}
