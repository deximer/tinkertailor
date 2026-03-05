"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useState, type FormEvent } from "react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useDesignSession } from "@/lib/store/design-session";

// ---------------------------------------------------------------------------
// Silhouette card sub-component
// ---------------------------------------------------------------------------

interface SilhouetteResult {
  id: string;
  name: string;
  patternId: string;
  tags: { dimension: string; value: string; label: string }[];
  components: { id: string; name: string; code: string }[];
}

function SilhouetteCard({ sil }: { sil: SilhouetteResult }) {
  const loadSilhouette = useDesignSession((s) => s.loadSilhouette);

  const displayTags = sil.tags.slice(0, 3);
  const componentIds = sil.components.map((c) => c.id);

  return (
    <div className="rounded-lg border border-gray-700 bg-[#2a2a2a] p-3">
      <div className="mb-1 text-sm font-medium text-white">{sil.name}</div>
      <div className="mb-2 text-xs text-gray-500">{sil.patternId}</div>
      <div className="mb-3 flex flex-wrap gap-1">
        {displayTags.map((tag) => (
          <span
            key={`${tag.dimension}-${tag.value}`}
            className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300"
          >
            {tag.label}
          </span>
        ))}
      </div>
      <button
        onClick={() => loadSilhouette(sil.id, componentIds)}
        className="w-full rounded bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-gray-200"
      >
        Start with this design
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message rendering
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? "bg-white text-black"
            : "bg-[#2a2a2a] text-gray-200"
        }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <span key={i} className="whitespace-pre-wrap">
                {part.text}
              </span>
            );
          }

          // Tool invocation results: render silhouette cards
          if (
            "toolCallId" in part &&
            "state" in part &&
            part.state === "output-available"
          ) {
            const output = (part as unknown as { output: unknown }).output as {
              silhouettes?: SilhouetteResult[];
            } | null;
            if (output?.silhouettes && output.silhouettes.length > 0) {
              return (
                <div key={i} className="mt-2 grid gap-2">
                  {output.silhouettes.map((sil) => (
                    <SilhouetteCard key={sil.id} sil={sil} />
                  ))}
                </div>
              );
            }
          }

          return null;
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaraChat main component
// ---------------------------------------------------------------------------

export default function TaraChat() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/tara/chat",
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    sendMessage({ text: trimmed });
  };

  return (
    <div className="flex h-full flex-col bg-[#1a1a1a]">
      {/* Message thread */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Tell TARA what you&apos;re looking for...
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && messages.at(-1)?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-[#2a2a2a] px-4 py-2 text-sm text-gray-400">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-800 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your dream dress..."
            className="flex-1 rounded-lg border border-gray-700 bg-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
