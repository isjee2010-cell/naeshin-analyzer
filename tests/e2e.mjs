// 브라우저 통합·보안 시험 (CI에서 실행)
// 사용법: python3 tools/build.py && python3 tools/make_sample.py tests/tmp g2 && python3 tools/make_sample.py tests/tmp xss
//         node tests/e2e.mjs
// 확인하는 것
//  - 가상 나이스 파일 3개 반 올리기 → 모든 화면·학생카드·비교·인쇄 화면·엑셀 받기가 오류 없이 동작
//  - 페이지가 자기 자신 외에 어떤 주소로도 요청을 보내지 않음, 보안 정책(CSP) 위반 없음
//  - 이름·과목에 공격 문자열을 넣은 파일을 올려도 스크립트가 실행되지 않음 (화면, 인쇄, 파일 저장 후 다시 열기)
//  - 「배포본 만들기」 결과에 성적이 들어 있지 않음
//  - 설정 양식 엑셀을 dist/ 에 저장 (Release 첨부용)
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'tests', 'tmp');
const DIST = path.join(ROOT, 'dist');
const html = fs.readdirSync(DIST).filter(f => /^naeshin_helper_v[\d.]+\.html$/.test(f)).sort().pop();
if (!html) throw new Error('dist/ 에 빌드된 HTML이 없습니다');
const ver = html.match(/v([\d.]+)\.html/)[1];
fs.mkdirSync(TMP, { recursive: true });

let failed = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failed++; };

// OPFS(파일 저장 시험)는 보안 맥락이 필요해 localhost 서버로 엽니다.
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const PORT = server.address().port;
const BASE = `http://localhost:${PORT}`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const errors = [], foreign = [];
await ctx.addInitScript(() => {
  try { localStorage.setItem('naeshinUi:prefs', JSON.stringify({ tour: 1 })); } catch (e) { }
  window.print = () => { };
  document.addEventListener('securitypolicyviolation', e => console.error('CSP 위반 ' + e.violatedDirective + ' ' + e.blockedURI));
});
ctx.on('request', r => {
  const u = r.url();
  if (!u.startsWith(BASE + '/dist/') && !u.startsWith(BASE + '/tests/tmp/') && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('file:')) foreign.push(u);
});
const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); }); };
const p = await ctx.newPage(); watch(p);
const ready = pg => pg.waitForFunction(() => window.__app && [...document.querySelectorAll('main .tab')].some(t => t.children.length > 0));
const closeModal = async () => { const b = await p.$('.modal .mb button:last-child'); if (b) await b.click(); };
const injected = pg => pg.evaluate(() => ({ xss: window.__xss || null, nodes: document.querySelectorAll('img,[onload],[onerror]').length }));

console.log('1. 가상 데이터로 기본 동작');
await p.goto(`${BASE}/dist/${html}`); await ready(p);
await p.setInputFiles('#fileAny', ['neis_2_1.xlsx', 'neis_2_2.xlsx', 'neis_2_3.xlsx'].map(f => path.join(TMP, f)));
await p.waitForFunction(() => __app.MODELS['2'] && Object.keys(__app.DB.classes).length === 3 && document.querySelector('.modal'));
await closeModal();
const n = await p.evaluate(() => ({ classes: Object.keys(__app.DB.classes).length, studs: __app.MODELS['2'].studs.length }));
ok(n.classes === 3 && n.studs === 72, `3개 반 72명 인식 (${n.classes}개 반, ${n.studs}명)`);
for (const t of ['class', 'card', 'grade', 'settings', 'help', 'upload']) { await p.evaluate(t => __app.showTab(t), t); await p.waitForTimeout(150); }
for (const g of ['sum', 'cmp', 'sub', 'type', 'trend']) { await p.evaluate(g => { __app.UI.gsub = g; __app.showTab('grade'); }, g); await p.waitForTimeout(150); }
await p.evaluate(() => __app.showTab('card')); await p.click('#cmpBtn'); await p.waitForTimeout(200);
ok(await p.$('.sc-page.cmp') !== null, '학생 비교 화면');
await p.evaluate(() => { __app.UI.cmp = null; __app.showTab('class'); }); await p.click('#pClass'); await p.waitForTimeout(200);
ok(await p.$$eval('#printArea .sc-page', a => a.length) === 72, '반 전체 인쇄 화면 (24명 × 3쪽)');
const dl = async (sel, name) => { const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]); const to = path.join(TMP, name); await d.saveAs(to); return to; };
ok(fs.statSync(await dl('#xClass', 'class.xlsx')).size > 5000, '반 학생카드 엑셀 받기');
await p.evaluate(() => __app.showTab('grade'));
ok(fs.statSync(await dl('#xGrade', 'grade.xlsx')).size > 5000, '학년 전체 분석 엑셀 받기');
await p.evaluate(() => __app.showTab('settings'));
const tpl = await dl('#cfTpl', 'settings.xlsx');
fs.copyFileSync(tpl, path.join(DIST, `naeshin_settings_v${ver}.xlsx`));
ok(true, `설정 양식 엑셀 → dist/naeshin_settings_v${ver}.xlsx`);
const distHtml = fs.readFileSync(await dl('#cfDist', 'dist_copy.html'), 'utf8'); await closeModal();
const m = distHtml.match(/<script id="J-DB" type="application\/json">([\s\S]*?)<\/script>/);
const ddb = JSON.parse(m[1]);
ok(Object.keys(ddb.classes).length === 0 && !ddb.demo, '배포본에 성적 없음');
ok(/connect-src 'none'/.test(distHtml), '배포본에도 보안 정책 유지');

console.log('2. 공격 문자열이 든 파일');
await p.evaluate(() => { __app.DB.classes = {}; __app.DB.tomb = {}; __app.renderAll(); });
await p.setInputFiles('#fileAny', [path.join(TMP, 'neis_xss.xlsx')]);
await p.waitForFunction(() => Object.keys(__app.DB.classes).length === 1 && document.querySelector('.modal'));
await closeModal();
for (const t of ['upload', 'class', 'card', 'grade', 'settings']) { await p.evaluate(t => __app.showTab(t), t); await p.waitForTimeout(150); }
for (const g of ['sum', 'cmp', 'sub', 'type', 'trend']) { await p.evaluate(g => { __app.UI.gsub = g; __app.showTab('grade'); }, g); }
await p.evaluate(() => __app.showTab('card'));
for (const k of await p.$$eval('[data-sk]', a => a.map(x => x.getAttribute('data-sk')))) await p.evaluate(k => selectStudent(k), k);
await p.fill('#stuSearch', '<'); await p.waitForTimeout(200); await p.fill('#stuSearch', '');
await p.evaluate(() => __app.showTab('class')); await p.click('#pClass'); await p.waitForTimeout(200);
let r = await injected(p);
ok(r.xss === null && r.nodes === 0, `화면·인쇄에서 실행 안 됨 (${JSON.stringify(r)})`);
const src = fs.readFileSync(path.join(DIST, html), 'utf8');
const saved = await p.evaluate(async src => {
  const root = await navigator.storage.getDirectory(); const h = await root.getFileHandle('t.html', { create: true });
  const w = await h.createWritable(); await w.write(src); await w.close();
  await __app.attachHandle(h, { silent: true }); await __app.save(); await new Promise(r => setTimeout(r, 600));
  return (await h.getFile()).text();
}, src);
ok(!saved.includes('<script>window.__xss'), '파일에 저장할 때 태그가 이스케이프됨');
fs.writeFileSync(path.join(TMP, 'saved.html'), saved);
const p2 = await ctx.newPage(); watch(p2);
await p2.goto(`${BASE}/tests/tmp/saved.html`); await ready(p2); await p2.waitForTimeout(300);
for (const t of ['class', 'card', 'grade']) await p2.evaluate(t => __app.showTab(t), t);
r = await injected(p2);
const c2 = await p2.evaluate(() => Object.keys(__app.DB.classes).length);
ok(r.xss === null && r.nodes === 0 && c2 === 1, `저장한 파일을 다시 열어도 실행 안 됨, 기록 유지 (${c2}개 반)`);

// 조작된 도우미 HTML(이상한 키·깨진 기록)을 합치기로 올려도 안전한지
const evil = src.replace(/(<script id="J-DB" type="application\/json">)[\s\S]*?(<\/script>)/, (m0, a, b) => a +
  '{"v":1,"fileId":"x","updatedAt":1,"classes":{"__proto__":{"polluted":1},"9-9":{"ban":1},"8-8":{"ban":"x","rows":"no","stu":{}}},"tomb":{"__proto__":5},"demo":false}' + b);
fs.writeFileSync(path.join(TMP, 'evil.html'), evil);
await p.waitForFunction(() => !document.querySelector('.modal'));
await p.setInputFiles('#fileAny', [path.join(TMP, 'evil.html')]);
await p.waitForSelector('.modal'); await closeModal();
const pol = await p.evaluate(() => ({ proto: ({}).polluted, dbProto: Object.getPrototypeOf(__app.DB.classes) === Object.prototype, n: Object.keys(__app.DB.classes).length }));
ok(pol.proto === undefined && pol.dbProto && pol.n === 1, `조작된 HTML 합치기를 막음 (${JSON.stringify(pol)})`);

console.log('3. 통신·오류');
ok(foreign.length === 0, '페이지 밖으로 나간 요청 없음' + (foreign.length ? ': ' + foreign.slice(0, 3).join(', ') : ''));
ok(errors.length === 0, '오류·CSP 위반 없음' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

await browser.close(); server.close();
if (failed) { console.log(`\n실패 ${failed}건`); process.exit(1); }
console.log('\n모두 통과');
