# LuminaRead

A personal library and reading journal for one reader. No accounts, no server, no sync. Everything lives in the browser's LocalStorage behind a repository interface, so the data source can be swapped later.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint`, `npm run typecheck`.

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

Reading progress is stored two ways. `Book.currentPage` is the bookmark. `ReadingSession` records pages per book per day and drives the heatmap, streaks and monthly totals. Moving the slider or typing a page logs the difference as today's session.

## Design system

The tokens in `app/globals.css` follow the locked spec: Paper and Obsidian surfaces, 1px hairlines, 8px card and 4px control radii, no shadows on UI chrome, no accent color. Active states use an underline or a light ink fill. Newsreader sets literary text, Space Grotesk sets headings and meta labels, Inter sets dense text such as the table.

Color and depth appear only on covers:

- Books without an image get a typeset cover (five layouts) from a stored three-color palette.
- `AmbientGlow` blurs that palette behind the cover. For books added with an image URL, the palette is read from the image in the browser when the host allows it.
- The heatmap uses a five-step grayscale ramp. Steps 1 to 4 pass the dataviz skill's ordinal check against both surfaces.

Motion: springs for layout shifts (grid filtering, tab and view changes), 0.98 scale on press, short ease-out enters for dialogs and popovers. The command palette opens with no animation because it is a keyboard action used many times a day. `prefers-reduced-motion` is respected through `MotionConfig`.

## URL import

Open Library links, and any link with an ISBN in it, are looked up through Open Library's public API for title, author, pages, publisher, year and cover. Other links (Goodreads, Amazon and so on) only fill the title from the URL slug. Either way the form opens for review before saving.

## Out of scope

Spoiler-gated companion features belong to the paused book companion project and are not in this build: no chapter gating, no character pages, no relationship map, no timelines, no challenge questions.
