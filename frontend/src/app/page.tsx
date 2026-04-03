"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ThemeToggle from "../components/ThemeToggle";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type FormStatus = "idle" | "loading" | "success" | "error";
type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface CoachResponse {
  assistant_reply: string;
  quality_score: number;
  quality_breakdown?: {
    clarity?: number;
    specificity?: number;
    impact?: number;
    actionability?: number;
  };
  detected_category?: "Bug" | "Feature Request" | "Improvement" | "Other";
  suggested_title?: string;
  suggested_description?: string;
  improvements?: string[];
  next_questions?: string[];
}

export default function Home() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Feature Request",
    submitterName: "",
    submitterEmail: "",
  });

  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I can help you craft stronger feedback. Tell me what happened, why it matters, and who is affected.",
    },
  ]);
  const [coachData, setCoachData] = useState<CoachResponse | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState("");

  const qualityScore = useMemo(() => {
    if (!coachData?.quality_score) return 0;
    return Math.max(0, Math.min(100, coachData.quality_score));
  }, [coachData]);

  const qualityTone =
    qualityScore >= 80 ? "text-emerald-700" : qualityScore >= 60 ? "text-amber-700" : "text-rose-700";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const submitFeedback = async () => {
    if (formData.description.length < 20) {
      setStatus("error");
      setErrorMessage("Description must be at least 20 characters long.");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus("success");
        setFormData({ title: "", description: "", category: "Feature Request", submitterName: "", submitterEmail: "" });
      } else {
        setStatus("error");
        setErrorMessage(result.error || "Failed to submit feedback.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Is the backend running?");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await submitFeedback();
  };

  const sendCoachMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || coachLoading) return;

    setCoachError("");
    setCoachLoading(true);

    const nextMessages = [...chatMessages, { role: "user" as const, content: trimmed }];
    setChatMessages(nextMessages);
    setChatInput("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          chatHistory: nextMessages,
          message: trimmed,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.data) {
        setCoachError(result?.error || "AI coach failed. Try again.");
        return;
      }

      const ai: CoachResponse = result.data;
      setCoachData(ai);

      const assistantReply = ai.assistant_reply || "I analyzed your draft and shared suggestions below.";
      setChatMessages(prev => [...prev, { role: "assistant", content: assistantReply }]);
    } catch {
      setCoachError("Network error while contacting AI coach.");
    } finally {
      setCoachLoading(false);
    }
  };

  const applySuggestions = () => {
    if (!coachData) return;
    setFormData(prev => ({
      ...prev,
      title: coachData.suggested_title || prev.title,
      description: coachData.suggested_description || prev.description,
      category: coachData.detected_category || prev.category,
    }));
  };

  const handleChatEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendCoachMessage();
    }
  };

  return (
    <main className="min-h-screen px-4 py-10 md:px-8 md:py-14">
      <header className="mx-auto mb-6 flex w-full max-w-7xl items-center justify-between rounded-2xl border border-white/50 bg-white/65 px-4 py-3 backdrop-blur-md md:px-5">
        <div>
          <p className="label-chip">FeedPulse</p>
          <p className="text-xs text-slate-600">AI-powered feedback workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm6-7a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Admin Console
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="surface-glass rounded-3xl p-6 md:p-8 reveal">
          <div className="mb-8 md:mb-10">
            <p className="label-chip mb-3">Public Feedback Portal</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">FeedPulse</h1>
            <p className="mt-3 max-w-2xl text-sm md:text-base text-slate-600">
              Share product pain points, feature ideas, and improvements. Your feedback is stored instantly and analyzed by AI so the product team can prioritize what matters most.
            </p>
          </div>

          {status === "success" && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 reveal-delay">
              <h3 className="font-bold">Thank you for sharing feedback</h3>
              <p>Your feedback has been submitted and sent to our AI for processing.</p>
            </div>
          )}

          {status === "error" && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 reveal-delay">
              <p>{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="col-span-1 md:col-span-2">
                <label className="label-chip block mb-2">Title *</label>
                <input
                  required
                  maxLength={120}
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., Add dark mode toggle"
                  className="field"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="label-chip block mb-2">
                  Description *
                  <span className={`float-right text-[11px] ${formData.description.length < 20 ? "text-rose-600" : "text-slate-500"}`}>
                    {formData.description.length} chars (min 20)
                  </span>
                </label>
                <textarea
                  required
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={6}
                  placeholder="Please describe your feedback in detail..."
                  className="field resize-y"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="label-chip block mb-2">Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="field"
                >
                  <option value="Bug">Bug</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Improvement">Improvement</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="label-chip block mb-2">Name (Optional)</label>
                <input
                  type="text"
                  name="submitterName"
                  value={formData.submitterName}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="field"
                />
              </div>

              <div>
                <label className="label-chip block mb-2">Email (Optional)</label>
                <input
                  type="email"
                  name="submitterEmail"
                  value={formData.submitterEmail}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  className="field"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="btn-accent w-full py-3.5 px-4"
            >
              {status === "loading" ? "Submitting..." : "Submit Feedback"}
            </button>
          </form>
        </section>

        <aside className="surface-glass rounded-3xl p-5 md:p-6 reveal-delay">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label-chip">AI Feedback Coach</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Draft Assistant</h2>
            </div>
            <div className={`rounded-full bg-white px-3 py-2 text-sm font-semibold ${qualityTone}`}>
              Score {qualityScore}/100
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversation</p>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {chatMessages.map((message, idx) => (
                <div
                  key={`${message.role}-${idx}`}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    message.role === "assistant"
                      ? "bg-sky-50 text-sky-900 border border-sky-100"
                      : "bg-slate-100 text-slate-800 border border-slate-200"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70 mb-1">{message.role}</p>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatEnter}
                placeholder="Ask AI to improve your feedback..."
                className="field !py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={sendCoachMessage}
                disabled={coachLoading}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {coachLoading ? "..." : "Send"}
              </button>
            </div>

            {coachError && (
              <p className="mt-2 text-xs text-rose-700">{coachError}</p>
            )}
          </div>

          {coachData && (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quality Breakdown</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div>Clarity: {coachData.quality_breakdown?.clarity ?? "-"}</div>
                  <div>Specificity: {coachData.quality_breakdown?.specificity ?? "-"}</div>
                  <div>Impact: {coachData.quality_breakdown?.impact ?? "-"}</div>
                  <div>Actionability: {coachData.quality_breakdown?.actionability ?? "-"}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested Improvements</p>
                <ul className="mt-2 list-disc pl-4 text-sm text-slate-700 space-y-1">
                  {(coachData.improvements || []).map((item, idx) => (
                    <li key={`imp-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next Questions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(coachData.next_questions || []).map((question, idx) => (
                    <button
                      key={`q-${idx}`}
                      type="button"
                      onClick={() => setChatInput(question)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-400"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={applySuggestions}
                className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Apply AI Suggestions To Form
              </button>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
