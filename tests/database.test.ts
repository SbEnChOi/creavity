import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("real Postgres migration: private sessions, atomic quota and concurrent request locks", async () => {
  const db = new PGlite();
  const alice = "00000000-0000-4000-8000-000000000001";
  const bob = "00000000-0000-4000-8000-000000000002";
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; grant usage on schema auth to authenticated;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      insert into auth.users values ('${alice}'), ('${bob}');`);
    await db.exec(await readFile(new URL("../supabase/migrations/202609300001_ai_studio.sql", import.meta.url), "utf8"));
    await db.exec(`set role authenticated; set "request.jwt.claim.sub" = '${alice}';`);
    const result = await db.query<{ id: string }>("insert into public.ai_sessions(user_id,state) values($1,$2) returning id", [alice, { seed: "private memo" }]);
    const id = result.rows[0].id;
    assert.equal((await db.query("select * from public.ai_sessions")).rows.length, 1);
    await db.exec(`set "request.jwt.claim.sub" = '${bob}';`);
    assert.equal((await db.query("select * from public.ai_sessions")).rows.length, 0);
    assert.equal((await db.query("update public.ai_sessions set state = '{}' where id=$1 returning id", [id])).rows.length, 0);
    await assert.rejects(db.query("insert into public.ai_sessions(user_id,state) values($1,'{}')", [alice]), /row-level security/);
    await assert.rejects(db.query("select * from public.ai_usage"), /permission denied/);
    const bobLock = await db.query<{ locked: boolean }>("select public.lock_ai_session($1,0) as locked", [id]);
    assert.equal(bobLock.rows[0].locked, false);
    await db.exec(`set "request.jwt.claim.sub" = '${alice}';`);
    const lock = await db.query<{ locked: boolean }>("select public.lock_ai_session($1,0) as locked", [id]);
    assert.equal(lock.rows[0].locked, true);
    assert.equal((await db.query<{ locked: boolean }>("select public.lock_ai_session($1,0) as locked", [id])).rows[0].locked, false);
    await db.query("update public.ai_sessions set revision=1, processing_until=null where id=$1", [id]);
    assert.equal((await db.query<{ locked: boolean }>("select public.lock_ai_session($1,0) as locked", [id])).rows[0].locked, false);
    assert.equal((await db.query<{ locked: boolean }>("select public.lock_ai_session($1,1) as locked", [id])).rows[0].locked, true);
    for (let i=0; i<40; i++) assert.equal((await db.query<{ allowed: boolean }>("select public.claim_ai_request() as allowed")).rows[0].allowed, true);
    assert.equal((await db.query<{ allowed: boolean }>("select public.claim_ai_request() as allowed")).rows[0].allowed, false);
    await db.exec(`set "request.jwt.claim.sub" = '${bob}';`);
    assert.equal((await db.query<{ allowed: boolean }>("select public.claim_ai_request() as allowed")).rows[0].allowed, true);
  } finally { await db.close(); }
});
