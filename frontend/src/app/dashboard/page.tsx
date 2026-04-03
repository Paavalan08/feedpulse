"use client";

import { useState, useEffect } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// 1. Strict TypeScript Interfaces
interface Feedback {
  _id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  ai_tags?: string[];
  ai_sentiment?: "Positive" | "Neutral" | "Negative";
  ai_priority?: number;
  ai_summary?: string;
  createdAt: string;
}

interface FeedbackMeta {
  total: number;
  page: number;
  pages: number;
}

interface FeedbackTheme {
  theme: string;
  count: number;
  avgPriority: number;
  sentimentBreakdown: {
    Positive: number;
    Neutral: number;
    Negative: number;
  };
  lastSeenAt: string;
  sampleFeedbackTitles: string[];
}

export default function Dashboard() {
  // --- STATE MANAGEMENT ---
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("adminToken");
  });
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Login State
  const [email, setEmail] = useState("admin@feedpulse.com");
  const [password, setPassword] = useState("password123");
  const [loginError, setLoginError] = useState("");

  // Filter State
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<FeedbackMeta>({ total: 0, page: 1, pages: 1 });
  const [themes, setThemes] = useState<FeedbackTheme[]>([]);
  const [isThemesLoading, setIsThemesLoading] = useState(false);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem("adminToken", data.data.token);
        setToken(data.data.token);
      } else {
        setLoginError(data.error);
      }
    } catch {
      setLoginError("Server offline. Please start backend.");
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setToken(null);
    setFeedbacks([]);
    setMeta({ total: 0, page: 1, pages: 1 });
  };

  const totalFeedback = meta.total;
  const openItems = feedbacks.filter((f) => f.status !== "Resolved").length;
  const priorityValues = feedbacks
    .map((f) => f.ai_priority)
    .filter((p): p is number => typeof p === "number");
  const averagePriority = priorityValues.length
    ? (priorityValues.reduce((sum, p) => sum + p, 0) / priorityValues.length).toFixed(1)
    : "-";
  const tagCountMap: Record<string, number> = {};
  feedbacks.forEach((f) => {
    (f.ai_tags || []).forEach((tag) => {
      tagCountMap[tag] = (tagCountMap[tag] || 0) + 1;
    });
  });
  const mostCommonTag =
    Object.entries(tagCountMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  // Fetch data whenever the token or filters change
  useEffect(() => {
    if (!token) return;

    const loadFeedbacks = async () => {
      // Build our query string based on filters
      let url = `${API_BASE_URL}/api/feedback?`;
      if (filterCategory) url += `category=${filterCategory}&`;
      if (filterStatus) url += `status=${filterStatus}&`;
      if (searchTerm.trim()) url += `search=${encodeURIComponent(searchTerm.trim())}&`;
      if (sortBy && sortBy !== "latest") url += `sort=${sortBy}&`;
      url += `page=${page}&limit=10`;

      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setFeedbacks(data.data.items || []);
          setMeta(data.data.meta || { total: 0, page: 1, pages: 1 });
        } else if (res.status === 401) {
          handleLogout(); // Token expired or invalid
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };

    void loadFeedbacks();
  }, [token, filterCategory, filterStatus, searchTerm, sortBy, page]);

  useEffect(() => {
    if (!token) return;

    const loadThemes = async () => {
      setIsThemesLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/feedback/themes?days=30&limit=6`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setThemes(data.data.themes || []);
        } else if (res.status === 401) {
          handleLogout();
        }
      } catch (error) {
        console.error("Failed to load themes", error);
      } finally {
        setIsThemesLoading(false);
      }
    };

    void loadThemes();
  }, [token]);

  const handleReanalyze = async (id: string) => {
    setReanalyzingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/feedback/${id}/reanalyze`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        // Refresh the feedback list
        const feedbackRes = await fetch(
          `${API_BASE_URL}/api/feedback?page=${page}&limit=10`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const feedbackData = await feedbackRes.json();
        if (feedbackData.success) {
          setFeedbacks(feedbackData.data.items || []);
        }
      } else {
        alert("Failed to reanalyze feedback");
      }
    } catch {
      alert("Error reanalyzing feedback");
    } finally {
      setReanalyzingId(null);
    }
  };

  // --- DATA MUTATION (UPDATE STATUS) ---
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/feedback/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const data = await res.json();
      if (data.success) {
        // Update the UI instantly without needing a page refresh (Optimistic UI)
        setFeedbacks(feedbacks.map(f => f._id === id ? { ...f, status: newStatus } : f));
      }
    } catch {
      alert("Failed to update status");
    }
  };

  // --- RENDER 1: LOGIN SCREEN ---
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="surface-glass p-7 md:p-8 rounded-3xl w-full max-w-md reveal">
          <p className="label-chip mb-3">Admin Access</p>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">FeedPulse Console</h2>
          <p className="text-sm text-slate-600 mb-6">Sign in to review, prioritize, and resolve product feedback.</p>
          {loginError && <p className="text-rose-600 mb-4">{loginError}</p>}
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="btn-accent w-full py-3"
            >
              {isLoading ? "Authenticating..." : "Login"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // --- RENDER 2: DASHBOARD SCREEN ---
  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="surface-glass rounded-3xl p-6 md:p-7 mb-6 reveal">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="label-chip mb-2">Admin Dashboard</p>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Product Feedback Intelligence</h1>
              <p className="text-sm md:text-base text-slate-600 mt-2">Track customer signals, detect trends, and move issues from report to resolution.</p>
            </div>
            <button onClick={handleLogout} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700 font-semibold hover:bg-rose-100 transition-colors w-fit">
          Logout
        </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 reveal-delay">
        <div className="surface-card rounded-2xl p-4">
          <p className="label-chip">Total Feedback</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{totalFeedback}</p>
        </div>
        <div className="surface-card rounded-2xl p-4">
          <p className="label-chip">Open Items</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{openItems}</p>
        </div>
        <div className="surface-card rounded-2xl p-4">
          <p className="label-chip">Avg Priority</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{averagePriority}</p>
        </div>
        <div className="surface-card rounded-2xl p-4">
          <p className="label-chip">Most Common Tag</p>
          <p className="text-3xl font-bold text-slate-900 mt-2 break-words">{mostCommonTag}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 surface-card rounded-2xl p-4 md:p-5">
        <div>
          <label className="label-chip block mb-2">Filter Category</label>
          <select 
            value={filterCategory} 
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setPage(1);
            }}
            className="field"
          >
            <option value="">All Categories</option>
            <option value="Bug">Bug</option>
            <option value="Feature Request">Feature Request</option>
            <option value="Improvement">Improvement</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="label-chip block mb-2">Filter Status</label>
          <select 
            value={filterStatus} 
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="field"
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="In Review">In Review</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
        <div>
          <label className="label-chip block mb-2">Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Title or AI summary"
            className="field"
          />
        </div>
        <div>
          <label className="label-chip block mb-2">Sort</label>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="field"
          >
            <option value="latest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="priority">Highest Priority</option>
            <option value="sentiment">Sentiment</option>
          </select>
        </div>
      </div>

      {/* Theme Clusters */}
      <div className="max-w-7xl mx-auto mb-6 surface-card rounded-2xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg md:text-xl font-bold text-slate-900">Top Feedback Themes (30 Days)</h2>
          <p className="label-chip">AI Tags + Keywords</p>
        </div>

        {isThemesLoading && <p className="text-sm text-slate-500">Generating theme clusters...</p>}

        {!isThemesLoading && themes.length === 0 && (
          <p className="text-sm text-slate-500">No themes found yet. Submit more feedback to unlock trend insights.</p>
        )}

        {!isThemesLoading && themes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {themes.map((theme) => (
              <div key={theme.theme} className="rounded-xl border border-sky-100 p-3.5 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{theme.theme}</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-sky-100 text-sky-700 font-bold">
                    {theme.count} mentions
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2">Avg priority: {theme.avgPriority}/10</p>
                <p className="text-xs text-slate-600 mt-1">
                  Sentiment P/N/N: {theme.sentimentBreakdown.Positive}/{theme.sentimentBreakdown.Neutral}/{theme.sentimentBreakdown.Negative}
                </p>
                {theme.sampleFeedbackTitles.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2 italic">
                    e.g. {theme.sampleFeedbackTitles[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="max-w-7xl mx-auto surface-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[860px]">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
              <th className="p-4 font-semibold">Priority</th>
              <th className="p-4 font-semibold">Title & AI Summary</th>
              <th className="p-4 font-semibold">Category</th>
              <th className="p-4 font-semibold">Sentiment</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Date</th>
              <th className="p-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">No feedback found.</td>
              </tr>
            )}
            {feedbacks.map((fb) => (
              <tr key={fb._id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                
                <td className="p-4">
                  <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-100 to-orange-100 text-slate-800 font-bold text-base">
                    {fb.ai_priority || "-"}
                  </div>
                </td>

                <td className="p-4 max-w-md">
                  <p className="font-bold text-slate-900">{fb.title}</p>
                  <p className="text-sm text-slate-500 mt-1">{fb.ai_summary || fb.description}</p>
                </td>

                <td className="p-4">
                  <span className="inline-block text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                    {fb.category}
                  </span>
                </td>

                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    fb.ai_sentiment === 'Positive' ? 'bg-green-100 text-green-700' :
                    fb.ai_sentiment === 'Negative' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {fb.ai_sentiment || "Pending AI"}
                  </span>
                </td>

                <td className="p-4">
                  <select
                    value={fb.status}
                    onChange={(e) => handleStatusChange(fb._id, e.target.value)}
                    className={`font-bold text-sm border border-slate-200 bg-white rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-300 cursor-pointer ${
                      fb.status === 'Resolved' ? 'text-green-600' : 
                      fb.status === 'In Review' ? 'text-amber-700' : 'text-sky-700'
                    }`}
                  >
                    <option value="New" className="text-black">New</option>
                    <option value="In Review" className="text-black">In Review</option>
                    <option value="Resolved" className="text-black">Resolved</option>
                  </select>
                </td>

                <td className="p-4 text-sm text-slate-600 whitespace-nowrap">
                  {new Date(fb.createdAt).toLocaleDateString()}
                </td>

                <td className="p-4">
                  <button
                    onClick={() => handleReanalyze(fb._id)}
                    disabled={reanalyzingId === fb._id}
                    className="text-xs px-2 py-1 rounded-lg border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-50 transition-colors"
                  >
                    {reanalyzingId === fb._id ? "Analyzing..." : "Re-analyze"}
                  </button>
                </td>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="max-w-7xl mx-auto mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Page {meta.page} of {meta.pages} ({meta.total} total)
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((prev) => Math.min(prev + 1, meta.pages || 1))}
            disabled={page >= meta.pages}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}