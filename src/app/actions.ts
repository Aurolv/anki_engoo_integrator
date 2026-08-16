"use server";

import { scrapeArticle, type EngooArticle } from "@/lib/engoo";
import { addWordsToAnki } from "@/lib/anki";

export type FetchState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; url: string; article: EngooArticle };

export async function fetchArticle(_previous: FetchState, formData: FormData): Promise<FetchState> {
  const url = formData.get("url");

  if (typeof url !== "string") {
    return { status: "error", message: "Paste an article link first" };
  }

  try {
    return { status: "success", url, article: await scrapeArticle(url) };
  } catch (error) {
    const message = Error.isError(error) ? error.message : "Failed to fetch the article";
    return { status: "error", message };
  }
}

export type AnkiState = | { status: "idle" }
                        | { status: "error"; message: string }
                        | { status: "success"; added: number; duplicates: number };

export async function addWordsFromArticle(_previous: AnkiState, formData: FormData): Promise<AnkiState> {
  const url = formData.get("url");

  if (typeof url !== "string") {
    return { status: "error", message: "Fetch an article first" };
  }

  const selected = new Set(formData.getAll("word").map(String));
  if (selected.size === 0) {
    return { status: "error", message: "Select at least one word" };
  }

  try {
    const { words } = await scrapeArticle(url);
    const chosen = words.filter((word) => selected.has(word.term));
    const { added, duplicates } = await addWordsToAnki(chosen);
    return { status: "success", added, duplicates };
  } catch (error) {
    const message = Error.isError(error) ? error.message : "Failed to add cards to Anki";
    return { status: "error", message };
  }
}
