import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  editionLanguageFor,
  textLanguage,
  htmlToParagraphs,
  isIsbnQuery,
  languageCode,
  languageName,
  normalizeTitle,
  toIsbn13,
  yearFrom,
} from "../text";
import { mapGenres } from "../genres";

describe("text helpers", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("Jonathan Strange &amp; Mr. Norrell &#39;x&#x27; &mdash;")).toBe("Jonathan Strange & Mr. Norrell 'x' —");
  });

  it("turns HTML into plain paragraphs and drops every tag", () => {
    const out = htmlToParagraphs('<p><b>Bold</b> start.</p><p>Second<br><br>third <script>alert(1)</script></p>');
    expect(out).toBe("Bold start.\n\nSecond\n\nthird alert(1)");
    expect(out).not.toContain("<");
  });

  it("normalizes titles for matching", () => {
    expect(normalizeTitle("The Left Hand of Darkness: 50th Anniversary")).toBe("left hand of darkness");
    expect(normalizeTitle("Piranesi (Hardcover)")).toBe("piranesi");
    expect(normalizeTitle("סיפור על אהבה וחושך")).toBe("סיפור על אהבה וחושך");
  });

  it("converts ISBN-10 to ISBN-13 with the right check digit", () => {
    expect(toIsbn13("0441478123")).toBe("9780441478125");
    expect(toIsbn13("978-0-06-105488-4")).toBe("9780061054884");
    expect(toIsbn13("12345")).toBeUndefined();
    expect(isIsbnQuery("978-0441478125")).toBe(true);
    expect(isIsbnQuery("piranesi")).toBe(false);
  });

  it("reads years from dates and epoch milliseconds, including before 1970", () => {
    expect(yearFrom("2020-09-15")).toBe(2020);
    expect(yearFrom(136512000000)).toBe(1974);
    expect(yearFrom(-2808172800000)).toBe(1881);
    expect(yearFrom(180)).toBe(180);
  });

  it("maps language codes and names", () => {
    expect(languageCode("heb")).toBe("he");
    expect(languageCode("English")).toBe("en");
    expect(languageCode("Polish")).toBe("pl");
    expect(languageCode("English (US)")).toBe("en");
    // A declared language it does not know is still not English.
    expect(languageCode("Klingon")).toBe("other");
    expect(languageName("he")).toBe("Hebrew");
    expect(languageName("other")).toBeUndefined();
  });

  it("asks for English editions unless the query is Hebrew or an Israeli ISBN", () => {
    expect(editionLanguageFor("golden son")).toBe("en");
    expect(editionLanguageFor("בן הזהב")).toBe("he");
    expect(editionLanguageFor("978-965-07-1234-5")).toBe("he");
    expect(editionLanguageFor("9780441478125")).toBe("en");
  });

  it("tells English, Hebrew and other passages apart", () => {
    expect(textLanguage("Darrow is a Red, a member of the lowest caste in the color-coded society of the future. He works in the mines.")).toBe("en");
    expect(
      textLanguage("Człowiek może stać się potworem, ale żaden potwór nie stanie się człowiekiem. Darrow wspina się coraz wyżej po szczeblach kariery."),
    ).toBe("other");
    expect(textLanguage("Darrow ist ein Roter, ein Mitglied der niedrigsten Kaste in der farbcodierten Gesellschaft der Zukunft.")).toBe("other");
    expect(textLanguage("דארו הוא אדום, בן למעמד הנמוך ביותר בחברה של העתיד, והוא עובד במכרות של מאדים.")).toBe("he");
    expect(textLanguage("Short blurb.")).toBeUndefined();
  });
});

describe("genre mapping", () => {
  it("weights Goodreads genres over broad catalog labels", () => {
    const genres = mapGenres([
      { labels: ["Science Fiction", "Fiction", "Classics", "Philosophy"], weight: 3 },
      { labels: ["Fiction / Literary"], weight: 2 },
    ]);
    expect(genres[0]).toBe("Science Fiction");
    expect(genres).toContain("Literary Fiction");
  });

  it("never lets generic tags like Fiction or Classics outrank a real genre", () => {
    expect(mapGenres([{ labels: ["Fiction", "Classics", "Novels", "Fantasy"], weight: 5 }])[0]).toBe("Fantasy");
    expect(mapGenres([{ labels: ["Fiction", "Classics"], weight: 5 }])).toEqual(["Literary Fiction"]);
  });

  it("keeps Non-fiction only for books with no fiction genre", () => {
    expect(mapGenres([{ labels: ["History", "Nature"], weight: 1 }])).toEqual(["Non-fiction"]);
    expect(mapGenres([{ labels: ["Fantasy fiction", "History"], weight: 1 }])).toEqual(["Fantasy"]);
    expect(mapGenres([{ labels: ["Biography & Autobiography", "History"], weight: 2 }])).toEqual(["Memoir", "Non-fiction"]);
  });
});
