"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, signUpAction } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import type { AuthActionState } from "@/lib/auth/validation";

type Props = { mode: "sign-in" | "sign-up"; productName: string };

export function AuthForm({ mode, productName }: Props) {
  const isSignUp = mode === "sign-up";
  const action = isSignUp ? signUpAction : signInAction;
  const [state, formAction, pending] = useActionState<AuthActionState | null, FormData>(action, null);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand href="/" label={productName} />
        <h1 className="auth-title">{isSignUp ? "Create your account" : "Sign in"}</h1>
        <p className="auth-subtitle">{isSignUp ? "A quiet space for your conversations." : "Continue to your workspace."}</p>

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
