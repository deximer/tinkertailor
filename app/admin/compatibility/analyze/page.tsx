"use client";

import { useEffect, useRef, useState } from "react";

type View = "launch" | "running" | "review";

interface AnalysisRun {
  id: string;
  pairType: string;
  status: string;
  confidenceThreshold: string;
  totalPairs: number | null;
  suggestionsCount: number;
  createdAt: string;
  completedAt: string | null;
}

interface Suggestion {
  id: string;
  bodiceId: string;
  partnerId: string;
  confidence: string;
  sleeveStyle: string | null;
  alreadyExists: boolean;
  status: string;
  bodiceName: string | null;
  bodiceAssetCode: string | null;
  partnerName: string | null;
  partnerAssetCode: string | null;
}

export default function AdminCompatibilityAnalyzePage() {
  const [view, setView] = useState<View>("launch");
  const [pairType, setPairType] = useState<"bodice_skirt" | "bodice_sleeve">(
    "bodice_skirt",
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.85);
  const [onlyUnmatched, setOnlyUnmatched] = useState(true);
  const [pastRuns, setPastRuns] = useState<AnalysisRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [logLines, setLogLines] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [filterTab, setFilterTab] = useState<
    "all" | "pending" | "accepted" | "rejected"
  >("all");
  const [bulkThreshold, setBulkThreshold] = useState(90);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    inserted: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch past runs on mount
  useEffect(() => {
    fetchPastRuns();
  }, []);

  async function fetchPastRuns() {
    setLoadingRuns(true);
    try {
      const res = await fetch("/api/admin/compatibility/analyze");
      if (res.ok) {
        const data = await res.json();
        setPastRuns(data);
      }
    } catch {
      // silently fail — past runs are non-critical
    }
    setLoadingRuns(false);
  }

  async function handleRunAnalysis() {
    setError(null);
    setLogLines([]);
    setProgress({ processed: 0, total: 0 });
    setView("running");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/admin/compatibility/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairType,
          confidenceThreshold,
          onlyUnmatched,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to start analysis");
        setView("launch");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "progress") {
                setProgress({
                  processed: data.processed,
                  total: data.total,
                });
                if (data.latestSuggestion) {
                  const s = data.latestSuggestion;
                  const pct = (s.confidence * 100).toFixed(1);
                  setLogLines((prev) => [
                    ...prev.slice(-4),
                    `${s.bodiceName} + ${s.partnerName}: ${pct}%`,
                  ]);
                }
              } else if (data.type === "done") {
                const runId = data.runId;
                setCurrentRunId(runId);
                await loadRunDetails(runId);
                setView("review");
              } else if (data.type === "error") {
                setError(data.message);
                setView("launch");
              }
            } catch {
              // skip malformed SSE data
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled — no error to show
        return;
      }
      setError("Connection lost during analysis");
      setView("launch");
    } finally {
      abortRef.current = null;
    }
  }

  async function loadRunDetails(runId: string) {
    try {
      const res = await fetch(
        `/api/admin/compatibility/analyze/${runId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setCurrentRunId(runId);
      }
    } catch {
      setError("Failed to load run details");
    }
  }

  async function handleViewRun(runId: string) {
    setError(null);
    setCommitResult(null);
    setFilterTab("all");
    await loadRunDetails(runId);
    setView("review");
  }

  async function handleBulkAccept() {
    if (!currentRunId) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/compatibility/analyze/${currentRunId}/suggestions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            minConfidence: bulkThreshold / 100,
            status: "accepted",
          }),
        },
      );
      if (res.ok) {
        await loadRunDetails(currentRunId);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to bulk accept");
      }
    } catch {
      setError("Failed to bulk accept suggestions");
    }
  }

  async function handleSuggestionAction(
    id: string,
    status: "accepted" | "rejected",
  ) {
    if (!currentRunId) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/compatibility/analyze/${currentRunId}/suggestions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [id], status }),
        },
      );
      if (res.ok) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status } : s)),
        );
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to update suggestion");
      }
    } catch {
      setError("Failed to update suggestion");
    }
  }

  async function handleCommit() {
    if (!currentRunId) return;
    setCommitting(true);
    setError(null);
    setCommitResult(null);
    try {
      const res = await fetch(
        `/api/admin/compatibility/analyze/${currentRunId}/commit`,
        { method: "POST" },
      );
      if (res.ok) {
        const data = await res.json();
        setCommitResult({ inserted: data.inserted, skipped: data.skipped });
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to commit pairs");
      }
    } catch {
      setError("Failed to commit pairs");
    }
    setCommitting(false);
  }

  function handleNewAnalysis() {
    setView("launch");
    setCurrentRunId(null);
    setSuggestions([]);
    setCommitResult(null);
    setError(null);
    setFilterTab("all");
    fetchPastRuns();
  }

  const filteredSuggestions =
    filterTab === "all"
      ? suggestions
      : suggestions.filter((s) => s.status === filterTab);

  const acceptedCount = suggestions.filter(
    (s) => s.status === "accepted",
  ).length;

  const progressPct =
    progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            Auto-Detect Compatibility
          </h1>
          <a
            href="/admin/compatibility"
            className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors"
          >
            Back to Compatibility
          </a>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-3 text-red-400 hover:text-red-300"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ===== VIEW: LAUNCH ===== */}
        {view === "launch" && (
          <>
            {/* Analysis form */}
            <section className="mb-8 rounded border border-gray-700 bg-[#222] p-6">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
                New Analysis
              </h2>

              {/* Pair type */}
              <div className="mb-5">
                <label className="mb-2 block text-xs text-gray-500">
                  Pair Type
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pairType"
                      value="bodice_skirt"
                      checked={pairType === "bodice_skirt"}
                      onChange={() => setPairType("bodice_skirt")}
                      className="accent-white"
                    />
                    <span className="text-sm text-gray-200">
                      Bodice x Skirt
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pairType"
                      value="bodice_sleeve"
                      checked={pairType === "bodice_sleeve"}
                      onChange={() => setPairType("bodice_sleeve")}
                      className="accent-white"
                    />
                    <span className="text-sm text-gray-200">
                      Bodice x Sleeve
                    </span>
                  </label>
                </div>
              </div>

              {/* Confidence threshold */}
              <div className="mb-5">
                <label className="mb-2 block text-xs text-gray-500">
                  Confidence Threshold:{" "}
                  <span className="text-white font-medium">
                    {Math.round(confidenceThreshold * 100)}%
                  </span>
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={1.0}
                  step={0.01}
                  value={confidenceThreshold}
                  onChange={(e) =>
                    setConfidenceThreshold(parseFloat(e.target.value))
                  }
                  className="w-full max-w-xs accent-white"
                />
                <div className="mt-1 flex justify-between max-w-xs text-xs text-gray-600">
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Only unmatched */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyUnmatched}
                    onChange={(e) => setOnlyUnmatched(e.target.checked)}
                    className="accent-white"
                  />
                  <span className="text-sm text-gray-200">Only unmatched</span>
                  <span className="text-xs text-gray-500">
                    — Skip pairs already in the compatibility table
                  </span>
                </label>
              </div>

              {/* Run button */}
              <button
                onClick={handleRunAnalysis}
                className="rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200 transition-colors"
              >
                Run Analysis
              </button>
            </section>

            {/* Past runs */}
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
                Past Runs
              </h2>

              {loadingRuns ? (
                <p className="text-gray-500 text-sm">Loading past runs...</p>
              ) : pastRuns.length === 0 ? (
                <div className="rounded border border-gray-700 bg-[#222] p-8 text-center">
                  <p className="text-gray-500 text-sm">
                    No analysis runs yet. Start your first one above.
                  </p>
                </div>
              ) : (
                <div className="rounded border border-gray-700 bg-[#222] overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Pair Type</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Suggestions</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {pastRuns.map((run) => (
                        <tr
                          key={run.id}
                          className="border-b border-gray-800 hover:bg-[#2a2a2a] transition-colors"
                        >
                          <td className="px-4 py-3 text-gray-300">
                            {new Date(run.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {run.pairType === "bodice_skirt"
                              ? "Bodice x Skirt"
                              : "Bodice x Sleeve"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={run.status} />
                          </td>
                          <td className="px-4 py-3 text-gray-300 tabular-nums">
                            {run.suggestionsCount}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleViewRun(run.id)}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* ===== VIEW: RUNNING ===== */}
        {view === "running" && (
          <section className="rounded border border-gray-700 bg-[#222] p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
              Analysis Running
            </h2>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                <span>
                  {progress.processed} / {progress.total} pairs
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-[#333] overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-600 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Log lines */}
            {logLines.length > 0 && (
              <div className="mb-4 rounded border border-gray-700 bg-[#1a1a1a] p-3">
                <p className="mb-2 text-xs text-gray-500 uppercase tracking-wider">
                  Recent Matches
                </p>
                {logLines.map((line, i) => (
                  <p key={i} className="text-xs text-gray-300 leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            )}

            {/* Cancel */}
            <button
              onClick={() => {
                abortRef.current?.abort();
                setView("launch");
              }}
              className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors"
            >
              Cancel
            </button>
          </section>
        )}

        {/* ===== VIEW: REVIEW ===== */}
        {view === "review" && (
          <>
            {/* Filter tabs */}
            <div className="mb-4 flex items-center gap-1">
              {(
                ["all", "pending", "accepted", "rejected"] as const
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`rounded px-3 py-1.5 text-sm capitalize transition-colors ${
                    filterTab === tab
                      ? "bg-[#333] text-white"
                      : "text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]"
                  }`}
                >
                  {tab}
                  {tab === "all" && (
                    <span className="ml-1 text-xs text-gray-500">
                      ({suggestions.length})
                    </span>
                  )}
                  {tab === "pending" && (
                    <span className="ml-1 text-xs text-gray-500">
                      (
                      {
                        suggestions.filter((s) => s.status === "pending")
                          .length
                      }
                      )
                    </span>
                  )}
                  {tab === "accepted" && (
                    <span className="ml-1 text-xs text-gray-500">
                      ({acceptedCount})
                    </span>
                  )}
                  {tab === "rejected" && (
                    <span className="ml-1 text-xs text-gray-500">
                      (
                      {
                        suggestions.filter((s) => s.status === "rejected")
                          .length
                      }
                      )
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Bulk action */}
            <div className="mb-4 flex items-center gap-3 rounded border border-gray-700 bg-[#222] px-4 py-3">
              <span className="text-sm text-gray-400">
                Accept all above
              </span>
              <input
                type="number"
                min={50}
                max={100}
                value={bulkThreshold}
                onChange={(e) =>
                  setBulkThreshold(parseInt(e.target.value, 10) || 90)
                }
                className="w-16 rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white text-center"
              />
              <span className="text-sm text-gray-400">%</span>
              <button
                onClick={handleBulkAccept}
                className="rounded border border-gray-600 px-3 py-1 text-sm text-gray-200 hover:bg-[#2a2a2a] transition-colors"
              >
                Accept
              </button>
            </div>

            {/* Suggestions table */}
            <div className="mb-6 rounded border border-gray-700 bg-[#222] overflow-auto">
              {filteredSuggestions.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500 text-sm">
                    No suggestions match the current filter.
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">Bodice</th>
                      <th className="px-4 py-3">Partner</th>
                      <th className="px-4 py-3">Confidence</th>
                      {suggestions.some((s) => s.sleeveStyle) && (
                        <th className="px-4 py-3">Sleeve Style</th>
                      )}
                      <th className="px-4 py-3">Exists</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuggestions.map((s) => {
                      const conf = (parseFloat(s.confidence) * 100).toFixed(1);
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-gray-800 hover:bg-[#2a2a2a] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span className="text-white">
                              {s.bodiceName ?? "—"}
                            </span>
                            {s.bodiceAssetCode && (
                              <span className="ml-1 text-xs text-gray-500">
                                {s.bodiceAssetCode}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-white">
                              {s.partnerName ?? "—"}
                            </span>
                            {s.partnerAssetCode && (
                              <span className="ml-1 text-xs text-gray-500">
                                {s.partnerAssetCode}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-gray-300">
                            {conf}%
                          </td>
                          {suggestions.some((ss) => ss.sleeveStyle) && (
                            <td className="px-4 py-3 text-gray-400">
                              {s.sleeveStyle ?? "—"}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            {s.alreadyExists && (
                              <span className="inline-block rounded border border-green-700 bg-green-900/30 px-2 py-0.5 text-xs text-green-300">
                                Exists
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  handleSuggestionAction(s.id, "accepted")
                                }
                                className={`rounded px-2 py-1 text-xs transition-colors ${
                                  s.status === "accepted"
                                    ? "bg-green-900/40 text-green-300 border border-green-700"
                                    : "text-gray-400 hover:text-green-300 border border-gray-700 hover:border-green-700"
                                }`}
                              >
                                Accept
                              </button>
                              <button
                                onClick={() =>
                                  handleSuggestionAction(s.id, "rejected")
                                }
                                className={`rounded px-2 py-1 text-xs transition-colors ${
                                  s.status === "rejected"
                                    ? "bg-red-900/40 text-red-300 border border-red-700"
                                    : "text-gray-400 hover:text-red-300 border border-gray-700 hover:border-red-700"
                                }`}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Commit section */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleCommit}
                disabled={committing || acceptedCount === 0}
                className="rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {committing
                  ? "Committing..."
                  : `Commit ${acceptedCount} accepted pair${acceptedCount !== 1 ? "s" : ""}`}
              </button>
              <button
                onClick={handleNewAnalysis}
                className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors"
              >
                New Analysis
              </button>
            </div>

            {/* Commit result */}
            {commitResult && (
              <div className="mt-4 rounded border border-green-700 bg-green-900/30 px-4 py-3 text-sm text-green-300">
                <p>
                  Inserted {commitResult.inserted}, skipped{" "}
                  {commitResult.skipped}.
                </p>
                <a
                  href="/admin/compatibility"
                  className="mt-2 inline-block text-sm text-green-300 underline hover:text-green-200"
                >
                  View Compatibility Matrix &rarr;
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let classes: string;
  switch (status) {
    case "running":
      classes =
        "border-yellow-700 bg-yellow-900/30 text-yellow-300";
      break;
    case "completed":
      classes =
        "border-green-700 bg-green-900/30 text-green-300";
      break;
    case "failed":
      classes = "border-red-700 bg-red-900/30 text-red-300";
      break;
    default:
      classes =
        "border-gray-700 bg-gray-900/30 text-gray-400";
  }
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs ${classes}`}
    >
      {status}
    </span>
  );
}
