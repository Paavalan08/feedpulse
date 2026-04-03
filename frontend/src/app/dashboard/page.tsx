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
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Admin Login</h2>
          {loginError && <p className="text-red-500 mb-4 text-center">{loginError}</p>}
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-md"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-md"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-900 text-white font-bold py-2 rounded-md hover:bg-gray-800"
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
    <div className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">FeedPulse Admin</h1>
        <button onClick={handleLogout} className="text-red-600 font-semibold hover:underline">
          Logout
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total Feedback</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalFeedback}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-semibold">Open Items</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{openItems}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-semibold">Avg Priority</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{averagePriority}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-semibold">Most Common Tag</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{mostCommonTag}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filter Category</label>
          <select 
            value={filterCategory} 
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setPage(1);
            }}
            className="border rounded px-3 py-1"
          >
            <option value="">All Categories</option>
            <option value="Bug">Bug</option>
            <option value="Feature Request">Feature Request</option>
            <option value="Improvement">Improvement</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filter Status</label>
          <select 
            value={filterStatus} 
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="border rounded px-3 py-1"
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="In Review">In Review</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Title or AI summary"
            className="border rounded px-3 py-1 w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sort</label>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="border rounded px-3 py-1 w-full"
          >
            <option value="latest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="priority">Highest Priority</option>
            <option value="sentiment">Sentiment</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm border-b">
              <th className="p-4 font-semibold">Priority</th>
              <th className="p-4 font-semibold">Title & AI Summary</th>
              <th className="p-4 font-semibold">Category</th>
              <th className="p-4 font-semibold">Sentiment</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">No feedback found.</td>
              </tr>
            )}
            {feedbacks.map((fb) => (
              <tr key={fb._id} className="border-b hover:bg-gray-50 transition-colors">
                
                <td className="p-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-lg">
                    {fb.ai_priority || "-"}
                  </div>
                </td>

                <td className="p-4 max-w-md">
                  <p className="font-bold text-gray-900">{fb.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{fb.ai_summary || fb.description}</p>
                </td>

                <td className="p-4">
                  <span className="inline-block text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded">
                    {fb.category}
                  </span>
                </td>

                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    fb.ai_sentiment === 'Positive' ? 'bg-green-100 text-green-700' :
                    fb.ai_sentiment === 'Negative' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {fb.ai_sentiment || "Pending AI"}
                  </span>
                </td>

                <td className="p-4">
                  <select
                    value={fb.status}
                    onChange={(e) => handleStatusChange(fb._id, e.target.value)}
                    className={`font-bold text-sm border-none bg-transparent focus:ring-0 cursor-pointer ${
                      fb.status === 'Resolved' ? 'text-green-600' : 
                      fb.status === 'In Review' ? 'text-purple-600' : 'text-blue-600'
                    }`}
                  >
                    <option value="New" className="text-black">New</option>
                    <option value="In Review" className="text-black">In Review</option>
                    <option value="Resolved" className="text-black">Resolved</option>
                  </select>
                </td>

                <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                  {new Date(fb.createdAt).toLocaleDateString()}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Page {meta.page} of {meta.pages} ({meta.total} total)
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page <= 1}
            className="px-3 py-1 rounded border bg-white disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((prev) => Math.min(prev + 1, meta.pages || 1))}
            disabled={page >= meta.pages}
            className="px-3 py-1 rounded border bg-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}