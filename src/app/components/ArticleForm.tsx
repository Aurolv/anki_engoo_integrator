"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2, Volume2 } from "lucide-react";
import { importArticle, type ImportState } from "@/app/actions";
import type { EngooWord } from "@/lib/engoo";

const initialState: ImportState = { status: "idle" };

export default function ArticleForm() {
  const [state, formAction, isPending] = useActionState(importArticle, initialState);

  return (
    <div className="w-full">
      <form action={formAction} className="flex gap-2">
        <input
          type="url"
          name="url"
          required
          placeholder="https://engoo.com/app/daily-news/article/…"
          className="flex-1 rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending ? "Fetching…" : "Fetch"}
        </button>
      </form>

      {state.status === "error" && (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" />
          {state.message}
        </p>
      )}

      {state.status === "success" && (
        <section className="mt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight">{state.article.title}</h2>
            <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
              {state.article.words.length} words
            </span>
          </div>
          <ul className="mt-5 space-y-3">
            {state.article.words.map((word) => (
              <WordCard key={word.word} word={word} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function WordCard({ word }: { word: EngooWord }) {
  return (
    <li className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/40">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{word.word}</span>
        <span className="rounded-full bg-muted/10 px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
          {word.partOfSpeech}
        </span>
        {word.audioUrl && (
          <button
            type="button"
            onClick={() => new Audio(word.audioUrl!).play()}
            aria-label={`Play pronunciation of ${word.word}`}
            className="ml-auto rounded-full p-1.5 text-muted transition-colors hover:bg-border/60 hover:text-foreground"
          >
            <Volume2 className="size-4" />
          </button>
        )}
      </div>
      <p className="mt-2 text-sm">{word.definition}</p>
      {word.example && (
        <p className="mt-2 border-l-2 border-border pl-3 text-sm italic text-muted">
          {word.example}
        </p>
      )}
    </li>
  );
}
