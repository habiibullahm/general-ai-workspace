"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, signUpAction } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import type { AuthActionState } from "@/lib/auth/validation";

type Props = { mode: "sign-in" | "sign-up"; productName: string; oauthError?: boolean };

export function AuthForm({ mode, productName, oauthError = false }: Props) {
  const isSignUp = mode === "sign-up";
  const action = isSignUp ? signUpAction : signInAction;
  const [state, formAction, pending] = useActionState<AuthActionState | null, FormData>(action, null);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand href="/" label={productName} />
        <h1 className="auth-title">{isSignUp ? "Create your account" : "Sign in"}</h1>
        <p className="auth-subtitle">{isSignUp ? "A quiet space for your conversations." : "Continue to your workspace."}</p>

        <form action="/auth/google" className="auth-providers" method="get">
          {oauthError && <p role="alert" className="auth-error">Sign-in could not be completed. Please try again.</p>}
          <button className="auth-google" disabled={pending} type="submit">
            <GoogleMark />
            Continue with Google
          </button>
        </form>
        <p className="auth-divider">or</p>

        <form action={formAction} className="auth-form">
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input autoComplete="email" id="email" maxLength={254} name="email" required type="email" />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input autoComplete={isSignUp ? "new-password" : "current-password"} id="password" maxLength={256} minLength={8} name="password" required type="password" />
          </div>
          {state?.error && <p role="alert" className="auth-error">{state.error}</p>}
          {state?.message && <p role="status" className="auth-message">{state.message}</p>}
          <button className="auth-submit" disabled={pending} type="submit">
            {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? "Already have an account? " : "New here? "}
          <Link href={isSignUp ? "/login" : "/signup"}>{isSignUp ? "Sign in" : "Create an account"}</Link>
        </p>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" width="18" height="18">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
