import { YankiConnect } from "yanki-connect";

const DECK_NAME = "Engoo";
const MODEL_NAME = "Engoo Vocab";
const MODEL_FIELDS = ["Word", "PartOfSpeech", "Definition", "Example", "Audio"];

const MODEL_CSS = `
.card {
  font-family: arial;
  font-size: 20px;
  line-height: 1.5;
  text-align: center;
  color: black;
  background-color: white;
}
.tag {
  font-size: 14px;
  color: #888;
  text-transform: uppercase;
}
.example {
  font-style: italic;
  color: #555;
}
`;

const CARD_FRONT = "{{Word}}";

const CARD_BACK = `
{{FrontSide}}
<hr id="answer">
<div class="tag">{{PartOfSpeech}}</div>
<div>{{Definition}}</div>
{{#Example}}<div class="example">{{Example}}</div>{{/Example}}
{{Audio}}
`;

const client = new YankiConnect();

export interface AnkiWord {
  term: string;
  partOfSpeech: string;
  definition: string;
  example: string | null;
  audioUrl: string | null;
}

export type AnkiImportResult = {
  added: number;
  duplicates: number;
};

async function ensureModelExists(): Promise<void> {
  const models = await client.model.modelNames();
  if (models.includes(MODEL_NAME)) return;

  await client.model.createModel({
    modelName: MODEL_NAME,
    inOrderFields: MODEL_FIELDS,
    css: MODEL_CSS,
    cardTemplates: [{ Front: CARD_FRONT, Back: CARD_BACK }],
  });
}

async function storeAudio(audioUrl: string): Promise<string> {
  const filename = new URL(audioUrl).pathname.split("/").pop()!;
  return client.media.storeMediaFile({ filename, url: audioUrl });
}

export async function addWordsToAnki(words: AnkiWord[]): Promise<AnkiImportResult> {
  try {
    await client.deck.createDeck({ deck: DECK_NAME });
    await ensureModelExists();

    // Sequential on purpose: AnkiConnect is single-threaded, and parallel downloads
    // through it get their connections refused.
    const notes = [];
    for (const word of words) {
      const audioFilename = word.audioUrl ? await storeAudio(word.audioUrl) : null;
      notes.push({
        deckName: DECK_NAME,
        modelName: MODEL_NAME,
        fields: {
          Word: word.term,
          PartOfSpeech: word.partOfSpeech,
          Definition: word.definition,
          Example: word.example ?? "",
          Audio: audioFilename ? `[sound:${audioFilename}]` : "",
        },
        options: { allowDuplicate: false },
      });
    }

    const canAddByIndex = await client.note.canAddNotes({ notes });
    const addableNotes = notes.filter((_, index) => canAddByIndex[index]);

    const createdIds = await client.note.addNotes({ notes: addableNotes });
    const addedCount = (createdIds ?? []).filter((id) => id !== null).length;
    return { added: addedCount, duplicates: notes.length - addedCount };
  } catch (error) {
    const errorReason = Error.isError(error) ? error.message : String(error);
    throw new Error(`Anki error: ${errorReason} (make sure Anki is open)`, { cause: error });
  }
}
