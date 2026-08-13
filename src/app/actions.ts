"use server";

import { scrapeArticle, type EngooArticle } from "@/lib/engoo";

export type ImportState = | { status: "idle" }
                          | { status: "error"; message: string }
                          | { status: "success"; article: EngooArticle };

export async function importArticle(_previous: ImportState, formData: FormData): Promise<ImportState> {
  const url = formData.get("url");
  
  if (typeof url !== "string") {
    return { status: "error", message: "Paste an article link first" };
  }

  try {
    return { status: "success", article: await scrapeArticle(url) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch the article";
    return { status: "error", message };
  }
}
