-- Nos Recettes : base de données Supabase.
-- À coller une fois dans Supabase › SQL Editor, puis exécuter seed.sql.

-- Les personnes autorisées (une adresse e-mail par ligne).
create table if not exists public.members (email text primary key);

-- Un document JSON par chemin : recipes/<id>, state/menu, state/courses.
create table if not exists public.docs (
  path text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.docs replica identity full;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

alter table public.docs enable row level security;
alter table public.members enable row level security;

drop policy if exists "membres lisent" on public.docs;
drop policy if exists "membres ajoutent" on public.docs;
drop policy if exists "membres modifient" on public.docs;
drop policy if exists "membres suppriment" on public.docs;
create policy "membres lisent" on public.docs for select to authenticated using (public.is_member());
create policy "membres ajoutent" on public.docs for insert to authenticated with check (public.is_member());
create policy "membres modifient" on public.docs for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "membres suppriment" on public.docs for delete to authenticated using (public.is_member());

drop policy if exists "membres voient les membres" on public.members;
create policy "membres voient les membres" on public.members for select to authenticated using (public.is_member());

-- Fusion profonde de deux objets JSON (pour cocher un article sans écraser ce que l'autre vient de cocher).
create or replace function public.jsonb_deep_merge(a jsonb, b jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; v jsonb; r jsonb;
begin
  if a is null or b is null or jsonb_typeof(a) <> 'object' or jsonb_typeof(b) <> 'object' then return b; end if;
  r := a;
  for k, v in select * from jsonb_each(b) loop
    r := jsonb_set(r, array[k], public.jsonb_deep_merge(r -> k, v), true);
  end loop;
  return r;
end $$;

create or replace function public.doc_merge(p_path text, p_patch jsonb) returns void
language sql security invoker as $$
  insert into public.docs (path, data) values (p_path, p_patch)
  on conflict (path) do update set data = public.jsonb_deep_merge(public.docs.data, excluded.data), updated_at = now();
$$;

-- Mises à jour en direct entre les téléphones.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- Photos des nouvelles recettes : lisibles par tous via leur lien, ajoutées seulement par les membres.
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
drop policy if exists "membres envoient des photos" on storage.objects;
create policy "membres envoient des photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member());

-- Les personnes autorisées. Pour en ajouter une : Table Editor › members.
insert into public.members (email) values
  ('frederic69008@gmail.com'),
  ('frederic03120@hotmail.fr')
on conflict do nothing;
