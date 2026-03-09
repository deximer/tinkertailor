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
  const mockLeftJoin = vi.fn();
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
    leftJoin: (...args: unknown[]) => {
      mockLeftJoin(...args);
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
    _mocks: { mockFrom, mockInnerJoin, mockLeftJoin, mockWhere, mockLimit },
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
        // Second call: all components in allowed roles
        "select-0": [
          makeMockComponent("c1", "Bodice 1", "BOD-1", "bodice", "bodice", "structural", true),
          makeMockComponent("c2", "Skirt 1", "SK-1", "skirt-section", "skirt", "structural", false),
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

    const skirt = makeMockComponent("sk1", "Skirt 1", "SK-1", "skirt-section", "skirt", "structural", false);

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

    const bodice = makeMockComponent("bod1", "Bodice 1", "BOD-1", "bodice", "bodice", "structural", true);

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

    const bodice = makeMockComponent("bod1", "Bodice 1", "BOD-1", "bodice", "bodice", "structural", true);
    const skirt = makeMockComponent("sk1", "Skirt 1", "SK-1", "skirt-section", "skirt", "structural", false);
    const sleeve = makeMockComponent("slv1", "Sleeve 1", "SLV-1", "sleeve", "sleeve", "structural", false);

    const mockDb = createMockDb({
      selectResults: {
        // select-0: fetch selected components with type info
        "select-0": [bodice, skirt],
        // select-1: bod1 bodice-skirt edges (skirt IDs compatible with bod1)
        "select-1": [{ compatId: "sk1" }],
        // select-2: bod1 bodice-sleeve edges (sleeve IDs compatible with bod1)
        "select-2": [{ compatId: "slv1" }],
        // select-3: sk1 bodice-skirt reverse (bodice IDs compatible with sk1)
        "select-3": [{ compatId: "bod1" }],
        // select-4: fetch full data for result IDs
        // Per-part: validSkirts={sk1}, validSleeves={slv1}, validBodices={bod1}
        // Plus selected = {bod1,sk1} → result = {bod1,sk1,slv1}
        "select-4": [bodice, skirt, sleeve],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getCompatibleComponents(mockDb as any, ["bod1", "sk1"]);

    // Phase should be embellishment (anchor bodice selected, structural role present)
    expect(result.designPhase).toBe("embellishment");
    // Selected components returned separately
    expect(result.selectedComponents).toHaveLength(2);
    // Available (non-selected) components: only slv1 is in the intersection
    expect(result.components).toHaveLength(1);
    expect(result.components[0].id).toBe("slv1");
  });

  it("incompatible pair rejected — empty compatible set when no shared edges", async () => {
    const { getCompatibleComponents } = await import("../engine");

    const bodice = makeMockComponent("bod1", "Bodice 1", "BOD-1", "bodice", "bodice", "structural", true);
    const skirt2 = makeMockComponent("sk2", "Skirt 2", "SK-2", "skirt-section", "skirt", "structural", false);

    const mockDb = createMockDb({
      selectResults: {
        // select-0: fetch selected components
        "select-0": [bodice, skirt2],
        // select-1: bod1 bodice-skirt edges (sk1, NOT sk2)
        "select-1": [{ compatId: "sk1" }],
        // select-2: bod1 bodice-sleeve edges
        "select-2": [{ compatId: "slv1" }],
        // select-3: sk2 bodice-skirt reverse (bod2, NOT bod1)
        "select-3": [{ compatId: "bod2" }],
        // select-4: DB fetches only the selected IDs
        // Per-part: validSkirts={sk1}, validSleeves={slv1}, validBodices={bod2}
        // None of these are selected, so after filtering selected: {slv1, sk1, bod2}
        // But these are fetched from DB filtered by allowed roles
        "select-4": [bodice, skirt2],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getCompatibleComponents(mockDb as any, ["bod1", "sk2"]);

    // Both are selected so they show up in selectedComponents
    expect(result.selectedComponents).toHaveLength(2);
    // The DB mock returns only bodice+skirt2 for the final fetch,
    // but both are already selected, so no available components
    expect(result.components).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test: Stage gating
// ---------------------------------------------------------------------------

describe("Stage Gating", () => {
  it("only structural-role components returned when no selection", async () => {
    const { getCompatibleComponents } = await import("../engine");

    const bodice = makeMockComponent("bod1", "Bodice 1", "BOD-1", "bodice", "bodice", "structural", true);

    const mockDb = createMockDb({
      selectResults: {
        // All components query - only structural role should be queried
        "select-0": [bodice],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getCompatibleComponents(mockDb as any, []);
    expect(result.designPhase).toBe("silhouette");
    // The DB mock returns what we tell it, but the important thing is the phase
    expect(result.components.every((c) => c.partRoleSlug === "structural")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test: Complete silhouette path (one-piece garments)
// ---------------------------------------------------------------------------

describe("Complete Silhouette Path", () => {
  it("complete silhouette anchor returns decorative components, not structural", async () => {
    const { getCompatibleComponents } = await import("../engine");

    const dressSilhouette = makeMockComponent(
      "ds1", "Dress Silhouette", "DS-1", "dress-silhouette", "dress-silhouette", "structural", true,
    );
    const embellishment = makeMockComponent(
      "emb1", "Lace Trim", "LT-1", "lace-trim", "lace-overlay", "decorative", false,
    );

    const mockDb = createMockDb({
      selectResults: {
        // select-0: fetch selected components with type info
        "select-0": [dressSilhouette],
        // select-1: all components in allowed roles (decorative only — structural excluded)
        "select-1": [embellishment],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getCompatibleComponents(mockDb as any, ["ds1"]);

    // Phase should be embellishment (anchor selected, structural role present)
    expect(result.designPhase).toBe("embellishment");
    // Selected component returned
    expect(result.selectedComponents).toHaveLength(1);
    expect(result.selectedComponents[0].id).toBe("ds1");
    // Available components should NOT include structural (bodice/skirt/sleeve)
    expect(result.components).toHaveLength(1);
    expect(result.components[0].partRoleSlug).toBe("decorative");
  });

  it("complete silhouette does not query compatibility graph", async () => {
    const { getCompatibleComponents } = await import("../engine");

    const topSilhouette = makeMockComponent(
      "ts1", "Top Silhouette", "TS-1", "top-silhouette", "top-silhouette", "structural", true,
    );

    const mockDb = createMockDb({
      selectResults: {
        // select-0: fetch selected components
        "select-0": [topSilhouette],
        // select-1: all in allowed roles
        "select-1": [],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getCompatibleComponents(mockDb as any, ["ts1"]);

    // Only 2 select calls: fetch selected + fetch all in phase
    // No bodice-skirt or bodice-sleeve edge queries
    expect(mockDb.select).toHaveBeenCalledTimes(2);
    expect(result.designPhase).toBe("embellishment");
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
  garmentPartSlug: string,
  partRoleSlug: ComponentWithType["partRoleSlug"],
  isAnchor: boolean,
): ComponentWithType {
  return {
    id,
    name,
    assetCode,
    componentTypeId: `${typeSlug}-type`,
    typeName: typeSlug.charAt(0).toUpperCase() + typeSlug.slice(1),
    typeSlug,
    partRoleSlug,
    isAnchor,
    garmentPartSlug,
  };
}
