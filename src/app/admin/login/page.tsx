"use client";

import { signIn, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in → go straight to admin dashboard
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/admin");
    }
  }, [status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
    } else {
      router.replace("/admin");
    }
  }

  // Show nothing while checking session (avoids flash of the form)
  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <p className="text-white text-sm opacity-60">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-headline font-bold mb-1 text-brand-dark">
          Broward News
        </h1>
        <p className="text-sm text-gray-500 mb-6">Admin Login</p>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-3 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-red text-white font-bold py-2 px-4 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
