# Replay and Table Top · second iteration

The changes apply to replay presentation, conserved manual cards,
deck preparation/variants, and a shared card-image library.

## Setup

Existing installations need `supabase/migrations/20261006_shared_card_art.sql`.
It adds the shared public `card-art` bucket (8 MB per PNG/JPEG/WebP image),
authenticated uploads and override registration, and an atomic `save_deck_variant`
RPC using the existing deck-variant relationship table. It does not change match snapshots.
Do not run `schema.sql` against an existing installation.

## Metadata

Standard search uses TCGdex's `legal.standard=eq:true` catalog, cached for 24 hours.
Imports keep original printing identifiers. Tera fallback is a printing-specific
snapshot of the Pokémon TCG API data repository's `Tera` subtype, retrieved on
2026-10-06. A printing from an unsupported set can be explicitly confirmed during
Table Top preparation. TCGdex metadata is preferred if it contains a Tera rule.

Sources: https://tcgdex.dev/rest/filtering-sorting-pagination and
https://github.com/PokemonTCG/pokemon-tcg-data/tree/master/cards/en

## Hidden information

Both 60-card lists are required. Preparation consumes known copies first and
preserves their zones/attachments. Missing deck-counter copies require an explicit
reconciliation. Unknown hand/prize allocations are shown for manual changes and
require explicit confirmation. The deck is an unordered inventory, never a claim
to reproduce hidden shuffle order.

## Shared images

Overrides are keyed by exact TCGdex printing ID and take priority over source art.
They are applied in imports, catalog selections, loaded deck and match printings,
and name-based representative replay images. Log-only names still cannot uniquely
identify a printing. Uploads use generated paths and validate MIME, signatures,
file size and a real catalog identifier. If registration fails, the new file is removed.
The set audit checks card metadata and original images in bounded batches. Missing
metadata/image HTTP 404 is distinguished from an unavailable provider. Uploads remain
visible for replacement during the current visit, and disappear from the missing list
after the next successful audit.

## Interactions

Discard/deck inspectors have a fixed outer size and an internal scroll area. Normal
replay never opens a hidden deck. Table Top groups remaining copies by printing and
always moves an actual copy. Attachments have explicit source/return zones; replacing
a tool returns the previous tool to the selected zone. ACE SPEC tools retain their
tool classification independently of the rarity-based card type.

Damage controls accept multiples of 10, from 0 to 1000, without automatic knockouts.
Area Zero updates each owner's capacity independently. Excess bench cards remain
visible with a warning when the capacity decreases; no hypothetical cards are silently
discarded. Empty editor bench positions remain usable drop targets.

Horizontal strips support touch scrolling, keyboard arrows, review dragging, and
Shift + drag / empty-gap dragging in Table Top. Card gestures in the editor remain
drag-and-drop. Screenshots are duplicated in the toolbar and main header; leaving
Table Top immediately discards the temporary scenario and annotations without a prompt.

Decks supports Standard-catalog edits and creating a related variant without changing
the base list. Variant saves are transactional and check ownership of the base deck.

## Validation

Passed: lint, TypeScript, production build, 61 automated domain/API/PostgreSQL tests,
and 9 isolated browser scenarios. Browser coverage includes the paired real logs,
anonymous Pro TV, stable inspectors, card-only inspection/Escape, explicit hidden
allocations, damage validation, conserved attachments/tool replacement, Area Zero,
bench drops and cross-owner rejection, Standard regex search, variant persistence,
missing-image auditing and upload UI. Provider responses and card art are mocked in
browser tests; no production database was mutated.
