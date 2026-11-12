-- Regras de integridade da migração 0002.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

-- Dados que já existiam antes da 0002 (tests/fixtures/antes_0002_integridade.sql).
select 'I01 conta antiga ganhou perfil: ' || display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000c1';
select 'I02 livro antigo incoerente ajustado: página=' || current_page || ' nota=' || coalesce(rating::text, 'nenhuma')
  from public.books where title = 'Legado';
select 'I03 ajuste não gerou histórico: ' || count(*) from public.reading_progress;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'dani@exemplo.com', '{"display_name":"Dani"}');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);

do $$ begin
  update public.profiles set display_name = '    ';
  raise exception 'FALHA: aceitou nome só com espaços';
exception when check_violation then raise notice 'I04 nome só com espaços: recusado';
end $$;

do $$ begin
  insert into public.books (title, author, status, current_page, total_pages) values ('X', 'Y', 'quero_ler', 50, 100);
  raise exception 'FALHA: aceitou "Quero ler" com progresso';
exception when check_violation then raise notice 'I05 "Quero ler" com progresso: recusado';
end $$;

do $$ begin
  insert into public.books (title, author, status, finished_on) values ('X', 'Y', 'lendo', '2026-01-01');
  raise exception 'FALHA: aceitou "Lendo" com data de término';
exception when check_violation then raise notice 'I06 "Lendo" com data de término: recusado';
end $$;

insert into public.books (title, author, status, total_pages, created_at, updated_at)
  values ('Datas', 'A', 'lendo', 300, '1999-01-01', '2999-01-01');
select 'I07 datas forjadas no cadastro ignoradas: ' || (created_at > now() - interval '1 minute' and updated_at <= now())
  from public.books where title = 'Datas';
update public.books set created_at = '1999-01-01' where title = 'Datas';
select 'I08 created_at não muda na edição: ' || (created_at > now() - interval '1 minute') from public.books where title = 'Datas';

-- Leitura normal, conclusão, releitura do zero e nova leitura.
update public.books set current_page = 120 where title = 'Datas';                                    -- +120
update public.books set status = 'concluido', current_page = 300, finished_on = current_date where title = 'Datas'; -- +180
update public.books set status = 'lendo', current_page = 0, finished_on = null where title = 'Datas'; -- recomeço: não entra
update public.books set current_page = 50 where title = 'Datas';                                     -- +50
select 'I09 releitura soma o que foi lido: ' || sum(to_page - from_page) || ' páginas em ' || count(*) || ' registros'
  from public.reading_progress where book_id = (select id from public.books where title = 'Datas');

-- Livro lido antes do app: "Quero ler" -> "Concluído" não conta como leitura do mês.
insert into public.books (title, author, total_pages) values ('Antigo', 'B', 200);
update public.books set status = 'concluido', current_page = 200, finished_on = current_date where title = 'Antigo';
select 'I10 concluir direto da fila não gera histórico: ' || count(*)
  from public.reading_progress where book_id = (select id from public.books where title = 'Antigo');

-- Voltar para "Quero ler" não apaga o que foi lido.
update public.books set status = 'quero_ler', current_page = 0, started_on = null, finished_on = null, rating = null where title = 'Datas';
select 'I11 voltar para a fila não gera registro negativo: ' || count(*) || ' registros'
  from public.reading_progress where book_id = (select id from public.books where title = 'Datas');

do $$ begin
  update public.books set user_id = '00000000-0000-0000-0000-0000000000d1' where title = 'Antigo';
  raise notice 'I12 manter o próprio dono: permitido';
end $$;

reset role;
do $$ begin
  update public.books set user_id = '00000000-0000-0000-0000-0000000000c1' where title = 'Antigo';
  raise exception 'FALHA: trocou o dono do livro';
exception when insufficient_privilege then raise notice 'I13 trocar o dono, mesmo como administrador: recusado';
end $$;

select 'I14 índice do histórico por livro: ' || count(*) from pg_indexes where indexname = 'reading_progress_book_idx';

-- Limpa as contas deste arquivo para o teste de RLS começar do zero.
delete from auth.users where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1');
