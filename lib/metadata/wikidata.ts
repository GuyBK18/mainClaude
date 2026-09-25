import type { SeriesInfo } from "@/types/reading";
import { endpoints, getJSON, TOOL_UA } from "./http";
import { hasHebrew, surname } from "./text";

type Binding = { seriesLabel?: { value: string }; ordinal?: { value: string } };

/**
 * Series fallback for when Goodreads has none: Wikidata's "part of the series" (P179)
 * with its "series ordinal" (P1545) qualifier, matched on exact title and author surname.
 */
export async function wikidataSeries(title: string, author?: string): Promise<SeriesInfo | undefined> {
  const lang = hasHebrew(title) ? "he" : "en";
  // JSON string escaping is valid SPARQL string syntax.
  const authorClause = author
    ? `?book wdt:P50 ?author . ?author rdfs:label ?authorLabel .
       FILTER(CONTAINS(LCASE(STR(?authorLabel)), ${JSON.stringify(surname(author))}))`
    : "";
  const query = `SELECT ?seriesLabel ?ordinal WHERE {
    ?book rdfs:label ${JSON.stringify(title)}@${lang} ; p:P179 ?statement .
    ${authorClause}
    ?statement ps:P179 ?series .
    OPTIONAL { ?statement pq:P1545 ?ordinal }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". }
  } LIMIT 5`;

  const url = `${endpoints.wikidataSparql}?format=json&query=${encodeURIComponent(query)}`;
  const data = await getJSON<{ results?: { bindings?: Binding[] } }>(url, {
    timeoutMs: 7000,
    headers: { Accept: "application/sparql-results+json", "User-Agent": TOOL_UA },
  });
  const rows = data.results?.bindings ?? [];
  const row = rows.find((r) => r.seriesLabel && r.ordinal) ?? rows.find((r) => r.seriesLabel);
  const position = Number(row?.ordinal?.value);
  if (!row?.seriesLabel || !Number.isFinite(position) || position <= 0) return undefined;
  return { name: row.seriesLabel.value, position };
}
