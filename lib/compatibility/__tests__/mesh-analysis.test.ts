/**
 * Unit tests for the mesh-analysis library.
 *
 * Pure geometry/math — no DB mocks needed.
 */

import { describe, it, expect } from "vitest";
import {
  parseObjBoundaryLoops,
  classifyLoops,
  normalizeLoop,
  computeSimilarity,
  classifySleeveStyle,
} from "../mesh-analysis";
import type { BoundaryLoop, ClassifiedLoop } from "../mesh-analysis";

// ---------------------------------------------------------------------------
// Test OBJ fixtures
// ---------------------------------------------------------------------------

/** A single quad face — all 4 edges are boundary, forming one loop of 4 vertices. */
const SINGLE_QUAD_OBJ = `
v 0 0 0
v 1 0 0
v 1 0 1
v 0 0 1
f 1 2 3 4
`.trim();

/** A fully closed tetrahedron — every edge shared by 2 faces, no boundary loops. */
const CLOSED_TETRAHEDRON_OBJ = `
v 0 0 0
v 1 0 0
v 0.5 1 0
v 0.5 0.5 1
f 1 3 2
f 1 2 4
f 2 3 4
f 1 4 3
`.trim();

/**
 * Two quads sharing an edge (a 2-quad strip). The shared edge (2-3)
 * is used by 2 faces so it's interior. The remaining 6 edges are
 * boundary, forming one connected loop of 6 vertices.
 */
const TWO_QUAD_STRIP_OBJ = `
v 0 0 0
v 1 0 0
v 1 0 1
v 0 0 1
v 2 0 0
v 2 0 1
f 1 2 3 4
f 2 5 6 3
`.trim();

/** OBJ with v/vt/vn face format to test parser robustness. */
const OBJ_WITH_TEXCOORDS = `
v 0 0 0
v 1 0 0
v 1 0 1
v 0 0 1
vt 0 0
vt 1 0
vt 1 1
vt 0 1
vn 0 1 0
f 1/1/1 2/2/1 3/3/1 4/4/1
`.trim();

// ---------------------------------------------------------------------------
// Helper to build BoundaryLoop objects for classification tests
// ---------------------------------------------------------------------------

function makeLoop(vertices: Array<[number, number, number]>): BoundaryLoop {
  const verts = vertices.map(([x, y, z]) => ({ x, y, z }));
  const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
  const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;
  const cz = verts.reduce((s, v) => s + v.z, 0) / verts.length;
  return { vertices: verts, centroid: { x: cx, y: cy, z: cz } };
}

/** Generate a circular loop in the XZ plane at a given Y height and center. */
function makeCircularLoop(
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  n = 16,
): BoundaryLoop {
  const verts = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    verts.push({
      x: cx + radius * Math.cos(angle),
      y: cy,
      z: cz + radius * Math.sin(angle),
    });
  }
  return { vertices: verts, centroid: { x: cx, y: cy, z: cz } };
}

// ---------------------------------------------------------------------------
// 1. parseObjBoundaryLoops
// ---------------------------------------------------------------------------

describe("parseObjBoundaryLoops", () => {
  it("returns empty array for empty input", () => {
    expect(parseObjBoundaryLoops("")).toEqual([]);
    expect(parseObjBoundaryLoops("   ")).toEqual([]);
  });

  it("returns empty array for vertices-only input (no faces)", () => {
    const obj = "v 0 0 0\nv 1 0 0\nv 0 1 0";
    expect(parseObjBoundaryLoops(obj)).toEqual([]);
  });

  it("returns empty array for a closed solid (no boundary edges)", () => {
    const loops = parseObjBoundaryLoops(CLOSED_TETRAHEDRON_OBJ);
    expect(loops).toEqual([]);
  });

  it("extracts one boundary loop from a single quad", () => {
    const loops = parseObjBoundaryLoops(SINGLE_QUAD_OBJ);
    expect(loops.length).toBe(1);
    expect(loops[0].vertices.length).toBe(4);
  });

  it("computes correct centroid for a single quad", () => {
    const loops = parseObjBoundaryLoops(SINGLE_QUAD_OBJ);
    expect(loops[0].centroid.x).toBeCloseTo(0.5);
    expect(loops[0].centroid.y).toBeCloseTo(0);
    expect(loops[0].centroid.z).toBeCloseTo(0.5);
  });

  it("extracts one loop from a two-quad strip (shared edge is interior)", () => {
    const loops = parseObjBoundaryLoops(TWO_QUAD_STRIP_OBJ);
    expect(loops.length).toBe(1);
    // 6 boundary vertices (verts 1,4,3,6,5,2 form the outer ring)
    expect(loops[0].vertices.length).toBe(6);
  });

  it("handles v/vt/vn face format", () => {
    const loops = parseObjBoundaryLoops(OBJ_WITH_TEXCOORDS);
    expect(loops.length).toBe(1);
    expect(loops[0].vertices.length).toBe(4);
  });

  it("ignores comments and blank lines", () => {
    const obj = `
# This is a comment
v 0 0 0
v 1 0 0
v 1 0 1

v 0 0 1
# Another comment
f 1 2 3 4
    `.trim();
    const loops = parseObjBoundaryLoops(obj);
    expect(loops.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2. classifyLoops
// ---------------------------------------------------------------------------

describe("classifyLoops", () => {
  it("returns empty array for empty input", () => {
    expect(classifyLoops([], "bodice")).toEqual([]);
  });

  describe("bodice", () => {
    it("assigns waist to lowest-Y loop and armholes to the two highest", () => {
      const waist = makeLoop([
        [-1, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [-1, 0, 1],
      ]);
      const armholeLeft = makeLoop([
        [-2, 5, 0],
        [-1, 5, 0],
        [-1, 5, 1],
        [-2, 5, 1],
      ]);
      const armholeRight = makeLoop([
        [1, 5, 0],
        [2, 5, 0],
        [2, 5, 1],
        [1, 5, 1],
      ]);

      const classified = classifyLoops(
        [waist, armholeLeft, armholeRight],
        "bodice",
      );

      expect(classified.length).toBe(3);
      const roles = classified.map((c) => c.role).sort();
      expect(roles).toEqual(["armhole_left", "armhole_right", "waist"]);

      // Waist is lowest Y
      const w = classified.find((c) => c.role === "waist")!;
      expect(w.centroid.y).toBe(0);

      // Left armhole has more negative X
      const al = classified.find((c) => c.role === "armhole_left")!;
      const ar = classified.find((c) => c.role === "armhole_right")!;
      expect(al.centroid.x).toBeLessThan(ar.centroid.x);
    });

    it("assigns waist and unknown when only 2 loops", () => {
      const low = makeLoop([
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
      ]);
      const high = makeLoop([
        [0, 5, 0],
        [1, 5, 0],
        [1, 5, 1],
      ]);

      const classified = classifyLoops([low, high], "bodice");
      expect(classified.find((c) => c.role === "waist")).toBeTruthy();
      expect(classified.find((c) => c.role === "unknown")).toBeTruthy();
    });
  });

  describe("skirt", () => {
    it("assigns waist to highest-Y loop and hem to lowest-Y loop", () => {
      const hem = makeLoop([
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
      ]);
      const waist = makeLoop([
        [0, 3, 0],
        [1, 3, 0],
        [1, 3, 1],
      ]);

      const classified = classifyLoops([hem, waist], "skirt");
      expect(classified.find((c) => c.role === "waist")!.centroid.y).toBe(3);
      expect(classified.find((c) => c.role === "hem")!.centroid.y).toBe(0);
    });
  });

  describe("sleeve", () => {
    it("assigns cap to the largest-circumference loop", () => {
      // Small wrist loop
      const wrist = makeCircularLoop(0, 0, 0, 0.5, 8);
      // Large cap loop
      const cap = makeCircularLoop(0, 3, 0, 2.0, 16);

      const classified = classifyLoops([wrist, cap], "sleeve");
      expect(classified.find((c) => c.role === "cap")).toBeTruthy();
      // Cap should be the larger loop
      const capLoop = classified.find((c) => c.role === "cap")!;
      expect(capLoop.centroid.y).toBe(3);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. normalizeLoop
// ---------------------------------------------------------------------------

describe("normalizeLoop", () => {
  it("returns Float64Array of length 128 (64 points x 2 coords)", () => {
    const loop = makeCircularLoop(5, 0, 5, 3, 32);
    const normalized = normalizeLoop(loop);
    expect(normalized).toBeInstanceOf(Float64Array);
    expect(normalized.length).toBe(128);
  });

  it("returns zeroed array for degenerate loop (< 2 vertices)", () => {
    const loop: BoundaryLoop = {
      vertices: [{ x: 0, y: 0, z: 0 }],
      centroid: { x: 0, y: 0, z: 0 },
    };
    const normalized = normalizeLoop(loop);
    expect(normalized.every((v) => v === 0)).toBe(true);
  });

  it("produces identical arrays for identical loops at different positions", () => {
    const loopA = makeCircularLoop(0, 0, 0, 2, 32);
    const loopB = makeCircularLoop(10, 5, 10, 2, 32);

    const normA = normalizeLoop(loopA);
    const normB = normalizeLoop(loopB);

    for (let i = 0; i < normA.length; i++) {
      expect(normA[i]).toBeCloseTo(normB[i], 10);
    }
  });

  it("produces identical arrays for identical loops at different scales", () => {
    const loopSmall = makeCircularLoop(0, 0, 0, 1, 32);
    const loopBig = makeCircularLoop(0, 0, 0, 5, 32);

    const normSmall = normalizeLoop(loopSmall);
    const normBig = normalizeLoop(loopBig);

    for (let i = 0; i < normSmall.length; i++) {
      expect(normSmall[i]).toBeCloseTo(normBig[i], 10);
    }
  });

  it("centers the normalized loop near the origin", () => {
    const loop = makeCircularLoop(100, 0, 200, 5, 32);
    const normalized = normalizeLoop(loop);

    let meanX = 0;
    let meanZ = 0;
    for (let i = 0; i < 64; i++) {
      meanX += normalized[i * 2];
      meanZ += normalized[i * 2 + 1];
    }
    meanX /= 64;
    meanZ /= 64;

    expect(meanX).toBeCloseTo(0, 10);
    expect(meanZ).toBeCloseTo(0, 10);
  });
});

// ---------------------------------------------------------------------------
// 4. computeSimilarity
// ---------------------------------------------------------------------------

describe("computeSimilarity", () => {
  it("returns 1.0 for identical normalized loops", () => {
    const loop = makeCircularLoop(0, 0, 0, 3, 32);
    const normalized = normalizeLoop(loop);
    const sim = computeSimilarity(normalized, normalized);
    expect(sim).toBeCloseTo(1.0, 10);
  });

  it("returns 0 for wrong-sized arrays", () => {
    const valid = new Float64Array(128);
    const short = new Float64Array(64);
    expect(computeSimilarity(valid, short)).toBe(0);
    expect(computeSimilarity(short, valid)).toBe(0);
  });

  it("returns high similarity for same shape at different positions", () => {
    const loopA = makeCircularLoop(0, 0, 0, 2, 32);
    const loopB = makeCircularLoop(50, 0, 50, 2, 32);
    const normA = normalizeLoop(loopA);
    const normB = normalizeLoop(loopB);
    expect(computeSimilarity(normA, normB)).toBeGreaterThan(0.95);
  });

  it("returns high similarity for same shape at different scales", () => {
    const loopA = makeCircularLoop(0, 0, 0, 1, 32);
    const loopB = makeCircularLoop(0, 0, 0, 10, 32);
    const normA = normalizeLoop(loopA);
    const normB = normalizeLoop(loopB);
    expect(computeSimilarity(normA, normB)).toBeGreaterThan(0.95);
  });

  it("returns lower similarity for different shapes", () => {
    // Circle
    const circle = makeCircularLoop(0, 0, 0, 2, 32);
    // Elongated rectangle (very different shape from a circle)
    const rect = makeLoop([
      [0, 0, 0],
      [10, 0, 0],
      [10, 0, 0.5],
      [0, 0, 0.5],
    ]);

    const normCircle = normalizeLoop(circle);
    const normRect = normalizeLoop(rect);
    const sim = computeSimilarity(normCircle, normRect);
    // Different shapes score meaningfully lower than 1.0 (identical)
    expect(sim).toBeLessThan(0.95);
  });
});

// ---------------------------------------------------------------------------
// 5. classifySleeveStyle
// ---------------------------------------------------------------------------

describe("classifySleeveStyle", () => {
  const bodiceBBox = { minX: -5, maxX: 5, minY: 0, maxY: 10 };

  it("returns ST for standard set-in armhole (narrow, high)", () => {
    // Narrow armhole in the upper half of the bodice
    const armhole: ClassifiedLoop = {
      ...makeCircularLoop(4, 8, 0, 1, 8),
      role: "armhole_right",
    };
    expect(classifySleeveStyle(armhole, bodiceBBox)).toBe("ST");
  });

  it("returns DS for drop-shoulder (narrow, low centroid)", () => {
    // Narrow armhole in the lower half of the bodice
    const armhole: ClassifiedLoop = {
      ...makeCircularLoop(4, 3, 0, 1, 8),
      role: "armhole_right",
    };
    expect(classifySleeveStyle(armhole, bodiceBBox)).toBe("DS");
  });

  it("returns OS for off-shoulder (wide armhole > 35% of bodice width)", () => {
    // Wide armhole spanning > 35% of the 10-unit bodice width
    // Needs armhole X-extent > 3.5 within bodice width of 10
    const armhole: ClassifiedLoop = {
      vertices: [
        { x: -1, y: 8, z: 0 },
        { x: 3, y: 8, z: 0 },
        { x: 3, y: 8, z: 1 },
        { x: -1, y: 8, z: 1 },
      ],
      centroid: { x: 1, y: 8, z: 0.5 },
      role: "armhole_right",
    };
    expect(classifySleeveStyle(armhole, bodiceBBox)).toBe("OS");
  });

  it("returns ST for empty vertices", () => {
    const armhole: ClassifiedLoop = {
      vertices: [],
      centroid: { x: 0, y: 0, z: 0 },
      role: "armhole_right",
    };
    expect(classifySleeveStyle(armhole, bodiceBBox)).toBe("ST");
  });

  it("returns ST for zero-width bodice", () => {
    const armhole: ClassifiedLoop = {
      ...makeCircularLoop(0, 5, 0, 1, 8),
      role: "armhole_right",
    };
    expect(classifySleeveStyle(armhole, { minX: 0, maxX: 0, minY: 0, maxY: 10 })).toBe("ST");
  });
});
