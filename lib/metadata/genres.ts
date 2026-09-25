import type { Genre } from "@/types/reading";

/**
 * Keyword rules from catalog categories to the app's genres. Checked in order; the
 * first rule a label matches wins for that label. Fiction-specific rules come before
 * the broad non-fiction ones so "History / Fiction" lands in Historical Fiction.
 */
const RULES: [Genre, RegExp][] = [
  ["Science Fiction", /science fiction|sci-?fi|\bsf\b|dystopi|space opera|cyberpunk|time travel|aliens|post-?apocalyptic/],
  ["Fantasy", /fantasy|magic|dragons?|fairy ?tales?|mytholog|wizards?|witches/],
  ["Mystery", /myster|detective|crime fiction|thriller|suspense|noir|whodunit|police procedural/],
  ["Historical Fiction", /historical fiction|fiction.*histor|histor.*fiction|historical novel/],
  ["Poetry", /poetry|poems?\b|verse/],
  ["Essays", /essays?\b/],
  ["Memoir", /memoir|autobiograph|biograph|diaries|letters/],
  ["Philosophy", /philosoph|ethics|stoic|metaphysics|existential/],
  ["Literary Fiction", /literary|contemporary fiction|general fiction/],
  [
    "Non-fiction",
    /non-?fiction|history|science\b|nature|psycholog|self-help|business|politic|econom|sociolog|true crime|biology|physics|religion|travel|journalism|cooking|health/,
  ],
];

/** Tags nearly every novel carries. They hint at Literary Fiction but should never outrank a real genre. */
const GENERIC = /^(fiction|classics?|novels?|literature|general|fiction \/ general|adult fiction|adult)$/;
const GENERIC_FACTOR = 0.3;

export function genreFor(label: string): Genre | undefined {
  const l = label.toLowerCase().trim();
  if (GENERIC.test(l)) return "Literary Fiction";
  return RULES.find(([, re]) => re.test(l))?.[0];
}

/**
 * Scores genres across catalogs. Each genre counts once per source, at its earliest
 * position (Goodreads orders genres by reader votes), scaled by how reliable the source is.
 */
export function mapGenres(sources: { labels: string[]; weight: number }[], max = 3): Genre[] {
  const scores = new Map<Genre, number>();
  for (const { labels, weight } of sources) {
    const best = new Map<Genre, number>();
    labels.slice(0, 20).forEach((label, i) => {
      const genre = genreFor(label);
      if (!genre) return;
      const factor = GENERIC.test(label.toLowerCase().trim()) ? GENERIC_FACTOR : 1;
      const score = (weight * factor) / (1 + i * 0.35);
      best.set(genre, Math.max(best.get(genre) ?? 0, score));
    });
    for (const [genre, score] of best) scores.set(genre, (scores.get(genre) ?? 0) + score);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  // "Non-fiction" is only a fallback label: keep it when nothing more specific matched a non-fiction book.
  const specific = ranked.filter((g) => g !== "Non-fiction");
  const isFiction = specific.some((g) => g !== "Memoir" && g !== "Philosophy" && g !== "Essays");
  const result = isFiction || !ranked.includes("Non-fiction") ? specific : [...specific, "Non-fiction" as Genre];
  return result.slice(0, max);
}
