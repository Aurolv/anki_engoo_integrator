import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { addWordsToAnki, type AnkiWord } from "./anki";

const ankiConnect = vi.hoisted(() => ({
  deck: { createDeck: vi.fn() },
  model: { modelNames: vi.fn(), createModel: vi.fn() },
  media: { storeMediaFile: vi.fn() },
  note: { canAddNotes: vi.fn(), addNotes: vi.fn() },
}));

// `new` on a constructor that returns an object yields that object.
vi.mock("yanki-connect", () => ({
  YankiConnect: function YankiConnect() {
    return ankiConnect;
  },
}));

type Card = { Word: string; PartOfSpeech: string; Definition: string; Example: string; Audio: string };
type Note = { deckName: string; modelName: string; fields: Card };

const SOUND_BASE_URL = "https://assets.app.engoo.com/sounds";
const NOTE_ID = 1700000000000;

function makeWord(overrides: Partial<AnkiWord> = {}): AnkiWord {
  return {
    term: "distraction",
    partOfSpeech: "Noun",
    definition: "something that stops a person from concentrating",
    example: "Social media is a huge distraction.",
    audioUrl: null,
    ...overrides,
  };
}

/** The notes handed to an AnkiConnect call, e.g. notesGivenTo(client.note.addNotes). */
function notesGivenTo(call: Mock): Note[] {
  return call.mock.lastCall?.[0].notes ?? [];
}

/** The first note built from the given words, before duplicates are dropped. */
function firstNote(): Note {
  return notesGivenTo(ankiConnect.note.canAddNotes)[0];
}

/** Fields of that first note — what the card will actually show. */
function firstCard(): Card {
  return firstNote().fields;
}

/** Terms that survived the duplicate filter and were sent to Anki. */
function submittedTerms(): string[] {
  return notesGivenTo(ankiConnect.note.addNotes).map((note) => note.fields.Word);
}

/** Makes downloads take time, and records how many ran at once. */
function trackDownloads() {
  const downloads = { peak: 0 };
  let active = 0;

  ankiConnect.media.storeMediaFile.mockImplementation(async ({ filename }) => {
    active += 1;
    downloads.peak = Math.max(downloads.peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    return filename;
  });

  return downloads;
}

describe("addWordsToAnki", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ankiConnect.model.modelNames.mockResolvedValue(["Engoo Vocab"]);
    ankiConnect.media.storeMediaFile.mockImplementation(async ({ filename }) => filename);
    ankiConnect.note.canAddNotes.mockImplementation(async ({ notes }) => notes.map(() => true));
    ankiConnect.note.addNotes.mockImplementation(async ({ notes }) => notes.map(() => NOTE_ID));
  });

  describe("deck and note type", () => {
    it("creates the deck", async () => {
      await addWordsToAnki([makeWord()]);

      expect(ankiConnect.deck.createDeck).toHaveBeenCalledWith({ deck: "Engoo" });
    });

    it("creates the note type when it is missing", async () => {
      ankiConnect.model.modelNames.mockResolvedValue([]);

      await addWordsToAnki([makeWord()]);

      expect(ankiConnect.model.createModel).toHaveBeenCalledWith(
        expect.objectContaining({ modelName: "Engoo Vocab" }),
      );
    });

    it("leaves an existing note type alone", async () => {
      ankiConnect.model.modelNames.mockResolvedValue(["Engoo Vocab"]);

      await addWordsToAnki([makeWord()]);

      expect(ankiConnect.model.createModel).not.toHaveBeenCalled();
    });

    it("files the card under the Engoo deck and note type", async () => {
      await addWordsToAnki([makeWord()]);

      expect(firstNote()).toMatchObject({ deckName: "Engoo", modelName: "Engoo Vocab" });
    });
  });

  describe("card fields", () => {
    it("maps the word and its part of speech", async () => {
      await addWordsToAnki([makeWord({ term: "resilient", partOfSpeech: "Adjective" })]);

      expect(firstCard()).toMatchObject({ Word: "resilient", PartOfSpeech: "Adjective" });
    });

    it("sends an empty example when the word has none", async () => {
      await addWordsToAnki([makeWord({ example: null })]);

      expect(firstCard().Example).toBe("");
    });

    it("sends an empty audio field when the word has no recording", async () => {
      await addWordsToAnki([makeWord({ audioUrl: null })]);

      expect(firstCard().Audio).toBe("");
    });

    it("skips the download when the word has no recording", async () => {
      await addWordsToAnki([makeWord({ audioUrl: null })]);

      expect(ankiConnect.media.storeMediaFile).not.toHaveBeenCalled();
    });
  });

  describe("audio", () => {
    it("names the media file after the last segment of the URL", async () => {
      await addWordsToAnki([makeWord({ audioUrl: `${SOUND_BASE_URL}/Abc123.mpga` })]);

      expect(ankiConnect.media.storeMediaFile).toHaveBeenCalledWith({
        filename: "Abc123.mpga",
        url: `${SOUND_BASE_URL}/Abc123.mpga`,
      });
    });

    it("references the filename Anki reports back, which may differ in case", async () => {
      ankiConnect.media.storeMediaFile.mockResolvedValue("lowercased.mpga");

      await addWordsToAnki([makeWord({ audioUrl: `${SOUND_BASE_URL}/Mixed.mpga` })]);

      expect(firstCard().Audio).toBe("[sound:lowercased.mpga]");
    });

    it("downloads one file at a time", async () => {
      const downloads = trackDownloads();

      await addWordsToAnki([
        makeWord({ audioUrl: `${SOUND_BASE_URL}/a.mpga` }),
        makeWord({ audioUrl: `${SOUND_BASE_URL}/b.mpga` }),
        makeWord({ audioUrl: `${SOUND_BASE_URL}/c.mpga` }),
      ]);

      expect(ankiConnect.media.storeMediaFile).toHaveBeenCalledTimes(3);
      expect(downloads.peak).toBe(1);
    });
  });

  describe("duplicates", () => {
    it("sends only the words Anki says it can add", async () => {
      ankiConnect.note.canAddNotes.mockResolvedValue([false, true]);

      await addWordsToAnki([makeWord({ term: "known" }), makeWord({ term: "unseen" })]);

      expect(submittedTerms()).toEqual(["unseen"]);
    });

    it("counts rejected words as duplicates", async () => {
      ankiConnect.note.canAddNotes.mockResolvedValue([false, false, true]);

      const result = await addWordsToAnki([makeWord(), makeWord(), makeWord()]);

      expect(result).toEqual({ added: 1, duplicates: 2 });
    });

    it("counts a word Anki skipped while adding as a duplicate", async () => {
      ankiConnect.note.addNotes.mockResolvedValue([NOTE_ID, null]);

      const result = await addWordsToAnki([makeWord(), makeWord()]);

      expect(result).toEqual({ added: 1, duplicates: 1 });
    });
  });

  describe("results", () => {
    it("reports every word as added when none exist yet", async () => {
      const result = await addWordsToAnki([makeWord(), makeWord()]);

      expect(result).toEqual({ added: 2, duplicates: 0 });
    });

    it("reports nothing added when the whole batch is rejected", async () => {
      ankiConnect.note.addNotes.mockResolvedValue(null);

      const result = await addWordsToAnki([makeWord()]);

      expect(result).toEqual({ added: 0, duplicates: 1 });
    });

    it("returns zeroes for an empty word list", async () => {
      const result = await addWordsToAnki([]);

      expect(result).toEqual({ added: 0, duplicates: 0 });
    });
  });

  describe("failures", () => {
    it("keeps the underlying reason in the message", async () => {
      ankiConnect.note.addNotes.mockRejectedValue(new Error("cannot create note: duplicate"));

      await expect(addWordsToAnki([makeWord()])).rejects.toThrow(/cannot create note: duplicate/);
    });

    it("hints that Anki may be closed", async () => {
      ankiConnect.deck.createDeck.mockRejectedValue(new Error("fetch failed"));

      await expect(addWordsToAnki([makeWord()])).rejects.toThrow(/make sure Anki is open/i);
    });
  });
});
