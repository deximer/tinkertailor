import { z } from "zod";
import { generateObject, type ModelMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// ---------------------------------------------------------------------------
// Zod schema — 13 tag dimensions matching seed-taxonomy.ts slugs
// ---------------------------------------------------------------------------

const coreSilhouetteValues = [
  "a-line", "fit-and-flare", "sheath", "column", "mermaid",
  "empire", "drop-waist", "shift", "wrap", "ballgown",
  "trapeze", "peplum", "slip", "tunic", "sculptural-architectural",
] as const;

const lengthValues = [
  "mini", "above-knee", "knee-length", "midi", "tea-length", "maxi", "floor-length",
] as const;

const waistPositionValues = [
  "natural-waist", "empire-waist", "drop-waist", "no-defined-waist",
] as const;

const shoulderConstructionValues = [
  "standard-shoulder", "off-shoulder", "drop-shoulder",
  "max-drop-shoulder", "one-shoulder", "halter-neck-held",
  "strapless", "cold-shoulder",
] as const;

const sleeveTypeValues = [
  "sleeveless", "cap", "short", "elbow", "3-4", "long",
  "fitted", "straight", "bell", "flare", "puff", "bishop",
  "dolman", "kimono", "cape", "detached",
] as const;

const necklineBackValues = [
  "crew", "scoop", "v-neck", "sweetheart", "halter", "boat",
  "square", "high-neck", "asymmetric",
  "closed-back", "low-back", "open-back", "cutout-back",
  "keyhole-back", "cross-back", "lace-up-back",
] as const;

const detailFeatureValues = [
  "cutouts-side-back", "slit-front-side-back", "ruching",
  "draping", "pleats", "gathering", "peplum", "ruffles",
  "asymmetry", "architectural-seaming",
] as const;

const bodyCueValues = [
  "hides-shoulders", "frames-shoulders", "reveals-shoulders",
  "reveals-back", "hides-arms", "highlights-arms", "hides-knees",
  "hides-hips", "accentuates-waist", "accentuates-bust",
  "accentuates-butt", "accentuates-legs", "accentuates-curves",
  "creates-vertical-line", "softens-silhouette", "structured-shaping",
] as const;

const bodyShapeValues = [
  "hourglass", "pear", "apple", "rectangle",
  "inverted-triangle", "petite", "tall",
] as const;

const aestheticMoodValues = [
  "timeless", "contemporary", "modern-romantic", "sexy", "minimal",
  "architectural", "sculptural", "soft-feminine", "bold", "dramatic",
  "playful", "elegant", "goth", "grunge", "ethereal",
] as const;

const eraReferenceValues = [
  "timeless", "1920s", "1930s", "1940s", "1950s", "1960s",
  "1970s", "1980s", "1990s", "y2k", "early-2000s", "2010s",
  "modern-2020s",
] as const;

const occasionValues = [
  "everyday", "business-casual", "work", "cocktail", "party",
  "clubbing", "date-night", "meet-the-parents", "bridesmaid",
  "wedding-guest", "black-tie", "formal-evening", "holiday",
  "beach", "resort", "art-opening", "art-festival", "concert",
  "burning-man", "fancy-sports-polo-races",
] as const;

const designerInspirationValues = [
  "chanel-inspired", "halston-inspired", "tom-ford-inspired",
  "alaia-inspired", "calvin-klein-inspired", "dior-inspired",
  "givenchy-inspired", "saint-laurent-inspired", "mcqueen-inspired",
  "phoebe-philo-era-celine-inspired",
] as const;

export const tagExtractionSchema = z.object({
  coreSilhouette: z.enum(coreSilhouetteValues).optional()
    .describe("Primary silhouette shape (e.g. a-line, sheath, mermaid)"),
  length: z.enum(lengthValues).optional()
    .describe("Garment length (e.g. mini, midi, floor-length)"),
  waistPosition: z.enum(waistPositionValues).optional()
    .describe("Where the waist sits (e.g. natural-waist, empire-waist)"),
  shoulderConstruction: z.enum(shoulderConstructionValues).optional()
    .describe("Shoulder style (e.g. off-shoulder, strapless, halter-neck-held)"),
  sleeveType: z.array(z.enum(sleeveTypeValues)).optional()
    .describe("Sleeve styles — can be multiple (e.g. long + puff)"),
  necklineBack: z.array(z.enum(necklineBackValues)).optional()
    .describe("Neckline and back details — can be multiple"),
  detailFeatures: z.array(z.enum(detailFeatureValues)).optional()
    .describe("Design details like ruching, pleats, cutouts"),
  bodyCues: z.array(z.enum(bodyCueValues)).optional()
    .describe("Body effect descriptors like accentuates-waist, hides-arms"),
  bodyShape: z.array(z.enum(bodyShapeValues)).optional()
    .describe("Body shapes this style flatters"),
  aestheticMood: z.array(z.enum(aestheticMoodValues)).optional()
    .describe("Style mood — romantic, minimal, dramatic, etc."),
  eraReferences: z.array(z.enum(eraReferenceValues)).optional()
    .describe("Decade or era inspiration"),
  occasion: z.array(z.enum(occasionValues)).optional()
    .describe("Events or settings this garment suits"),
  designerInspiration: z.array(z.enum(designerInspirationValues)).optional()
    .describe("Designer aesthetics that inspire this look"),
});

export type TagExtraction = z.infer<typeof tagExtractionSchema>;

// ---------------------------------------------------------------------------
// extractTags() — derive structured tags from conversation
// ---------------------------------------------------------------------------

export async function extractTags(
  messages: ModelMessage[],
): Promise<TagExtraction> {
  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: tagExtractionSchema,
    prompt: buildExtractionPrompt(messages),
  });

  return object;
}

function buildExtractionPrompt(messages: ModelMessage[]): string {
  const conversationText = messages
    .map((m) => {
      const role = m.role === "user" ? "User" : "Assistant";
      const content = typeof m.content === "string"
        ? m.content
        : JSON.stringify(m.content);
      return `${role}: ${content}`;
    })
    .join("\n");

  return `Analyze the following conversation and extract fashion design preferences as structured tags.
Only include dimensions that are clearly expressed or strongly implied by the conversation.
Do not guess — leave dimensions empty if there is no signal.

Conversation:
${conversationText}`;
}
