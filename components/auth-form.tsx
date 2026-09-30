"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, signUpAction } from "@/app/actions/auth";
import type { AuthActionState } from "@/lib/auth/validation";

type Props = { mode: "sign-in" | "sign-up"; productName: string };

export function AuthForm({ mode, productName }: Props) {
  const isSignUp = mode === "sign-up";
  const action = isSignUp ? signUpAction : signInAction;
  const [state, formAction, pending] = useActionState<AuthActionState | null, FormData>(action, null);

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
        <Link href="/" className="text-sm font-medium tracking-tight text-stone-700">
          {productName}
        </Link>
        <h1 className="mt-8 text-2xl font-medium tracking-tight text-stone-900">
          {isSignUp ? "Create your account" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          {isSignUp ? "A quiet space for your conversations." : "Continue to your workspace."}
        </p>

        <form action={formAction} className="mt-7 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-stone-700">Email</label>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
              id="email"
              maxLength={254}
              name="email"
              required
              type="email"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-stone-700">Password</label>
            <input
              autoComplete={isSignUp ? "new-password" : "current-password"}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
              id="password"
              maxLength={256}
              minLength={8}
              name="password"
              required
              type="password"
            />
          </div>
          {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
          {state?.message && <p role="status" className="text-sm text-stone-600">{state.message}</p>}
          <button
            className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-stone-600">
          {isSignUp ? "Already have an account? " : "New here? "}
          <Link className="font-medium text-stone-900 underline underline-offset-4" href={isSignUp ? "/login" : "/signup"}>
            {isSignUp ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
