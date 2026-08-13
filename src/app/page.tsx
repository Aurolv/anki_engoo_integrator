import ArticleForm from "@/app/components/ArticleForm";
import ThemeToggle from "@/app/components/ThemeToggle";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Engoo → Anki</h1>
          <p className="mt-1 text-sm text-muted">
            Paste a Daily News article link to pull its vocabulary.
          </p>
        </div>
        <ThemeToggle />
      </div>
      <div className="mt-10">
        <ArticleForm />
      </div>
    </main>
  );
}
