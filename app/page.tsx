import { signOutAction } from "@/app/actions/auth";
import { getProductName } from "@/lib/config/branding";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireAuthenticatedUser();
  const productName = getProductName();

  return (
    <main className="min-h-screen px-6 py-8 sm:px-10">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <span className="text-sm font-medium tracking-tight text-stone-800">{productName}</span>
        <form action={signOutAction}>
          <button className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 hover:bg-stone-50" type="submit">
            Sign out
          </button>
        </form>
      </header>
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium text-stone-500">Signed in as {user.email ?? "your account"}</p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight text-stone-900">A little room to think.</h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">Your conversations will have a home here.</p>
        </div>
      </section>
    </main>
  );
}
