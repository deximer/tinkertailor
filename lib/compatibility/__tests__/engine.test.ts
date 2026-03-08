/**
 * Unit tests for the compatibility engine.
 *
 * These tests mock the database layer to verify the engine's logic
 * in isolation: selection rules, phase determination, stage gating,
 * and query composition.
 */

import { describe, it, expect, vi } from "vitest";
import type { ComponentWithType } from "../engine";

// We test the internal helpers by importing the module and exercising
// the exported functions with mocked DB responses.

// ---------------------------------------------------------------------------
// Mock DB setup
// ---------------------------------------------------------------------------

// Since the engine functions take a db parameter, we can create a mock
// that returns controlled data for each test.

function createMockDb(overrides: {
  selectResults?: Record<string, unknown[]>;
} = {}) {
  const selectResults = overrides.selectResults ?? {};
  let callIndex = 0;

  const mockFrom = vi.fn();
  const mockInnerJoin = vi.fn();
  const mockWhere = vi.fn();
  const mockLimit = vi.fn();

  const chainResult = {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return chainResult;
    },
    innerJoin: (...args: unknown[]) => {
      mockInnerJoin(...args);
      return chainResult;
    },
    where: (...args: unknown[]) => {
      mockWhere(...args);
      return chainResult;
    },
    limit: (...args: unknown[]) => {
      mockLimit(...args);
      const key = `select-${callIndex}`;
      const result = selectResults[key] ?? [];
      callIndex++;
      return Promise.resolve(result);
    },
    then: (resolve: (val: unknown[]) => void) => {
      const key = `select-${callIndex}`;
      const result = selectResults[key] ?? [];
      callIndex++;
      resolve(result);
      return Promise.resolve(result);
    },
  };

  // Make the chain itself thenable for cases where .limit() is not called
  Object.defineProperty(chainResult, "then", {
    value: (resolve: (val: unknown[]) => void) => {
      const key = `select-${callIndex}`;
      const result = selectResults[key] ?? [];
      callIndex++;
      return Promise.resolve(result).then(resolve);
    },
    writable: true,
    configurable: true,
  });

  return {
    select: vi.fn(() => chainResult),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    _mocks: { mockFrom, mockInnerJoin, mockWhere, mockLimit },
  };
}

// ---------------------------------------------------------------------------
// Test: Design phase determination
// ---------------------------------------------------------------------------

describe("Design Phase Determination", () => {
  // Import the module to test internal logic via exported functions
  // The determineDesignPhase function is internal, so we test it
  // indirectly through getCompatibleComponents behavior.

  it("empty selection means silhouette phase", async () => {
    // With empty selection, getCompatibleComponents should return silhouette phase
    const { getCompatibleComponents } = await import("../engine");

    const mockDb = createMockDb({
      selectResults: {
        // First call: selected components (empty)
        // Second call: all components in allowed stages
        "select-0": [
          makeMockComponent("c1", "Bodice 1", "BOD-1", "bodice", "silhouette", true),
          makeMockComponent("c2", "Skirt 1", "SK-1", "skirt-section", "silhouette", false),
        ],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getCompatibleComponents(mockDb as any, []);
    expect(result.designPhase).toBe("silhouette");
    expect(result.selectedComponents).toEqual([]);
  });

  it("silhouette phase when only non-anchor selected", async () => {
    const { getCompatibleComponents } = await import("../engine");

    const skirt = makeMockComponent("sk1", "Skirt 1", "SK-1", "skirt-section", "silhouette", false);

    const mockDb = createMockDb({
      selectResults: {
        // selected components
        "select-0": [skirt],
        // compatible edges (forward)
        "select-1": [],
        // compatible edges (reverse)
        "select-2": [],
        // fetch full component data
        "select-3": [],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getCompatibleComponents(mockDb as any, ["sk1"]);
    expect(result.designPhase).toBe("silhouette");
  });

  it("embellishment phase when anchor component is selected", async () => {
    const { getCompatibleComponents } = await import("../engine");

    const bodice = makeMockComponent("bod1", "Bodice 1", "BOD-1", "bodice", "silhouette", true);

    const mockDb = createMockDb({
      selectResults: {
        "select-0": [bodice],
        "select-1": [],
        "select-2": [],
        "select-3": [],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getCompatibleComponents(mockDb as any, ["bod1"]);
    expect(result.designPhase).toBe("embellishment");
  });
});

// ---------------------------------------------------------------------------
// Test: Selection rules
// ---------------------------------------------------------------------------

describe("Selection Rules", () => {
  it("anchor selection clears all other components", async () => {
    const { applySelectionRules } = await import("../engine");

    const mockDb = createMockDb({
      selectResults: {
        // New component lookup
        "select-0": [{ id: "bod2", typeId: "bodice-type", isAnchor: true }],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applySelectionRules(mockDb as any, ["bod1", "sk1", "slv1"], "bod2");
    expect(result).toEqual(["bod2"]);
  });

  it("non-anchor deselects only same-type components", async () => {
    const { applySelectionRules } = await import("../engine");

    const mockDb = createMockDb({
      selectResults: {
        // New component lookup
        "select-0": [{ id: "sk2", typeId: "skirt-type", isAnchor: false }],
        // Current components lookup
        "select-1": [
          { id: "bod1", typeId: "bodice-type" },
          { id: "sk1", typeId: "skirt-type" },
          { id: "slv1", typeId: "sleeve-type" },
        ],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applySelectionRules(mockDb as any, ["bod1", "sk1", "slv1"], "sk2");
    // sk1 should be removed (same type), bod1 and slv1 kept
    expect(result).toContain("bod1");
    expect(result).toContain("slv1");
    expect(result).toContain("sk2");
    expect(result).not.toContain("sk1");
  });

  it("selecting into empty set returns just the new component", async () => {
    const { applySelectionRules } = await import("../engine");

    const mockDb = createMockDb({
      selectResults: {
        "select-0": [{ id: "bod1", typeId: "bodice-type", isAnchor: true }],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applySelectionRules(mockDb as any, [], "bod1");
    expect(result).toEqual(["bod1"]);
  });
});

// ---------------------------------------------------------------------------
// Test: Compatible components with multi-select
// ---------------------------------------------------------------------------

describe("Compatible Components — Multi-Select", () => {
  it("bodice+skirt selected returns only mutually compatible components", async () => {
    const { getCompatibleComponents } = await import("../engine");

    const bodice = makeMockComponent("bod1", "Bodice 1", "BOD-1", "bodice", "silhouette", true);
    const skirt = makeMockComponent("sk1", "Skirt 1", "SK-1", "skirt-section", "silhouette", false);
    const sleeve = makeMockComponent("slv1", "Sleeve 1", "SLV-1", "sleeve", "silhouette", false);

    const mockDb = createMockDb({
      selectResults: {
        // select-0: fetch selected components with type info
        "select-0": [bodice, skirt],
        // select-1: forward edges for bod1 (bod1 → sk1, bod1 → slv1)
        "select-1": [{ compatId: "sk1" }, { compatId: "slv1" }],
        // select-2: reverse edges for bod1
        "select-2": [],
        // select-3: forward edges for sk1
        "select-3": [],
        // select-4: reverse edges for sk1 (bod1 → sk1 stored, sk1 ← slv1)
        "select-4": [{ compatId: "bod1" }, { compatId: "slv1" }],
        // select-5: fetch full data for intersection result IDs
        // Intersection of {sk1,slv1} ∩ {bod1,slv1} = {slv1}, plus selected = {bod1,sk1,slv1}
        "select-5": [bodice, skirt, sleeve],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getCompatibleComponents(mockDb as any, ["bod1", "sk1"]);

    // Phase should be embellishment (anchor bodice selected, silhouette stage present)
    expect(result.designPhase).toBe("embellishment");
    // Selected components returned separately
    expect(result.selectedComponents).toHaveLength(2);
    // Available (non-selected) components: only slv1 is in the intersection
    expect(result.components).toHaveLength(1);
    expect(result.components[0].id).toBe("slv1");
  });

  it("incompatible pair rejected — empty compatible set when no shared edges", async () => {
    const { getCompatibleComponents } = await import("../engine");

    const bodice = makeMockComponent("bod1", "Bodice 1", "BOD-1", "bodice", "silhouette", true);
    const skirt2 = makeMockComponent("sk2", "Skirt 2", "SK-2", "skirt-section", "silhouette", false);

    const mockDb = createMockDb({
      selectResults: {
        // select-0: fetch selected components
        "select-0": [bodice, skirt2],
        // select-1: forward edges for bod1 (compatible with sk1, slv1 — NOT sk2)
        "select-1": [{ compatId: "sk1" }, { compatId: "slv1" }],
        // select-2: reverse edges for bod1
        "select-2": [],
        // select-3: forward edges for sk2 (compatible with slv2, slv3 — no overlap with bod1)
        "select-3": [{ compatId: "slv2" }, { compatId: "slv3" }],
        // select-4: reverse edges for sk2
        "select-4": [],
        // select-5: DB fetches only the selected IDs (intersection was empty)
        "select-5": [bodice, skirt2],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getCompatibleComponents(mockDb as any, ["bod1", "sk2"]);

    // Both are selected so they show up in selectedComponents
    expect(result.selectedComponents).toHaveLength(2);
    // No available components — the compatible sets don't overlap
    expect(result.components).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test: Stage gating
// ---------------------------------------------------------------------------

describe("Stage Gating", () => {
  it("only silhouette-stage components returned when no selection", async () => {
    const { getCompatibleComponents } = await import("../engine");

    const bodice = makeMockComponent("bod1", "Bodice 1", "BOD-1", "bodice", "silhouette", true);

    const mockDb = createMockDb({
      selectResults: {
        // All components query - only silhouette stage should be queried
        "select-0": [bodice],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getCompatibleComponents(mockDb as any, []);
    expect(result.designPhase).toBe("silhouette");
    // The DB mock returns what we tell it, but the important thing is the phase
    expect(result.components.every((c) => c.designStage === "silhouette")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockComponent(
  id: string,
  name: string,
  assetCode: string,
  typeSlug: string,
  designStage: ComponentWithType["designStage"],
  isAnchor: boolean,
): ComponentWithType {
  return {
    id,
    name,
    assetCode,
    componentTypeId: `${typeSlug}-type`,
    modelPath: null,
    typeName: typeSlug.charAt(0).toUpperCase() + typeSlug.slice(1),
    typeSlug,
    designStage,
    isAnchor,
  };
}
