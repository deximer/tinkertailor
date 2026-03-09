/**
 * Mesh analysis library — pure geometry/math utilities for analyzing 3D
 * garment component OBJ files to detect compatibility between parts.
 *
 * Analyzes boundary edge loops (where meshes connect, like waistlines and
 * armholes) to determine whether components can be joined together.
 *
 * NO database dependencies — this is a standalone math library.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BoundaryLoop {
  vertices: Vec3[];
  centroid: Vec3;
}

export type LoopRole =
  | "waist"
  | "armhole_left"
  | "armhole_right"
  | "cap"
  | "hem"
  | "unknown";

export interface ClassifiedLoop extends BoundaryLoop {
  role: LoopRole;
}

/** ST = set-in, DS = drop-shoulder, OS = off-shoulder */
export type SleeveStyle = "ST" | "DS" | "OS";

export type ComponentRole = "bodice" | "skirt" | "sleeve";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of evenly-spaced sample points for normalized loops. */
const RESAMPLE_COUNT = 64;

/** Number of rotational phase offsets to try when comparing loops. */
const PHASE_OFFSETS = 8;

// ---------------------------------------------------------------------------
// 1. parseObjBoundaryLoops
// ---------------------------------------------------------------------------

/**
 * Parse Wavefront OBJ text to extract boundary (open-edge) loops.
 *
 * A boundary edge is one that belongs to exactly one face. Connected boundary
 * edges form closed loops representing where garment components meet (waistlines,
 * armholes, hems, sleeve caps, etc.).
 */
export function parseObjBoundaryLoops(objText: string): BoundaryLoop[] {
  if (!objText || objText.trim().length === 0) {
    return [];
  }

  // Step 1: Parse vertices (OBJ is 1-indexed)
  const vertices: Vec3[] = [];
  const lines = objText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("v ")) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 4) {
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          vertices.push({ x, y, z });
        }
      }
    }
  }

  if (vertices.length === 0) {
    return [];
  }

  // Step 2: Parse faces and build edge-to-face-count map
  // Edge key: "lowIdx-highIdx" using 1-based OBJ indices
  const edgeFaceCount = new Map<string, number>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("f ")) {
      const parts = trimmed.split(/\s+/);
      const faceVertexIndices: number[] = [];

      for (let i = 1; i < parts.length; i++) {
        // OBJ face vertex can be v, v/vt, v/vt/vn, or v//vn
        const vertexPart = parts[i].split("/")[0];
        const idx = parseInt(vertexPart, 10);
        if (!isNaN(idx) && idx >= 1 && idx <= vertices.length) {
          faceVertexIndices.push(idx);
        }
      }

      // Add edges for this face (consecutive vertex pairs + closing edge)
      for (let i = 0; i < faceVertexIndices.length; i++) {
        const a = faceVertexIndices[i];
        const b = faceVertexIndices[(i + 1) % faceVertexIndices.length];
        const edgeKey = makeEdgeKey(a, b);
        edgeFaceCount.set(edgeKey, (edgeFaceCount.get(edgeKey) ?? 0) + 1);
      }
    }
  }

  // Step 3: Identify boundary edges (face count === 1)
  const boundaryEdges: Array<[number, number]> = [];
  for (const [key, count] of edgeFaceCount) {
    if (count === 1) {
      const [a, b] = key.split("-").map(Number);
      boundaryEdges.push([a, b]);
    }
  }

  if (boundaryEdges.length === 0) {
    return [];
  }

  // Step 4: Build adjacency list from boundary edges
  const adjacency = new Map<number, Set<number>>();
  for (const [a, b] of boundaryEdges) {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }

  // Step 5: Walk adjacency to form closed loops
  const visited = new Set<number>();
  const loops: BoundaryLoop[] = [];

  for (const startVertex of adjacency.keys()) {
    if (visited.has(startVertex)) continue;

    const loopIndices: number[] = [];
    let current = startVertex;

    while (!visited.has(current)) {
      visited.add(current);
      loopIndices.push(current);

      const neighbors = adjacency.get(current);
      if (!neighbors) break;

      // Pick the first unvisited neighbor
      let next: number | null = null;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          next = neighbor;
          break;
        }
      }

      if (next === null) break;
      current = next;
    }

    // Skip degenerate loops (need at least 3 vertices to form a meaningful loop)
    if (loopIndices.length < 3) continue;

    // Convert 1-based OBJ indices to Vec3 positions
    const loopVertices: Vec3[] = loopIndices.map((idx) => vertices[idx - 1]);
    const centroid = computeCentroid(loopVertices);

    loops.push({ vertices: loopVertices, centroid });
  }

  return loops;
}

// ---------------------------------------------------------------------------
// 2. classifyLoops
// ---------------------------------------------------------------------------

/**
 * Classify each boundary loop by its semantic role based on geometry and the
 * component type it belongs to.
 */
export function classifyLoops(
  loops: BoundaryLoop[],
  role: ComponentRole,
): ClassifiedLoop[] {
  if (loops.length === 0) return [];

  switch (role) {
    case "bodice":
      return classifyBodiceLoops(loops);
    case "skirt":
      return classifySkirtLoops(loops);
    case "sleeve":
      return classifySleeveLoops(loops);
  }
}

function classifyBodiceLoops(loops: BoundaryLoop[]): ClassifiedLoop[] {
  // Sort by centroid Y ascending (lowest first)
  const sorted = [...loops].sort((a, b) => a.centroid.y - b.centroid.y);

  return sorted.map((loop, i): ClassifiedLoop => {
    if (i === 0) {
      // Lowest centroid Y = waist
      return { ...loop, role: "waist" };
    }

    if (sorted.length >= 3 && i >= sorted.length - 2) {
      // Two highest loops = armholes; distinguish left/right by X
      const topTwo = sorted.slice(sorted.length - 2);
      // Sort top two by centroid X: more negative = left
      const [leftLoop, rightLoop] = [...topTwo].sort(
        (a, b) => a.centroid.x - b.centroid.x,
      );

      if (loop === leftLoop) {
        return { ...loop, role: "armhole_left" };
      }
      if (loop === rightLoop) {
        return { ...loop, role: "armhole_right" };
      }
    }

    return { ...loop, role: "unknown" };
  });
}

function classifySkirtLoops(loops: BoundaryLoop[]): ClassifiedLoop[] {
  // Sort by centroid Y ascending
  const sorted = [...loops].sort((a, b) => a.centroid.y - b.centroid.y);

  return sorted.map((loop, i): ClassifiedLoop => {
    if (i === sorted.length - 1) {
      // Highest centroid Y = waist
      return { ...loop, role: "waist" };
    }
    if (i === 0) {
      // Lowest centroid Y = hem
      return { ...loop, role: "hem" };
    }
    return { ...loop, role: "unknown" };
  });
}

function classifySleeveLoops(loops: BoundaryLoop[]): ClassifiedLoop[] {
  // Largest loop by circumference = cap
  let maxCircumference = -1;
  let capIndex = 0;

  for (let i = 0; i < loops.length; i++) {
    const circ = computeCircumference(loops[i].vertices);
    if (circ > maxCircumference) {
      maxCircumference = circ;
      capIndex = i;
    }
  }

  return loops.map((loop, i): ClassifiedLoop => {
    if (i === capIndex) {
      return { ...loop, role: "cap" };
    }
    return { ...loop, role: "unknown" };
  });
}

// ---------------------------------------------------------------------------
// 3. normalizeLoop
// ---------------------------------------------------------------------------

/**
 * Normalize a boundary loop for shape comparison.
 *
 * Projects to XZ plane, resamples to 64 evenly-spaced points, centers at
 * origin, and scales to unit circumference.
 *
 * Returns a Float64Array of 128 numbers: [x0, z0, x1, z1, ...].
 */
export function normalizeLoop(loop: BoundaryLoop): Float64Array {
  const result = new Float64Array(RESAMPLE_COUNT * 2);

  if (loop.vertices.length < 2) {
    return result;
  }

  // Step 1: Project to XZ plane
  const projected: Array<[number, number]> = loop.vertices.map((v) => [
    v.x,
    v.z,
  ]);

  // Step 2: Compute cumulative arc lengths along the loop (closed)
  const arcLengths: number[] = [0];
  for (let i = 1; i <= projected.length; i++) {
    const prev = projected[i - 1];
    const curr = projected[i % projected.length];
    const dx = curr[0] - prev[0];
    const dz = curr[1] - prev[1];
    const segLen = Math.sqrt(dx * dx + dz * dz);
    arcLengths.push(arcLengths[i - 1] + segLen);
  }

  const totalLength = arcLengths[arcLengths.length - 1];

  if (totalLength === 0) {
    return result;
  }

  // Step 3: Resample to RESAMPLE_COUNT evenly-spaced points
  const resampled: Array<[number, number]> = [];
  for (let i = 0; i < RESAMPLE_COUNT; i++) {
    const targetArc = (i / RESAMPLE_COUNT) * totalLength;
    const point = interpolateAtArcLength(projected, arcLengths, targetArc);
    resampled.push(point);
  }

  // Step 4: Translate centroid to origin
  let meanX = 0;
  let meanZ = 0;
  for (const [x, z] of resampled) {
    meanX += x;
    meanZ += z;
  }
  meanX /= RESAMPLE_COUNT;
  meanZ /= RESAMPLE_COUNT;

  for (let i = 0; i < resampled.length; i++) {
    resampled[i] = [resampled[i][0] - meanX, resampled[i][1] - meanZ];
  }

  // Step 5: Scale so total circumference = 1
  let resampledCirc = 0;
  for (let i = 0; i < RESAMPLE_COUNT; i++) {
    const curr = resampled[i];
    const next = resampled[(i + 1) % RESAMPLE_COUNT];
    const dx = next[0] - curr[0];
    const dz = next[1] - curr[1];
    resampledCirc += Math.sqrt(dx * dx + dz * dz);
  }

  const scale = resampledCirc > 0 ? 1 / resampledCirc : 1;

  // Step 6: Write to output array
  for (let i = 0; i < RESAMPLE_COUNT; i++) {
    result[i * 2] = resampled[i][0] * scale;
    result[i * 2 + 1] = resampled[i][1] * scale;
  }

  return result;
}

// ---------------------------------------------------------------------------
// 4. computeSimilarity
// ---------------------------------------------------------------------------

/**
 * Compare two normalized loops using rotational-invariant RMS matching.
 *
 * Tries multiple rotational phase offsets and returns the best similarity
 * score: 1.0 for identical shapes, approaching 0.0 for very different shapes.
 */
export function computeSimilarity(a: Float64Array, b: Float64Array): number {
  if (a.length !== RESAMPLE_COUNT * 2 || b.length !== RESAMPLE_COUNT * 2) {
    return 0;
  }

  const stepSize = RESAMPLE_COUNT / PHASE_OFFSETS; // 64 / 8 = 8 points
  let minRMS = Infinity;

  for (let phase = 0; phase < PHASE_OFFSETS; phase++) {
    const offset = phase * stepSize;
    let sumSqDist = 0;

    for (let i = 0; i < RESAMPLE_COUNT; i++) {
      const ai = i;
      const bi = (i + offset) % RESAMPLE_COUNT;

      const ax = a[ai * 2];
      const az = a[ai * 2 + 1];
      const bx = b[bi * 2];
      const bz = b[bi * 2 + 1];

      const dx = ax - bx;
      const dz = az - bz;
      sumSqDist += dx * dx + dz * dz;
    }

    const rms = Math.sqrt(sumSqDist / RESAMPLE_COUNT);
    if (rms < minRMS) {
      minRMS = rms;
    }
  }

  // Convert to similarity: 1.0 for identical, approaching 0 for very different
  return 1 / (1 + minRMS);
}

// ---------------------------------------------------------------------------
// 5. classifySleeveStyle
// ---------------------------------------------------------------------------

/**
 * Infer sleeve attachment style from armhole geometry relative to the bodice
 * bounding box.
 *
 * - OS (off-shoulder): armhole spans > 35% of bodice width
 * - DS (drop-shoulder): armhole centroid sits in the lower half of the bodice
 * - ST (set-in): default — high centroid, normal width
 */
export function classifySleeveStyle(
  armholeLoop: ClassifiedLoop,
  bodiceBBox: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  },
): SleeveStyle {
  if (armholeLoop.vertices.length === 0) {
    return "ST";
  }

  // Compute armhole X-extent
  let armMinX = Infinity;
  let armMaxX = -Infinity;
  for (const v of armholeLoop.vertices) {
    if (v.x < armMinX) armMinX = v.x;
    if (v.x > armMaxX) armMaxX = v.x;
  }
  const armholeXExtent = armMaxX - armMinX;

  // Compute bodice width
  const bodiceWidth = bodiceBBox.maxX - bodiceBBox.minX;
  if (bodiceWidth <= 0) {
    return "ST";
  }

  const relativeWidth = armholeXExtent / bodiceWidth;

  // Compute relative Y position of armhole centroid within bodice
  const bodiceHeight = bodiceBBox.maxY - bodiceBBox.minY;
  const relativeY =
    bodiceHeight > 0
      ? (armholeLoop.centroid.y - bodiceBBox.minY) / bodiceHeight
      : 0.5;

  // Classification
  if (relativeWidth > 0.35) {
    return "OS";
  }
  if (relativeY < 0.5) {
    return "DS";
  }
  return "ST";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Create a canonical edge key (sorted low→high) from two 1-based vertex indices. */
function makeEdgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Compute the centroid (average position) of a vertex array. */
function computeCentroid(vertices: Vec3[]): Vec3 {
  if (vertices.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const v of vertices) {
    sx += v.x;
    sy += v.y;
    sz += v.z;
  }

  const n = vertices.length;
  return { x: sx / n, y: sy / n, z: sz / n };
}

/** Compute the total circumference (perimeter) of a closed vertex loop. */
function computeCircumference(vertices: Vec3[]): number {
  if (vertices.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < vertices.length; i++) {
    const curr = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const dz = next.z - curr.z;
    total += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  return total;
}

/**
 * Interpolate a 2D point along a polyline at a given cumulative arc length.
 *
 * @param points - The XZ-projected polyline vertices (forms a closed loop)
 * @param arcLengths - Cumulative arc lengths including the closing segment
 * @param targetArc - The arc length to interpolate at
 */
function interpolateAtArcLength(
  points: Array<[number, number]>,
  arcLengths: number[],
  targetArc: number,
): [number, number] {
  // Find the segment containing the target arc length
  for (let i = 1; i < arcLengths.length; i++) {
    if (arcLengths[i] >= targetArc) {
      const segStart = arcLengths[i - 1];
      const segEnd = arcLengths[i];
      const segLength = segEnd - segStart;

      const t = segLength > 0 ? (targetArc - segStart) / segLength : 0;

      const p0 = points[i - 1];
      const p1 = points[i % points.length];

      return [p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1])];
    }
  }

  // Fallback: return the last point
  const last = points[points.length - 1];
  return [last[0], last[1]];
}
