// Contiguity repair + bounded rebalance (INTERFACES.md / plan §repair).
// 1. Orphan components (all but the highest-POPULATION component, FL-004) reassigned wholesale
//    to the adjacent district with lowest population (tie: lowest district id).
// 2. Rebalance: boundary-cell moves over->under target that strictly reduce Σ|pop_d - ideal|
//    by >= 1 person AND keep the donor connected. Integer objective bounded below => terminates;
//    iteration cap retained as a pure guard.
// Scale notes (code review B1/M1): no Math.min(...spread) over cell arrays (V8 stack limit
// ~130k elements — TX absorb components exceed it); rebalance keeps per-district cell Sets
// incrementally so connectivity checks are O(|district|), never O(grid).

function neighborsOf(i, rows, cols) {
  const r = Math.floor(i / cols), c = i % cols;
  const out = [];
  if (r > 0) out.push(i - cols);
  if (r < rows - 1) out.push(i + cols);
  if (c > 0) out.push(i - 1);
  if (c < cols - 1) out.push(i + 1);
  return out;
}

const minOf = (arr) => { let m = Infinity; for (const v of arr) if (v < m) m = v; return m; };

function buildBridgeMap(bridges) {
  const m = new Map();
  for (const [a, b] of bridges || []) {
    if (!m.has(a)) m.set(a, []);
    if (!m.has(b)) m.set(b, []);
    m.get(a).push(b);
    m.get(b).push(a);
  }
  return m;
}

function componentsOf(cells, rows, cols, bridgeMap) {
  const cellSet = cells instanceof Set ? cells : new Set(cells);
  const seen = new Set();
  const comps = [];
  for (const start of cellSet) {
    if (seen.has(start)) continue;
    const stack = [start], comp = [];
    seen.add(start);
    while (stack.length) {
      const i = stack.pop();
      comp.push(i);
      for (const j of neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || [])) {
        if (cellSet.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
      }
    }
    comps.push(comp);
  }
  return comps;
}

export function repair(grid, meta, district, anchors) {
  const { rows, cols, inState, pop, bridges } = grid;
  const n = rows * cols;
  const bridgeMap = buildBridgeMap(bridges);
  const ideal = meta.idealTarget;
  const stats = { orphanComponentsMoved: 0, orphanCellsMoved: 0, rebalanceMoves: 0 };

  // Per-district cell sets + pops, maintained incrementally from here on (M1).
  const cellsOf = Array.from({ length: meta.seats + 1 }, () => new Set());
  const dPop = new Array(meta.seats + 1).fill(0);
  for (let i = 0; i < n; i++) {
    if (inState[i] && district[i] >= 1) { cellsOf[district[i]].add(i); dPop[district[i]] += pop[i]; }
  }
  const popOf = (cells) => { let s = 0; for (const i of cells) s += pop[i]; return s; };
  const moveCell = (i, from, to) => {
    district[i] = to;
    cellsOf[from].delete(i);
    cellsOf[to].add(i);
    dPop[from] -= pop[i];
    dPop[to] += pop[i];
  };

  // ---- Pass 1: orphan reassignment (repeat until stable; dumps can cascade) ----
  for (let round = 0; round < meta.seats + 2; round++) {
    let moved = false;
    for (let d = 1; d <= meta.seats; d++) {
      const comps = componentsOf(cellsOf[d], rows, cols, bridgeMap);
      if (comps.length <= 1) continue;
      // Keep the component with the most POPULATION (tie: most cells, then min index) — FL-004.
      let keepIdx = 0, keepPop = -1, keepCells = -1, keepMin = Infinity;
      for (let ci = 0; ci < comps.length; ci++) {
        const p = popOf(comps[ci]), len = comps[ci].length;
        if (p < keepPop || (p === keepPop && len < keepCells)) continue;
        const mn = (p > keepPop || len > keepCells) ? minOf(comps[ci]) : minOf(comps[ci]); // tie only: lazy enough at component granularity
        if (p > keepPop || (p === keepPop && (len > keepCells || (len === keepCells && mn < keepMin)))) {
          keepIdx = ci; keepPop = p; keepCells = len; keepMin = mn;
        }
      }
      const orphans = comps.filter((_, ci) => ci !== keepIdx)
        .map((comp) => ({ comp, min: minOf(comp) }))
        .sort((a, b) => a.min - b.min);
      for (const { comp: orphan, min: orphanMin } of orphans) {
        const adj = new Set();
        for (const i of orphan) {
          for (const j of neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || [])) {
            if (inState[j] && district[j] >= 1 && district[j] !== d) adj.add(district[j]);
          }
        }
        const orphanPop = popOf(orphan);
        if (adj.size >= 2 && orphanPop > 0.1 * ideal) {
          // POP-AWARE ORPHAN SPLITTING (shakeout option A): dumping a populous component into
          // ONE neighbor created the 4-37% deviations on MD/FL coasts. Instead, divide it among
          // ALL adjacent districts: each absorbs a share proportional to its deficit, growing a
          // connected region from its own border (budgeted multi-source BFS; deterministic).
          const adjList = [...adj].sort((a, b) => a - b);
          const deficits = adjList.map((e) => Math.max(0, ideal - dPop[e]));
          const totDef = deficits.reduce((a, b) => a + b, 0);
          const share = new Map(adjList.map((e, k) => [
            e, totDef > 0 ? (orphanPop * deficits[k]) / totDef : orphanPop / adjList.length,
          ]));
          const orphanSet = new Set(orphan);
          const claimed = new Map();
          const absorbed = new Map(adjList.map((e) => [e, 0]));
          const frontier = new Map(adjList.map((e) => [e, []]));
          for (const i of [...orphan].sort((a, b) => a - b)) {
            for (const j of neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || [])) {
              if (inState[j] && adj.has(district[j])) { frontier.get(district[j]).push(i); break; }
            }
          }
          let remaining = orphan.length;
          let ignoreBudgets = false;
          while (remaining > 0) {
            let progress = false;
            for (const e of adjList) {
              const f = frontier.get(e);
              while (f.length && claimed.has(f[0])) f.shift();
              if (!f.length) continue;
              const a0 = absorbed.get(e), s0 = share.get(e);
              if (!ignoreBudgets && a0 > 0 && Math.abs(a0 + pop[f[0]] - s0) > Math.abs(a0 - s0)) continue;
              const i = f.shift();
              claimed.set(i, e);
              absorbed.set(e, a0 + pop[i]);
              remaining--;
              progress = true;
              for (const j of neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || []).sort((x, y) => x - y)) {
                if (orphanSet.has(j) && !claimed.has(j)) f.push(j);
              }
            }
            if (!progress) {
              if (ignoreBudgets) break; // unreachable pocket (shouldn't happen: orphan is connected)
              ignoreBudgets = true; // budgets exhausted — finish claiming round-robin
            }
          }
          for (const i of [...orphan].sort((a, b) => a - b)) {
            moveCell(i, d, claimed.has(i) ? claimed.get(i) : adjList[0]);
          }
        } else {
          let target;
          if (adj.size) {
            target = [...adj].sort((a, b) => dPop[a] - dPop[b] || a - b)[0];
          } else {
            // No adjacent district (rare): nearest district by Chebyshev from the orphan's min cell
            const or = Math.floor(orphanMin / cols), oc = orphanMin % cols;
            let best = null;
            for (let dd = 1; dd <= meta.seats; dd++) {
              if (dd === d) continue;
              for (const i of cellsOf[dd]) {
                const ch = Math.max(Math.abs(Math.floor(i / cols) - or), Math.abs((i % cols) - oc));
                if (!best || ch < best.ch || (ch === best.ch && dd < best.dd)) best = { ch, dd };
              }
            }
            target = best.dd;
          }
          for (const i of orphan) moveCell(i, d, target);
        }
        stats.orphanComponentsMoved++;
        stats.orphanCellsMoved += orphan.length;
        moved = true;
      }
    }
    if (!moved) break;
  }

  // ---- Pass 2: rebalance (strict-decrease invariant is the terminator; cap is a guard) ----
  const cap = 500 + 5 * stats.orphanCellsMoved;
  const objective = () => {
    let s = 0;
    for (let d = 1; d <= meta.seats; d++) s += Math.abs(dPop[d] - ideal);
    return s;
  };
  const donorStaysConnected = (cell, d) => {
    const donor = cellsOf[d];
    if (donor.size <= 1) return false; // never empty a district
    let start = -1;
    if (donor.has(anchors[d - 1]) && anchors[d - 1] !== cell) start = anchors[d - 1];
    else { let m = Infinity; for (const i of donor) if (i !== cell && i < m) m = i; start = m; }
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const i = stack.pop();
      for (const j of neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || [])) {
        if (j !== cell && donor.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
      }
    }
    return seen.size === donor.size - 1;
  };

  for (let iter = 0; iter < cap; iter++) {
    const before = objective();
    // Candidates: boundary cells of over-ideal districts adjacent to ANY under-ideal district
    // (review m2: consider every under-ideal neighbor, not just the first found).
    const candidates = [];
    for (let d = 1; d <= meta.seats; d++) {
      if (dPop[d] <= ideal) continue;
      for (const i of cellsOf[d]) {
        const seenTargets = new Set();
        for (const j of neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || [])) {
          const e = inState[j] ? district[j] : 0;
          if (e >= 1 && e !== d && dPop[e] < ideal && !seenTargets.has(e)) {
            seenTargets.add(e);
            const delta =
              Math.abs(dPop[d] - pop[i] - ideal) + Math.abs(dPop[e] + pop[i] - ideal) -
              Math.abs(dPop[d] - ideal) - Math.abs(dPop[e] - ideal);
            if (delta <= -1) candidates.push({ i, from: d, to: e, delta });
          }
        }
      }
    }
    let applied = false;
    if (candidates.length) {
      candidates.sort((a, b) => a.delta - b.delta || a.i - b.i || a.to - b.to);
      for (const cand of candidates) {
        if (donorStaysConnected(cand.i, cand.from)) {
          moveCell(cand.i, cand.from, cand.to);
          stats.rebalanceMoves++;
          applied = true;
          break;
        }
      }
    }
    // CORRIDOR MOVES (FL-009): single-cell moves stall behind zero-pop walls (water, desert)
    // because a 0-pop move has delta 0, never <= -1. When no single move applies, tunnel a
    // shortest path of zero-pop donor cells + ONE populated endpoint from an over district
    // into an adjacent under district as one atomic move. delta <= -1 still required, so the
    // objective still strictly decreases by >= 1 per applied move => termination unchanged.
    if (!applied) {
      let bestPath = null; // {delta, path, from, to, startIdx}
      for (let d = 1; d <= meta.seats; d++) {
        if (dPop[d] <= ideal) continue;
        for (let e = 1; e <= meta.seats; e++) {
          if (e === d || dPop[e] >= ideal) continue;
          // BFS inside district d from cells adjacent to e, through zero-pop d-cells,
          // until the first populated d-cell. Deterministic: sorted frontier expansion.
          const startCells = [];
          for (const i of cellsOf[d]) {
            for (const j of neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || [])) {
              if (inState[j] && district[j] === e) { startCells.push(i); break; }
            }
          }
          startCells.sort((a, b) => a - b);
          const parent = new Map();
          const queue = [];
          for (const s of startCells) if (!parent.has(s)) { parent.set(s, -1); queue.push(s); }
          let endpoint = -1;
          for (let qi = 0; qi < queue.length && endpoint === -1; qi++) {
            const i = queue[qi];
            if (pop[i] > 0) { endpoint = i; break; }
            const nbrs = neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || []).sort((a, b) => a - b);
            for (const j of nbrs) {
              if (cellsOf[d].has(j) && !parent.has(j)) { parent.set(j, i); queue.push(j); }
            }
          }
          if (endpoint === -1) continue;
          const path = [];
          for (let i = endpoint; i !== -1; i = parent.get(i)) path.push(i);
          const popMoved = pop[endpoint]; // all other path cells are zero-pop by construction
          const delta =
            Math.abs(dPop[d] - popMoved - ideal) + Math.abs(dPop[e] + popMoved - ideal) -
            Math.abs(dPop[d] - ideal) - Math.abs(dPop[e] - ideal);
          if (delta > -1) continue;
          if (
            !bestPath || delta < bestPath.delta ||
            (delta === bestPath.delta && (path.length < bestPath.path.length ||
              (path.length === bestPath.path.length && path[path.length - 1] < bestPath.startIdx)))
          ) bestPath = { delta, path, from: d, to: e, startIdx: path[path.length - 1] };
        }
      }
      if (bestPath) {
        // donor must stay connected after removing the whole path
        const donor = cellsOf[bestPath.from];
        const pathSet = new Set(bestPath.path);
        if (donor.size > pathSet.size) {
          let start = -1;
          for (const i of donor) if (!pathSet.has(i)) { if (start === -1 || i < start) start = i; }
          const seen = new Set([start]);
          const stack = [start];
          while (stack.length) {
            const i = stack.pop();
            for (const j of neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || [])) {
              if (donor.has(j) && !pathSet.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
            }
          }
          if (seen.size === donor.size - pathSet.size) {
            for (const i of bestPath.path) moveCell(i, bestPath.from, bestPath.to);
            stats.rebalanceMoves += bestPath.path.length;
            applied = true;
          }
        }
      }
    }
    if (!applied) break;
    if (objective() >= before) break; // safety: must strictly decrease
  }

  // ---- Pass 3: chain-flow rebalance (FL-009b) ----
  // Local strictly-improving moves cannot fix imbalances when the over- and under-populated
  // districts are not adjacent (population must flow THROUGH balanced intermediaries, which
  // local moves forbid: the intermediate hop has delta ~ 0). Treat it as flow on the district
  // adjacency graph: worst-surplus -> worst-deficit path, pairwise transfers along the chain.
  // Only fires above 0.9% max deviation, so already-converged states (CO) are byte-unchanged.
  const GATE_TARGET = 0.009 * ideal;
  const adjacentDistricts = () => {
    const adj = Array.from({ length: meta.seats + 1 }, () => new Set());
    for (let d = 1; d <= meta.seats; d++) {
      for (const i of cellsOf[d]) {
        for (const j of neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || [])) {
          if (inState[j] && district[j] >= 1 && district[j] !== d) adj[d].add(district[j]);
        }
      }
    }
    return adj;
  };
  const donorOkMinus = (d, removeSet) => {
    const donor = cellsOf[d];
    if (donor.size <= removeSet.size) return false;
    let start = -1;
    for (const i of donor) if (!removeSet.has(i)) { if (start === -1 || i < start) start = i; }
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const i = stack.pop();
      for (const j of neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || [])) {
        if (donor.has(j) && !removeSet.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
      }
    }
    return seen.size === donor.size - removeSet.size;
  };
  const roundMoves = []; // (cell, from, to) journal for round-level revert (pass 3 only)
  const moveCellLogged = (i, from, to) => { roundMoves.push([i, from, to]); moveCell(i, from, to); };

  // Transfer ~X pop from district A to adjacent district B as ONE atomic connected blob:
  // BFS-grow inside A from the B-boundary (sorted, deterministic), accumulate until pop >= X
  // (overshoot < one cell), then a SINGLE donor-connectivity flood for the whole blob.
  // Cell-by-cell transfer was O(moves * |district| * flood) and hung on big states.
  const transferBlob = (A, B, X) => {
    if (X < 1) return 0;
    const starts = [];
    for (const i of cellsOf[A]) {
      for (const j of neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || [])) {
        if (inState[j] && district[j] === B) { starts.push(i); break; }
      }
    }
    if (!starts.length) return 0;
    starts.sort((a, b) => a - b);
    // Halving retry: a big bite can fragment the donor; smaller bites usually don't.
    for (let xTry = X; xTry >= 1; xTry = Math.floor(xTry / 2)) {
      const seen = new Set(starts);
      const queue = [...starts];
      for (let qi = 0; qi < queue.length; qi++) {
        const i = queue[qi];
        const nbrs = neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || []).sort((a, b) => a - b);
        for (const j of nbrs) {
          if (cellsOf[A].has(j) && !seen.has(j)) { seen.add(j); queue.push(j); }
        }
        if (queue.length > cellsOf[A].size) break;
      }
      // Greedy-cut prefix: include next dequeued cell only while it moves the blob pop
      // CLOSER to xTry (overshoot bounded by half the deciding cell, like the traversal).
      const moved = new Set();
      let movedPop = 0;
      for (const i of queue) {
        if (movedPop > 0 && Math.abs(movedPop + pop[i] - xTry) > Math.abs(movedPop - xTry)) break;
        moved.add(i);
        movedPop += pop[i];
        if (movedPop >= xTry) break;
      }
      if (movedPop === 0) return 0; // nothing reachable with population
      if (donorOkMinus(A, moved)) {
        for (const i of moved) moveCellLogged(i, A, B);
        stats.rebalanceMoves += moved.size;
        return movedPop;
      }
      if (xTry === 1) {
        // FRAGMENTING FALLBACK (1-wide isthmus donors: FL Keys, Chesapeake shore — every
        // bite disconnects, so the connectivity veto deadlocks the pass). Take the bite,
        // then reattach the donor's orphans locally (keep max-pop component, donate the
        // rest to adjacent lowest-pop districts). Everything is journaled in roundMoves,
        // so the round-level worst-guard reverts the whole thing if it doesn't net-help.
        for (const i of moved) moveCellLogged(i, A, B);
        stats.rebalanceMoves += moved.size;
        const comps = componentsOf(cellsOf[A], rows, cols, bridgeMap);
        if (comps.length > 1) {
          let keepIdx = 0, keepPop = -1;
          for (let ci = 0; ci < comps.length; ci++) {
            const p = popOf(comps[ci]);
            if (p > keepPop || (p === keepPop && comps[ci].length > comps[keepIdx].length)) { keepIdx = ci; keepPop = p; }
          }
          for (let ci = 0; ci < comps.length; ci++) {
            if (ci === keepIdx) continue;
            const adjD = new Set();
            for (const i of comps[ci]) {
              for (const j of neighborsOf(i, rows, cols).concat(bridgeMap.get(i) || [])) {
                if (inState[j] && district[j] >= 1 && district[j] !== A) adjD.add(district[j]);
              }
            }
            const target = adjD.size ? [...adjD].sort((a, b) => dPop[a] - dPop[b] || a - b)[0] : B;
            for (const i of comps[ci]) moveCellLogged(i, A, target);
            stats.rebalanceMoves += comps[ci].length; // symmetric with revert's per-move decrement
          }
        }
        return movedPop;
      }
    }
    return 0;
  };

  for (let round = 0; round < 8 * meta.seats; round++) {
    let over = -1, under = -1;
    for (let d = 1; d <= meta.seats; d++) {
      if (over === -1 || dPop[d] - ideal > dPop[over] - ideal) over = d;
      if (under === -1 || ideal - dPop[d] > ideal - dPop[under]) under = d;
    }
    const worst = Math.max(dPop[over] - ideal, ideal - dPop[under]);
    if (worst <= GATE_TARGET) break;
    // Path attempts: one failed link (donor would fragment at every halving) must not kill
    // the pass — revert the attempt, ban that district-graph edge, route around it.
    const adj = adjacentDistricts();
    const bannedEdges = new Set();
    const X = Math.min(dPop[over] - ideal, ideal - dPop[under]);
    let progressed = false;
    for (let attempt = 0; attempt < 4 && !progressed; attempt++) {
      const parent = new Array(meta.seats + 1).fill(0);
      parent[over] = -1;
      const queue = [over];
      let found = false;
      for (let qi = 0; qi < queue.length && !found; qi++) {
        for (const nb of [...adj[queue[qi]]].sort((a, b) => a - b)) {
          if (parent[nb] || bannedEdges.has(queue[qi] + '-' + nb)) continue;
          parent[nb] = queue[qi];
          if (nb === under) { found = true; break; }
          queue.push(nb);
        }
      }
      if (!found) break;
      const chain = [];
      for (let d = under; d !== -1; d = parent[d]) chain.push(d);
      chain.reverse(); // over ... under
      roundMoves.length = 0; // per-attempt journal
      let failedAt = -1;
      for (let k = 0; k < chain.length - 1; k++) {
        if (transferBlob(chain[k], chain[k + 1], X) === 0) { failedAt = k; break; }
      }
      if (failedAt !== -1) {
        for (let m = roundMoves.length - 1; m >= 0; m--) {
          const [i, from, to] = roundMoves[m];
          moveCell(i, to, from);
          stats.rebalanceMoves--;
        }
        bannedEdges.add(chain[failedAt] + '-' + chain[failedAt + 1]);
        continue;
      }
      progressed = true;
    }
    if (!progressed) break;
    // Round-level guard with REVERT: if the round did not strictly improve the worst
    // deviation (e.g., a coarse cell over-corrected a tiny imbalance), undo it and stop —
    // never leave the map worse than the round found it. Kills over-correction ping-pong.
    let newOver = -1, newUnder = -1;
    for (let d = 1; d <= meta.seats; d++) {
      if (newOver === -1 || dPop[d] - ideal > dPop[newOver] - ideal) newOver = d;
      if (newUnder === -1 || ideal - dPop[d] > ideal - dPop[newUnder]) newUnder = d;
    }
    const newWorst = Math.max(dPop[newOver] - ideal, ideal - dPop[newUnder]);
    if (newWorst >= worst) {
      for (let m = roundMoves.length - 1; m >= 0; m--) {
        const [i, from, to] = roundMoves[m];
        moveCell(i, to, from);
        stats.rebalanceMoves--;
      }
      break;
    }
  }
  return stats;
}
