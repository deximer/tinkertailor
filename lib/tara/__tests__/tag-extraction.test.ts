import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractTags, tagExtractionSchema } from "../tag-extraction";
import type { TagExtraction } from "../tag-extraction";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mock-model"),
}));

import { generateObject } from "ai";
const mockGenerateObject = vi.mocked(generateObject);

function mockExtraction(tags: TagExtraction) {
  mockGenerateObject.mockResolvedValueOnce({
    object: tags,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    request: {},
    response: {
      id: "test",
      modelId: "test",
      timestamp: new Date(),
      headers: {},
    },
    providerMetadata: undefined,
    toJsonResponse: () => new Response(),
  } as unknown as Awaited<ReturnType<typeof generateObject>>);
}

describe("tagExtractionSchema", () => {
  it("validates a complete extraction", () => {
    const input: TagExtraction = {
      coreSilhouette: "a-line",
      length: "midi",
      waistPosition: "natural-waist",
      aestheticMood: ["modern-romantic"],
      occasion: ["wedding-guest"],
    };
    expect(tagExtractionSchema.parse(input)).toEqual(input);
  });

  it("validates an empty extraction", () => {
    expect(tagExtractionSchema.parse({})).toEqual({});
  });

  it("rejects invalid enum values", () => {
    expect(() =>
      tagExtractionSchema.parse({ coreSilhouette: "not-a-real-silhouette" }),
    ).toThrow();
  });
});

describe("extractTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts romantic midi dress for a wedding", async () => {
    const expected: TagExtraction = {
      aestheticMood: ["modern-romantic"],
      length: "midi",
      occasion: ["wedding-guest"],
    };
    mockExtraction(expected);

    const result = await extractTags([
      { role: "user", content: "a romantic midi dress for a wedding" },
    ]);

    expect(result).toEqual(expected);
    expect(mockGenerateObject).toHaveBeenCalledOnce();
  });

  it("extracts minimal sheath for work", async () => {
    const expected: TagExtraction = {
      coreSilhouette: "sheath",
      aestheticMood: ["minimal"],
      occasion: ["work"],
    };
    mockExtraction(expected);

    const result = await extractTags([
      { role: "user", content: "minimal sheath for work" },
    ]);

    expect(result).toEqual(expected);
  });

  it("extracts dramatic floor-length gown for black tie", async () => {
    const expected: TagExtraction = {
      length: "floor-length",
      aestheticMood: ["dramatic"],
      occasion: ["black-tie"],
    };
    mockExtraction(expected);

    const result = await extractTags([
      { role: "user", content: "dramatic floor-length gown for black tie" },
    ]);

    expect(result).toEqual(expected);
  });

  it("extracts fun playful above-the-knee", async () => {
    const expected: TagExtraction = {
      aestheticMood: ["playful"],
      length: "above-knee",
    };
    mockExtraction(expected);

    const result = await extractTags([
      { role: "user", content: "something fun and playful above the knee" },
    ]);

    expect(result).toEqual(expected);
  });

  it("extracts 1960s shift dress", async () => {
    const expected: TagExtraction = {
      eraReferences: ["1960s"],
      coreSilhouette: "shift",
    };
    mockExtraction(expected);

    const result = await extractTags([
      { role: "user", content: "a 1960s shift dress" },
    ]);

    expect(result).toEqual(expected);
  });

  it("handles multi-turn conversation context", async () => {
    const expected: TagExtraction = {
      coreSilhouette: "a-line",
      length: "midi",
      aestheticMood: ["elegant"],
      occasion: ["cocktail"],
      necklineBack: ["v-neck"],
    };
    mockExtraction(expected);

    const result = await extractTags([
      { role: "user", content: "I need a dress for a cocktail party" },
      { role: "assistant", content: "What style are you thinking?" },
      { role: "user", content: "Something elegant, A-line, midi length with a V-neck" },
    ]);

    expect(result).toEqual(expected);
    // Verify the prompt includes all messages
    const callArgs = mockGenerateObject.mock.calls[0][0];
    expect(callArgs.prompt).toContain("cocktail party");
    expect(callArgs.prompt).toContain("V-neck");
  });
});
