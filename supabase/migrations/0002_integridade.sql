-- Minha Estante · correções de integridade sobre a 0001.
-- Rode depois da 0001 (no SQL Editor do Supabase ou com `supabase db push`).
-- Pode rodar num banco que já tem dados: as linhas antigas são ajustadas antes das novas regras.

-- ---------------------------------------------------------------------------
-- 1. Perfis que faltam: contas criadas antes do gatilho de cadastro existir.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, display_name)
select u.id,
       case when char_length(btrim(left(coalesce(u.raw_user_meta_data ->> 'display_name', ''), 40))) >= 2
            then btrim(left(u.raw_user_meta_data ->> 'display_name', 40))
            else 'Leitor' end
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Nome não pode ser só espaços.
-- ---------------------------------------------------------------------------
update public.profiles set display_name = 'Leitor' where char_length(btrim(display_name)) < 2;

alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles add constraint nome_valido
  check (char_length(btrim(display_name)) >= 2 and char_length(display_name) <= 40);

-- ---------------------------------------------------------------------------
-- 3. Status coerente com páginas, datas e nota.
--    "Quero ler": sem progresso, sem datas, sem nota. "Lendo": sem data de término.
-- ---------------------------------------------------------------------------
alter table public.books disable trigger user;  -- o ajuste abaixo não é leitura: não gera histórico nem mexe em updated_at
update public.books
   set current_page = 0, started_on = null, finished_on = null, rating = null
 where status = 'quero_ler'
   and (current_page <> 0 or started_on is not null or finished_on is not null or rating is not null);
update public.books set finished_on = null where status = 'lendo' and finished_on is not null;
alter table public.books enable trigger user;

alter table public.books add constraint status_coerente check (
  case status
    when 'quero_ler' then current_page = 0 and started_on is null and finished_on is null and rating is null
    when 'lendo'     then finished_on is null
    else true
  end
);

-- ---------------------------------------------------------------------------
-- 4. Histórico de progresso só registra leitura de verdade.
--    Não entram: recomeços (voltar para "Quero ler" ou começar uma releitura, que zeram a página)
--    nem marcar como concluído um livro que estava em "Quero ler" (foi lido antes, fora do app;
--    igual a registrar o livro já como concluído).
-- ---------------------------------------------------------------------------
create or replace function public.log_reading_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    if new.current_page = 0 then return null; end if;
    if old.status = 'quero_ler' and new.status = 'concluido' then return null; end if;
  end if;
  insert into public.reading_progress (user_id, book_id, from_page, to_page)
  values (new.user_id, new.id, old.current_page, new.current_page);
  return null;
end;
$$;

revoke execute on function public.log_reading_progress() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Datas de criação e atualização são do banco, não do app.
--    Antes o gatilho só rodava no UPDATE e o INSERT aceitava qualquer data.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger profiles_touch on public.profiles;
create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger books_touch on public.books;
create trigger books_touch before insert or update on public.books
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Dono do livro imutável (o comentário da 0001 prometia; agora é regra do banco).
-- ---------------------------------------------------------------------------
create function public.keep_book_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'o dono de um livro não pode ser trocado' using errcode = '42501';
end;
$$;

create trigger books_keep_owner before update of user_id on public.books
  for each row
  when (old.user_id is distinct from new.user_id)
  execute function public.keep_book_owner();

revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.keep_book_owner() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Índice para a exclusão em cascata do histórico ao apagar um livro.
-- ---------------------------------------------------------------------------
create index if not exists reading_progress_book_idx on public.reading_progress (book_id);
