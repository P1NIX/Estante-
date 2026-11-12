-- Estado de um banco que já tinha dados antes da 0002:
-- uma conta sem perfil (criada antes do gatilho) e um livro "Quero ler" incoerente.
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'antiga@exemplo.com', '{"display_name":"Carla Antiga"}');
alter table auth.users enable trigger on_auth_user_created;
insert into public.books (user_id, title, author, status, current_page, total_pages, rating)
  values ('00000000-0000-0000-0000-0000000000c1', 'Legado', 'Autor', 'quero_ler', 40, 100, 3);
