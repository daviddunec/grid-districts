// S4 HILBERT CURVE — the panel's pre-committed robustness contingency (E5: "locality is
// shape-independent; it never seals, so it cannot cascade-seal"). Order all in-state cells
// by Hilbert index over the 2^m x 2^m curve (x=col, y=row), then greedy-cut the 1-D sequence
// with the shared rules (never close at P=0, <= acceptance, last district absorbs).
// Mask-gap jumps create orphans by design — repair reattaches them.

function xy2d(side, x, y) {
  let d = 0;
  for (let s = side >> 1; s >= 1; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) { // rotate quadrant
      if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
      const t = x; x = y; y = t;
    }
  }
  return d;
}

export function runHilbert(grid, meta) {
  const { rows, cols, inState, pop } = grid;
  const n = rows * cols;
  const district = new Int16Array(n).fill(-1);
  const anchors = [];

  let m = 1;
  while (m < Math.max(rows, cols, 2)) m <<= 1;

  const order = [];
  for (let i = 0; i < n; i++) if (inState[i]) order.push(i);
  const hkey = new Map();
  for (const i of order) hkey.set(i, xy2d(m, i % cols, Math.floor(i / cols)));
  order.sort((a, b) => hkey.get(a) - hkey.get(b) || a - b);

  let remainingPop = meta.residentPop;
  let ptr = 0;
  for (let d = 1; d <= meta.seats; d++) {
    const T = remainingPop / (meta.seats - d + 1);
    if (ptr >= order.length) break;
    anchors.push(order[ptr]);
    if (d === meta.seats) {
      for (; ptr < order.length; ptr++) district[order[ptr]] = d;
      remainingPop = 0;
      break;
    }
    let P = 0;
    while (ptr < order.length) {
      const i = order[ptr];
      const accept = P === 0 || Math.abs(P + pop[i] - T) <= Math.abs(P - T);
      if (!accept) break;
      district[i] = d;
      P += pop[i];
      ptr++;
    }
    remainingPop -= P;
  }
  return { district, anchors, sealedLog: [] };
}
