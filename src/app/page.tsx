import ArticleForm from "@/app/components/ArticleForm";
import ThemeToggle from "@/app/components/ThemeToggle";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pt-24 pb-32">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-serif text-5xl leading-[1.05] tracking-[-0.03em] text-balance sm:text-6xl">
            Engoo <span className="text-muted">to</span> Anki
          </h1>
          <p className="mt-4 max-w-[55ch] text-sm text-pretty text-muted">
            Paste a Daily News article link to pull its vocabulary.
          </p>
        </div>
        <ThemeToggle />
      </header>
      <div className="mt-14">
        <ArticleForm />
      </div>
    </main>
  );
}
