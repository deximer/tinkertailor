import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient } from "@/lib/supabase/server";
import { TARA_SYSTEM_PROMPT } from "@/lib/tara/system-prompt";
import { taraTools } from "@/lib/tara/tools";

// ---------------------------------------------------------------------------
// Design context passed from TaraChat via the useChat `body` option
// ---------------------------------------------------------------------------

interface DesignContext {
  selectedComponentIds: string[];
  designPhase: string;
  silhouetteId: string | null;
  selectedFabricCode: string | null;
}

function isDesignContext(value: unknown): value is DesignContext {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj.selectedComponentIds) &&
    typeof obj.designPhase === "string"
  );
}

/** Build a concise system-prompt addition describing the user's current design state. */
function buildDesignContextPrompt(ctx: DesignContext): string | null {
  const parts: string[] = [];

  if (ctx.silhouetteId) {
    parts.push(`Silhouette: ${ctx.silhouetteId}`);
  }

  if (ctx.selectedComponentIds.length > 0) {
    parts.push(`Selected components: ${ctx.selectedComponentIds.join(", ")}`);
  }

  parts.push(`Design phase: ${ctx.designPhase}`);

  if (ctx.selectedFabricCode) {
    parts.push(`Fabric: ${ctx.selectedFabricCode}`);
  }

  if (parts.length === 1 && parts[0] === `Design phase: ${ctx.designPhase}`) {
    // Only the default phase with nothing selected — not useful context
    if (ctx.designPhase === "silhouette") return null;
  }

  return `\n\n[Current design session]\n${parts.join("\n")}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: UIMessage[];
    designContext?: unknown;
  };
  const { messages } = body;

  // Build system prompt, optionally enriched with design session state
  let systemPrompt = TARA_SYSTEM_PROMPT;
  if (isDesignContext(body.designContext)) {
    const contextSnippet = buildDesignContextPrompt(body.designContext);
    if (contextSnippet) {
      systemPrompt = `${TARA_SYSTEM_PROMPT}${contextSnippet}`;
    }
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: taraTools,
    stopWhen: stepCountIs(3),
    onFinish({ steps }) {
      for (const step of steps) {
        for (const call of step.toolCalls) {
          console.log(
            `[TARA] tool=${call.toolName} input=${JSON.stringify("input" in call ? call.input : undefined)}`,
          );
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
