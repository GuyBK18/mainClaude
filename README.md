# LuminaRead

A personal library and reading journal for one reader. No accounts and no sync. Your library lives in the browser's LocalStorage behind a repository interface, so the data source can be swapped later. The only server code is the book importer, which runs inside `npm run dev` on your own machine.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`.

The library starts empty. It is saved in the browser's LocalStorage under `luminaread:library:v1`. Earlier versions filled a new library with 31 sample books. On the first load after the update, those sample books are removed once, with their highlights, reading sessions and sample goal. Books you added stay. If the stored library ever cannot be read, the app starts empty and keeps the unreadable text under `luminaread:library:v1:unreadable`.

## Stack

Next.js 15 (App Router), TypeScript in strict mode, Tailwind CSS v4, shadcn/ui-style components on Radix primitives, Framer Motion, Lucide icons, Recharts, Tiptap for the review and summary editor, cmdk for the command palette, Sonner for toasts.

The shadcn registry could not be reached while building, so the components in `components/ui` were written by hand in shadcn's structure and restyled to the design system. `components.json` is in place, so `npx shadcn add <component>` works from now on.

## Pages

| Route | What is there |
| --- | --- |
| `/` | Currently reading with ambient cover glow and a page slider, annual goal with a pace marker, KPI cards, a 53-week reading heatmap, recently finished |
| `/library` | Grid, Display (books standing face out in 3D), Spines (books leaning at an angle) and a sortable table. Filters for status, genre, length and rating. Sorts by date added, title, author, series (each series first to last), genre, length or rating, and remembers the choice. Quick add, URL import and Add many |
| `/book/[id]` | Cover over a blur of itself, editorial metadata, status and rating controls, rich text summary and review, highlights, quote card studio |
| `/analytics` | Genre distribution, reading velocity (pages a day against book length), pages per month. Each chart has a table view |

`Cmd+K` (or `Ctrl+K`) opens search over books, authors, series and highlights from any page.

## Data layer

```
types/reading.ts                    Book, Highlight, SeriesInfo, ReadingStatus, ReadingSession, ReadingGoal
lib/data/repository.ts              LibraryRepository interface (all methods async)
lib/data/local-storage-repository.ts  LocalStorage implementation
lib/data/migrations.ts              One-time changes to a stored library, run on load by its version
lib/data/index.ts                   getRepository(): the one place that picks the source
lib/library-context.tsx             React provider the UI reads from
```

To move to an API or a database, write a class that implements `LibraryRepository` and return it from `getRepository()`. Nothing in the UI imports the LocalStorage class directly.

`Book` also stores `description` (the publisher's text), `ratingSource` and `ratingsCount` for imported books. `goodreadsRating` keeps its name from the spec and holds the public average; `ratingSource` says which catalog it came from.

Reading progress is stored two ways. `Book.currentPage` is the bookmark. `ReadingSession` records pages per book per day and drives the heatmap, streaks and monthly totals. Moving the slider or typing a page logs the difference as today's session.

## Design system

The tokens in `app/globals.css` follow the locked spec: Paper and Obsidian surfaces, 1px hairlines, 8px card and 4px control radii, no shadows on UI chrome, no accent color. Active states use an underline or a light ink fill. Newsreader sets literary text, Space Grotesk sets headings and meta labels, Inter sets dense text such as the table.

Color and depth appear only on covers:

- Books without an image get a typeset cover (five layouts) from a stored three-color palette.
- `AmbientGlow` blurs that palette behind the cover. For books added with an image URL, the palette is read from the image in the browser when the host allows it.
- The heatmap uses a five-step grayscale ramp. Steps 1 to 4 pass the dataviz skill's ordinal check against both surfaces.

Both 3D views stand the books on a shelf board seen from a little above: a top surface running back to the wall, a lit lip, the front face and a soft shadow on the wall. It is drawn from theme tokens (`--shelf-*` in `app/globals.css`), so it reads the same way in light and dark. In Spines the board's lines are projected with the books' own perspective, so books stand on it and not over its edge.

The **Spines** view stands the books at an angle, pressed one against the next, so each shows its spine and a strip of cover. Pointing at a book slides it out along its own cover, which never touches its neighbors, and then either turns it to face you or leaves it at its angle. **Adjust** sets that choice, the angle (40° to 75°, default 62°) and how much of each cover shows (0 to 40 px, default 14 px). The settings stay in this browser. Only one book turns at a time: when the pointer moves on, the first book goes back before the next one turns. On a phone the first tap pulls a book out and the second opens it. Books with a cover image take their spine color from the image's left edge, with the title in cream or near-black, whichever stands out more. The books share one 3D scene, so the browser draws whichever is in front. The geometry is in `lib/leaning-shelf.ts`, and its tests check that no book passes through another at any angle, strip width or hand-off.

Motion: springs for layout shifts (grid filtering, tab and view changes), 0.98 scale on press, short ease-out enters for dialogs and popovers. The command palette opens with no animation because it is a keyboard action used many times a day. `prefers-reduced-motion` is respected through `MotionConfig`.

## Adding books

`Add book` opens on **Search**. Type a title, an author or an ISBN. Google Books and Open Library are searched together, the same book from both merges into one row, and you pick the right one. Picking it reads every catalog for that book and fills the form.

Books come in English. The search asks both catalogs for English editions only, and the details step takes the ISBN, publisher, pages, description and covers from English editions. To get a Hebrew edition, type the title in Hebrew (or an Israeli ISBN, which starts 978-965). An ISBN is looked up as is. Some fields hold for every edition and are taken from any of them: the Goodreads rating, series, genres and first publication year. Every description is also checked by its text, since catalogs sometimes mislabel an edition's language. If no catalog has an English description, the field stays empty and the dialog says so. For a Hebrew edition with no Hebrew description, the English one is used.

| Field | Where it comes from, in order |
| --- | --- |
| Rating and number of ratings | Goodreads, then Open Library, then Google Books (fallbacks need at least 5 ratings) |
| Series and number in series | Goodreads, then Wikidata |
| Genres | Goodreads genres, Google categories and Open Library subjects, mapped to the app's ten genres |
| Pages | Goodreads (the edition Goodreads shows for the book), then Google Books, then Open Library's median |
| Year | First publication: Open Library, then Goodreads, then the edition year from Google |
| Description | Google Books, then Goodreads, then Open Library, in the edition's language |
| Cover | Covers of English print and ebook editions: the Goodreads page, the other editions Goodreads lists, then Open Library and Google Books. You pick one of them or a designed cover |
| Publisher, ISBN | The English edition in Google Books first, then Goodreads |

Under the preview the dialog says which catalog gave which field, and notes any catalog that did not answer. Under **Your copy** is a row of covers: up to five different ones found in the catalogs, then a typeset cover in the library's own palettes, the same kind the seed books use. Click one or use the arrow keys.

Different editions often share one image, so the browser compares the covers before showing them. Each image goes through the app's cover route and is reduced to a small fingerprint: the shape of its light and dark areas, and the color of each region in a 4×6 grid. Covers that match on both show once. Square images (audiobooks), tiny placeholders and images that fail to load are left out. **Find more covers** shows the next five. When the first batch runs out, it asks the server for more: the next page of Goodreads' editions list, Open Library's editions and other Google Books volumes, all in the edition language. The button says so when nothing is left. The code is in `lib/metadata/covers.ts` (gathering), `lib/cover-compare.ts` (comparing) and `components/library/cover-picker.tsx`. You still choose the status, the format and your own rating, and every field stays editable before you save. The description appears on the book page under **About the book**.

**Import from URL** takes a Goodreads book page, any link with an ISBN such as Open Library or Amazon, or any other book link, which is searched by the title in its address. A Goodreads link is the most exact way to add a book: that page wins every field it has, and Google Books and Open Library only fill what it lacks, such as a second cover.

**Add many** (on the library page, or "Add many books from links" in the command palette) takes a pasted list of links and adds them in one go. Text around the links is ignored, so a list copied from notes or a chat works as it is. Each link goes through the same lookup as Import from URL, two at a time. You then see every book with its cover, series and page count, set the status per book or for all of them, and untick what you do not want. A book already in the library, or found twice in the list, starts unticked. A link that fails can be tried again, and a book with no page count asks for one. Finished books come in without reading dates, so they do not count toward the yearly goal or the heatmap until you add dates on the book page. The code is in `lib/bulk-add.ts` and `components/library/bulk-add-dialog.tsx`.

### How the lookup works

The browser calls four routes in `app/api/`: `books/search`, `books/details`, `books/covers` (more covers for a book) and `cover`. They run on your machine and call the catalogs from there, which avoids browser cross-origin limits. The `cover` route passes a cover image through the app's own address so the page can read its colors for the ambient glow. It only accepts known cover hosts.

Goodreads has no public API. The importer reads the public book page, the way a browser does, one page per book you pick. Each Goodreads page is one edition, with its own page count and cover. The importer searches Goodreads by title and author first, which leads to the edition Goodreads shows for the book, the same page you see there. The ISBN is the fallback. A page in another language only lends its rating, series and genres. This goes against a strict reading of Goodreads' terms of use, and it breaks if Goodreads changes its pages. The parser reads three layers (JSON-LD, the page's Next.js data, then the visible HTML), so a partial change still leaves most fields. To skip Goodreads, set `LUMINAREAD_GOODREADS=off` in `.env.local`. See `.env.example` for this and an optional Google Books API key.

Code: `lib/metadata/` has one file per catalog, plus `search.ts` (merging results) and `details.ts` (picking fields). The tests in `lib/metadata/__tests__/` run the parsers against saved responses. The base URL of every catalog can be changed through environment variables (`GOOGLE_BOOKS_API`, `OPEN_LIBRARY_BASE`, `OPEN_LIBRARY_COVERS`, `GOODREADS_BASE`, `WIKIDATA_SPARQL`), which is how the importer was tested against a local mock.

## Out of scope

Spoiler-gated companion features belong to the paused book companion project and are not in this build: no chapter gating, no character pages, no relationship map, no timelines, no challenge questions.
