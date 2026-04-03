"use client"; // Tells Next.js this is an interactive client component

import { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function Home() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Feature Request",
    submitterName: "",
    submitterEmail: "",
  });

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Client-side Validation (Requirement 1.3)
    if (formData.description.length < 20) {
      setStatus("error");
      setErrorMessage("Description must be at least 20 characters long.");
      return;
    }

    setStatus("loading");

    try {
      // 2. Send data to your Node.js API
      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus("success");
        setFormData({ title: "", description: "", category: "Feature Request", submitterName: "", submitterEmail: "" }); // Reset form
      } else {
        setStatus("error");
        setErrorMessage(result.error || "Failed to submit feedback.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Is the backend running?");
    }
  };

  return (
    <main className="min-h-screen px-4 py-10 md:px-8 md:py-14">
      {/* Admin Console Link */}
      <div className="absolute top-6 right-6">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm6-7a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Admin Console
        </a>
      </div>

      <div className="mx-auto w-full max-w-3xl surface-glass rounded-3xl p-6 md:p-8 reveal">
        <div className="mb-8 md:mb-10">
          <p className="label-chip mb-3">Public Feedback Portal</p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">FeedPulse</h1>
          <p className="mt-3 max-w-2xl text-sm md:text-base text-slate-600">
            Share product pain points, feature ideas, and improvements. Your feedback is stored instantly and analyzed by AI so the product team can prioritize what matters most.
          </p>
        </div>

        {/* Success Message */}
        {status === "success" && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 reveal-delay">
            <h3 className="font-bold">Thank you for sharing feedback</h3>
            <p>Your feedback has been submitted and sent to our AI for processing.</p>
          </div>
        )}

        {/* Error Message */}
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
                <span className={`float-right text-[11px] ${formData.description.length < 20 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {formData.description.length} chars (min 20)
                </span>
              </label>
              <textarea
                required
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
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
      </div>
    </main>
  );
}