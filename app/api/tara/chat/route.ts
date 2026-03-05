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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = (await request.json()) as { messages: UIMessage[] };

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: TARA_SYSTEM_PROMPT,
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
