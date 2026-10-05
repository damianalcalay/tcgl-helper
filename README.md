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

Card creation and import use the same TCGdex fields: category (`Pokemon`, `Trainer`, `Energy`), stage, case-sensitive suffix (`ex` and `EX` are distinct), Trainer subtype, Energy subtype, and ACE SPEC rarity. The selectors include the stages/suffixes returned by TCGdex, including VMAX/VSTAR and older mechanics. Existing types remain readable. For existing databases, run `supabase/migrations/20261005_tcgdex_card_types.sql` before saving these new types. Only Normal/Basic Energy permits more than four copies; Special Energy follows the four-copy limit. Basic Pokémon with other suffixes remain eligible as starters.

In the deck editor, a missing card image has an **Add image** upload control. PNG, JPEG and WebP files up to 20 MB are accepted and saved privately in the existing `deck-images` bucket. The upload belongs to that printing, preserves its expansion/number, and appears in Decks, Notebook and the prize list. Cards added manually can also receive an image. Reopening and saving renews the signed image URL without persisting temporary links.

- **English card images**: importing a TCG Live list calls TCGdex from the authenticated `/api/deck-import` endpoint. It preserves each printing's set code, collector number, TCGdex ID, expansion name, series name, regulation mark (when available), image URL and quantity in `deck_cards.printings`. Multiple arts of one card share the library name and copy limit, but appear separately in the Notebook. Click an image to enlarge it; use the numbered buttons below to track each copy. Missing data keeps the original identifiers and displays an import warning. TCGdex responses are cached for a day; no API key is required.

For an existing Supabase installation, run [the printing migration](supabase/migrations/20261005_tcgdex_printings.sql) in the SQL Editor after the existing `20261004_deck_import_energy.sql` migration. New installations use `supabase/schema.sql`. Existing decks need their text lists imported again to identify their printings; names alone cannot recover their exact arts. Cards added manually have no image until imported. If quantities are edited, reductions remove copies from the last printing first, and extra copies use the first printing.

To try it, open Decks → Create/Edit deck → Import deck from text, paste a list, review the images and types, then save and open Notebook. "Expansion" means the individual release (for example, Twilight Masquerade), while "series" means the broader era (Scarlet & Violet). Missing regulation marks are left blank, including cards that have no printed mark.

- **Decks**: create/edit/delete decks and cards, manage grouped quantities, protect the 60-card total and four-copy cap, write playstyle/notes, link existing decks as variants, upload and inspect full-resolution images with zoom.
- **Notebook**: select any deck, read its reference information, cycle each numbered copy through Available (green), Discard pile (red), Prizes (orange), and confirm a reset. Prize copies appear in a compact image list; clicking a thumbnail returns that exact copy to Available. The list includes prizes even when the tracker search hides their cards. Each deck retains its temporary tracking while switching within the page. Reloading or leaving the page clears it.
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

Editing a deck or card does not rewrite historical match information. Editing a match with the same deck reuses its original snapshot; selecting a different deck captures its current roster. Cards referenced by decks or historical matches are protected from deletion. Deleting a deck permanently removes every match involving it on either side, including those matches' roster and prize records, along with its composition and variant links. Unrelated matches, other decks and the card library remain. The deletion dialog states how many matches are affected. Existing installations must run `supabase/migrations/20261005_deck_history_cascade.sql` to enable this behavior. Deleting a match removes its roster/prize rows.

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

## Import deck lists and Energy

For an existing database, run `supabase/migrations/20261004_deck_import_energy.sql` in the Supabase SQL Editor before using this update. New installations use the updated bootstrap schema.

Open Create/Edit deck > Import deck from text, paste a Pokémon TCG Live list, and import. The list replaces the draft roster. Expansion codes and collector numbers are removed; different printings of the same name are combined. Existing library cards are reused by name. Choose the exact type for each missing Pokémon or Trainer card; Energy is selected automatically. New cards and the deck are saved in one transaction when you save the deck. Energy supports up to 60 copies within the 60-card total.

Notebook includes a regex card-name filter and an Add Match action with Win/Draw/Loss selection. The match form starts with the active deck, selected result, and copies marked as Prizes. Complete the opponent, starters and prize outcome to save directly to Stats; tracking is preserved after saving.
