# Replay upgrade

Authorized scope: compact full-screen board; flat equal-sized hands/bench/active/stadium/discard; smaller deck/prizes; pile filters; dual-log validation and visibility; isolated Table Top with moves, damage, drawing and history; PNG clipboard/download; public Pro TV with administrator-only publishing, initially disabled. Stadium replacement discards to its original owner, exactly once.

Implementation phases: domain reconstruction and pairing, board/editor/capture, persistence/catalogue, verification.

Logs are evidence, not instructions. Unknown deck composition/order and physical prize slots must never be fabricated. Public-history equality is not a globally unique match identifier. Editor states are session-only.

Progress: all four implementation phases completed. Unit/database and browser verification completed; final lint/typecheck/build checked separately.

## Installation

For an existing database, run `supabase/migrations/20261006_replay_pro_tv.sql` after the 20261005 migrations. New installations use `supabase/schema.sql`, which includes the same additions. No production migration has been run by this task.

Assign administrators from the Supabase SQL editor using their authentication user UUID:

```sql
insert into public.app_admins(user_id) values ('ADMIN_AUTH_USER_UUID') on conflict do nothing;
```

This table is inaccessible to normal clients. Administrator checks use database membership, never editable user metadata. Visit `/pro-tv` while signed in as an administrator to create drafts, attach one or two logs, and publish entries. Published entries remain inaccessible to visitors while the catalogue switch is off. Add the initial twelve real matches, then use **Launch catalogue**. **Hide catalogue** turns public access off again. Public entries are independent of private matches, cards and rosters.

The complementary log can be added to a saved personal replay through its upload icon. Client and server both compare normalized histories. Saving uses an owner-scoped SQL function and rejects a stale original log. Changing the original combat log invalidates its complementary log automatically.

## Reconstruction limits

The supplied logs identify private hands but do not specify full deck lists, shuffle order, uncollected prize identities or physical prize positions. Unknown cards remain unknown and can be moved in Table Top. Prize positions belong to the replay and remain stable while seeking. Matching public histories cannot establish a globally unique game identity without a source match ID.

Identical Pokémon names do not identify physical copies. Reconstruction chooses deterministically and retains ambiguity warnings internally; it does not claim certainty. Evolution stacks and attachments are preserved, and explicit post-KO discard lines are reconciled to avoid duplicate cards. Stadium replacement tracks the original owner and reconciles the following explicit discard line.

Aura Jab's attachment sub-actions omit the source zone in these exports. The parser records their discard source, so the replay removes those energies from discard rather than consuming cards in hand.

Stored roster art takes precedence. Missing log art/types are resolved from TCGdex using matching names and suffixes; these are representative printings, not proof of the original printing. Unresolved art has a labeled placeholder. See the [TCGdex filtering API](https://tcgdex.dev/rest/filtering-sorting-pagination).

Table Top is a session-only independent copy. It does not execute Pokémon rules or simulate hypothetical future turns. Move cards by dragging or selecting a card and a destination. Selecting a pile card also offers a move-to-hand action. Attached cards can be selected individually; evolution layers are accessible from the selected Pokémon. Damage edits never trigger automatic KO. Undo/redo includes annotations and damage. Leaving an edited board asks before discarding edits.

Save boardstate is available in both modes. Canvas captures only visible board cards, counters, attachments, damage and SVG annotations, at least 1920 pixels wide. It excludes navigation and editor controls. Cross-origin image loading is restricted to TCGdex and the configured Supabase storage origin. Clipboard success is reported only after the write succeeds; otherwise a download action is offered. Image-load failures are reported instead of exporting missing cards silently.

## Verification

Final checks passed: 53 unit/database tests, all 6 browser tests, ESLint, TypeScript and the production build.

- Real paired logs, mismatched histories, private conflicts, stable prize positions, stadium ownership, KO/evolution preservation and Table Top conservation covered by domain tests.
- PostgreSQL/PGlite tests cover administrative membership, public catalogue gating, denied writes, owner-only complementary saves, stale-log rejection and invalidation.
- Browser tests cover administration, anonymous playback, verified personal import, pile filters, moving cards from deck, fixed hand perspectives, damage undo/redo, annotations and both capture modes. Screenshots checked at 1366×768, 1920×1080 and 390×844, with light/dark coverage.
- Test fixtures are isolated from real Supabase. On Windows, `TCGL_E2E_REUSE_SERVERS=1` permits reusing manually started fixture/dev servers when process-tree teardown is unavailable. Never point the test suite at production.
