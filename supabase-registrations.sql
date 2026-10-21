-- HOA Portal — self-registration requests
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Safe to run more than once. Run supabase-setup.sql first.

-- People who press "Register" on the sign-in page land here until an admin approves or rejects them.
create table if not exists public.registrations (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (length(name) between 1 and 120),
  email       text not null check (email = lower(email) and length(email) <= 200),
  phone       text not null default '' check (length(phone) <= 40),
  unit        text not null check (length(unit) between 1 and 40),
  role        text not null default 'homeowner' check (role in ('homeowner','renter')),
  proof       text not null default '' check (length(proof) <= 60),
  proof_ref   text not null default '' check (length(proof_ref) <= 120),
  owner_name  text not null default '' check (length(owner_name) <= 120),
  note        text not null default '' check (length(note) <= 1000),
  status      text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  review_note text not null default '',
  reviewed_by text,
  reviewed_at timestamptz
);

alter table public.registrations enable row level security;

-- Anyone (signed in or not) may send a request, but only as Pending.
-- Only admins may read, review or delete requests.
drop policy if exists reg_insert on public.registrations;
drop policy if exists reg_read   on public.registrations;
drop policy if exists reg_update on public.registrations;
drop policy if exists reg_delete on public.registrations;
create policy reg_insert on public.registrations for insert to anon, authenticated
  with check (status = 'Pending' and reviewed_by is null and reviewed_at is null and review_note = '');
create policy reg_read   on public.registrations for select to authenticated using (public.my_role() = 'admin');
create policy reg_update on public.registrations for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy reg_delete on public.registrations for delete to authenticated using (public.my_role() = 'admin');

grant insert on public.registrations to anon;
grant select, insert, update, delete on public.registrations to authenticated;

-- Live updates, so the admin sees new requests without reloading.
do $$ begin
  alter publication supabase_realtime add table public.registrations;
exception when duplicate_object then null; end $$;
