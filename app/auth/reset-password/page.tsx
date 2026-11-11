"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // The recovery session is passed via query params when Supabase redirects
  // the user back from the reset email link. Read client-side only.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [errorParam, setErrorParam] = useState<string | null>(null);
  const [errorDescription, setErrorDescription] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setAccessToken(params.get("access_token"));
      setRefreshToken(params.get("refresh_token"));
      setErrorParam(params.get("error"));
      setErrorDescription(params.get("error_description"));
    } catch {
      // window.location unavailable during SSR; safe to ignore.
    }
  }, []);

  useEffect(() => {
    if (errorParam) {
      setStatus("error");
      setMessage(
        errorDescription
          ? decodeURIComponent(errorDescription)
          : "Invalid or expired reset link. Please request a new one."
      );
      return;
    }

    // Set the recovery session so updateUser() can operate on it.
    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }
  }, [accessToken, refreshToken, errorParam, errorDescription, supabase]);

  // Session missing entirely → link invalid/expired.
  if (!accessToken || !refreshToken) {
    return (
      <main className="neumorphic-page flex min-h-screen items-center justify-center px-4 py-10 text-[#2d3436]">
        <section className="neumorphic-card w-full max-w-md mx-auto">
          <div className="p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b5bf5] mb-1">
              Student Study Planner
            </p>

              <h1 className="text-2xl font-black tracking-tight text-[#1e2224] sm:text-3xl">
                Reset password
              </h1>

              <div className="mt-6 neumorphic-inset rounded-xl p-4 text-sm text-[#e74c3c] font-medium">
                Invalid or expired reset link. Please request a new one.
              </div>

              <p className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => router.push("/auth/forgot-password")}
                  className="neumorphic-btn-ghost font-semibold text-sm underline underline-offset-4"
                >
                  Request a new reset link
                </button>
              </p>
            </div>
          </section>
        </main>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setStatus("loading");

    if (!password.trim()) {
      setStatus("idle");
      setMessage("Please enter a new password.");
      return;
    }

    if (password.trim().length < 6) {
      setStatus("idle");
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("idle");
      setMessage("Passwords do not match.");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: password.trim() });

      if (error) throw error;

      setStatus("success");
      setMessage("Your password has been reset successfully.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to reset your password. The link may have expired."
      );
    } finally {
      setStatus("idle");
    }
  }

  return (
    <main className="neumorphic-page flex min-h-screen items-center justify-center px-4 py-10 text-[#2d3436]">
    <section className="neumorphic-card w-full max-w-md mx-auto">
      <div className="p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b5bf5] mb-1">
            Student Study Planner
          </p>

          <h1 className="text-2xl font-black tracking-tight text-[#1e2224] sm:text-3xl">
            Reset password
          </h1>

          <p className="mt-2 text-sm text-[#6c7a89]">
            Enter your new password below.
          </p>

          {status === "success" ? (
            <div className="mt-6 neumorphic-inset rounded-xl p-4 text-sm text-[#2ecc71] font-medium">
              Your password has been reset successfully.
            </div>
          ) : (
            <>
              {message && (
                <div
                  role="status"
                  className="mt-6 neumorphic-inset rounded-xl p-4 text-sm text-[#e74c3c] font-medium"
                >
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-[#2d3436]"
                  >
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="neumorphic-input w-full px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="mb-2 block text-sm font-medium text-[#2d3436]"
                  >
                    Confirm new password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Type it again to confirm"
                    className="neumorphic-input w-full px-4 py-3 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="neumorphic-btn-primary w-full px-4 py-3 font-semibold text-sm"
                >
                  {status === "loading" ? "Resetting…" : "Reset password"}
                </button>
              </form>

              <p className="mt-8 text-center text-sm text-[#6c7a89]">
                Remember your password?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/auth")}
                  className="neumorphic-btn-ghost font-semibold text-sm underline underline-offset-4"
                >
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}