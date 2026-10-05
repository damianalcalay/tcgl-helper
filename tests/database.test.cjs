const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const USER = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000002";
for (const migrated of [false, true])
  test(`schema ${migrated ? "migration" : "bootstrap"} executes in PostgreSQL; RPCs enforce domain constraints, history and RLS`, async (t) => {
    const db = new PGlite();
    t.after(() => db.close());
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
 grant usage on schema auth,storage,public to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users values('${USER}'),('${OTHER}');`);
    let schema = fs.readFileSync("supabase/schema.sql", "utf8");
    if (migrated)
      schema = schema
        .replace(",'energy'", "")
        .replaceAll(
          "check(quantity between 1 and 60)",
          "check(quantity between 1 and 4)",
        )
        .replace(
          /create function public.check_card_copy_limit[\s\S]*?create trigger card_copy_limit[^;]+;/,
          "",
        );
    await db.exec(schema);
    if (migrated)
      await db.exec(
        fs.readFileSync(
          "supabase/migrations/20261004_deck_import_energy.sql",
          "utf8",
        ),
      );
    if (migrated)
      await db.exec(
        fs.readFileSync(
          "supabase/migrations/20261005_tcgdex_printings.sql",
          "utf8",
        ),
      );
    if (migrated) {
      await db.exec(`alter table public.matches drop constraint matches_deck_id_user_id_fkey;
        alter table public.matches add constraint matches_deck_id_user_id_fkey foreign key(deck_id,user_id) references public.decks(id,user_id) on delete restrict;
        alter table public.matches drop constraint matches_opponent_deck_id_user_id_fkey;
        alter table public.matches add constraint matches_opponent_deck_id_user_id_fkey foreign key(opponent_deck_id,user_id) references public.decks(id,user_id) on delete restrict;`);
      await db.exec(
        fs.readFileSync(
          "supabase/migrations/20261005_deck_history_cascade.sql",
          "utf8",
        ),
      );
    }
    if (migrated)
      await db.exec(
        fs.readFileSync(
          "supabase/migrations/20261005_tcgdex_card_types.sql",
          "utf8",
        ),
      );
    if (migrated)
      await db.exec(
        fs.readFileSync("supabase/migrations/20261005_combat_logs.sql", "utf8"),
      );
    if (migrated)
      await db.exec(
        fs.readFileSync(
          "supabase/migrations/20261005_named_opponents.sql",
          "utf8",
        ),
      );
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
      USER,
    ]);
    await db.exec("set role authenticated");
    const card = async (name, type = "basic") =>
      (
        await db.query(
          "insert into public.cards(name,type) values($1,$2) returning id",
          [name, type],
        )
      ).rows[0].id;
    const basic = await card("Starter");
    const item = await card("Item", "item");
    const stage = await card("Evolution", "stage_1");
    const many = [];
    for (let i = 0; i < 15; i++)
      many.push({ card_id: await card(`Card ${i}`), quantity: 4 });
    const rpc = async (fn, payload) =>
      (
        await db.query(`select public.${fn}($1::jsonb) as id`, [
          JSON.stringify(payload),
        ])
      ).rows[0].id;
    const deckPayload = (name, cards, extra = {}) => ({
      name,
      playstyle: "",
      notes: "",
      image_path: null,
      cards,
      variants: [],
      ...extra,
    });
    const mine = await rpc(
      "save_deck",
      deckPayload("Mine", [
        { card_id: basic, quantity: 2 },
        { card_id: item, quantity: 4 },
        { card_id: stage, quantity: 1 },
      ]),
    );
    const opponent = await rpc(
      "save_deck",
      deckPayload("Opponent", [{ card_id: basic, quantity: 1 }]),
    );
    await t.test(
      "printing identifiers and separate arts persist through deck edits",
      async () => {
        const printings = [
          {
            quantity: 1,
            set_code: "TWM",
            collector_number: "025",
            tcgdex_id: "sv06-025",
            set_name: "Twilight Masquerade",
            regulation_mark: "H",
            image_url: "https://assets.tcgdex.net/en/sv/sv06/025/high.webp",
          },
          {
            quantity: 1,
            set_code: "TWM",
            collector_number: "211",
            tcgdex_id: "sv06-211",
          },
        ];
        const did = await rpc(
          "save_deck",
          deckPayload("Printing test", [
            { card_id: basic, quantity: 2, printings },
          ]),
        );
        const stored = await db.query(
          "select printings from public.deck_cards where deck_id=$1",
          [did],
        );
        assert.deepEqual(stored.rows[0].printings, printings);
        await rpc(
          "save_deck",
          deckPayload(
            "Printing test edited",
            [{ card_id: basic, quantity: 2, printings }],
            { id: did },
          ),
        );
        assert.deepEqual(
          (
            await db.query(
              "select printings from public.deck_cards where deck_id=$1",
              [did],
            )
          ).rows[0].printings,
          printings,
        );
      },
    );
    await t.test("deck limits and failed transaction rollback", async () => {
      await rpc("save_deck", deckPayload("Full", many));
      await assert.rejects(
        rpc(
          "save_deck",
          deckPayload("Too many", [...many, { card_id: basic, quantity: 1 }]),
        ),
        /60/,
      );
      await assert.rejects(
        rpc(
          "save_deck",
          deckPayload("Five copies", [{ card_id: basic, quantity: 5 }]),
        ),
        /1-4/,
      );
      await assert.rejects(
        rpc(
          "save_deck",
          deckPayload("Duplicate", [
            { card_id: basic, quantity: 1 },
            { card_id: basic, quantity: 1 },
          ]),
        ),
        /duplicate/,
      );
      await assert.rejects(rpc("save_deck", deckPayload("", [])), /name/);
      await assert.rejects(
        rpc(
          "save_deck",
          deckPayload("Mine", [], { id: mine, variants: [mine] }),
        ),
        /check constraint/,
      );
      await assert.rejects(
        rpc(
          "save_deck",
          deckPayload("Mine", [], { id: mine, variants: [opponent, opponent] }),
        ),
        /duplicate/,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.deck_cards where deck_id=$1",
            [mine],
          )
        ).rows[0].n,
        3,
      );
      await assert.rejects(
        db.query(
          "insert into public.deck_cards(deck_id,card_id,user_id,quantity) values($1,$2,$3,1)",
          [mine, basic, USER],
        ),
        /permission denied/,
      );
    });

    await t.test(
      "import creates missing cards atomically, reuses names, and snapshots Energy",
      async () => {
        const energyId = "20000000-0000-4000-8000-000000000001";
        const newCard = { id: energyId, name: "Grass Energy", type: "energy" };
        const imported = await rpc(
          "save_deck",
          deckPayload("Imported", [{ card_id: energyId, quantity: 13 }], {
            new_cards: [newCard],
          }),
        );
        assert.equal(
          (
            await db.query(
              "select quantity from public.deck_cards where deck_id=$1",
              [imported],
            )
          ).rows[0].quantity,
          13,
        );
        const alias = "20000000-0000-4000-8000-000000000002";
        await rpc(
          "save_deck",
          deckPayload("Reuse", [{ card_id: alias, quantity: 13 }], {
            new_cards: [{ ...newCard, id: alias, name: "grass energy" }],
          }),
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.cards where lower(name)='grass energy'",
            )
          ).rows[0].n,
          1,
        );
        await assert.rejects(
          db.query("update public.cards set type='item' where id=$1", [
            energyId,
          ]),
          /Reduce deck quantities/,
        );
        const badId = "20000000-0000-4000-8000-000000000003";
        await assert.rejects(
          rpc(
            "save_deck",
            deckPayload("Failed import", [{ card_id: badId, quantity: 5 }], {
              new_cards: [{ id: badId, name: "Bad import", type: "item" }],
            }),
          ),
          /1-4/,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.cards where id=$1",
              [badId],
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.decks where name='Failed import'",
            )
          ).rows[0].n,
          0,
        );
        await rpc(
          "save_deck",
          deckPayload(
            "Imported",
            [
              { card_id: basic, quantity: 1 },
              { card_id: energyId, quantity: 13 },
            ],
            { id: imported },
          ),
        );
        const match = await rpc("save_match", {
          deck_id: imported,
          opponent_deck_id: opponent,
          result: "win",
          my_prizes: 6,
          opponent_prizes: 0,
          starter_id: basic,
          opponent_starter_id: basic,
          played_at: "2026-10-04T10:00:00Z",
          notes: "",
          prizes: Array(6).fill(energyId),
        });
        assert.equal(
          (
            await db.query(
              "select quantity from public.match_rosters where match_id=$1 and card_id=$2",
              [match, energyId],
            )
          ).rows[0].quantity,
          13,
        );
      },
    );
    const input = {
      deck_id: mine,
      opponent_deck_id: opponent,
      result: "win",
      my_prizes: 6,
      opponent_prizes: 3,
      starter_id: basic,
      opponent_starter_id: basic,
      played_at: "2026-10-04T10:00:00Z",
      notes: "Test",
      prizes: [basic, basic, item, item, item, item],
    };
    await t.test(
      "combat imports accept a named opponent without a saved deck",
      async () => {
        const payload = {
          ...input,
          opponent_deck_id: null,
          opponent_starter_id: null,
          opponent_deck_name: "Named opponent",
          opponent_starter_name: "Fezandipiti ex",
          combat_log: fs.readFileSync("tests/fixtures/combat-log.txt", "utf8"),
        };
        const matchId = await rpc("save_match", payload);
        const saved = (
          await db.query(
            "select opponent_deck_id, opponent_starter_id, opponent_deck_name, opponent_starter_name from public.matches where id=$1",
            [matchId],
          )
        ).rows[0];
        assert.equal(saved.opponent_deck_id, null);
        assert.equal(saved.opponent_starter_id, null);
        assert.equal(saved.opponent_deck_name, "Named opponent");
        assert.equal(saved.opponent_starter_name, "Fezandipiti ex");
        await assert.rejects(
          rpc("save_match", { ...payload, opponent_deck_name: "" }),
          /opponent/i,
        );
        await assert.rejects(
          rpc("save_match", { ...payload, combat_log: "" }),
          /opponent/i,
        );
        await db.query("select public.delete_entity($1,$2)", [
          "match",
          matchId,
        ]);
      },
    );
    let mid;
    await t.test("starters, prize membership and per-copy limits", async () => {
      await assert.rejects(
        rpc("save_match", { ...input, starter_id: stage }),
        /Basic starter/,
      );
      await assert.rejects(
        rpc("save_match", { ...input, starter_id: item }),
        /Basic starter/,
      );
      await assert.rejects(
        rpc("save_match", { ...input, opponent_starter_id: stage }),
        /Basic starter/,
      );
      await assert.rejects(
        rpc("save_match", { ...input, prizes: [basic, basic, basic] }),
        /Prize copies/,
      );
      await assert.rejects(
        rpc("save_match", { ...input, prizes: [many[0].card_id] }),
        /Prize copies/,
      );
      await assert.rejects(
        rpc("save_match", {
          ...input,
          prizes: [basic, basic, item, item, item, item, item],
        }),
        /six/,
      );
      await assert.rejects(
        rpc("save_match", { ...input, my_prizes: 7 }),
        /check constraint/,
      );
      mid = await rpc("save_match", input);
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.match_prizes where match_id=$1",
            [mid],
          )
        ).rows[0].n,
        6,
      );
    });
    await t.test(
      "combat log persistence, note limits and printing history survive match edits",
      async () => {
        const combat = fs.readFileSync("tests/fixtures/combat-log.txt", "utf8");
        const match = await rpc("save_match", {
          ...input,
          combat_log: combat,
          log_player: "bastorz",
          coin_won: true,
          notes: "x".repeat(200),
          prizes: [],
        });
        const saved = (
          await db.query(
            "select combat_log, log_player, coin_won, notes from public.matches where id=$1",
            [match],
          )
        ).rows[0];
        assert.equal(saved.combat_log, combat);
        assert.equal(saved.log_player, "bastorz");
        assert.equal(saved.coin_won, true);
        assert.equal(saved.notes.length, 200);
        await assert.rejects(
          rpc("save_match", { ...input, notes: "x".repeat(201) }),
          /200 characters/,
        );
        await assert.rejects(
          rpc("save_match", { ...input, combat_log: "x".repeat(200001) }),
          /too long/,
        );
        const printedDeck = await rpc(
          "save_deck",
          deckPayload("Log printing snapshot", [
            {
              card_id: basic,
              quantity: 1,
              printings: [
                {
                  quantity: 1,
                  set_code: "TWM",
                  collector_number: "17",
                  image_url:
                    "https://assets.tcgdex.net/en/sv/sv06/017/high.webp",
                },
              ],
            },
          ]),
        );
        const printedMatch = await rpc("save_match", {
          ...input,
          deck_id: printedDeck,
          prizes: [basic],
        });
        await rpc(
          "save_deck",
          deckPayload(
            "Log printing snapshot edited",
            [{ card_id: basic, quantity: 1 }],
            { id: printedDeck },
          ),
        );
        await rpc("save_match", {
          ...input,
          id: printedMatch,
          deck_id: printedDeck,
          prizes: [basic],
        });
        const snapshot = (
          await db.query(
            "select printings from public.match_rosters where match_id=$1 and side='mine'",
            [printedMatch],
          )
        ).rows[0];
        assert.equal(snapshot.printings[0].set_code, "TWM");
        assert.equal(snapshot.printings[0].collector_number, "17");
        await db.query("select public.delete_entity($1,$2)", [
          "deck",
          printedDeck,
        ]);
        await db.query("select public.delete_entity($1,$2)", ["match", match]);
      },
    );
    await t.test(
      "history survives editing deck/card; deletions respect relationships",
      async () => {
        await db.query(
          "update public.cards set name='Renamed',type='stage_2' where id=$1",
          [basic],
        );
        await rpc(
          "save_deck",
          deckPayload("Mine changed", [{ card_id: item, quantity: 1 }], {
            id: mine,
          }),
        );
        await rpc("save_match", { ...input, id: mid, result: "loss" });
        const snapshot = (
          await db.query(
            "select card_name,card_type,quantity from public.match_rosters where match_id=$1 and side='mine' and card_id=$2",
            [mid, basic],
          )
        ).rows[0];
        assert.equal(snapshot.card_name, "Starter");
        assert.equal(snapshot.card_type, "basic");
        assert.equal(snapshot.quantity, 2);
        await assert.rejects(
          db.query("select public.delete_entity('card',$1)", [basic]),
          /foreign key/,
        );
      },
    );
    await t.test(
      "another user cannot read or mutate the first user data",
      async () => {
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          OTHER,
        ]);
        assert.equal(
          (await db.query("select count(*)::int n from public.decks")).rows[0]
            .n,
          0,
        );
        assert.equal(
          (await db.query("select count(*)::int n from public.cards")).rows[0]
            .n,
          0,
        );
        await assert.rejects(
          rpc("save_deck", deckPayload("Stolen", [], { id: mine })),
          /not found/,
        );
        await assert.rejects(
          rpc(
            "save_deck",
            deckPayload("Foreign cards", [{ card_id: item, quantity: 1 }]),
          ),
          /Card not found/,
        );
        await assert.rejects(
          rpc("save_match", { ...input, id: mid }),
          /not found/,
        );
        await assert.rejects(
          db.query("select public.delete_entity('match',$1)", [mid]),
          /not found/,
        );
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          USER,
        ]);
      },
    );
    await t.test("match delete cascades roster and prizes", async () => {
      await db.query("select public.delete_entity('match',$1)", [mid]);
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.match_rosters where match_id=$1",
            [mid],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.match_prizes where match_id=$1",
            [mid],
          )
        ).rows[0].n,
        0,
      );
      await db.query("select public.delete_entity('deck',$1)", [mine]);
    });
    await t.test(
      "TCGdex types preserve Basic V starter eligibility and separate Basic and Special Energy limits",
      async () => {
        const basicV = await card("Canonical Basic V", "basic_v");
        const basicEnergy = await card(
          "Canonical Basic Energy",
          "energy_basic",
        );
        const specialEnergy = await card(
          "Canonical Special Energy",
          "energy_special",
        );
        const did = await rpc(
          "save_deck",
          deckPayload("Canonical types", [
            { card_id: basicV, quantity: 1 },
            { card_id: basicEnergy, quantity: 13 },
            { card_id: specialEnergy, quantity: 4 },
          ]),
        );
        await assert.rejects(
          rpc(
            "save_deck",
            deckPayload("Too much Special Energy", [
              { card_id: specialEnergy, quantity: 5 },
            ]),
          ),
          /1-4/,
        );
        await rpc("save_match", {
          ...input,
          deck_id: did,
          opponent_deck_id: did,
          starter_id: basicV,
          opponent_starter_id: basicV,
          prizes: [basicEnergy],
        });
      },
    );
    await t.test(
      "deck deletion cascades all history on either side and preserves unrelated matches and cards",
      async () => {
        // The updated RPC must also work while the old RESTRICT keys remain.
        await db.exec(`reset role;
          alter table public.matches drop constraint matches_deck_id_user_id_fkey;
          alter table public.matches add constraint matches_deck_id_user_id_fkey foreign key(deck_id,user_id) references public.decks(id,user_id) on delete restrict;
          alter table public.matches drop constraint matches_opponent_deck_id_user_id_fkey;
          alter table public.matches add constraint matches_opponent_deck_id_user_id_fkey foreign key(opponent_deck_id,user_id) references public.decks(id,user_id) on delete restrict;
          set role authenticated;`);
        const starter = await card("Cascade starter");
        const makeDeck = (name) =>
          rpc(
            "save_deck",
            deckPayload(name, [{ card_id: starter, quantity: 2 }]),
          );
        const target = await makeDeck("Delete with history");
        const survivor = await makeDeck("Keep opponent");
        const unrelated = await makeDeck("Unrelated");
        const match = (deck_id, opponent_deck_id) =>
          rpc("save_match", {
            ...input,
            deck_id,
            opponent_deck_id,
            starter_id: starter,
            opponent_starter_id: starter,
            prizes: [starter, starter],
          });
        const ownMatch = await match(target, survivor);
        const opponentMatch = await match(survivor, target);
        const selfMatch = await match(target, target);
        const keptMatch = await match(survivor, unrelated);
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          OTHER,
        ]);
        await assert.rejects(
          db.query("select public.delete_entity('deck',$1)", [target]),
          /not found/,
        );
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          USER,
        ]);
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.matches where id=any($1::uuid[])",
              [[ownMatch, opponentMatch, selfMatch]],
            )
          ).rows[0].n,
          3,
        );
        await db.query("select public.delete_entity('deck',$1)", [target]);
        for (const table of ["matches", "match_rosters", "match_prizes"]) {
          const column = table === "matches" ? "id" : "match_id";
          assert.equal(
            (
              await db.query(
                `select count(*)::int n from public.${table} where ${column}=any($1::uuid[])`,
                [[ownMatch, opponentMatch, selfMatch]],
              )
            ).rows[0].n,
            0,
          );
          assert.ok(
            (
              await db.query(
                `select count(*)::int n from public.${table} where ${column}=$1`,
                [keptMatch],
              )
            ).rows[0].n > 0,
          );
        }
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.cards where id=$1",
              [starter],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.decks where id=$1",
              [survivor],
            )
          ).rows[0].n,
          1,
        );
      },
    );
  });
