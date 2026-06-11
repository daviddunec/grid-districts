// Projection + geometry helpers. PIP runs entirely in lon/lat (CLAUDE.md rule 5).
import proj4 from 'proj4';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { PROJ_5070, CELL_M } from './constants.js';

proj4.defs('EPSG:5070', PROJ_5070); // proj4 ships no 5070 by name (CLAUDE.md rule 6)
const ALBERS = proj4('EPSG:4326', 'EPSG:5070');

export const toAlbers = (lon, lat) => ALBERS.forward([lon, lat]);
export const toLonLat = (x, y) => ALBERS.inverse([x, y]);

export function pointInState(lon, lat, stateGeom) {
  return booleanPointInPolygon([lon, lat], stateGeom);
}

/**
 * Edge-tracing dissolve: cells of one district -> GeoJSON (Multi)Polygon in lon/lat.
 * Directed boundary edges keep the district on the LEFT in the (x=col right, y=row down)
 * frame, so rings stitch deterministically. Vertex (vx,vy) = NW corner of cell (vy,vx).
 */
export function dissolveDistrict(cells, isSame, meta) {
  // cells: array of [row, col]; isSame(r,c) -> true if (r,c) belongs to this district
  const edges = new Map(); // "vx,vy" start vertex -> array of [endVx, endVy]
  const addEdge = (x1, y1, x2, y2) => {
    const k = x1 + ',' + y1;
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push([x2, y2]);
  };
  for (const [r, c] of cells) {
    if (!isSame(r - 1, c)) addEdge(c + 1, r, c, r);         // north side, westward
    if (!isSame(r + 1, c)) addEdge(c, r + 1, c + 1, r + 1); // south side, eastward
    if (!isSame(r, c - 1)) addEdge(c, r, c, r + 1);         // west side, southward
    if (!isSame(r, c + 1)) addEdge(c + 1, r + 1, c + 1, r); // east side, northward
  }
  // Stitch directed edges into closed rings (deterministic: lowest start key first,
  // and at multi-exit vertices take the lexicographically smallest unused end).
  const rings = [];
  const keys = [...edges.keys()].sort();
  for (const startKey of keys) {
    while (edges.get(startKey) && edges.get(startKey).length) {
      const ring = [];
      let key = startKey;
      for (;;) {
        const outs = edges.get(key);
        if (!outs || !outs.length) break;
        outs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const [nx, ny] = outs.shift();
        ring.push([nx, ny]);
        key = nx + ',' + ny;
        if (key === startKey) break;
      }
      if (ring.length >= 4) rings.push(ring);
    }
  }
  // Lattice vertices -> projected meters -> lon/lat; classify exterior vs hole by shoelace
  // sign in the projected (y-up) frame: interior-on-left construction makes exteriors and
  // holes come out with opposite orientation.
  const toLL = ([vx, vy]) => {
    const x = meta.originX + vx * CELL_M;
    const y = meta.originYTop - vy * CELL_M;
    const [lon, lat] = toLonLat(x, y);
    return [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
  };
  const shoelace = (ring) => {
    let s = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
      // projected frame: x right, y UP -> flip vy sign
      s += (x1 * -y2 - x2 * -y1);
    }
    return s / 2;
  };
  const outers = [], holes = [];
  for (const ring of rings) {
    const closed = [...ring, ring[0]];
    (shoelace(ring) > 0 ? outers : holes).push({ ll: closed.map(toLL), lattice: ring });
  }
  // Assign each hole to the outer ring whose lattice bbox contains it (sufficient on a grid).
  // One-pass bboxes hoisted out of the hole loop — Math.min(...spread) overflows the V8 stack
  // at ~130k ring vertices on big-state districts (code review B2).
  const outerBbox = outers.map((o) => {
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const [x, y] of o.lattice) {
      if (x < xmin) xmin = x; if (x > xmax) xmax = x;
      if (y < ymin) ymin = y; if (y > ymax) ymax = y;
    }
    return { xmin, xmax, ymin, ymax };
  });
  const polys = outers.map((o) => [o.ll]);
  for (const h of holes) {
    const [hx, hy] = h.lattice[0];
    let target = 0;
    for (let i = 0; i < outers.length; i++) {
      const b = outerBbox[i];
      if (hx >= b.xmin && hx <= b.xmax && hy >= b.ymin && hy <= b.ymax) { target = i; break; }
    }
    polys[target].push(h.ll);
  }
  return polys.length === 1
    ? { type: 'Polygon', coordinates: polys[0] }
    : { type: 'MultiPolygon', coordinates: polys };
}
