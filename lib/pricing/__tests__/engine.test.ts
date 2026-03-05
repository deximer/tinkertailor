/**
 * Unit tests for the pricing engine.
 *
 * These tests mock the database layer to verify the pricing calculation
 * logic in isolation: base price lookup, fabric markup summation,
 * shipping, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DB setup
// ---------------------------------------------------------------------------

/**
 * Create a mock DB that returns controlled data for sequential
 * select() chain calls. Each chain resolves via .then() (Drizzle's
 * awaitable pattern) returning results keyed by call index.
 */
function createMockDb(selectResults: Record<string, unknown[]> = {}) {
  let callIndex = 0;

  const chainResult = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (val: unknown[]) => void) => {
      const key = `select-${callIndex}`;
      const result = (selectResults[key] ?? []) as unknown[];
      callIndex++;
      return Promise.resolve(result).then(resolve);
    },
  };

  // Make then non-enumerable so it behaves like a thenable without
  // interfering with object spread or iteration.
  Object.defineProperty(chainResult, "then", {
    value: chainResult.then,
    writable: true,
    configurable: true,
    enumerable: false,
  });

  return {
    select: vi.fn(() => chainResult),
  };
}

// We mock the db module so the engine imports our controlled mock.
vi.mock("@/lib/db", () => {
  const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
  };
  return { db: mockDb, getDb: () => mockDb };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateOrderTotal", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("calculates basic pricing: base price + fabric markup + shipping", async () => {
    const mockDb = createMockDb({
      // select-0: product lookup
      "select-0": [
        { id: "prod-1", silhouetteTemplateId: "sil-1" },
      ],
      // select-1: silhouette base price
      "select-1": [{ basePrice: "49.99" }],
      // select-2: product components
      "select-2": [{ fabricSkinId: "fab-1" }],
      // select-3: fabric skin markup for fab-1
      "select-3": [{ priceMarkup: "12.50" }],
    });

    // Re-import with fresh module to pick up our mock
    vi.doMock("@/lib/db", () => ({ db: mockDb, getDb: () => mockDb }));
    const { calculateOrderTotal } = await import("../engine");

    const result = await calculateOrderTotal({ productId: "prod-1" });

    expect(result.subtotal).toBe("62.49");
    expect(result.shippingCost).toBe("9.95");
    expect(result.total).toBe("72.44");
  });

  it("sums markups from multiple components with different fabrics", async () => {
    const mockDb = createMockDb({
      // select-0: product lookup
      "select-0": [
        { id: "prod-1", silhouetteTemplateId: "sil-1" },
      ],
      // select-1: silhouette base price
      "select-1": [{ basePrice: "100.00" }],
      // select-2: product components (3 components, each with a fabric)
      "select-2": [
        { fabricSkinId: "fab-1" },
        { fabricSkinId: "fab-2" },
        { fabricSkinId: "fab-3" },
      ],
      // select-3: fabric skin markup for fab-1
      "select-3": [{ priceMarkup: "5.00" }],
      // select-4: fabric skin markup for fab-2
      "select-4": [{ priceMarkup: "10.00" }],
      // select-5: fabric skin markup for fab-3
      "select-5": [{ priceMarkup: "7.50" }],
    });

    vi.doMock("@/lib/db", () => ({ db: mockDb, getDb: () => mockDb }));
    const { calculateOrderTotal } = await import("../engine");

    const result = await calculateOrderTotal({ productId: "prod-1" });

    // subtotal = 100.00 + 5.00 + 10.00 + 7.50 = 122.50
    expect(result.subtotal).toBe("122.50");
    expect(result.shippingCost).toBe("9.95");
    // total = 122.50 + 9.95 = 132.45
    expect(result.total).toBe("132.45");
  });

  it("treats component with no fabric selected as 0 markup", async () => {
    const mockDb = createMockDb({
      // select-0: product lookup
      "select-0": [
        { id: "prod-1", silhouetteTemplateId: "sil-1" },
      ],
      // select-1: silhouette base price
      "select-1": [{ basePrice: "75.00" }],
      // select-2: product components — one with fabric, one without
      "select-2": [
        { fabricSkinId: "fab-1" },
        { fabricSkinId: null },
      ],
      // select-3: fabric skin markup for fab-1
      "select-3": [{ priceMarkup: "15.00" }],
      // No select-4 needed — the null fabricSkinId is skipped
    });

    vi.doMock("@/lib/db", () => ({ db: mockDb, getDb: () => mockDb }));
    const { calculateOrderTotal } = await import("../engine");

    const result = await calculateOrderTotal({ productId: "prod-1" });

    // subtotal = 75.00 + 15.00 + 0 = 90.00
    expect(result.subtotal).toBe("90.00");
    expect(result.shippingCost).toBe("9.95");
    expect(result.total).toBe("99.95");
  });

  it("throws an error when the product is not found", async () => {
    const mockDb = createMockDb({
      // select-0: product lookup returns empty
      "select-0": [],
    });

    vi.doMock("@/lib/db", () => ({ db: mockDb, getDb: () => mockDb }));
    const { calculateOrderTotal } = await import("../engine");

    await expect(
      calculateOrderTotal({ productId: "nonexistent" }),
    ).rejects.toThrow("Product not found: nonexistent");
  });

  it("throws an error when the product has no silhouette template", async () => {
    const mockDb = createMockDb({
      // select-0: product found but no silhouette template
      "select-0": [
        { id: "prod-1", silhouetteTemplateId: null },
      ],
    });

    vi.doMock("@/lib/db", () => ({ db: mockDb, getDb: () => mockDb }));
    const { calculateOrderTotal } = await import("../engine");

    await expect(
      calculateOrderTotal({ productId: "prod-1" }),
    ).rejects.toThrow("Product has no silhouette template assigned: prod-1");
  });
});

describe("FLAT_SHIPPING_RATE constant", () => {
  it("exports the expected flat shipping rate", async () => {
    const { FLAT_SHIPPING_RATE } = await import("../engine");
    expect(FLAT_SHIPPING_RATE).toBe("9.95");
  });
});
