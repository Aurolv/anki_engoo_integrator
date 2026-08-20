"use client";

import { useActionState, useState } from "react";
import { Alert, Check, Plus, Speaker, Spinner } from "@/app/components/icons";
import {
  addWordsFromArticle,
  fetchArticle,
  type AnkiState,
  type FetchState,
} from "@/app/actions";
import type { EngooArticle, EngooWord } from "@/lib/engoo";

const initialFetchState: FetchState = { status: "idle" };
const initialAnkiState: AnkiState = { status: "idle" };

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const EASE = "duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]";

export default function ArticleForm() {
  const [state, formAction, isPending] = useActionState(fetchArticle, initialFetchState);

  return (
    <div className="w-full">
      <form action={formAction} className="flex gap-2">
        <input
          type="url"
          name="url"
          required
          placeholder="https://engoo.com/app/daily-news/article/…"
          className={`min-w-0 flex-1 rounded-md border border-border bg-card px-3.5 py-2.5 font-mono text-[0.8125rem] shadow-raised outline-none transition-colors placeholder:text-muted focus:border-accent ${FOCUS_RING}`}
        />
        <button
          type="submit"
          disabled={isPending}
          className={`flex shrink-0 items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-[opacity,transform] hover:opacity-85 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${EASE} ${FOCUS_RING}`}
        >
          {isPending && <Spinner className="size-4 animate-spin" />}
          {isPending ? "Fetching…" : "Fetch"}
        </button>
      </form>

      {isPending && <ArticleSkeleton />}
      {!isPending && state.status === "error" && <ErrorMessage message={state.message} />}
      {!isPending && state.status === "success" && (
        <ArticleResult key={state.url} url={state.url} article={state.article} />
      )}
    </div>
  );
}

function ArticleResult({ url, article }: { url: string; article: EngooArticle }) {
  const [ankiState, ankiAction, isPending] = useActionState(addWordsFromArticle, initialAnkiState);
  const [selected, setSelected] = useState(() => new Set(article.words.map((word) => word.term)));

  const isAllSelected = selected.size === article.words.length;

  function toggleWord(word: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (!next.delete(word)) next.add(word);
      return next;
    });
  }

  function toggleAll() {
    setSelected(isAllSelected ? new Set() : new Set(article.words.map((word) => word.term)));
  }

  // Engoo publishes some lessons with no vocabulary section at all.
  if (article.words.length === 0) {
    return (
      <section className="animate-rise mt-16">
        <ArticleTitle>{article.title}</ArticleTitle>
        <div className="mt-6 rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <p className="text-sm font-medium">No vocabulary in this lesson</p>
          <p className="mx-auto mt-1.5 max-w-[45ch] text-sm text-pretty text-muted">
            Some Daily News articles ship without a vocabulary section. Try another lesson.
          </p>
        </div>
      </section>
    );
  }

  return (
    <form action={ankiAction} className="animate-rise mt-16">
      <input type="hidden" name="url" value={url} />

      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-4">
        <ArticleTitle>{article.title}</ArticleTitle>
        <button
          type="button"
          onClick={toggleAll}
          className={`shrink-0 rounded px-1.5 py-1 text-xs text-muted transition-colors hover:text-foreground ${FOCUS_RING}`}
        >
          {isAllSelected ? "Clear all" : "Select all"}
        </button>
      </div>

      <button
        type="submit"
        disabled={isPending || selected.size === 0}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-accent/25 bg-accent-wash px-5 py-2.5 text-sm font-medium text-accent transition-[background-color,transform] hover:border-accent/40 active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100 ${EASE} ${FOCUS_RING}`}
      >
        {isPending ? <Spinner className="size-4 animate-spin" /> : <Plus className="size-4" />}
        {isPending ? (
          "Adding to Anki…"
        ) : (
          <span>
            Add <span className="tabular-nums">{selected.size}</span> to Anki
          </span>
        )}
      </button>

      {ankiState.status === "error" && <ErrorMessage message={ankiState.message} />}

      {ankiState.status === "success" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Check className="size-4 shrink-0 text-accent" />
          <span>
            Added <span className="tabular-nums text-foreground">{ankiState.added}</span>{" "}
            {ankiState.added === 1 ? "card" : "cards"}
            {ankiState.duplicates > 0 && (
              <>
                , <span className="tabular-nums">{ankiState.duplicates}</span> already in Anki
              </>
            )}
          </span>
        </p>
      )}

      <ul className="mt-6 space-y-2.5">
        {article.words.map((word, index) => (
          <WordCard
            key={word.term}
            word={word}
            index={index}
            checked={selected.has(word.term)}
            onToggle={() => toggleWord(word.term)}
          />
        ))}
      </ul>
    </form>
  );
}

function ArticleTitle({ children }: { children: string }) {
  return (
    <h2 className="font-serif text-2xl leading-[1.15] tracking-[-0.02em] text-balance sm:text-3xl">
      {children}
    </h2>
  );
}

function WordCard({
  word,
  index,
  checked,
  onToggle,
}: {
  word: EngooWord;
  index: number;
  checked: boolean;
  onToggle: () => void;
}) {
  const { audioUrl } = word;

  return (
    <li
      className={`animate-rise rounded-xl border p-5 transition-[background-color,border-color,box-shadow,opacity] ${EASE} ${
        checked ? "border-border bg-card shadow-raised" : "border-border/60 bg-transparent"
      }`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="flex items-center gap-2.5">
        <input
          type="checkbox"
          name="word"
          value={word.term}
          checked={checked}
          onChange={onToggle}
          aria-label={`Include ${word.term}`}
          className={`size-4 shrink-0 rounded accent-accent ${FOCUS_RING}`}
        />
        <span className={`font-medium ${checked ? "" : "text-muted"}`}>{word.term}</span>
        <span className="font-serif text-sm italic text-muted">
          {word.partOfSpeech.toLowerCase()}
        </span>
        {audioUrl && (
          <button
            type="button"
            onClick={() => void new Audio(audioUrl).play().catch(() => {})}
            aria-label={`Play pronunciation of ${word.term}`}
            className={`ml-auto rounded p-1.5 text-muted transition-colors hover:bg-border/60 hover:text-foreground active:scale-95 ${FOCUS_RING}`}
          >
            <Speaker className="size-4" />
          </button>
        )}
      </div>
      <p className="mt-2.5 text-sm text-pretty">{word.definition}</p>
      {word.example && (
        <p className="mt-3 border-l border-accent/40 pl-3.5 font-serif text-[0.9375rem] italic text-pretty text-muted">
          {word.example}
        </p>
      )}
    </li>
  );
}

function ArticleSkeleton() {
  return (
    <div className="mt-16" role="status" aria-label="Loading article vocabulary">
      <div className="h-8 w-2/3 animate-pulse rounded bg-border" />
      <div className="mt-6 h-11 w-full animate-pulse rounded-md bg-border/70" />
      <ul className="mt-6 space-y-2.5">
        {[0, 1, 2].map((index) => (
          <li
            key={index}
            className="animate-pulse rounded-xl border border-border/60 p-5"
            style={{ animationDelay: `${index * 120}ms` }}
          >
            <div className="flex items-center gap-2.5">
              <div className="size-4 shrink-0 rounded bg-border" />
              <div className="h-4 w-28 rounded bg-border" />
              <div className="h-3 w-12 rounded bg-border/70" />
            </div>
            <div className="mt-3.5 h-3.5 w-full rounded bg-border/70" />
            <div className="mt-2 h-3.5 w-4/5 rounded bg-border/70" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="animate-rise mt-4 flex items-start gap-2 rounded-md border border-danger/20 bg-danger/8 px-3.5 py-2.5 text-sm text-pretty text-danger"
    >
      <Alert className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}
