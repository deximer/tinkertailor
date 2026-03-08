import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fixtures: 3 silhouettes with different tag profiles
// ---------------------------------------------------------------------------

const SILHOUETTES = [
  { id: "sil-1", name: "Romantic Midi A-Line", patternId: "TT-PAT-SIL-001" },
  { id: "sil-2", name: "Minimal Sheath", patternId: "TT-PAT-SIL-002" },
  { id: "sil-3", name: "Dramatic Mermaid Gown", patternId: "TT-PAT-SIL-003" },
];

const TAG_ASSIGNMENTS = [
  // sil-1: a-line, midi, modern-romantic, wedding-guest
  { silhouetteId: "sil-1", tagSlug: "a-line", tagLabel: "A-Line", dimensionSlug: "core-silhouette", dimensionName: "Core Silhouette" },
  { silhouetteId: "sil-1", tagSlug: "midi", tagLabel: "Midi", dimensionSlug: "length", dimensionName: "Length" },
  { silhouetteId: "sil-1", tagSlug: "modern-romantic", tagLabel: "Modern Romantic", dimensionSlug: "aesthetic-mood", dimensionName: "Aesthetic Mood" },
  { silhouetteId: "sil-1", tagSlug: "wedding-guest", tagLabel: "Wedding Guest", dimensionSlug: "occasion", dimensionName: "Occasion" },
  // sil-2: sheath, midi, minimal, work
  { silhouetteId: "sil-2", tagSlug: "sheath", tagLabel: "Sheath", dimensionSlug: "core-silhouette", dimensionName: "Core Silhouette" },
  { silhouetteId: "sil-2", tagSlug: "midi", tagLabel: "Midi", dimensionSlug: "length", dimensionName: "Length" },
  { silhouetteId: "sil-2", tagSlug: "minimal", tagLabel: "Minimal", dimensionSlug: "aesthetic-mood", dimensionName: "Aesthetic Mood" },
  { silhouetteId: "sil-2", tagSlug: "work", tagLabel: "Work", dimensionSlug: "occasion", dimensionName: "Occasion" },
  // sil-3: mermaid, floor-length, dramatic, black-tie
  { silhouetteId: "sil-3", tagSlug: "mermaid", tagLabel: "Mermaid", dimensionSlug: "core-silhouette", dimensionName: "Core Silhouette" },
  { silhouetteId: "sil-3", tagSlug: "floor-length", tagLabel: "Floor Length", dimensionSlug: "length", dimensionName: "Length" },
  { silhouetteId: "sil-3", tagSlug: "dramatic", tagLabel: "Dramatic", dimensionSlug: "aesthetic-mood", dimensionName: "Aesthetic Mood" },
  { silhouetteId: "sil-3", tagSlug: "black-tie", tagLabel: "Black Tie", dimensionSlug: "occasion", dimensionName: "Occasion" },
];

const COMP_ASSIGNMENTS = [
  { silhouetteId: "sil-1", componentId: "comp-1", componentName: "A-Line Bodice", componentAssetCode: "BOD-001" },
  { silhouetteId: "sil-2", componentId: "comp-2", componentName: "Sheath Bodice", componentAssetCode: "BOD-002" },
];

// ---------------------------------------------------------------------------
// Mock DB — track call sequence to return correct data per query
// ---------------------------------------------------------------------------

let dbCallCount = 0;
let mockSilhouettes = SILHOUETTES;
let mockTags = TAG_ASSIGNMENTS;
let mockComps = COMP_ASSIGNMENTS;

function makeChain(resolveValue: unknown): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  self.from = vi.fn().mockReturnValue(self);
  self.innerJoin = vi.fn().mockReturnValue(self);
  self.where = vi.fn().mockResolvedValue(resolveValue);
  // Make it thenable so `await` works directly (for the first query with no .where())
  self.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    Promise.resolve(resolveValue).then(resolve, reject);
  return self;
}

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => {
      dbCallCount++;
      if (dbCallCount % 3 === 1) return makeChain(mockSilhouettes);
      if (dbCallCount % 3 === 2) return makeChain(mockTags);
      return makeChain(mockComps);
    }),
  },
}));

vi.mock("@/lib/compatibility", () => ({
  getCompatibleComponents: vi.fn(),
  getCompatibleFabrics: vi.fn(),
}));

// ---------------------------------------------------------------------------

const toolCtx = {
  toolCallId: "test",
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
};

let searchSilhouettes: typeof import("../tools").searchSilhouettes;

// The Vercel AI SDK types execute as returning T | AsyncIterable<T> to support
// streaming, but in non-streaming tests it always returns T directly.
type SearchInput = Parameters<NonNullable<typeof searchSilhouettes["execute"]>>[0];
type SearchResult = { silhouettes: { id: string; name: string; patternId: string; matchScore: number; totalRequested: number; tags: { dimension: string; value: string; label: string }[]; components: { id: string; name: string; assetCode: string }[] }[] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const exec = (input: SearchInput, ctx = toolCtx) => searchSilhouettes.execute!(input, ctx) as any as Promise<SearchResult>;

beforeEach(async () => {
  vi.clearAllMocks();
  dbCallCount = 0;
  mockSilhouettes = SILHOUETTES;
  mockTags = TAG_ASSIGNMENTS;
  mockComps = COMP_ASSIGNMENTS;
  const mod = await import("../tools");
  searchSilhouettes = mod.searchSilhouettes;
});

describe("searchSilhouettes", () => {
  it("returns all silhouettes when no filters are provided", async () => {
    const result = await exec({}, toolCtx);
    expect(result.silhouettes).toHaveLength(3);
  });

  it("ranks exact matches highest", async () => {
    const result = await exec(
      { aestheticMood: ["modern-romantic"], length: "midi", occasion: ["wedding-guest"] },
      toolCtx,
    );

    // sil-1 matches all 3 tags → highest score
    expect(result.silhouettes.length).toBeGreaterThanOrEqual(1);
    expect(result.silhouettes[0].name).toBe("Romantic Midi A-Line");
    expect(result.silhouettes[0].matchScore).toBe(3);
    expect(result.silhouettes[0].totalRequested).toBe(3);
  });

  it("includes partial matches above threshold", async () => {
    // 3 requested slugs → minScore = max(1, floor(3/2)) = 1
    // sil-1: 3 matches, sil-2: 1 match (midi), sil-3: 0 matches
    const result = await exec(
      { aestheticMood: ["modern-romantic"], length: "midi", occasion: ["wedding-guest"] },
      toolCtx,
    );

    const names = result.silhouettes.map((s) => s.name);
    expect(names).toContain("Romantic Midi A-Line");
    expect(names).toContain("Minimal Sheath"); // matches "midi" → score 1 >= minScore 1
    expect(names).not.toContain("Dramatic Mermaid Gown"); // score 0 < minScore 1
  });

  it("returns empty array when no silhouettes match any tag", async () => {
    const result = await exec(
      { aestheticMood: ["goth"], occasion: ["burning-man"] },
      toolCtx,
    );

    expect(result.silhouettes).toEqual([]);
  });

  it("returns empty array when database has no silhouettes", async () => {
    mockSilhouettes = [];
    mockTags = [];
    mockComps = [];
    const result = await exec(
      { length: "midi" },
      toolCtx,
    );

    expect(result.silhouettes).toEqual([]);
  });

  it("includes tags and components in results", async () => {
    const result = await exec(
      { coreSilhouette: "a-line" },
      toolCtx,
    );

    const sil1 = result.silhouettes.find((s) => s.name === "Romantic Midi A-Line");
    expect(sil1).toBeDefined();
    expect(sil1!.patternId).toBe("TT-PAT-SIL-001");
    expect(sil1!.tags.length).toBeGreaterThan(0);
    expect(sil1!.tags[0]).toHaveProperty("dimension");
    expect(sil1!.tags[0]).toHaveProperty("value");
    expect(sil1!.tags[0]).toHaveProperty("label");
    expect(sil1!.components.length).toBeGreaterThan(0);
    expect(sil1!.components[0]).toHaveProperty("id");
    expect(sil1!.components[0]).toHaveProperty("name");
    expect(sil1!.components[0]).toHaveProperty("assetCode");
  });

  it("sorts results by match score descending", async () => {
    // 2 requested slugs → minScore = max(1, floor(2/2)) = 1
    // sil-1: 2 matches (midi, modern-romantic), sil-2: 1 match (midi), sil-3: 0
    const result = await exec(
      { aestheticMood: ["modern-romantic"], length: "midi" },
      toolCtx,
    );

    expect(result.silhouettes.length).toBe(2);
    expect(result.silhouettes[0].matchScore).toBeGreaterThanOrEqual(
      result.silhouettes[1].matchScore,
    );
    expect(result.silhouettes[0].name).toBe("Romantic Midi A-Line");
  });
});
