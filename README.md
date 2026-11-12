# Minha Estante

Aplicativo de leitura com conta real, estante sincronizada entre aparelhos e progresso de leitura.
Esta é a **fase 1** da migração do protótipo (arquivo único dentro do Claude) para um produto
com backend próprio.

- **Frontend:** React 18 + TypeScript + Vite + React Router
- **Backend:** Supabase (Auth + PostgreSQL com RLS)
- **Sem dados de exemplo:** sem um projeto Supabase configurado, o app mostra uma tela de
  configuração e não salva nada.

## O que já funciona (fase 1)

| Área | Detalhe |
|---|---|
| Conta | Cadastro e login por e-mail e senha, confirmação de e-mail (se ligada no Supabase), "esqueci minha senha", troca de senha, sair |
| Sincronização | Os livros ficam na conta; entrar em outro aparelho mostra a mesma estante |
| Estante | Três categorias (Lendo, Quero ler, Concluídos), grade ou lista, busca por título e autor, filtro por gênero e por avaliação, ordenação |
| Livro | Título, autor, gênero, total de páginas, datas de início e término, nota, resenha, anotações; editar e excluir com confirmação |
| Progresso | Registrar a página atual, porcentagem, atalho "+10 páginas", concluir; ao chegar no total o livro vira "Concluído" |
| Início | Saudação, leituras em andamento com barra de progresso, resumo do mês (páginas lidas, livros concluídos), fila do "Quero ler" |
| Perfil | Nome, e-mail, estatísticas (concluídos, nota média, páginas), trocar nome e senha |
| Segurança | RLS em todas as tabelas; histórico de progresso gravado pelo banco; nenhuma chave secreta no frontend |

## O que ainda não existe (próximas fases)

Nada abaixo aparece no app como botão ou tela vazia.

1. **Fase 2, diário:** álbum de recortes com fotos (Supabase Storage) e número da página, foto de capa,
   cronômetro e meta diária, diário de emoções, cápsula literária, importação dos dados do protótipo.
2. **Fase 3, Party Read:** salas, convites, progresso de cada pessoa, chat com anti-spoiler garantido
   pelo banco, reações, enquetes (Supabase Realtime).
3. **Fase 4, social:** perfil público com controles de privacidade, seguir, feed, curtidas, comentários.
4. **Fase 5, extras:** conquistas, cartões compartilháveis em imagem, desafios coletivos.

Também pendentes: login por telefone (exige contratar um provedor de SMS no Supabase), organização
manual da estante, recomendações (dependem de uma fonte de dados real).

## Como colocar para funcionar

### 1. Criar o projeto no Supabase

1. Crie uma conta e um projeto em <https://supabase.com>.
2. No painel, abra **SQL Editor**, cole o conteúdo de `supabase/migrations/0001_base.sql` e execute.
3. Em **Authentication > URL Configuration**:
   - **Site URL:** o endereço onde o app vai rodar (`http://localhost:5173` para testar no computador;
     depois troque pelo endereço publicado).
   - **Redirect URLs:** adicione `http://localhost:5173/redefinir-senha` e, depois de publicar,
     `https://SEU-ENDERECO/redefinir-senha`. Sem isso o link de "esqueci minha senha" não volta para o app.
4. Em **Authentication > Providers > Email**, decida se quer exigir confirmação de e-mail
   (recomendado para uso real). O app funciona nos dois modos.
5. O serviço de e-mail embutido do Supabase serve para testes e tem limite baixo de envios.
   Para usuários reais, configure um SMTP próprio em **Authentication > Emails > SMTP Settings**.

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com os dados de **Project Settings > API**:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   (chave "anon" / "publishable")
```

Essas duas são públicas por natureza: quem protege os dados é o RLS do banco.
**Nunca** coloque a chave `service_role` no projeto, no `.env.local` ou na hospedagem do frontend.

### 3. Rodar no computador

Precisa do Node.js 20 ou mais novo.

```
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente `http://localhost:5173`).

### 4. Publicar

O app é um site estático. Em qualquer hospedagem:

- **Comando de build:** `npm run build`
- **Pasta publicada:** `dist`
- **Variáveis:** as mesmas duas `VITE_...` do passo 2
- **Rotas:** todas as rotas devem cair em `index.html`. Já vai configurado para Vercel (`vercel.json`)
  e Netlify (`public/_redirects`).

Depois de publicar, volte ao passo 1.3 e troque a Site URL e a Redirect URL pelo endereço final.

### 5. Backup

Os dados ficam no PostgreSQL do Supabase. Confira em **Database > Backups** o que o seu plano inclui.
Para um backup manual: `supabase db dump --data-only > backup.sql` (com a CLI do Supabase).

## Testes

```
npm run build        # confere os tipos e compila
npm run test:db      # aplica as migrações num PostgreSQL local descartável e testa o RLS (18 verificações)
npm run test:e2e     # abre o app num navegador e percorre 44 verificações de tela
```

- `test:db` precisa do PostgreSQL 15+ instalado na máquina. Ele cria um esqueleto mínimo do schema
  `auth` do Supabase e prova, com dois usuários, que ninguém lê, altera ou apaga dados de outro.
- `test:e2e` precisa do Playwright (`npm i -D playwright && npx playwright install chromium`).
  As respostas do Supabase são **simuladas** por `tests/mock-supabase.mjs`; isso testa as telas,
  não o seu projeto Supabase. Depois de configurar o projeto real, faça o roteiro manual abaixo.

### Roteiro manual com o projeto real

1. Criar conta, confirmar o e-mail (se ligado) e entrar.
2. Registrar um livro em "Lendo" com total de páginas e registrar uma página.
3. Abrir o app em outro aparelho ou navegador com a mesma conta e conferir que o livro aparece.
4. Sair, usar "Esqueci minha senha", abrir o link do e-mail e definir a nova senha.
5. Criar uma segunda conta e conferir que a estante dela começa vazia.

## Estrutura

```
supabase/migrations/0001_base.sql   tabelas, RLS e gatilhos
src/lib/supabase.ts                 cliente único
src/lib/auth.tsx                    sessão, cadastro, login, recuperação de senha
src/lib/books.tsx                   leitura e escrita dos livros, páginas do mês
src/lib/format.ts                   datas, porcentagem, mensagens de erro
src/components/                     capa, estrelas, barra de progresso, navegação
src/pages/                          Entrada, Nova senha, Início, Estante, Livro, Formulário, Perfil
tests/                              testes do banco e das telas
```

## Decisões de modelagem

- `books.current_page` nunca passa de `total_pages` e as datas ficam em ordem: o banco recusa.
- O histórico `reading_progress` é escrito por um gatilho quando `current_page` muda. O app só lê.
  Assim "páginas lidas no mês" não pode ser forjado nem ficar inconsistente com os livros.
- Excluir a conta em **Authentication > Users** apaga perfil, livros e histórico em cascata.
