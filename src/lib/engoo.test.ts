import { afterEach, describe, expect, it, vi } from "vitest";
import { scrapeArticle } from "./engoo";

const ARTICLE_URL = "https://engoo.com/app/daily-news/article/slug/yjdZtp-JEearTz9F6Pk8Kw";

function stubEngooApi(payload: unknown, status = 200) {
  const fetchStub = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(payload), { status }));
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

//Builds the `{ data, references }` envelope the API actually returns.
function lesson({
  words = [] as unknown[],
  references = {} as Record<string, unknown>,
  title = "Some Article",
} = {}) {
  return {
    data: {
      title_text: { text: title },
      exercises: [{ sections: [{ _type: "VocabSection", vocab_section_words: words }] }],
    },
    references,
  };
}

describe("scrapeArticle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("article link", () => {
    it("rejects a host that merely starts with engoo.com", async () => {
      const fetchStub = stubEngooApi(lesson());

      await expect(
        scrapeArticle("https://engoo.com.attacker.tld/app/daily-news/article/x/yjdZtp-JEearTz9F6Pk8Kw"),
      ).rejects.toThrow(/expected an engoo\.com link/i);
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it("rejects a link pointing at the local Anki port", async () => {
      const fetchStub = stubEngooApi(lesson());

      await expect(scrapeArticle("http://localhost:8765/")).rejects.toThrow(/engoo\.com/i);
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it("rejects a link without an article id", async () => {
      stubEngooApi(lesson());

      await expect(scrapeArticle("https://engoo.com/app/daily-news")).rejects.toThrow(/no article id/i);
    });

    it("rejects an id that does not decode to 16 bytes", async () => {
      stubEngooApi(lesson());

      await expect(scrapeArticle("https://engoo.com/app/daily-news/article/x/tooshort")).rejects.toThrow(
        /no article id/i,
      );
    });

    it("rejects a string that is not a URL", async () => {
      stubEngooApi(lesson());

      await expect(scrapeArticle("not a url")).rejects.toThrow();
    });

    it("rejects a bare engoo.com link with no path at all", async () => {
      stubEngooApi(lesson());

      await expect(scrapeArticle("https://engoo.com/")).rejects.toThrow(/no article id/i);
    });

    it("accepts www.engoo.com", async () => {
      stubEngooApi(lesson());

      await expect(
        scrapeArticle("https://www.engoo.com/app/daily-news/article/x/yjdZtp-JEearTz9F6Pk8Kw"),
      ).resolves.toBeDefined();
    });

    it("requests the lesson id decoded from base64url into a UUID", async () => {
      const fetchStub = stubEngooApi(lesson());

      await scrapeArticle(ARTICLE_URL);

      expect(fetchStub).toHaveBeenCalledWith(
        expect.stringContaining("ca3759b6-9f89-11e6-ab4f-3f45e8f93c2b"),
        expect.anything(),
      );
    });

    it("ignores query string and fragment", async () => {
      const fetchStub = stubEngooApi(lesson());

      await scrapeArticle(`${ARTICLE_URL}?utm_source=newsletter#vocabulary`);

      expect(fetchStub).toHaveBeenCalledOnce();
    });
  });

  // Engoo changed its payload shape over the years and still serves all of them.
  describe("lesson shapes", () => {
    it("reads a word and example held behind reference chains", async () => {
      stubEngooApi(
        lesson({
          words: [
            {
              word: { _ref: "ref:word" },
              vocab_section_word_sentences: [{ word_sentence: { _ref: "ref:wrapper" } }],
            },
          ],
          references: {
            "ref:word": {
              word: "get on with",
              part_of_speech: "Phrasal Verb",
              definition: "to begin or continue doing something",
              sound: { url: "https://assets.app.engoo.com/sounds/abc.mpga" },
            },
            "ref:wrapper": { sentence: { _ref: "ref:sentence" } },
            "ref:sentence": { text: "I'd better get on with it." },
          },
        }),
      );

      const { words } = await scrapeArticle(ARTICLE_URL);

      expect(words).toEqual([
        {
          term: "get on with",
          partOfSpeech: "Phrasal Verb",
          definition: "to begin or continue doing something",
          example: "I'd better get on with it.",
          audioUrl: "https://assets.app.engoo.com/sounds/abc.mpga",
        },
      ]);
    });

    it("reads a word and example inlined under local_word", async () => {
      stubEngooApi(
        lesson({
          words: [
            {
              word: null,
              local_word: {
                word: "obesity",
                part_of_speech: "Noun",
                definition: "a condition where you have too much fat stored in the body",
              },
              vocab_section_word_sentences: [
                { local_sentence: { text: "An unhealthy diet can lead to obesity." } },
              ],
            },
          ],
        }),
      );

      const {
        words: [word],
      } = await scrapeArticle(ARTICLE_URL);

      expect(word).toMatchObject({
        term: "obesity",
        example: "An unhealthy diet can lead to obesity.",
      });
    });

    it("reads an example held under global_sentence", async () => {
      stubEngooApi(
        lesson({
          words: [
            {
              word: { _ref: "ref:word" },
              vocab_section_word_sentences: [{ global_sentence: { _ref: "ref:sentence" } }],
            },
          ],
          references: {
            "ref:word": { word: "persuade", part_of_speech: "Verb", definition: "to convince" },
            "ref:sentence": { text: "He persuaded her to sign the deal." },
          },
        }),
      );

      const {
        words: [word],
      } = await scrapeArticle(ARTICLE_URL);

      expect(word.example).toBe("He persuaded her to sign the deal.");
    });

    it("reads all three shapes appearing in one lesson", async () => {
      stubEngooApi(
        lesson({
          words: [
            {
              word: { _ref: "ref:a" },
              vocab_section_word_sentences: [{ word_sentence: { _ref: "ref:wrapper" } }],
            },
            {
              local_word: { word: "beta", part_of_speech: "Noun", definition: "second" },
              vocab_section_word_sentences: [{ local_sentence: { text: "Beta sentence." } }],
            },
            {
              word: { _ref: "ref:c" },
              vocab_section_word_sentences: [{ global_sentence: { _ref: "ref:global" } }],
            },
          ],
          references: {
            "ref:a": { word: "alpha", part_of_speech: "Noun", definition: "first" },
            "ref:c": { word: "gamma", part_of_speech: "Noun", definition: "third" },
            "ref:wrapper": { sentence: { _ref: "ref:inner" } },
            "ref:inner": { text: "Alpha sentence." },
            "ref:global": { text: "Gamma sentence." },
          },
        }),
      );

      const { words } = await scrapeArticle(ARTICLE_URL);

      expect(words).toEqual([
        { term: "alpha", partOfSpeech: "Noun", definition: "first", example: "Alpha sentence.", audioUrl: null },
        { term: "beta", partOfSpeech: "Noun", definition: "second", example: "Beta sentence.", audioUrl: null },
        { term: "gamma", partOfSpeech: "Noun", definition: "third", example: "Gamma sentence.", audioUrl: null },
      ]);
    });
  });

  describe("optional and malformed fields", () => {
    it("returns null audio when the word has no sound", async () => {
      stubEngooApi(
        lesson({
          words: [{ word: { _ref: "ref:word" } }],
          references: {
            "ref:word": { word: "test", part_of_speech: "Noun", definition: "a definition", sound: null },
          },
        }),
      );

      const {
        words: [word],
      } = await scrapeArticle(ARTICLE_URL);

      expect(word.audioUrl).toBeNull();
    });

    it("returns null example when the word has no sentences", async () => {
      stubEngooApi(
        lesson({
          words: [{ word: { _ref: "ref:word" }, vocab_section_word_sentences: [] }],
          references: {
            "ref:word": { word: "test", part_of_speech: "Noun", definition: "a definition" },
          },
        }),
      );

      const {
        words: [word],
      } = await scrapeArticle(ARTICLE_URL);

      expect(word.example).toBeNull();
    });

    it("trims surrounding whitespace", async () => {
      stubEngooApi(
        lesson({
          words: [{ word: { _ref: "ref:word" } }],
          references: {
            "ref:word": { word: "  spaced  ", part_of_speech: "Noun", definition: "\n a definition \t" },
          },
        }),
      );

      const {
        words: [word],
      } = await scrapeArticle(ARTICLE_URL);

      expect(word).toMatchObject({ term: "spaced", definition: "a definition" });
    });

    it("drops a word whose definition is only whitespace", async () => {
      stubEngooApi(
        lesson({
          words: [{ word: { _ref: "ref:word" } }],
          references: {
            "ref:word": { word: "test", part_of_speech: "Noun", definition: "   " },
          },
        }),
      );

      const { words } = await scrapeArticle(ARTICLE_URL);

      expect(words).toEqual([]);
    });

    it("drops a word whose reference is missing from the lookup table", async () => {
      stubEngooApi(lesson({ words: [{ word: { _ref: "ref:absent" } }] }));

      const { words } = await scrapeArticle(ARTICLE_URL);

      expect(words).toEqual([]);
    });

    it("keeps usable words when a neighbouring entry is incomplete", async () => {
      stubEngooApi(
        lesson({
          words: [{ word: { _ref: "ref:complete" } }, { word: { _ref: "ref:incomplete" } }],
          references: {
            "ref:complete": { word: "fine", part_of_speech: "Noun", definition: "usable" },
            "ref:incomplete": { word: "broken", part_of_speech: "Noun" },
          },
        }),
      );

      const { words } = await scrapeArticle(ARTICLE_URL);

      expect(words.map((word) => word.term)).toEqual(["fine"]);
    });
  });

  describe("lesson structure", () => {
    it("ignores sections that are not VocabSection", async () => {
      stubEngooApi({
        data: {
          title_text: { text: "Some Article" },
          exercises: [
            {
              sections: [
                { _type: "ArticleSection", vocab_section_words: [{ word: { _ref: "ref:word" } }] },
                { _type: "QuestionSection", vocab_section_words: [{ word: { _ref: "ref:word" } }] },
              ],
            },
          ],
        },
        references: {
          "ref:word": { word: "ignored", part_of_speech: "Noun", definition: "should not appear" },
        },
      });

      const { words } = await scrapeArticle(ARTICLE_URL);

      expect(words).toEqual([]);
    });

    it("collects vocabulary from every exercise", async () => {
      stubEngooApi({
        data: {
          title_text: { text: "Some Article" },
          exercises: [
            { sections: [{ _type: "VocabSection", vocab_section_words: [{ word: { _ref: "ref:one" } }] }] },
            { sections: [{ _type: "VocabSection", vocab_section_words: [{ word: { _ref: "ref:two" } }] }] },
          ],
        },
        references: {
          "ref:one": { word: "one", part_of_speech: "Noun", definition: "first" },
          "ref:two": { word: "two", part_of_speech: "Noun", definition: "second" },
        },
      });

      const { words } = await scrapeArticle(ARTICLE_URL);

      expect(words.map((word) => word.term)).toEqual(["one", "two"]);
    });

    it("returns the lesson title", async () => {
      stubEngooApi(lesson({ title: "Work a Good Distraction" }));

      const { title } = await scrapeArticle(ARTICLE_URL);

      expect(title).toBe("Work a Good Distraction");
    });

    it("returns no words when the payload omits exercises entirely", async () => {
      stubEngooApi({ data: { title_text: { text: "Some Article" } }, references: {} });

      const { words } = await scrapeArticle(ARTICLE_URL);

      expect(words).toEqual([]);
    });

    it("returns no words when an exercise omits its sections", async () => {
      stubEngooApi({
        data: { title_text: { text: "Some Article" }, exercises: [{}] },
        references: {},
      });

      const { words } = await scrapeArticle(ARTICLE_URL);

      expect(words).toEqual([]);
    });

    it("returns no words when a section omits its word list", async () => {
      stubEngooApi({
        data: {
          title_text: { text: "Some Article" },
          exercises: [{ sections: [{ _type: "VocabSection" }] }],
        },
        references: {},
      });

      const { words } = await scrapeArticle(ARTICLE_URL);

      expect(words).toEqual([]);
    });

    it("survives a payload with no references table", async () => {
      stubEngooApi({ data: { title_text: { text: "Some Article" }, exercises: [] } });

      const { title } = await scrapeArticle(ARTICLE_URL);

      expect(title).toBe("Some Article");
    });
  });

  describe("failures", () => {
    it("throws when Engoo answers with an error status", async () => {
      stubEngooApi(lesson(), 503);

      await expect(scrapeArticle(ARTICLE_URL)).rejects.toThrow(/503/);
    });

    it("throws when the lesson has no title, since every lesson has one", async () => {
      stubEngooApi({ data: { title_text: null, exercises: [] }, references: {} });

      await expect(scrapeArticle(ARTICLE_URL)).rejects.toThrow(/no title/i);
    });
  });
});
