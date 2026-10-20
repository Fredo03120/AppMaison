-- Nos Recettes : comptes ouverts, groupes, amis et chats.
-- À coller dans Supabase › SQL Editor après setup.sql. On peut le relancer sans risque.

create extension if not exists pgcrypto with schema extensions;

-- Profils : un par compte, avec un prénom et un pseudo unique pour se retrouver entre amis.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  handle text not null unique check (handle ~ '^[a-z0-9_.]{3,24}$'),
  created_at timestamptz not null default now()
);

-- Groupes : chacun a son carnet (recettes, menu, courses) et son chat.
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 40),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid references public.groups on delete cascade,
  user_id uuid references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Amis : une demande, puis acceptée.
create table if not exists public.friendships (
  requester uuid references auth.users on delete cascade,
  addressee uuid references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- Messages : soit dans un groupe, soit en privé entre deux amis (dm = "idA_idB", ids triés).
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  group_id uuid references public.groups on delete cascade,
  dm text,
  sender uuid not null references auth.users on delete cascade default auth.uid(),
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  check ((group_id is null) <> (dm is null))
);
create index if not exists messages_group on public.messages (group_id, created_at);
create index if not exists messages_dm on public.messages (dm, created_at);

-- Fonctions d'accès (security definer pour éviter les boucles entre règles).
create or replace function public.in_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid());
$$;
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where status = 'accepted'
    and ((requester = a and addressee = b) or (requester = b and addressee = a)));
$$;
create or replace function public.path_group(p text) returns uuid
language sql immutable as $$
  select case when p ~ '^g/[0-9a-f-]{36}/' then split_part(p, '/', 2)::uuid end;
$$;
create or replace function public.dm_key(a uuid, b uuid) returns text
language sql immutable as $$ select least(a::text, b::text) || '_' || greatest(a::text, b::text) $$;

-- Règles d'accès.
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.friendships enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profils visibles" on public.profiles;
drop policy if exists "mon profil" on public.profiles;
create policy "profils visibles" on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (select 1 from public.friendships f where (f.requester = auth.uid() and f.addressee = id) or (f.addressee = auth.uid() and f.requester = id))
  or exists (select 1 from public.group_members a join public.group_members b using (group_id) where a.user_id = auth.uid() and b.user_id = id));
create policy "mon profil" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "mes groupes" on public.groups;
drop policy if exists "renommer mes groupes" on public.groups;
create policy "mes groupes" on public.groups for select to authenticated using (public.in_group(id));
create policy "renommer mes groupes" on public.groups for update to authenticated using (public.in_group(id)) with check (public.in_group(id));

drop policy if exists "membres de mes groupes" on public.group_members;
drop policy if exists "quitter un groupe" on public.group_members;
create policy "membres de mes groupes" on public.group_members for select to authenticated using (public.in_group(group_id));
create policy "quitter un groupe" on public.group_members for delete to authenticated using (user_id = auth.uid());

drop policy if exists "mes amitiés" on public.friendships;
drop policy if exists "retirer un ami" on public.friendships;
create policy "mes amitiés" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
create policy "retirer un ami" on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));

drop policy if exists "lire mes messages" on public.messages;
drop policy if exists "écrire un message" on public.messages;
create policy "lire mes messages" on public.messages for select to authenticated using (
  (group_id is not null and public.in_group(group_id))
  or (dm is not null and auth.uid()::text in (split_part(dm, '_', 1), split_part(dm, '_', 2))));
create policy "écrire un message" on public.messages for insert to authenticated with check (
  sender = auth.uid() and (
    (group_id is not null and public.in_group(group_id))
    or (dm is not null and auth.uid()::text in (split_part(dm, '_', 1), split_part(dm, '_', 2))
        and public.are_friends(split_part(dm, '_', 1)::uuid, split_part(dm, '_', 2)::uuid))));

-- Le carnet : chaque document est rangé sous g/<groupe>/..., visible des seuls membres du groupe.
drop policy if exists "membres lisent" on public.docs;
drop policy if exists "membres ajoutent" on public.docs;
drop policy if exists "membres modifient" on public.docs;
drop policy if exists "membres suppriment" on public.docs;
drop policy if exists "groupe lit" on public.docs;
drop policy if exists "groupe ajoute" on public.docs;
drop policy if exists "groupe modifie" on public.docs;
drop policy if exists "groupe supprime" on public.docs;
create policy "groupe lit" on public.docs for select to authenticated using (public.in_group(public.path_group(path)));
create policy "groupe ajoute" on public.docs for insert to authenticated with check (public.in_group(public.path_group(path)));
create policy "groupe modifie" on public.docs for update to authenticated using (public.in_group(public.path_group(path))) with check (public.in_group(public.path_group(path)));
create policy "groupe supprime" on public.docs for delete to authenticated using (public.in_group(public.path_group(path)));

-- Photos : tout compte peut en envoyer.
drop policy if exists "membres envoient des photos" on storage.objects;
drop policy if exists "comptes envoient des photos" on storage.objects;
create policy "comptes envoient des photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos');

-- Le carnet d'origine devient le groupe « Maison ».
insert into public.groups (id, name) values ('00000000-0000-4000-8000-000000000001', 'Maison') on conflict (id) do nothing;
update public.docs set path = 'g/00000000-0000-4000-8000-000000000001/' || path where path !~ '^g/';

-- Nouveau compte : profil, puis groupe « Maison » si l'adresse était autorisée, sinon un carnet personnel.
create or replace function public.new_profile(u auth.users) returns void
language plpgsql security definer set search_path = public as $$
declare base text; h text; n int := 0; g uuid;
begin
  if exists (select 1 from profiles where id = u.id) then return; end if;
  base := left(regexp_replace(lower(split_part(coalesce(u.email, 'ami'), '@', 1)), '[^a-z0-9_.]', '', 'g'), 18);
  if length(base) < 3 then base := base || 'ami'; end if;
  h := base;
  while exists (select 1 from profiles where handle = h) loop n := n + 1; h := base || n; end loop;
  insert into profiles (id, name, handle) values (u.id, coalesce(u.raw_user_meta_data ->> 'name', ''), h);
  if exists (select 1 from members where lower(email) = lower(u.email)) then
    insert into group_members (group_id, user_id) values ('00000000-0000-4000-8000-000000000001', u.id) on conflict do nothing;
  else
    insert into groups (name, created_by) values ('Mon carnet', u.id) returning id into g;
    insert into group_members (group_id, user_id) values (g, u.id);
  end if;
end $$;

create or replace function public.on_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.new_profile(new); return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.on_new_user();

-- Les comptes déjà créés reçoivent leur profil.
do $$ declare u auth.users; begin
  for u in select * from auth.users loop perform public.new_profile(u); end loop;
end $$;

-- Actions (security definer : elles vérifient elles-mêmes qui a le droit).
create or replace function public.request_friend(p_handle text) returns text
language plpgsql security definer set search_path = public as $$
declare other uuid;
begin
  select id into other from profiles where handle = lower(trim(both '@ ' from p_handle));
  if other is null then return 'introuvable'; end if;
  if other = auth.uid() then return 'soi'; end if;
  if are_friends(auth.uid(), other) then return 'deja'; end if;
  if exists (select 1 from friendships where requester = other and addressee = auth.uid()) then
    update friendships set status = 'accepted' where requester = other and addressee = auth.uid();
    return 'ami';
  end if;
  insert into friendships (requester, addressee) values (auth.uid(), other) on conflict do nothing;
  return 'envoye';
end $$;

create or replace function public.accept_friend(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update friendships set status = 'accepted' where requester = p_user and addressee = auth.uid();
$$;

create or replace function public.create_group(p_name text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid; m uuid;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  insert into groups (name, created_by) values (left(trim(p_name), 40), auth.uid()) returning id into g;
  insert into group_members (group_id, user_id) values (g, auth.uid());
  foreach m in array coalesce(p_members, '{}') loop
    if are_friends(auth.uid(), m) then insert into group_members (group_id, user_id) values (g, m) on conflict do nothing; end if;
  end loop;
  return g;
end $$;

create or replace function public.add_to_group(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not in_group(p_group) or not are_friends(auth.uid(), p_user) then raise exception 'non autorisé'; end if;
  insert into group_members (group_id, user_id) values (p_group, p_user) on conflict do nothing;
end $$;

-- Un groupe sans membre disparaît avec son carnet.
create or replace function public.on_member_left() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from group_members where group_id = old.group_id) then
    delete from docs where path_group(path) = old.group_id;
    delete from groups where id = old.group_id;
  end if;
  return old;
end $$;
drop trigger if exists on_member_left on public.group_members;
create trigger on_member_left after delete on public.group_members for each row execute function public.on_member_left();

-- Mises à jour en direct.
do $$ declare t text; begin
  foreach t in array array['messages','friendships','group_members','groups','profiles'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
alter table public.friendships replica identity full;
alter table public.group_members replica identity full;
