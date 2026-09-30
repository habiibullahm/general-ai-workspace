import { MessageSquareText } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-8 sm:px-10">
      <header className="mx-auto flex max-w-5xl items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700">
          <MessageSquareText aria-hidden="true" size={18} />
        </span>
        <span className="text-sm font-medium tracking-tight text-stone-800">General AI Workspace</span>
      </header>
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium text-stone-500">Your workspace</p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight text-stone-900">A little room to think.</h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">Your conversations will have a home here.</p>
        </div>
      </section>
    </main>
  );
}
