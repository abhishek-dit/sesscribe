"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  // Wait for hydration to use searchParams safely in client components
  // In a robust implementation you might wrap this in a Suspense boundary, 
  // but for simplicity we'll just handle it directly.
  let redirectUrl = "/";
  try {
    const searchParams = useSearchParams();
    redirectUrl = searchParams.get("from") || "/";
  } catch(e) {}

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        // Force replace to clear the login route from history
        router.replace(redirectUrl);
      } else {
        setError(data.error || "Authentication failed");
        setLoading(false);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: radial-gradient(circle at center, rgba(139,92,246,0.08) 0%, transparent 60%);
        }
        .login-card {
          width: 100%;
          max-width: 420px;
          background: var(--surface-1);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 2.5rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .login-logo {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--primary), var(--pink));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          margin: 0 auto 1.5rem;
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
        }
        .input-group {
          margin-bottom: 1.5rem;
        }
        .login-input {
          width: 100%;
          background: var(--surface-2);
          border: 1px solid var(--border);
          padding: 1rem 1.25rem;
          border-radius: var(--radius-md);
          color: var(--fg);
          font-size: 1rem;
          transition: all 0.2s;
        }
        .login-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
        }
        .login-button {
          width: 100%;
          padding: 0.9rem;
          border-radius: var(--radius-md);
          border: none;
          background: linear-gradient(135deg, var(--primary), var(--pink));
          color: white;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(139, 92, 246, 0.3);
        }
        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .error-message {
          color: #ef4444;
          font-size: 0.85rem;
          margin-top: 0.5rem;
          text-align: center;
          min-height: 20px;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: #fff;
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">🎙</div>
          <h1 style={{ textAlign: "center", fontSize: "1.75rem", marginBottom: "0.5rem" }}>
            SesScribe
          </h1>
          <p style={{ textAlign: "center", color: "var(--fg-3)", fontSize: "0.9rem", marginBottom: "2rem" }}>
            Enter the shared access password to proceed.
          </p>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <input
                type="password"
                className="login-input"
                placeholder="Access Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                disabled={loading}
              />
              <div className="error-message">
                {error && <span>{error}</span>}
              </div>
            </div>

            <button type="submit" className="login-button" disabled={loading || !password}>
              {loading ? (
                <>
                  <div className="spinner" /> Authenticating...
                </>
              ) : (
                "Unlock Dashboard"
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
