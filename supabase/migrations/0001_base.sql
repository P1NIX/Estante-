-- Minha Estante · fase 1: perfis, livros e histórico de progresso.
-- Rode este arquivo inteiro no SQL Editor do Supabase (ou com `supabase db push`).
-- Toda tabela tem RLS: cada pessoa só enxerga e altera as próprias linhas.

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "perfil: ler o próprio"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "perfil: editar o próprio"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- O perfil nasce junto com a conta. O nome vem do cadastro (display_name);
-- se vier vazio ou curto demais, usa "Leitor" para nunca bloquear o cadastro.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nome text := btrim(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 40));
begin
  if char_length(nome) < 2 then
    nome := 'Leitor';
  end if;
  insert into public.profiles (id, display_name) values (new.id, nome);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Livros
-- ---------------------------------------------------------------------------
create type public.book_status as enum ('quero_ler', 'lendo', 'concluido');

create table public.books (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  author       text not null check (char_length(btrim(author)) between 1 and 200),
  status       public.book_status not null default 'quero_ler',
  genre        text check (genre is null or char_length(genre) between 1 and 40),
  total_pages  integer check (total_pages is null or total_pages between 1 and 20000),
  current_page integer not null default 0 check (current_page >= 0),
  started_on   date,
  finished_on  date,
  rating       smallint check (rating is null or rating between 1 and 5),
  review       text not null default '' check (char_length(review) <= 20000),
  notes        text not null default '' check (char_length(notes) <= 20000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint pagina_dentro_do_total check (total_pages is null or current_page <= total_pages),
  constraint datas_em_ordem check (started_on is null or finished_on is null or started_on <= finished_on)
);

create index books_user_status_idx on public.books (user_id, status);

alter table public.books enable row level security;

create policy "livros: ler os próprios"
  on public.books for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "livros: criar os próprios"
  on public.books for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "livros: editar os próprios"
  on public.books for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "livros: excluir os próprios"
  on public.books for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Histórico de progresso
-- Cada mudança de página vira uma linha, gravada pelo banco (não pelo app),
-- para que "páginas lidas no mês" seja sempre consistente com os livros.
-- ---------------------------------------------------------------------------
create table public.reading_progress (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users (id) on delete cascade,
  book_id   uuid not null references public.books (id) on delete cascade,
  from_page integer not null check (from_page >= 0),
  to_page   integer not null check (to_page >= 0),
  logged_at timestamptz not null default now()
);

create index reading_progress_user_time_idx on public.reading_progress (user_id, logged_at desc);

alter table public.reading_progress enable row level security;

-- Só leitura para o dono. Ninguém insere, altera ou apaga pelo app:
-- as linhas vêm do gatilho abaixo e somem junto com o livro.
create policy "progresso: ler o próprio"
  on public.reading_progress for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.log_reading_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reading_progress (user_id, book_id, from_page, to_page)
  values (new.user_id, new.id, old.current_page, new.current_page);
  return null;
end;
$$;

create trigger books_log_progress
  after update of current_page on public.books
  for each row
  when (old.current_page is distinct from new.current_page)
  execute function public.log_reading_progress();

-- ---------------------------------------------------------------------------
-- updated_at automático e dono imutável
-- ---------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger books_touch before update on public.books
  for each row execute function public.touch_updated_at();

-- As funções de gatilho não devem ser chamadas diretamente pela API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_reading_progress() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
