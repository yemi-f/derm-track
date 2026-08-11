"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Your Clinic";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [useMagicLink, setUseMagicLink] = useState(false);
  const [authAction, setAuthAction] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (authAction === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setNotice("Check your email to confirm your account, then sign back in here.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLinkSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
      });
      if (otpError) throw otpError;

      setNotice("Check your email for your sign-in link.");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <p style={styles.eyebrow}>{clinicName}</p>
        <h1 style={styles.heading}>Track your skin journey</h1>
        <p style={styles.subheading}>
          Sign in to see your progress between visits.
        </p>

        {error && <p style={styles.error}>{error}</p>}
        {notice && <p style={styles.notice}>{notice}</p>}

        {useMagicLink ? (
          <form onSubmit={handleMagicLinkSubmit} style={styles.form}>
            <label style={styles.label} htmlFor="magic-email">
              Email
            </label>
            <input
              id="magic-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
            />
            <button type="submit" disabled={loading} style={styles.primaryButton}>
              {loading ? "Sending link…" : "Email me a sign-in link"}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} style={styles.form}>
            <label style={styles.label} htmlFor="password-email">
              Email
            </label>
            <input
              id="password-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
            />

            <label style={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={authAction === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />

            <button type="submit" disabled={loading} style={styles.primaryButton}>
              {loading
                ? authAction === "signup"
                  ? "Creating account…"
                  : "Signing in…"
                : authAction === "signup"
                ? "Create account"
                : "Sign in"}
            </button>
          </form>
        )}

        <div style={styles.links}>
          {!useMagicLink && (
            <button
              type="button"
              style={styles.linkButton}
              onClick={() => {
                setError(null);
                setNotice(null);
                setAuthAction(authAction === "signup" ? "signin" : "signup");
              }}
            >
              {authAction === "signup"
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          )}

          <button
            type="button"
            style={styles.linkButton}
            onClick={() => {
              setError(null);
              setNotice(null);
              setUseMagicLink(!useMagicLink);
            }}
          >
            {useMagicLink ? "Use password instead" : "Or, email me a link instead"}
          </button>
        </div>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    background: "var(--color-surface)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow-soft)",
    padding: 32,
  },
  eyebrow: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.4,
    color: "var(--color-primary-dark)",
    textTransform: "uppercase",
  },
  heading: {
    margin: "8px 0 4px",
    fontSize: 24,
    color: "var(--color-text)",
  },
  subheading: {
    margin: "0 0 24px",
    color: "var(--color-text-muted)",
    fontSize: 14,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--color-text)",
    marginTop: 10,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--color-border)",
    fontSize: 15,
    background: "var(--color-bg)",
    color: "var(--color-text)",
  },
  primaryButton: {
    marginTop: 20,
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: "var(--color-primary)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  links: {
    marginTop: 20,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-start",
  },
  linkButton: {
    background: "none",
    border: "none",
    padding: 0,
    color: "var(--color-primary-dark)",
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
  },
  error: {
    background: "#fbeceb",
    color: "#a13a34",
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 16,
  },
  notice: {
    background: "#eef2ea",
    color: "#4d6b46",
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 16,
  },
};
