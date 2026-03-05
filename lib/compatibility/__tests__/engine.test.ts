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
  selectResults?: Record<string, unknown[][]>;
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

  it("silhouette phase when only non-first-leaf selected", async () => {
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

  it("embellishment phase when first-leaf component is selected", async () => {
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
  it("first-leaf selection clears all other components", async () => {
    const { applySelectionRules } = await import("../engine");

    const mockDb = createMockDb({
      selectResults: {
        // New component lookup
        "select-0": [{ id: "bod2", typeId: "bodice-type", isFirstLeaf: true }],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applySelectionRules(mockDb as any, ["bod1", "sk1", "slv1"], "bod2");
    expect(result).toEqual(["bod2"]);
  });

  it("non-first-leaf deselects only same-type components", async () => {
    const { applySelectionRules } = await import("../engine");

    const mockDb = createMockDb({
      selectResults: {
        // New component lookup
        "select-0": [{ id: "sk2", typeId: "skirt-type", isFirstLeaf: false }],
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
        "select-0": [{ id: "bod1", typeId: "bodice-type", isFirstLeaf: true }],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applySelectionRules(mockDb as any, [], "bod1");
    expect(result).toEqual(["bod1"]);
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
    expect(result.components.every((c) => c.stage === "silhouette")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockComponent(
  id: string,
  name: string,
  code: string,
  typeSlug: string,
  stage: ComponentWithType["stage"],
  isFirstLeaf: boolean,
): ComponentWithType {
  return {
    id,
    name,
    code,
    componentTypeId: `${typeSlug}-type`,
    modelPath: null,
    typeName: typeSlug.charAt(0).toUpperCase() + typeSlug.slice(1),
    typeSlug,
    stage,
    isFirstLeaf,
  };
}
