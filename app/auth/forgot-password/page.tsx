"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [suggestedEmail, setSuggestedEmail] = useState("");

  useEffect(() => {
    // Read an email passed back from the reset flow (client-side only).
    try {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      if (emailParam) setSuggestedEmail(emailParam);
    } catch {
      // window.location unavailable during SSR; safe to ignore.
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setStatus("loading");

    if (!email.trim()) {
      setStatus("idle");
      setMessage("Please enter your email address.");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      setStatus("success");
      setMessage(
        "If an account exists for that email, you will receive a password reset link shortly."
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to send reset email. Please try again."
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
              Forgot password
            </h1>

            <p className="mt-2 text-sm text-[#6c7a89]">
              No problem. Enter your email and we will send you a link to set a new password.
            </p>

            {status === "success" ? (
              <div className="mt-6 neumorphic-inset rounded-xl p-4 text-sm text-[#2ecc71] font-medium">
                Reset link sent. Please check your inbox.
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

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="neumorphic-btn-primary w-full px-4 py-3 font-semibold text-sm"
                  >
                    {status === "loading" ? "Sending…" : "Send reset link"}
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

            {suggestedEmail && status === "idle" && !message && (
              <p className="mt-6 text-xs text-[#95a5a9] text-center">
                An email was sent to {suggestedEmail}. Check your inbox to reset your password.
              </p>
            )}
          </div>
        </section>
      </main>
  );
}
