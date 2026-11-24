// Fresh-database test: applies every migration in filename order to an in-process Postgres (PGlite),
// with a minimal stand-in for Supabase's auth schema, roles and pg_cron. Then checks the database
// functions against hand-computed expectations and checks that users can't see each other's data.
// Used by: node test/db.test.mjs   (needs: npm i @electric-sql/pglite in test/ or a parent folder)
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = new URL('../supabase/migrations/', import.meta.url);
export const SHIM = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb,
    email_confirmed_at timestamptz, created_at timestamptz default now());
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create or replace function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  create schema if not exists extensions;
  create schema if not exists cron;
  create table if not exists cron.job (jobid serial primary key, jobname text unique, schedule text, command text, active boolean default true);
  create or replace function cron.schedule(n text, s text, c text) returns int language sql as
    $$ insert into cron.job(jobname, schedule, command) values (n, s, c) returning jobid $$;
  create or replace function cron.unschedule(id int) returns boolean language sql as $$ delete from cron.job where jobid = id returning true $$;
`;
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SHIM);
  for (const f of files) {
    const sql = readFileSync(new URL(f, dir), 'utf8').replace(/create extension if not exists pg_cron;?/gi, '-- pg_cron: shimmed');
    try { await db.exec(sql); } catch (e) { throw new Error(`Migration ${f} failed on a fresh database: ${e.message}`); }
  }
  return db;
}
export const as = async (db, uid, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return (await db.query(sql, params)).rows; } finally { await db.exec(`reset role;`); }
};

