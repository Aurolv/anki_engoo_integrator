/**
 * @fileoverview Client for Engoo's undocumented Daily News JSON API (found by
 * inspecting the site's own network requests, not from published docs).
 * Everything below was learned by sampling real responses, not from a spec,
 * so it's recorded here rather than left implicit.
 *
 * **Endpoint**: `GET https://api.engoo.com/api/lessons/{lessonId}/current`,
 * no auth required. `{lessonId}` is the UUID hidden in the article URL's
 * last path segment, re-encoded as 22-char base64url see `parseLessonId`.
 *
 * **Shape**: normalized, not nested. The response is `{ data, references }`.
 * `data` is the lesson tree; anywhere a value would repeat, it's replaced
 * with `{ "_ref": "ref:h:<hash>" }` and the real object lives once in
 * `references[hash]`. `inlineReferences` undoes this up front, so nothing
 * past that point needs to know refs exist.
 *
 * **Two eras of lesson data** (cutover ~2019):
 * - Old lessons inline the word and its example directly: `word` is `null`,
 *   `local_word` holds the object, and the sentence link's `local_sentence`
 *   holds the text.
 * - New lessons reference a shared object instead: `word` is a `{ _ref }`
 *   pointing to a `Word`, and the sentence link's `word_sentence` is a
 *   `{ _ref }` to a `WordSentence` whose own `sentence` field is a further
 *   `{ _ref }` to the actual `Sentence`.
 * - A minority of lessons use a third shape, where the sentence link's
 *   `global_sentence` is a `{ _ref }` straight to a `Sentence`.
 *
 * Dropping any one branch silently loses real vocabulary this file used to
 * drop `local_word` and separately `global_sentence`, and each time lost
 * real words or examples with no error, just fewer results than expected.
 *
 * **Field reliability**: `word`, `part_of_speech`, `definition`, and
 * `title_text` have shown up on every lesson sampled so far. `sound.url`
 * (→ `audioUrl`) is missing on lessons old enough to predate recorded audio.
 * `example` is treated as optional below since nothing about the API
 * guarantees it, even though no missing case has been observed yet.
 *
 * Undocumented, and the `as ApiLesson` cast below doesn't check any of it 
 * a shape change won't throw, it'll just quietly return fewer words than
 * the article has.
 */

import { stringify as stringifyUuid } from "uuid";

export interface EngooWord {
  word: string;
  partOfSpeech: string;
  definition: string;
  // Older lessons predate audio, and a handful of words ship without an example.
  example: string | null;
  audioUrl: string | null;
}

export interface EngooArticle {
  title: string;
  words: EngooWord[];
}

interface ApiWord {
  word?: string;
  part_of_speech?: string;
  definition?: string;
  sound?: { url?: string } | null;
}

// Which of these fields are set varies by lesson era (the API changed ~2019).
interface ApiVocabWord {
  word?: ApiWord | null;
  local_word?: ApiWord | null;
  vocab_section_word_sentences?: {
    local_sentence?: { text?: string } | null;
    global_sentence?: { text?: string } | null;
    word_sentence?: { sentence?: { text?: string } | null } | null;
  }[];
}

interface ApiLesson {
  title_text?: { text?: string } | null;
  exercises?: { sections?: { _type?: string; vocab_section_words?: ApiVocabWord[] }[] }[];
}

// The id in an article URL is a UUID in base64url decoded locally, no request
function parseLessonId(rawUrl: string): string {
  const url = new URL(rawUrl.trim());

  if (url.hostname !== "engoo.com" && url.hostname !== "www.engoo.com") {
    throw new Error(`Expected an engoo.com link, got ${url.hostname}`);
  }

  const id = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const bytes = Buffer.from(id, "base64url");

  // Buffer.from silently drops characters outside the alphabet, so re-encode to verify.
  if (bytes.length !== 16 || bytes.toString("base64url") !== id) {
    throw new Error("That link has no article id");
  }

  return stringifyUuid(bytes);
}

// Anything JSON.parse can produce  what the API payload is made of
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

// Replaces every { _ref } with its object from `references`, recursively.
// Refs are content hashes, so they cannot form cycles.
function inlineReferences(node: Json, references: Record<string, Json>): Json {
  if (node === null || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node.map((item) => inlineReferences(item, references));
  }

  if (typeof node._ref === "string") {
    const referencedObject = references[node._ref];
    return inlineReferences(referencedObject, references);
  }

  const inlinedEntries = Object.entries(node).map(([key, child]) => [key, inlineReferences(child, references)]);
  return Object.fromEntries(inlinedEntries);
}

const clean = (value: string | undefined) => value?.trim() || null;

function extractWord(entry: ApiVocabWord): EngooWord | null {
  const source = entry.local_word ?? entry.word;
  const word = clean(source?.word);
  const partOfSpeech = clean(source?.part_of_speech);
  const definition = clean(source?.definition);
  // Guarantees the non-nullable EngooWord fields instead of just asserting them.
  if (!source || !word || !partOfSpeech || !definition) return null;

  const example = (entry.vocab_section_word_sentences ?? [])
    .map((link) => link.local_sentence ?? link.global_sentence ?? link.word_sentence?.sentence)
    .map((sentence) => clean(sentence?.text))
    .find(Boolean);

  return {
    word,
    partOfSpeech,
    definition,
    example: example ?? null,
    audioUrl: clean(source.sound?.url),
  };
}

export async function scrapeArticle(rawUrl: string): Promise<EngooArticle> {
  const lessonId = parseLessonId(rawUrl);
  const response = await fetch(`https://api.engoo.com/api/lessons/${lessonId}/current`, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`Engoo responded with status ${response.status}`);

  const payload = (await response.json()) as { data: Json; references: Record<string, Json> };
  const lesson = inlineReferences(payload.data, payload.references ?? {}) as ApiLesson;

  const words = (lesson.exercises ?? [])
    .flatMap((exercise) => exercise.sections ?? [])
    // Sections are heterogeneous and ordered arbitrarily match on _type
    .filter((section) => section._type === "VocabSection")
    .flatMap((section) => section.vocab_section_words ?? [])
    .map(extractWord)
    .filter((word) => word !== null);

  const title = clean(lesson.title_text?.text);
  // Every lesson has one, so its absence means the payload isn't what we expect
  if (!title) throw new Error("Lesson has no title");

  return { title, words };
}
