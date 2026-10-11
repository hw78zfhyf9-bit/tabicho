-- 旅帖 データベースの設定
-- Supabase の SQL Editor に全文を貼り付けて Run を押してください。
-- 何度実行しても壊れないように書いてあります。

------------------------------------------------------------
-- テーブル
------------------------------------------------------------
create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  country     text not null default 'KR' check (char_length(country) = 2),
  start_date  date,
  end_date    date,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  trip_id   uuid not null references public.trips(id) on delete cascade,
  user_id   uuid not null,
  name      text not null check (char_length(name) between 1 and 12),
  color     int  not null default 0 check (color between 0 and 5),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  day        int  not null default -1 check (day between -1 and 60),
  time       text check (time is null or time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  title      text not null check (char_length(title) between 1 and 80),
  cat        text not null default 'その他',
  note       text check (note is null or char_length(note) <= 200),
  by         uuid default auth.uid(),
  ref_path   text,
  lat        double precision check (lat is null or lat between -90 and 90),
  lng        double precision check (lng is null or lng between -180 and 180),
  visited    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists events_trip_idx on public.events(trip_id);

create table if not exists public.packing (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  owner      uuid,                       -- null のときは「共有」
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists packing_trip_idx on public.packing(trip_id);

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  event_id   uuid references public.events(id) on delete set null,
  place_name text check (place_name is null or char_length(place_name) <= 80),
  by         uuid not null default auth.uid(),
  body       text check (body is null or char_length(body) <= 2000),
  photos     text[] not null default '{}' check (cardinality(photos) <= 12),
  created_at timestamptz not null default now()
);
create index if not exists posts_trip_idx on public.posts(trip_id);

------------------------------------------------------------
-- 参加者かどうかの判定
------------------------------------------------------------
create or replace function public.is_member(t uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.trip_id = t and m.user_id = auth.uid()
  );
$$;

-- 写真の保存パス「旅のID/ファイル名」から、その旅の参加者か判定する
create or replace function public.photo_path_ok(path text)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare t uuid;
begin
  t := split_part(path, '/', 1)::uuid;
  return public.is_member(t);
exception when others then
  return false;
end;
$$;

------------------------------------------------------------
-- 旅の作成と、招待コードでの参加
------------------------------------------------------------
create or replace function public.create_trip(
  p_name text, p_country text, p_start date, p_end date, p_nickname text
) returns public.trips
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  t  public.trips;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from public.trips where created_by = me) >= 20 then
    raise exception 'too_many_trips';
  end if;
  insert into public.trips (name, country, start_date, end_date, created_by)
  values (trim(p_name), upper(coalesce(nullif(trim(p_country), ''), 'KR')), p_start, p_end, me)
  returning * into t;
  insert into public.members (trip_id, user_id, name, color)
  values (t.id, me, left(trim(p_nickname), 12), 0);
  return t;
end;
$$;

create or replace function public.join_trip(p_code text, p_nickname text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  t  uuid;
  c  int;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select id into t from public.trips where invite_code = lower(trim(p_code));
  if t is null then raise exception 'invalid_code'; end if;
  if exists (select 1 from public.members where trip_id = t and user_id = me) then
    return t;
  end if;
  if (select count(*) from public.members where trip_id = t) >= 6 then
    raise exception 'trip_full';
  end if;
  select min(g) into c from generate_series(0, 5) g
   where g not in (select color from public.members where trip_id = t);
  insert into public.members (trip_id, user_id, name, color)
  values (t, me, left(trim(p_nickname), 12), coalesce(c, 0));
  return t;
end;
$$;

-- 一時停止を防ぐための、毎週の呼び出し先
create or replace function public.ping()
returns timestamptz
language sql stable
as $$ select now(); $$;

------------------------------------------------------------
-- 行ごとの権限 (参加者だけが読み書きできる)
------------------------------------------------------------
alter table public.trips   enable row level security;
alter table public.members enable row level security;
alter table public.events  enable row level security;
alter table public.packing enable row level security;
alter table public.posts   enable row level security;

drop policy if exists trips_select on public.trips;
drop policy if exists trips_update on public.trips;
drop policy if exists trips_delete on public.trips;
create policy trips_select on public.trips for select to authenticated using (public.is_member(id));
create policy trips_update on public.trips for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
create policy trips_delete on public.trips for delete to authenticated using (created_by = auth.uid());

drop policy if exists members_select on public.members;
drop policy if exists members_update on public.members;
drop policy if exists members_delete on public.members;
create policy members_select on public.members for select to authenticated using (public.is_member(trip_id));
create policy members_update on public.members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_delete on public.members for delete to authenticated using (user_id = auth.uid());

drop policy if exists events_all on public.events;
create policy events_all on public.events for all to authenticated
  using (public.is_member(trip_id)) with check (public.is_member(trip_id));

drop policy if exists packing_all on public.packing;
create policy packing_all on public.packing for all to authenticated
  using (public.is_member(trip_id)) with check (public.is_member(trip_id));

drop policy if exists posts_select on public.posts;
drop policy if exists posts_insert on public.posts;
drop policy if exists posts_update on public.posts;
drop policy if exists posts_delete on public.posts;
create policy posts_select on public.posts for select to authenticated using (public.is_member(trip_id));
create policy posts_insert on public.posts for insert to authenticated with check (public.is_member(trip_id) and by = auth.uid());
create policy posts_update on public.posts for update to authenticated using (by = auth.uid()) with check (by = auth.uid() and public.is_member(trip_id));
create policy posts_delete on public.posts for delete to authenticated using (by = auth.uid());

------------------------------------------------------------
-- 使える操作の許可
------------------------------------------------------------
revoke all on public.trips, public.members, public.events, public.packing, public.posts from anon;
grant select, delete on public.trips   to authenticated;
grant select, delete on public.members to authenticated;
grant select, insert, update, delete on public.events, public.packing, public.posts to authenticated;
-- 書き換えてよい列だけを許可する (招待コードや作成者は変えられない)
revoke update on public.trips, public.members from authenticated;
grant update (name, country, start_date, end_date) on public.trips   to authenticated;
grant update (name)                                on public.members to authenticated;

revoke all on function public.is_member(uuid)                         from public, anon;
revoke all on function public.photo_path_ok(text)                     from public, anon;
revoke all on function public.create_trip(text, text, date, date, text) from public, anon;
revoke all on function public.join_trip(text, text)                   from public, anon;
grant execute on function public.is_member(uuid)                         to authenticated;
grant execute on function public.photo_path_ok(text)                     to authenticated;
grant execute on function public.create_trip(text, text, date, date, text) to authenticated;
grant execute on function public.join_trip(text, text)                   to authenticated;
grant execute on function public.ping() to anon, authenticated;

------------------------------------------------------------
-- 写真の保存先 (非公開。参加者だけが見られる)
------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 3145728,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists photos_select on storage.objects;
drop policy if exists photos_insert on storage.objects;
drop policy if exists photos_delete on storage.objects;
create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.photo_path_ok(name));
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.photo_path_ok(name));
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.photo_path_ok(name));

------------------------------------------------------------
-- 変更をリアルタイムで相手に届ける
------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['trips', 'members', 'events', 'packing', 'posts'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
