
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setMessage(
            "Account created! Check your email to confirm your account, then log in."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function goToForgotPassword() {
    setMessage("");
    router.push("/auth/forgot-password");
  }

  return (
    <main
      className="neumorphic-page flex min-h-screen items-center justify-center px-4 py-10 text-[#2d3436]"
    >
      <section
        className="neumorphic-card w-full max-w-md mx-auto"
        role="region"
        aria-label={mode === "signup" ? "Create account" : "Sign in"}
      >
        <div className="p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b5bf5] mb-1">
            Student Study Planner
          </p>

          <h1 className="text-2xl font-black tracking-tight text-[#1e2224] sm:text-3xl">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>

          <p className="mt-2 text-sm text-[#6c7a89]">
            {mode === "signup"
              ? "Start organising your studies in one place."
              : "Log in to continue your study journey."}
          </p>

          <form onSubmit={handleAuth} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-[#2d3436]"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="neumorphic-input w-full px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-[#2d3436]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="neumorphic-input w-full px-4 py-3 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="neumorphic-btn-primary w-full px-4 py-3 font-semibold text-sm"
            >
              {loading
                ? "Please wait..."
                : mode === "signup"
                  ? "Create account"
                  : "Log in"}
            </button>
          </form>

          {message && (
            <p
              role="status"
              className="mt-5 neumorphic-inset p-3 text-sm text-[#6c7a89] rounded-xl"
            >
              {message}
            </p>
          )}

          <p className="mt-8 text-center text-sm text-[#6c7a89]">
            {mode === "signup" ? "Already have an account?" : "New to the planner?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setMessage("");
              }}
              className="neumorphic-btn-ghost font-semibold text-sm"
            >
              {mode === "signup" ? "Log in" : "Sign up"}
            </button>
          </p>

          {mode === "login" && (
            <p className="mt-5 text-center text-sm text-[#6c7a89]">
              <button
                type="button"
                onClick={goToForgotPassword}
                className="neumorphic-btn-ghost font-semibold text-sm underline underline-offset-4"
              >
                Forgot password?
              </button>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
