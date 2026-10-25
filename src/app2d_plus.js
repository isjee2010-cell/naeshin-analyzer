/* ===== app2d_plus.js : 표 정렬·필터, 스파크라인, 히트맵, 되돌리기, 온보딩 투어, 글자 크기·발표 모드, ▲▼, 학생 비교 ===== */

/* ---------- 색약 친화 ▲▼ : 좋아짐 ▲ / 나빠짐 ▼ (색 + 기호) ---------- */
function arw(v, lowerIsBetter) {
  if (v === '' || v == null || Math.abs(v) < 1e-9) return '';
  const good = lowerIsBetter === false ? v > 0 : v < 0;
  return '<i class="ar" aria-hidden="true">' + (good ? '▲' : '▼') + '</i>';
}
function deltaHtml(v, lowerIsBetter, d) {
  if (v === '' || v == null) return '';
  const good = lowerIsBetter === false ? v > 0 : v < 0;
  return '<span class="' + (Math.abs(v) < 1e-9 ? '' : good ? 'up' : 'down') + '">' + fx(v, d == null ? 2 : d) + arw(v, lowerIsBetter) + '</span>';
}

/* ---------- 히트맵 : 1등급(초록) → 최하 등급(로즈) ---------- */
function heatStyle(v, scale) {
  if (v === '' || v == null || !UX.heat) return '';
  const t = Math.max(0, Math.min(1, (v - 1) / ((scale || 5) - 1)));
  /* 한 가지 색(남보라)의 진하기만으로: 1등급 옅게 → 최하 등급 진하게 */
  return ' style="background:rgba(var(--heat),' + (0.04 + t * 0.30).toFixed(2) + ')"';
}
function tdHeat(v, scale, d) { return '<td data-v="' + (v === '' ? '' : v) + '"' + heatStyle(v, scale) + '>' + tdNum(v, d) + '</td>'; }

/* ---------- 스파크라인 ---------- */
function sparkline(vals, scale) {
  const pts = vals.map((v, i) => [i, v]).filter(p => p[1] !== '' && p[1] != null);
  if (!pts.length) return '';
  const w = 64, h = 20, n = Math.max(1, vals.length - 1);
  const X = i => 3 + i * (w - 6) / n, Y = v => 3 + (v - 1) / ((scale || 5) - 1) * (h - 6);
  const last = pts[pts.length - 1], first = pts[0];
  const col = last[1] < first[1] - 1e-9 ? 'var(--up)' : last[1] > first[1] + 1e-9 ? 'var(--down)' : 'var(--sub)';
  return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
    '<polyline fill="none" stroke="' + col + '" stroke-width="1.8" stroke-linejoin="round" points="' + pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ') + '"/>' +
    '<circle cx="' + X(last[0]).toFixed(1) + '" cy="' + Y(last[1]).toFixed(1) + '" r="2.4" fill="' + col + '"/></svg>';
}

/* ---------- 표 정렬 (table.sortable 머리글 클릭) ---------- */
function cellKey(td) {
  if (!td) return '';
  const dv = td.getAttribute('data-v');
  const t = dv != null ? dv : td.textContent.replace(/[▲▼]/g, '').trim();
  return t;
}
document.addEventListener('click', e => {
  const th = e.target.closest && e.target.closest('table.sortable thead th');
  if (!th || th.classList.contains('nosort')) return;
  const table = th.closest('table'), tb = table.tBodies[0];
  if (!tb) return;
  const idx = Array.from(th.parentNode.children).indexOf(th);
  const dir = th.getAttribute('data-dir') === 'asc' ? 'desc' : 'asc';
  $$('thead th', table).forEach(x => { x.removeAttribute('data-dir'); x.classList.remove('s-asc', 's-desc'); });
  th.setAttribute('data-dir', dir); th.classList.add('s-' + dir);
  const rows = Array.from(tb.rows);
  rows.sort((a, b) => {
    const x = cellKey(a.cells[idx]), y = cellKey(b.cells[idx]);
    if (x === '' && y === '') return 0; if (x === '') return 1; if (y === '') return -1;
    const nx = Number(x), ny = Number(y);
    const c = (!isNaN(nx) && !isNaN(ny)) ? nx - ny : x.localeCompare(y, 'ko');
    return dir === 'asc' ? c : -c;
  });
  rows.forEach(r => tb.appendChild(r));
});

/* ---------- 반 요약 필터 ---------- */
const CLASS_FILTERS = [['all', '전체'], ['up', '▲ 좋아진 학생'], ['down', '▼ 나빠진 학생'], ['hard', '목표 도달 불가']];
function classFilterBar(xs) {
  const types = TYPES.filter(t => xs.some(s => s.type === t));
  return '<div class="fbar" role="group" aria-label="학생 걸러 보기">' + CLASS_FILTERS.map(f => '<button class="chip' + (UI.cf === f[0] ? ' on' : '') + '" data-cf="' + f[0] + '">' + f[1] + '</button>').join('') +
    '<select class="sel sm" data-cft><option value="">유형 전체</option>' + types.map(t => '<option' + (UI.cft === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>' +
    '<label class="chip-tgl"><input type="checkbox" data-heat' + (UX.heat ? ' checked' : '') + '> <i data-ic="grid"></i>색으로 보기</label><span class="muted" id="fcount"></span></div>';
}
function applyClassFilter(root) {
  let n = 0;
  $$('#clsTbl tbody tr', root).forEach(tr => {
    const d = tr.getAttribute('data-diff'), ok1 = UI.cf === 'up' ? d !== '' && Number(d) < 0 : UI.cf === 'down' ? d !== '' && Number(d) > 0 : UI.cf === 'hard' ? tr.getAttribute('data-hard') === '1' : true;
    const ok2 = !UI.cft || tr.getAttribute('data-type') === UI.cft;
    tr.style.display = ok1 && ok2 ? '' : 'none'; if (ok1 && ok2) n++;
  });
  const c = $('#fcount', root); if (c) c.textContent = n + '명 표시';
}
function bindClassFilter(root) {
  $$('[data-cf]', root).forEach(b => b.onclick = () => { UI.cf = b.getAttribute('data-cf'); $$('[data-cf]', root).forEach(x => x.classList.toggle('on', x === b)); applyClassFilter(root); });
  const s = $('[data-cft]', root); if (s) s.onchange = () => { UI.cft = s.value; applyClassFilter(root); };
  const h = $('[data-heat]', root); if (h) h.onchange = () => { UX.heat = h.checked; uxSave(); renderTab(UI.tab); };
  applyClassFilter(root);
}

/* ---------- 되돌리기 토스트 ---------- */
function undoToast(msg, undo) {
  /* 되돌리기는 가장 최근 작업 하나만 (앞선 되돌리기 알림은 새것으로 교체) */
  const root = toastSlot('undo');
  const t = document.createElement('div');
  t.className = 'toast undo';
  t.setAttribute('data-k', 'undo');
  t.innerHTML = '<span>' + esc(msg) + '</span><button>되돌리기</button>';
  root.appendChild(t);
  let done = false;
  const close = () => { if (t.parentNode) t.remove(); };
  $('button', t).onclick = () => { if (done) return; done = true; undo(); close(); toast('되돌렸습니다.', 'ok'); };
  setTimeout(close, 9000);
}
function snapshotClasses() { return { classes: Object.assign({}, DB.classes), tomb: Object.assign({}, DB.tomb), demo: DB.demo }; }
function restoreClasses(sn) { DB.classes = sn.classes; DB.tomb = sn.tomb; DB.demo = sn.demo; markDirty(); renderAll(); }
function snapshotCur() { return JSON.parse(JSON.stringify(CUR)); }
function restoreCur(sn) { CUR = sn; saveSettings(); renderAll(); }

/* ---------- 글자 크기·발표 모드 ---------- */
const ZOOMS = [1, 1.15, 1.3];
function applyZoom() { document.documentElement.style.setProperty('--zoom', String(UX.zoom || 1)); syncViewMenu(); }
function setZoom(z) { UX.zoom = ZOOMS.indexOf(z) >= 0 ? z : 1; uxSave(); applyZoom(); }
function togglePresent() {
  const on = !document.documentElement.classList.contains('present');
  document.documentElement.classList.toggle('present', on);
  if (on) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { }); openViewMenu(false); toast('발표 모드: 크게 보기 + 전체 화면. Esc 또는 「보기 → 발표 모드 끝내기」로 끝냅니다.'); }
  else { openViewMenu(false); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => { }); }
  syncViewMenu();
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { document.documentElement.classList.remove('present'); syncViewMenu(); } });

/* ---------- 온보딩 투어 ---------- */
const TOUR = [
  { sel: '#tabs [data-tab="upload"]', title: '① 성적 올리기', text: '나이스 › 학생부 항목별 조회 › 교과학습발달상황 › XLS Data로 받은 반별 파일을 여기에 놓습니다. 창 어디에 끌어다 놓아도 됩니다.' },
  { sel: '#tabs [data-tab="class"]', title: '② 반 요약', text: '한눈에 보기(숫자 카드·유형 분포)와 학생별 요약표가 나옵니다. 머리글을 누르면 정렬, 위쪽 버튼으로 걸러 봅니다.' },
  { sel: '#tabs [data-tab="card"]', title: '③ 학생카드', text: '학생당 3쪽 카드입니다. 아래 떠 있는 ◀ ▶로 넘기고, 「다른 학생과 비교」로 다른 학생과 나란히 비교합니다.' },
  { sel: '#tabs [data-tab="grade"]', title: '④ 학년 분석', text: '여러 반을 올리면 반별 비교·과목별 분석·유형별 명단·학기별 추이를 봅니다.' },
  { sel: '#stuSearch', title: '학생 검색', text: '이름이나 번호로 학년 전체에서 바로 찾습니다. 키보드 / 키로도 열립니다.' },
  { sel: '#btnView', title: '보기 메뉴', text: '회의·연수 때는 여기서 「이름 가리기」(김○영처럼 표시), 글자 크기, 발표 모드를 켭니다. 화면 밝기(어둡게)도 여기서 바꿉니다.' },
  { sel: '#btnConnect', title: '꼭 한 번: 파일에 저장 연결', text: '지금 연 이 HTML 파일을 고르면 이후 내용이 이 파일 안에 자동 저장됩니다.' }
];
let tourI = -1;
function startTour() { tourI = 0; showTourStep(); }
function endTour() { tourI = -1; const r = $('#tourRing'), p = $('#tourPop'); if (r) r.remove(); if (p) p.remove(); UX.tour = 1; uxSave(); window.removeEventListener('resize', showTourStep); }
function showTourStep() {
  if (tourI < 0) return;
  const st = TOUR[tourI]; const el = $(st.sel);
  if (!el || !el.getBoundingClientRect().width) { if (tourI < TOUR.length - 1) { tourI++; return showTourStep(); } return endTour(); }
  el.scrollIntoView({ block: 'nearest' });
  let ring = $('#tourRing'), pop = $('#tourPop');
  if (!ring) { ring = document.createElement('div'); ring.id = 'tourRing'; document.body.appendChild(ring); window.addEventListener('resize', showTourStep); }
  if (!pop) { pop = document.createElement('div'); pop.id = 'tourPop'; pop.setAttribute('role', 'dialog'); document.body.appendChild(pop); }
  const r = el.getBoundingClientRect();
  ring.style.cssText = 'left:' + (r.left - 5) + 'px;top:' + (r.top - 5) + 'px;width:' + (r.width + 10) + 'px;height:' + (r.height + 10) + 'px';
  pop.innerHTML = '<div class="tp-step">' + (tourI + 1) + ' / ' + TOUR.length + '</div><h4>' + esc(st.title) + '</h4><p>' + esc(st.text) + '</p>' +
    '<div class="row" style="justify-content:space-between"><button class="btn ghost sm" id="tourSkip">건너뛰기</button><span class="row">' +
    (tourI > 0 ? '<button class="btn ghost sm" id="tourPrev">이전</button>' : '') + '<button class="btn sm" id="tourNext">' + (tourI === TOUR.length - 1 ? '시작하기' : '다음') + '</button></span></div>';
  const pw = Math.min(320, window.innerWidth - 20);
  pop.style.width = pw + 'px';
  let x = Math.max(10, Math.min(r.left + r.width / 2 - pw / 2, window.innerWidth - pw - 10));
  let y = r.bottom + 12;
  if (y + pop.offsetHeight > window.innerHeight - 10) y = Math.max(10, r.top - pop.offsetHeight - 12);
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
  $('#tourSkip').onclick = endTour;
  $('#tourNext').onclick = () => { if (tourI >= TOUR.length - 1) endTour(); else { tourI++; showTourStep(); } };
  const pv = $('#tourPrev'); if (pv) pv.onclick = () => { tourI--; showTourStep(); };
}
document.addEventListener('keydown', e => { if (tourI >= 0 && e.key === 'Escape') endTour(); });

/* ---------- 학생 비교 모드 ---------- */
const CMP_A = '#5262c9', CMP_B = '#e0708f';
function svgTrend2(labels, a, b, scale, nameA, nameB) {
  const w = 360, h = 210, L = 30, R = 12, T = 56, B = 26, P = 22, iw = w - L - R - 2 * P, ih = h - T - B;
  const y = v => T + (v - 1) / (scale - 1) * ih, x = i => L + P + (labels.length === 1 ? iw / 2 : i * iw / (labels.length - 1));
  let s = '<svg class="chart" xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><rect width="' + w + '" height="' + h + '" fill="#fff"/>' +
    '<text x="' + (w / 2) + '" y="18" text-anchor="middle" font-size="12.5" font-weight="700" fill="#33386e">학기별 평균등급 비교</text>' +
    '<rect x="' + (w / 2 - 110) + '" y="27" width="10" height="10" rx="2" fill="' + CMP_A + '"/><text x="' + (w / 2 - 96) + '" y="36" font-size="11" fill="#33386e">' + esc(nameA) + '</text>' +
    '<rect x="' + (w / 2 + 10) + '" y="27" width="10" height="10" rx="2" fill="' + CMP_B + '"/><text x="' + (w / 2 + 24) + '" y="36" font-size="11" fill="#33386e">' + esc(nameB) + '</text>';
  for (let g = 1; g <= scale; g++) s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="#e6e4ef"/><text x="' + (L - 6) + '" y="' + (y(g) + 4) + '" text-anchor="end" font-size="10.5" fill="#6e6a85">' + g + '</text>';
  labels.forEach((l, i) => { s += '<text x="' + x(i) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="11" fill="#4b4766">' + esc(l) + '</text>'; });
  /* 같은 학기에서 더 좋은(작은) 값은 점 위에, 더 나쁜 값은 점 아래에 글자를 둬 겹치지 않게 한다 */
  const isNum = v => v !== '' && v != null;
  const dyOf = (mine, other) => (!isNum(other) || mine <= other) ? -9 : 17;
  [[a, b, CMP_A], [b, a, CMP_B]].forEach(([vals, oth, col]) => {
    const pts = []; vals.forEach((v, i) => { if (isNum(v)) pts.push([x(i), y(Math.min(scale, Math.max(1, v))), v, dyOf(v, oth[i]) === -9 && isNum(oth[i]) && v === oth[i] && col === CMP_B ? 17 : dyOf(v, oth[i])]); });
    if (pts.length > 1) s += '<polyline fill="none" stroke="' + col + '" stroke-width="2.4" points="' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '"/>';
    pts.forEach(p => { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4" fill="#fff" stroke="' + col + '" stroke-width="2"/><text x="' + p[0].toFixed(1) + '" y="' + Math.min(h - 22, Math.max(T - 2, p[1] + p[3])).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="' + col + '" stroke="#fff" stroke-width="3" paint-order="stroke">' + fx(p[2], 2) + '</text>'; });
  });
  return s + '</svg>';
}
function compareHtml(M, A, B) {
  const ctx = M.ctx, nA = dn(A.name), nB = dn(B.name);
  const row = (label, va, vb, num, lowerBetter) => {
    let d = '';
    if (num && va !== '' && vb !== '' && va != null && vb != null) d = deltaHtml(vround(vb - va, 2), lowerBetter);
    return '<tr><th class="l">' + label + '</th><td' + (num ? heatStyle(va, M.scale) : '') + '>' + (num ? tdNum(va) : va) + '</td><td' + (num ? heatStyle(vb, M.scale) : '') + '>' + (num ? tdNum(vb) : vb) + '</td><td>' + d + '</td></tr>';
  };
  let h = '<div class="sc-page cmp"><div class="sc-title"><i data-ic="compare"></i>학생 비교</div><div class="cmp-head"><div style="border-color:' + CMP_A + '"><b>' + esc(nA) + '</b><small>' + esc(A.ban) + ' ' + A.no + '번</small>' + typePill(A.type) + '</div><span>vs</span><div style="border-color:' + CMP_B + '"><b>' + esc(nB) + '</b><small>' + esc(B.ban) + ' ' + B.no + '번</small>' + typePill(B.type) + '</div></div>';
  h += '<div class="sc-flex"><div class="tw" style="flex:1 1 320px"><table class="t"><thead><tr><th class="l">항목</th><th style="color:' + CMP_A + '">' + esc(nA) + '</th><th style="color:' + CMP_B + '">' + esc(nB) + '</th><th>' + tip('차이', 'cmpdiff') + '</th></tr></thead><tbody>' +
    M.terms.map((t, i) => row(esc(t) + '학기', A.tv[i], B.tv[i], true)).join('') +
    row('전체 평균', A.overall, B.overall, true) + row(esc(ctx.baseLabel || '기준선'), A.base, B.base, true) + row(esc(ctx.curLabel), A.curAvg, B.curAvg, true) +
    row('기준선 대비', A.diff === '' ? '' : deltaHtml(A.diff), B.diff === '' ? '' : deltaHtml(B.diff), false) +
    row('강점 교과군', esc(A.best || '-'), esc(B.best || '-'), false) + row('취약 교과군', esc(A.worst || '-'), esc(B.worst || '-'), false) +
    (ctx.next ? row(esc(ctx.next) + ' 목표', esc(A.target.need || A.target.verdict), esc(B.target.need || B.target.verdict), false) : '') +
    '</tbody></table></div>' + svgTrend2(M.terms, A.tv, B.tv, M.scale, nA, nB) + '</div>';
  const gs = []; A.groups.concat(B.groups).forEach(g => { if (gs.indexOf(g.g) < 0) gs.push(g.g); });
  h += '<div class="sc-sec">교과군별 전체 평균등급</div><div class="tw"><table class="t"><thead><tr><th class="l">교과군</th><th style="color:' + CMP_A + '">' + esc(nA) + '</th><th style="color:' + CMP_B + '">' + esc(nB) + '</th><th>차이</th></tr></thead><tbody>' +
    gs.map(g => { const a = (A.groups.find(x => x.g === g) || {}).all, b = (B.groups.find(x => x.g === g) || {}).all; return row(esc(g), a == null ? '' : a, b == null ? '' : b, true); }).join('') + '</tbody></table></div>';
  h += '<p class="muted">※ 차이 = 오른쪽 − 왼쪽. ▲는 오른쪽 학생이 더 좋음(등급 숫자가 작음), ▼는 더 나쁨입니다.</p></div>';
  return h;
}
function compareControls(M, A) {
  const opts = M.studs.filter(s => s.key !== A.key);
  return '<div class="cmp-bar"><span class="muted">비교할 학생</span><select class="sel" id="cmpPick">' + opts.map(s => '<option value="' + esc(s.key) + '"' + (s.key === UI.cmp ? ' selected' : '') + '>' + esc(s.ban) + ' ' + s.no + '번 ' + esc(dn(s.name)) + '</option>').join('') + '</select><button class="btn ghost sm" id="cmpEnd">비교 끝내기</button></div>';
}

function initPlus() {
  applyZoom();
  $$('[data-zoom]').forEach(b => b.onclick = () => setZoom(Number(b.getAttribute('data-zoom'))));
  $('#btnPresent').onclick = togglePresent;
  if (!UX.tour && !dbCounts(DB).nc) setTimeout(() => { if (!$('.mbg')) startTour(); }, 700);
}
