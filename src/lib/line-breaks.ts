// Reading rhythm for every message in the app: one sentence per line, and a clause
// joined by a comma ("확인해 보고, 바로 알려 드릴게요") starts a new line too.
// A comma that only lists words ("공감, 사과, 대안") stays on the same line.

/** Korean endings that close a clause right before a comma. */
const CLAUSE_END =
  /(고|며|면서|지만|는데|은데|던데|인데|해서|어서|아서|라서|니까|으니|면|도|요|다|죠|게|서),[ \t]+/g;

/** A sentence ends with . ! ? (optionally inside closing quotes or brackets). */
const SENTENCE_END = /([.!?。…][”"’')\]]?)[ \t]+(?=\S)/g;

export function sentenceBreaks(text: string): string {
  return text
    .replace(/\s*\n\s*/g, "\n")
    .replace(SENTENCE_END, "$1\n")
    .replace(CLAUSE_END, "$1,\n")
    .trim();
}
