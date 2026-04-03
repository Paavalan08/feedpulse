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
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-8">
        
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-800">FeedPulse</h1>
          <p className="text-gray-500 mt-2">Help us improve! Share your ideas, bugs, or requests.</p>
        </div>

        {/* Success Message */}
        {status === "success" && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700">
            <h3 className="font-bold">Thank you!</h3>
            <p>Your feedback has been submitted and sent to our AI for processing.</p>
          </div>
        )}

        {/* Error Message */}
        {status === "error" && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
            <p>{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                required
                maxLength={120}
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Add dark mode toggle"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
                <span className={`float-right text-xs ${formData.description.length < 20 ? 'text-red-500' : 'text-gray-400'}`}>
                  {formData.description.length}/20 min
                </span>
              </label>
              <textarea
                required
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder="Please describe your feedback in detail..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Bug">Bug</option>
                <option value="Feature Request">Feature Request</option>
                <option value="Improvement">Improvement</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name (Optional)</label>
              <input
                type="text"
                name="submitterName"
                value={formData.submitterName}
                onChange={handleChange}
                placeholder="John Doe"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
              <input
                type="email"
                name="submitterEmail"
                value={formData.submitterEmail}
                onChange={handleChange}
                placeholder="john@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:bg-blue-400"
          >
            {status === "loading" ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>
      </div>
    </main>
  );
}