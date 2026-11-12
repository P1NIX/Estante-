-- Teste das regras de acesso (RLS) num PostgreSQL local.
-- Antes deste arquivo, tests/run_db_test.sh cria um esqueleto mínimo do que o
-- Supabase já traz pronto (schema auth, auth.uid(), papéis anon/authenticated).
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

-- Duas contas. O gatilho deve criar os perfis.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com', '{"display_name":"Ana Souza"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@exemplo.com', '{"display_name":" "}');

select 'T01 perfis criados pelo gatilho: ' || string_agg(display_name, ', ' order by display_name) from public.profiles;

-- ---- Ana ----
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

insert into public.books (title, author, status, total_pages) values ('Dom Casmurro', 'Machado de Assis', 'lendo', 256);
insert into public.books (title, author) values ('Vidas Secas', 'Graciliano Ramos');
select 'T02 Ana vê seus livros: ' || count(*) from public.books;

update public.books set current_page = 64 where title = 'Dom Casmurro';
update public.books set current_page = 128 where title = 'Dom Casmurro';
update public.books set review = 'Ótimo' where title = 'Dom Casmurro'; -- não muda página: não gera histórico
select 'T03 histórico gerado pelo gatilho: ' || string_agg(from_page || '->' || to_page, ' ' order by id) from public.reading_progress;

-- Ana não pode forjar histórico nem criar livro em nome de outra pessoa.
do $$ begin
  insert into public.reading_progress (user_id, book_id, from_page, to_page)
    select user_id, id, 0, 999 from public.books limit 1;
  raise exception 'FALHA: inseriu histórico direto';
exception when insufficient_privilege then raise notice 'T04 inserir histórico direto: bloqueado';
end $$;

do $$ begin
  insert into public.books (user_id, title, author) values ('00000000-0000-0000-0000-00000000000b', 'Intruso', 'X');
  raise exception 'FALHA: criou livro para outra pessoa';
exception when insufficient_privilege then raise notice 'T05 criar livro em nome de outra pessoa: bloqueado';
end $$;

do $$ begin
  update public.books set current_page = 999 where title = 'Dom Casmurro';
  raise exception 'FALHA: página acima do total';
exception when check_violation then raise notice 'T06 página acima do total: recusada';
end $$;

do $$ begin
  update public.books set started_on = '2026-11-10', finished_on = '2026-11-01' where title = 'Dom Casmurro';
  raise exception 'FALHA: datas fora de ordem';
exception when check_violation then raise notice 'T07 término antes do início: recusado';
end $$;

-- ---- Bia ----
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select 'T08 Bia vê livros da Ana: ' || count(*) from public.books;
select 'T09 Bia vê histórico da Ana: ' || count(*) from public.reading_progress;
select 'T10 Bia vê perfis: ' || string_agg(display_name, ', ') from public.profiles;

with x as (update public.books set title = 'Hackeado' returning 1) select 'T11 Bia altera livros da Ana: ' || count(*) from x;
with x as (delete from public.books returning 1) select 'T12 Bia apaga livros da Ana: ' || count(*) from x;
with x as (update public.profiles set display_name = 'Invadido' where id = '00000000-0000-0000-0000-00000000000a' returning 1)
  select 'T13 Bia altera perfil da Ana: ' || count(*) from x;

do $$ begin
  update public.books set user_id = '00000000-0000-0000-0000-00000000000b';
  raise notice 'T14 Bia tomar posse de livro: nenhuma linha alcançada';
end $$;

-- ---- Visitante sem login ----
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  perform 1 from public.books;
  raise exception 'FALHA: visitante leu livros';
exception when insufficient_privilege then raise notice 'T15 visitante lê livros: bloqueado';
end $$;

-- ---- Conferência final como administrador ----
reset role;
select 'T16 livros intactos: ' || string_agg(title, ', ' order by title) from public.books;
select 'T17 perfil da Ana intacto: ' || display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a';

-- Apagar a conta apaga tudo que é dela.
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select 'T18 após excluir a conta: livros=' || (select count(*) from public.books) || ' histórico=' || (select count(*) from public.reading_progress) || ' perfis=' || (select count(*) from public.profiles);
