import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-semibold">VeriDegree</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Sélectionne un espace : administration des diplômes ou consultation étudiant.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin"
          className="rounded-lg border border-zinc-300 px-4 py-4 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Aller vers page Admin
        </Link>
        <Link
          href="/student"
          className="rounded-lg border border-zinc-300 px-4 py-4 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Aller vers page Étudiant
        </Link>
      </div>
    </main>
  );
}
