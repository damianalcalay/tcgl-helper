const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
test("Pro TV database: private drafts, launch switch, anonymous viewing, administrator-only writes", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const admin = "10000000-0000-4000-8000-000000000001",
    user = "10000000-0000-4000-8000-000000000002";
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values('${admin}'),('${user}');create table public.matches(id uuid primary key,combat_log text,user_id uuid);`,
  );
  await db.exec(
    fs.readFileSync("supabase/migrations/20261006_replay_pro_tv.sql", "utf8"),
  );
  await db.exec(
    `insert into public.app_admins values('${admin}');select set_config('request.jwt.claim.sub','${admin}',false);set role authenticated`,
  );
  assert.equal(
    (await db.query("select public.is_app_admin() as admin")).rows[0].admin,
    true,
  );
  await db.exec(
    "insert into public.pro_tv_matches(title,player,opponent,combat_log,published) values('Draft','A','B','log',false),('Published','A','B','log',true)",
  );
  assert.equal(
    (await db.query("select * from public.pro_tv_matches")).rows.length,
    2,
  );
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${user}',false);set role authenticated`,
  );
  assert.equal(
    (await db.query("select public.is_app_admin() as admin")).rows[0].admin,
    false,
  );
  assert.equal(
    (await db.query("select * from public.pro_tv_matches")).rows.length,
    0,
  );
  await db.exec(
    `reset role;insert into public.matches(id,user_id,combat_log) values('${admin}','${admin}','original');select set_config('request.jwt.claim.sub','${admin}',false);set role authenticated;`,
  );
  await db.query("select public.save_complementary_log($1,$2,$3)", [
    admin,
    "original",
    "second",
  ]);
  await assert.rejects(
    db.query("select public.save_complementary_log($1,$2,$3)", [
      admin,
      "stale",
      "wrong",
    ]),
  );
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`,
  );
  await assert.rejects(
    db.query("select public.save_complementary_log($1,$2,$3)", [
      admin,
      "original",
      "wrong",
    ]),
  );
  await db.exec(
    `reset role;update public.matches set combat_log='changed' where id='${admin}';`,
  );
  assert.equal(
    (await db.query("select opponent_combat_log from public.matches")).rows[0]
      .opponent_combat_log,
    "",
  );
  await db.exec(
    `select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`,
  );
  await assert.rejects(
    db.exec(
      "insert into public.pro_tv_matches(title,player,opponent,combat_log) values('Bad','A','B','log')",
    ),
  );
  assert.equal(
    (
      await db.query(
        "update public.pro_tv_settings set enabled=true returning *",
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    db.exec(`insert into public.app_admins values('${user}')`),
  );
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${admin}',false);set role authenticated;update public.pro_tv_settings set enabled=true;reset role;select set_config('request.jwt.claim.sub','',false);set role anon;`,
  );
  assert.equal(
    (await db.query("select * from public.pro_tv_matches")).rows.length,
    1,
  );
  await assert.rejects(db.exec("update public.pro_tv_matches set title='Bad'"));
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${user}',false);set role authenticated`,
  );
  assert.equal(
    (await db.query("delete from public.pro_tv_matches returning *")).rows
      .length,
    0,
  );
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${admin}',false);set role authenticated;update public.pro_tv_settings set enabled=false;reset role;select set_config('request.jwt.claim.sub','',false);set role anon;`,
  );
  assert.equal(
    (await db.query("select * from public.pro_tv_matches")).rows.length,
    0,
  );
});
