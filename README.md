# LuminaRead

A personal library and reading journal for one reader. No accounts and no sync. Your library lives in the browser's LocalStorage behind a repository interface, so the data source can be swapped later. The only server code is the book importer, which runs inside `npm run dev` on your own machine.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`.

The first load writes a seed library of 31 books, a year of reading sessions and some highlights. Dates are relative to the day you first open the app, so the dashboard always has a current year to show. To start over, clear the `luminaread:library:v1` key in LocalStorage.

## Stack

Next.js 15 (App Router), TypeScript in strict mode, Tailwind CSS v4, shadcn/ui-style components on Radix primitives, Framer Motion, Lucide icons, Recharts, Tiptap for the review and summary editor, cmdk for the command palette, Sonner for toasts.

The shadcn registry could not be reached while building, so the components in `components/ui` were written by hand in shadcn's structure and restyled to the design system. `components.json` is in place, so `npx shadcn add <component>` works from now on.

## Pages

| Route | What is there |
| --- | --- |
| `/` | Currently reading with ambient cover glow and a page slider, annual goal with a pace marker, KPI cards, a 53-week reading heatmap, recently finished |
| `/library` | Grid, 3D shelf and sortable table views. Filters for status, genre, length and rating. Quick add and URL import |
| `/book/[id]` | Cover over a blur of itself, editorial metadata, status and rating controls, rich text summary and review, highlights, quote card studio |
| `/analytics` | Genre distribution, reading velocity (pages a day against book length), pages per month. Each chart has a table view |

`Cmd+K` (or `Ctrl+K`) opens search over books, authors, series and highlights from any page.

## Data layer

```
types/reading.ts                    Book, Highlight, SeriesInfo, ReadingStatus, ReadingSession, ReadingGoal
lib/data/repository.ts              LibraryRepository interface (all methods async)
lib/data/local-storage-repository.ts  LocalStorage implementation
lib/data/seed.json                  Seed catalog with relative dates
lib/data/seed.ts                    Turns the catalog into dated books and daily sessions
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

Motion: springs for layout shifts (grid filtering, tab and view changes), 0.98 scale on press, short ease-out enters for dialogs and popovers. The command palette opens with no animation because it is a keyboard action used many times a day. `prefers-reduced-motion` is respected through `MotionConfig`.

## Adding books

`Add book` opens on **Search**. Type a title, an author or an ISBN. Hebrew titles are sent as typed; how many Hebrew books come back depends on the catalogs, and Google Books usually has more of them than Open Library. Google Books and Open Library are searched together, the same book from both merges into one row, and you pick the right edition. Picking it reads every catalog for that book and fills the form:

| Field | Where it comes from, in order |
| --- | --- |
| Rating and number of ratings | Goodreads, then Open Library, then Google Books (fallbacks need at least 5 ratings) |
| Series and number in series | Goodreads, then Wikidata |
| Genres | Goodreads genres, Google categories and Open Library subjects, mapped to the app's ten genres |
| Pages | Goodreads (the edition), then Google Books, then Open Library's median |
| Year | First publication: Open Library, then Goodreads, then the edition year from Google |
| Description | Google Books, then Goodreads, then Open Library |
| Cover | Goodreads, then Open Library, then Google Books |
| Publisher, ISBN, language | Google Books first |

Under the preview the dialog says which catalog gave which field, and notes any catalog that did not answer. You still choose the status, the format and your own rating, and every field stays editable before you save. The description appears on the book page under **About the book**.

**Import from URL** takes a Goodreads book page (full record), any link with an ISBN such as Open Library or Amazon (full record), or any other book link, which is searched by the title in its address.

### How the lookup works

The browser calls three routes in `app/api/`: `books/search`, `books/details` and `cover`. They run on your machine and call the catalogs from there, which avoids browser cross-origin limits. The `cover` route passes a cover image through the app's own address so the page can read its colors for the ambient glow. It only accepts known cover hosts.

Goodreads has no public API. The importer reads the public book page, the way a browser does, one page per book you pick. This goes against a strict reading of Goodreads' terms of use, and it breaks if Goodreads changes its pages. The parser reads three layers (JSON-LD, the page's Next.js data, then the visible HTML), so a partial change still leaves most fields. To skip Goodreads, set `LUMINAREAD_GOODREADS=off` in `.env.local`. See `.env.example` for this and an optional Google Books API key.

Code: `lib/metadata/` has one file per catalog, plus `search.ts` (merging results) and `details.ts` (picking fields). The tests in `lib/metadata/__tests__/` run the parsers against saved responses. The base URL of every catalog can be changed through environment variables (`GOOGLE_BOOKS_API`, `OPEN_LIBRARY_BASE`, `OPEN_LIBRARY_COVERS`, `GOODREADS_BASE`, `WIKIDATA_SPARQL`), which is how the importer was tested against a local mock.

## Out of scope

Spoiler-gated companion features belong to the paused book companion project and are not in this build: no chapter gating, no character pages, no relationship map, no timelines, no challenge questions.
