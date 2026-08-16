"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, Loader2, Plus, Volume2 } from "lucide-react";
import {
  addWordsFromArticle,
  fetchArticle,
  type AnkiState,
  type FetchState,
} from "@/app/actions";
import type { EngooArticle, EngooWord } from "@/lib/engoo";

const initialFetchState: FetchState = { status: "idle" };
const initialAnkiState: AnkiState = { status: "idle" };

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

      {state.status === "error" && <ErrorMessage message={state.message} />}
      {state.status === "success" && (
        <ArticleResult key={state.url} url={state.url} article={state.article} />
      )}
    </div>
  );
}

function ArticleResult({ url, article }: { url: string; article: EngooArticle }) {
  const [ankiState, ankiAction, isPending] = useActionState(addWordsFromArticle, initialAnkiState);
  const [selected, setSelected] = useState(() => new Set(article.words.map((word) => word.term)));

  const allSelected = selected.size === article.words.length;

  function toggleWord(word: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (!next.delete(word)) next.add(word);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(article.words.map((word) => word.term)));
  }

  return (
    <form action={ankiAction} className="mt-10">
      <input type="hidden" name="url" value={url} />

      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">{article.title}</h2>
        <button
          type="button"
          onClick={toggleAll}
          className="shrink-0 text-xs font-medium text-muted transition-colors hover:text-foreground"
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </div>

      <button
        type="submit"
        disabled={isPending || selected.size === 0}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        {isPending ? "Adding to Anki…" : `Add ${selected.size} to Anki`}
      </button>

      {ankiState.status === "error" && <ErrorMessage message={ankiState.message} />}

      {ankiState.status === "success" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Check className="size-4 shrink-0 text-accent" />
          Added {ankiState.added} {ankiState.added === 1 ? "card" : "cards"}
          {ankiState.duplicates > 0 && `, ${ankiState.duplicates} already in Anki`}
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {article.words.map((word) => (
          <WordCard
            key={word.term}
            word={word}
            checked={selected.has(word.term)}
            onToggle={() => toggleWord(word.term)}
          />
        ))}
      </ul>
    </form>
  );
}

function WordCard({
  word,
  checked,
  onToggle,
}: {
  word: EngooWord;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className={`rounded-xl border p-4 transition-colors ${
        checked ? "border-accent/40 bg-card" : "border-border bg-transparent opacity-60"
      }`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="word"
          value={word.term}
          checked={checked}
          onChange={onToggle}
          aria-label={`Include ${word.term}`}
          className="size-4 shrink-0 accent-accent"
        />
        <span className="font-semibold">{word.term}</span>
        <span className="rounded-full bg-muted/10 px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
          {word.partOfSpeech}
        </span>
        {word.audioUrl && (
          <button
            type="button"
            onClick={() => new Audio(word.audioUrl!).play()}
            aria-label={`Play pronunciation of ${word.term}`}
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

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="mt-4 flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
      <AlertCircle className="size-4 shrink-0" />
      {message}
    </p>
  );
}
