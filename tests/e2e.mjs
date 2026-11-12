// Teste de ponta a ponta das telas. Compila o app apontando para um endereço de teste e
// intercepta as chamadas ao Supabase com tests/mock-supabase.mjs.
// Uso: npm run test:e2e   (precisa do Playwright: npm i -D playwright && npx playwright install chromium)
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMock } from './mock-supabase.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist-test');
const SHOTS = path.join(ROOT, 'tests', 'shots');
const API = 'https://mock.supabase.test';
const PORT = 4179;
const APP = `http://127.0.0.1:${PORT}`;

execFileSync('npx', ['vite', 'build', '--outDir', OUT, '--emptyOutDir', '--logLevel', 'error'], {
  cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_SUPABASE_URL: API, VITE_SUPABASE_ANON_KEY: 'chave-anon-de-teste' },
});
fs.mkdirSync(SHOTS, { recursive: true });

// Servidor estático com o mesmo "fallback" de SPA que a hospedagem usa.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, APP).pathname);
  let file = path.join(OUT, p);
  if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(OUT, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1');

const mock = createMock();
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
const errors = [];
let fails = 0;
const check = (label, ok, extra) => { if (!ok) fails++; console.log(ok ? 'OK    ' : 'FALHOU', label, extra === undefined ? '' : `| ${extra}`); };

async function device(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1280, height: 900 }, ...opts });
  await ctx.route(`${API}/**`, async (route) => {
    const r = route.request();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const out = mock.handle({ method: r.method(), url: r.url(), headers: r.headers(), body: r.postData() });
    return route.fulfill({ status: out.status, contentType: out.contentType, headers: CORS, body: out.body });
  });
  await ctx.route('https://fonts.g*/**', (route) => route.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push(`console: ${m.text()}`); });
  return { ctx, page };
}
const txt = (page, sel) => page.locator(sel).first().innerText();
const toastIs = (page, re) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector('#toast.show')?.textContent || ''), re.source);

async function addBook(page, { title, author, status, total, genre, rating, review, pageNow }) {
  await page.goto(`${APP}/livro/novo?s=${status}`);
  await page.fill('#title', title);
  await page.fill('#author', author);
  if (genre) await page.selectOption('#genre', genre);
  if (total) await page.fill('#total', String(total));
  if (pageNow !== undefined) await page.fill('#page', String(pageNow));
  if (rating) await page.click(`.rating button:nth-child(${rating})`);
  if (review) await page.fill('#review', review);
  await page.click('#save');
  await page.waitForSelector('#headline');
}

const browser = await chromium.launch();
try {
  const A = await device(browser);
  const a = A.page;

  // ---------- 1. Cadastro ----------
  await a.goto(APP);
  await a.waitForSelector('#authForm');
  await a.click('#tab-signup');
  await a.fill('#name', 'Ana Souza'); await a.fill('#email', 'ana@exemplo.com'); await a.fill('#pw', 'curta'); await a.fill('#pw2', 'curta');
  await a.click('#authForm button[type=submit]');
  check('01 senha curta é recusada antes de ir ao servidor', (await txt(a, '#authError')).includes('8 caracteres') && mock.db.users.size === 0);
  await a.fill('#pw', 'senha-forte-1'); await a.fill('#pw2', 'senha-diferente');
  await a.click('#authForm button[type=submit]');
  check('02 senhas diferentes são recusadas', (await txt(a, '#authError')).includes('não são iguais'));
  await a.fill('#pw2', 'senha-forte-1');
  await a.click('#authForm button[type=submit]');
  await a.waitForSelector('#addFirst');
  check('03 conta criada: Início com saudação e estado vazio', (await txt(a, '.intro h1')) === 'Olá, Ana.' && mock.db.users.size === 1, await txt(a, '.intro h1'));

  // ---------- 2. Livro em leitura e progresso ----------
  await a.click('#addFirst');
  await a.waitForSelector('#bookForm');
  await a.click('#save');
  check('04 livro sem título é recusado', (await txt(a, '#bookError')).includes('título'));
  await a.fill('#title', 'Dom Casmurro'); await a.fill('#author', 'Machado de Assis'); await a.fill('#total', '256'); await a.fill('#page', '300');
  await a.click('#save');
  check('05 página acima do total é recusada', (await txt(a, '#bookError')).includes('não pode passar do total'));
  await a.fill('#page', '0'); await a.selectOption('#genre', 'Clássico');
  await a.click('#save');
  await a.waitForSelector('#headline');
  const head = (await txt(a, '#headline')).toLowerCase();
  check('06 livro salvo como "Lendo", com páginas e gênero', head.startsWith('lendo desde') && head.includes('256 páginas') && head.includes('clássico'), head);
  await a.fill('#pageNow', '64'); await a.click('#savePage');
  await a.waitForFunction(() => document.querySelector('#pctNow')?.textContent === '25%');
  check('07 página 64 de 256 = 25%', true);
  await a.click('#plus10');
  await a.waitForFunction(() => document.querySelector('#pctNow')?.textContent === '29%');
  check('08 +10 páginas: 74 = 29%', (await a.inputValue('#pageNow')) === '74');
  await a.fill('#pageNow', '999'); await a.click('#savePage');
  await toastIs(a, /256 páginas/);
  check('09 página 999 recusada com aviso', mock.db.progress.length === 2, `histórico=${mock.db.progress.length}`);

  await a.click('#tab-inicio');
  await a.waitForSelector('.now');
  check('10 Início: lendo agora com 29% e 74 páginas no mês', (await txt(a, '.now-pct b')) === '29%' && (await txt(a, '#monthPages')) === '74', `${await txt(a, '.now-pct b')} / ${await txt(a, '#monthPages')}`);
  await a.screenshot({ path: path.join(SHOTS, 'inicio_desktop.png'), fullPage: true });

  // ---------- 3. Quero ler -> lendo; concluído com nota ----------
  await addBook(a, { title: 'Torto Arado', author: 'Itamar Vieira Junior', status: 'quero_ler', total: 264, genre: 'Romance' });
  check('11 "Quero ler" salvo sem datas', (await txt(a, '#headline')).toLowerCase().startsWith('quero ler ·'), await txt(a, '#headline'));
  await addBook(a, { title: 'A Hora da Estrela', author: 'Clarice Lispector', status: 'concluido', total: 88, genre: 'Clássico', rating: 5, review: 'Curto e devastador.' });
  check('12 concluído salvo com nota, data e resenha', (await txt(a, '#headline')).toLowerCase().startsWith('concluído em') && (await a.locator('.hero .stars svg.on').count()) === 5 && (await txt(a, '.ruled')).includes('devastador'));
  await addBook(a, { title: 'O Hobbit', author: 'J. R. R. Tolkien', status: 'concluido', total: 310, genre: 'Fantasia', rating: 3 });

  await a.click('#tab-estante');
  await a.waitForSelector('.status-tabs');
  const counts = await a.locator('.status-tabs .count').allInnerTexts();
  check('13 contadores das três estantes', counts.join(',') === '1,1,2', counts.join(','));
  await a.click('#st-quero_ler');
  await a.click('.book');
  await a.click('#startReading');
  await a.waitForFunction(() => document.querySelector('#headline')?.textContent.toLowerCase().startsWith('lendo'));
  check('14 "Começar a ler" move o livro para Lendo', true);

  // ---------- 4. Filtros, busca e visualização ----------
  await a.goto(`${APP}/estante?s=concluido`);
  await a.waitForSelector('#grid');
  check('15 aba Concluídos pelo endereço mostra 2 livros', (await a.locator('#grid .book').count()) === 2);
  await a.selectOption('#minRating', '4');
  check('16 filtro por avaliação (4 ou mais)', (await a.locator('#grid .book').count()) === 1 && (await txt(a, '#grid h3')) === 'A Hora da Estrela');
  await a.selectOption('#minRating', '0'); await a.selectOption('#genre', 'Fantasia');
  check('17 filtro por gênero', (await a.locator('#grid .book').count()) === 1 && (await txt(a, '#grid h3')) === 'O Hobbit');
  await a.selectOption('#genre', ''); await a.fill('#q', 'clarice');
  check('18 busca por autor, sem acento', (await txt(a, '#grid h3')) === 'A Hora da Estrela');
  await a.fill('#q', 'zzz');
  check('19 busca sem resultado oferece limpar filtros', (await a.locator('#clearFilters').count()) === 1);
  await a.click('#clearFilters');
  await a.selectOption('#sort', 'title');
  check('20 ordenar por título', (await a.locator('#grid h3').allInnerTexts()).join('|') === 'A Hora da Estrela|O Hobbit');
  await a.click('#viewList');
  await a.waitForSelector('#grid .rowbook');
  await a.reload(); await a.waitForSelector('#grid');
  check('21 visualização em lista é lembrada após recarregar', (await a.locator('#grid .rowbook').count()) === 2);
  await a.screenshot({ path: path.join(SHOTS, 'estante_lista_desktop.png'), fullPage: true });
  await a.click('#viewGrid');

  // ---------- 5. Concluir, editar, excluir ----------
  await a.goto(`${APP}/estante`);
  await a.waitForSelector('#grid');
  await a.click('#grid .book:has-text("Dom Casmurro")');
  await a.click('#finish');
  await a.waitForFunction(() => document.querySelector('#headline')?.textContent.toLowerCase().startsWith('concluído em'));
  const dom = [...mock.db.books.values()].find((b) => b.title === 'Dom Casmurro');
  check('22 concluir: página vai ao total e ganha data de término', dom.current_page === 256 && !!dom.finished_on && dom.status === 'concluido');
  await a.click('#edit');
  await a.waitForSelector('#bookForm');
  await a.reload(); await a.waitForSelector('#bookForm');
  check('23 recarregar na edição mantém os campos preenchidos', (await a.inputValue('#title')) === 'Dom Casmurro' && (await a.inputValue('#total')) === '256');
  await a.fill('#title', 'Dom Casmurro (edição anotada)'); await a.click('.rating button:nth-child(4)');
  await a.click('#save');
  await a.waitForSelector('#headline');
  check('24 edição salva título e nota', (await txt(a, '.detail-head h1')) === 'Dom Casmurro (edição anotada)' && (await a.locator('.hero .stars svg.on').count()) === 4);
  await a.click('#tab-inicio'); await a.waitForSelector('#monthPages');
  check('25 páginas do mês somam o livro concluído (256)', (await txt(a, '#monthPages')) === '256', await txt(a, '#monthPages'));
  await a.goto(`${APP}/estante?s=concluido`); await a.waitForSelector('#grid');
  await a.click('#grid .book:has-text("O Hobbit")');
  await a.click('#del'); await a.click('#confirmNo');
  check('26 cancelar a exclusão mantém o livro', mock.db.books.size === 4);
  await a.click('#del'); await a.click('#confirmYes');
  await a.waitForSelector('.status-tabs');
  check('27 excluir remove o livro', mock.db.books.size === 3 && (await a.locator('#grid .book:has-text("O Hobbit")').count()) === 0);

  // Releitura: volta para "Lendo" do zero, sem apagar as páginas já lidas no mês.
  await a.click('#st-concluido'); await a.waitForSelector('#grid');
  await a.click('#grid .book:has-text("Dom Casmurro")');
  await a.click('#reread');
  await a.waitForFunction(() => document.querySelector('#pctNow')?.textContent === '0%');
  const reread = [...mock.db.books.values()].find((b) => b.title.startsWith('Dom Casmurro'));
  const hoje = new Date(); const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  check('27a ler de novo começa da página 0, com início hoje', reread.status === 'lendo' && reread.current_page === 0 && reread.started_on === hojeISO && reread.finished_on === null, JSON.stringify({ p: reread.current_page, s: reread.started_on }));
  await a.click('#plus10');
  await a.waitForFunction(() => document.querySelector('#pctNow')?.textContent === '4%');
  await a.click('#tab-inicio'); await a.waitForSelector('#monthPages');
  check('27b páginas da releitura somam às do mês (256 + 10)', (await txt(a, '#monthPages')) === '266', await txt(a, '#monthPages'));
  await a.click('.now:has-text("Dom Casmurro")');
  await a.click('#finish');
  await a.waitForFunction(() => document.querySelector('#headline')?.textContent.toLowerCase().startsWith('concluído em'));

  // ---------- 6. Perfil, nome e senha ----------
  await a.click('#tab-perfil');
  await a.waitForSelector('.figures');
  const figs = await a.locator('.figures dd').allInnerTexts();
  check('28 estatísticas do perfil', figs[0] === '2' && figs[2] === '4,5' && figs[3] === '344' && figs[4] === '1', figs.join(' | '));
  await a.fill('#pname', 'Ana S. Lima'); await a.click('#saveName');
  await a.waitForFunction(() => document.querySelector('#profileName')?.textContent === 'Ana S. Lima');
  check('29 nome atualizado no servidor', mock.db.profiles.get(mock.byEmail('ana@exemplo.com').id).display_name === 'Ana S. Lima');
  await a.fill('#ppw', 'nova-senha-2'); await a.fill('#ppw2', 'nova-senha-2'); await a.click('#savePw');
  await toastIs(a, /Senha alterada/);
  check('30 senha trocada no perfil', mock.byEmail('ana@exemplo.com').password === 'nova-senha-2');

  // ---------- 7. Sair, entrar, sincronizar em outro aparelho ----------
  await a.click('#logout');
  await a.waitForSelector('#authForm');
  await a.goto(`${APP}/estante`);
  await a.waitForSelector('#authForm');
  check('31 depois de sair, rotas protegidas mostram a entrada', true);
  await a.fill('#email', 'ana@exemplo.com'); await a.fill('#pw', 'senha-forte-1');
  await a.click('#authForm button[type=submit]');
  await a.waitForFunction(() => document.querySelector('#authError')?.textContent.length > 0);
  check('32 senha antiga não entra mais', (await txt(a, '#authError')) === 'E-mail ou senha incorretos.');

  const B = await device(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const b = B.page;
  await b.goto(APP);
  await b.fill('#email', 'ana@exemplo.com'); await b.fill('#pw', 'nova-senha-2');
  await b.click('#authForm button[type=submit]');
  await b.waitForSelector('.now');
  check('33 outro aparelho (celular): mesma conta, mesmos livros', (await txt(b, '.intro h1')) === 'Olá, Ana.' && (await txt(b, '.now h3')) === 'Torto Arado');
  check('34 celular: sem rolagem lateral no Início', await b.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await b.screenshot({ path: path.join(SHOTS, 'inicio_celular.png'), fullPage: true });
  await b.click('.now'); await b.waitForSelector('#pageNow');
  await b.fill('#pageNow', '132'); await b.click('#savePage');
  await b.waitForFunction(() => document.querySelector('#pctNow')?.textContent === '50%');
  await b.screenshot({ path: path.join(SHOTS, 'livro_celular.png'), fullPage: true });
  await b.click('#tab-estante'); await b.waitForSelector('.status-tabs');
  await b.click('#st-concluido'); await b.waitForSelector('#grid');
  check('35 celular: sem rolagem lateral na Estante', await b.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await b.screenshot({ path: path.join(SHOTS, 'estante_celular.png'), fullPage: true });

  // ---------- 8. Outra pessoa não vê nada da Ana ----------
  const C = await device(browser);
  const c = C.page;
  await c.goto(APP);
  await c.click('#tab-signup');
  await c.fill('#name', 'Bia Lima'); await c.fill('#email', 'ana@exemplo.com'); await c.fill('#pw', 'outra-senha-9'); await c.fill('#pw2', 'outra-senha-9');
  await c.click('#authForm button[type=submit]');
  await c.waitForFunction(() => document.querySelector('#authError')?.textContent.length > 0);
  check('36 e-mail já cadastrado é avisado', (await txt(c, '#authError')).includes('Já existe uma conta'));
  await c.fill('#email', 'bia@exemplo.com');
  await c.click('#authForm button[type=submit]');
  await c.waitForSelector('#addFirst');
  check('37 conta nova começa com a estante vazia', (await txt(c, '.intro h1')) === 'Olá, Bia.');

  // ---------- 9. Esqueci minha senha ----------
  await c.click('#tab-perfil'); await c.click('#logout'); await c.waitForSelector('#authForm');
  await c.click('#forgot');
  await c.fill('#email', 'bia@exemplo.com');
  await c.click('#authForm button[type=submit]');
  await c.waitForSelector('.sent');
  check('38 pedido de nova senha enviado ao servidor', mock.opts.recoverRequests.join() === 'bia@exemplo.com' && (await txt(c, '.sent')).includes('bia@exemplo.com'));
  // O e-mail traria este link; aqui montamos o mesmo formato que o Supabase envia.
  const s = mock.session(mock.byEmail('bia@exemplo.com'));
  await c.goto('about:blank');
  await c.goto(`${APP}/redefinir-senha#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=3600&expires_at=${s.expires_at}&token_type=bearer&type=recovery`);
  await c.waitForSelector('#resetForm');
  await c.fill('#npw', 'recuperada-77'); await c.fill('#npw2', 'recuperada-77');
  await c.click('#resetForm button[type=submit]');
  await c.waitForSelector('.intro');
  check('39 link de recuperação: nova senha salva e pessoa entra', mock.byEmail('bia@exemplo.com').password === 'recuperada-77');

  const D = await device(browser);
  const d = D.page;
  await d.goto(`${APP}/redefinir-senha`);
  await d.waitForSelector('.auth-panel');
  check('40 link de recuperação sem sessão avisa que expirou', (await txt(d, '.auth-panel')).includes('expirou'));

  // ---------- 10. Confirmação de e-mail ligada ----------
  mock.opts.confirmEmails = true;
  await d.goto(APP); await d.click('#tab-signup');
  await d.fill('#name', 'Caio'); await d.fill('#email', 'caio@exemplo.com'); await d.fill('#pw', 'senha-do-caio'); await d.fill('#pw2', 'senha-do-caio');
  await d.click('#authForm button[type=submit]');
  await d.waitForSelector('.sent');
  check('41 com confirmação ligada, pede para conferir o e-mail', (await txt(d, '.sent')).includes('link de confirmação'));
  await d.click('#backToLogin');
  await d.fill('#email', 'caio@exemplo.com'); await d.fill('#pw', 'senha-do-caio');
  await d.click('#authForm button[type=submit]');
  await d.waitForFunction(() => document.querySelector('#authError')?.textContent.length > 0);
  check('42 entrar antes de confirmar explica o motivo', (await txt(d, '#authError')).includes('Confirme seu e-mail'));

  // ---------- 11. Falha do servidor ao carregar ----------
  mock.opts.failBooksOnce = true;
  await b.reload();
  await b.waitForSelector('.notice');
  check('43 erro ao carregar a estante mostra aviso com "Tentar de novo"', (await txt(b, '.notice')).includes('Não foi possível carregar'));
  await b.click('.notice .btn');
  await b.waitForSelector('#grid, .now, .status-tabs');
  check('44 tentar de novo recupera a tela', true);

  console.log('ERROS DE PÁGINA:', errors.length ? `\n${errors.join('\n')}` : 'nenhum');
  console.log(fails || errors.length ? `>>> ${fails} FALHA(S)` : '>>> TUDO OK');
} catch (e) {
  fails++;
  console.error('FALHA NO TESTE', e);
} finally {
  await browser.close();
  server.close();
  fs.rmSync(OUT, { recursive: true, force: true });
  process.exit(fails || errors.length ? 1 : 0);
}
