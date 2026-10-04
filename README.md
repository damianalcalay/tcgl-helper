# TCGL Helper

A desktop-first Pokémon TCG Live companion built with Next.js App Router, React, strict TypeScript, Tailwind CSS, shadcn/ui primitives, Lucide icons and Supabase. All interface labels and messages are in English. No demo cards or decks are seeded.

## Requirements and installation

- Node.js 20.9+ (Node 24 recommended) and npm.
- A Supabase project; the supplied project ID is `mfdhaqwuyosyffufqjgr` in `eu-west-1`.

```bash
npm install
```

Copy `.env.example` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://mfdhaqwuyosyffufqjgr.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_public_publishable_key
```

Find these values in your Supabase project's Connect/API settings. A legacy anon key also works in the publishable-key variable. No service-role key or direct PostgreSQL connection is used. Never paste a database password or a service-role key into these variables. `.env.local` is ignored by Git.

## Supabase setup

1. Open the SQL Editor for your project.
2. On a **clean** project, paste and execute the entire contents of `supabase/schema.sql`. It is a one-time bootstrap, wrapped in a transaction, not an idempotent migration for an existing database. Back up any existing schema before adapting it.
3. The SQL creates tables, enums, foreign keys, indexes, update triggers, RLS policies, atomic RPCs and the private `deck-images` bucket. PNG/JPEG/WebP uploads are limited to 20 MB and retain their original resolution.
4. In Authentication → Providers, enable Email. Configure Authentication → URL Configuration with your development Site URL (`http://localhost:3000`) and allowed redirects (`http://localhost:3000/decks`, `http://localhost:3000/auth/update-password`). Add production equivalents before deploying.
5. For server-side email confirmation, configure the **Confirm signup** email link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/decks`. Configure password recovery to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password`.
6. Start the app, sign up, confirm your email and sign in. Supabase Auth handles credentials; no application/database administrator password is needed or stored in code.

Data is private per signed-in user, including cards and opponent decks. Create an opponent as an independent deck with its Basic starter cards; it does not need a complete 60-card list. No shared catalog is assumed.

## Run and check

```bash
npm run dev
# http://localhost:3000
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Without environment variables the workspace displays setup instructions instead of fake data. With Supabase configured, sign-in is required. Build does not require real Supabase credentials; normal page reads happen at request time.

## Features

- **Decks**: create/edit/delete decks and cards, manage grouped quantities, protect the 60-card total and four-copy cap, write playstyle/notes, link existing decks as variants, upload and inspect full-resolution images with zoom.
- **Notebook**: select any deck, read its reference information, cycle each numbered copy through Available (green), Prizes (orange), Discard pile (red), and confirm a reset. Each deck retains its temporary tracking while switching within the page. Reloading or leaving the page clears it.
- **Stats**: record/edit/delete matches, select Basic starters from the appropriate rosters, record 0–6 prizes taken per side, and select up to six opening prize copies. Unknown prize cards can remain unrecorded. Prize outcomes do not force a win/loss: concessions and other game endings need not take all six prizes.
- Overview metrics, per-deck wins/losses/draws, overall and last-20 win rates, best/worst three matchups with sample sizes, and independently expandable histories. Histories are sorted newest first and paginate 10/25/50/100/All.
- Searchable selectors use case-insensitive JavaScript regex. Invalid expressions display feedback. Searches run in an isolated Web Worker with a timeout, so a pathological pattern does not block the interface.
- Collapsible sidebar, light/dark theme support, responsive layout, keyboard-accessible controls and native modal dialogs, skeletons, error and empty states.

**Win rate** is always wins divided by all recorded matches, including draws. Last 20 uses all available games if fewer than 20 exist. Matchups rank by win rate, then sample size, then name; no small-sample data is hidden.

## Database and consistency

- `cards`: typed card catalog owned by an Auth user.
- `decks`: owned decks, notes, playstyle and private image paths.
- `deck_cards`: one row per card/deck, quantities 1–4. A locking trigger enforces the 60-card limit.
- `deck_variants`: directed links to independent decks; unique pairs, no self-link.
- `matches`: deck/opponent, result, prizes taken, starters, date and notes.
- `match_rosters`: historical snapshots of each side's card names, types and quantities.
- `match_prizes`: one row per selected prize copy, numbered 1–6.

All tables have UUID relationships where appropriate, creation timestamps and update timestamps for mutable records. Composite owner foreign keys prevent cross-user relationships. RLS restricts every table to its owner. App mutations authenticate on the server and use transactional database functions for decks and matches; direct writes to those tables are not granted to API users. Functions explicitly verify ownership and serialize an owner's related writes. PostgreSQL constraints also reject invalid types, amounts, duplicate links and references.

Editing a deck or card does not rewrite historical match information. Editing a match with the same deck reuses its original snapshot; selecting a different deck captures its current roster. Decks/cards used by historical matches are protected from deletion. Remove those matches first if you intend to delete the record. Removing a deck removes its composition and variant links; deleting a match removes its roster/prize rows.

Images use private signed URLs valid for one hour. Reopening/refreshing a page renews the URL. New images are uploaded under `user-id/random-id.ext`; replacing/removing an image attempts cleanup via Storage. If a network failure interrupts cleanup, an unreferenced file may remain and can be removed in the Supabase Storage dashboard. This does not affect record consistency.

## Architecture

```text
app/                  Server-rendered routes, auth routes and Server Actions
components/ui/        Existing shadcn/ui primitives
components/shared/    RegexCombobox, dialogs and form helpers
components/decks/     Deck/card forms, collection and image viewer
components/notebook/  Per-copy card tracking and deck reference panels
components/stats/     Match form, histories and statistics
lib/supabase/         Separate browser/server clients and session proxy
lib/domain/           Pure domain calculations and validations
lib/data.ts           Authenticated server-side Supabase reads
types/domain.ts       Strict shared domain types
public/regex-worker.js Isolated selector search
supabase/schema.sql   Clean-project PostgreSQL bootstrap
tests/                Domain and database integration checks
```

Persistent application records and images live in Supabase. Theme preference is managed by next-themes in the browser. Notebook copy state is intentionally temporary. Mutations revalidate workspace routes and refresh server data without a full browser reload. Reads page through Supabase's default 1,000-row limit; the UI history paginates locally. This is appropriate for a personal companion; large accounts would benefit from dedicated server-side aggregate queries and history pagination.

## Verification limits

Repository checks validate TypeScript, lint, production compilation, domain calculations, and the SQL in a local PostgreSQL engine (PGlite). They cannot verify your live Supabase project until its schema, API key and Auth settings have been supplied. No remote schema changes or deployment are performed automatically.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Next.js revalidation](https://nextjs.org/docs/app/api-reference/functions/revalidatePath).

## Browser integration tests

```bash
# If neither a system Chrome nor a Playwright Chromium is installed:
npx playwright install chromium
npm run test:e2e
```

The browser suite starts Next.js on port 3100 and an isolated Supabase protocol fixture backed by PGlite on port 54329. Both ports must be free. The fixture is explicitly test-only, uses a disposable in-memory database, and never connects to your Supabase project. It verifies CRUD forms, regex feedback, Storage/image dialogs, copy tracking and resets, match validation, statistics, independently expanded histories, pagination, themes and a mobile viewport. It does not replace the real Supabase integration in the app. Screenshots and failure traces are written to ignored `test-results/`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if your Chromium executable is installed elsewhere.

The initial dependency audit reports a transitive `braces` advisory through Tailwind 3's tooling (and ESLint tooling); its published latest version is still affected. These are build/development dependencies, not an application endpoint accepting glob patterns. Avoid applying `npm audit fix --force`, which proposes incompatible major-version changes; revisit the upstream patch when available.
