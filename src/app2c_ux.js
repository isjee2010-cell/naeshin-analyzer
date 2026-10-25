/* ===== app2c_ux.js : 이름 가리기·다크 모드·툴팁·학생 검색·진행 표시·창 전체 드롭·물결 효과 ===== */
const UX = { mask: false, theme: null, heat: true, zoom: 1, tour: 0 };
const UX_KEY = 'naeshinUi:prefs';
function uxLoad() {
  try { const o = JSON.parse(localStorage.getItem(UX_KEY) || '{}'); UX.mask = !!o.mask; UX.theme = o.theme || null; UX.heat = o.heat !== false; UX.zoom = Number(o.zoom) || 1; UX.tour = o.tour || 0; } catch (e) { }
}
function uxSave() { try { localStorage.setItem(UX_KEY, JSON.stringify({ mask: UX.mask, theme: UX.theme, heat: UX.heat, zoom: UX.zoom, tour: UX.tour })); } catch (e) { } }

/* ---------- 이름 가리기 ---------- */
function maskName(n) {
  n = String(n || '');
  if (n.length <= 1) return n;
  if (n.length === 2) return n[0] + '○';
  return n[0] + '○'.repeat(n.length - 2) + n[n.length - 1];
}
function dn(n) { return UX.mask ? maskName(n) : n; }
function setMask(on) {
  UX.mask = !!on; uxSave();
  const t = $('#tglMask'); if (t) t.checked = UX.mask;
  document.documentElement.classList.toggle('masked', UX.mask);
  syncViewMenu();
  renderTab(UI.tab);
  toast(UX.mask ? '이름을 가렸습니다. 화면과 인쇄에 적용되고, 엑셀 내보내기는 실명 그대로입니다.' : '이름을 다시 보입니다.');
}

/* ---------- 다크 모드 ---------- */
function sysDark() { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
function applyTheme() {
  const dark = UX.theme ? UX.theme === 'dark' : sysDark();
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  syncViewMenu();
}
function setTheme(mode) { UX.theme = mode === 'auto' ? null : mode; uxSave(); applyTheme(); }
/* 보기 메뉴의 현재 상태 표시 (이름 가림 칩·선택된 단추) */
function syncViewMenu() {
  const chip = $('#maskChip'); if (chip) chip.hidden = !UX.mask;
  const cur = UX.theme || 'auto';
  $$('[data-theme-set]').forEach(b => { const on = b.getAttribute('data-theme-set') === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  $$('[data-zoom]').forEach(b => { const on = Number(b.getAttribute('data-zoom')) === (UX.zoom || 1); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  const pr = $('#btnPresent'); if (pr) pr.firstChild.textContent = document.documentElement.classList.contains('present') ? '발표 모드 끝내기 ' : '발표 모드 시작 ';
}
function openViewMenu(open) {
  const pop = $('#viewPop'), btn = $('#btnView');
  if (!pop) return;
  pop.hidden = !open; btn.setAttribute('aria-expanded', open);
  if (open) syncViewMenu();
}
function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  UX.theme = dark ? 'light' : 'dark'; uxSave(); applyTheme();
}

/* ---------- 용어 툴팁 ---------- */
const TIPS = {
  base: '비교 기준선: 최근 학기의 직전 학년 학점가중 평균입니다. 2학년 1학기면 1학년(1-1·1-2) 평균, 1학년 2학기면 1학년 1학기입니다.',
  cur: '최근 학기: 올린 파일에 있는 가장 최근 학기의 학점가중 평균등급입니다. 설정 탭에서 다른 학기로 바꿀 수 있습니다.',
  diff: '차이 = 최근 학기 − 기준선. 음수(청록 ▲)는 등급 숫자가 줄어 좋아진 것, 양수(주황 ▼)는 나빠진 것입니다.',
  target: '목표: 이번 학년 평균이 기준 학년 평균보다 같거나 좋아지려면 다음 학기에 받아야 하는 학점가중 평균등급입니다. 「도달 불가」는 전 과목 1등급이어도 회복이 어렵다는 뜻, 「유지로 달성」은 이미 앞서 있다는 뜻입니다.',
  verdict: "목표 판정: '도달 불가'는 다음 학기 전 과목 1등급이어도 회복이 어렵다는 뜻, '현 수준 유지로 달성'은 이미 앞서 있다는 뜻입니다.",
  worst: '취약 교과군: 본인 전체 평균보다 등급이 가장 많이 낮은 교과군입니다. 강점 교과군은 그 반대입니다.',
  avg: '평균등급: 석차등급이 있는 교과 과목만 학점으로 가중해 평균낸 값입니다. 체육·예술·과학탐구실험·교양은 빠집니다.',
  dev: '편차 = 원점수 − 과목평균. 양수(청록 ▲)는 평균보다 높은 점수입니다.',
  cnt: '수강자수: 나이스 원자료에 적힌 학년 전체 수강자 수입니다. 적은 과목은 등급이 흔들리기 쉬우니 해석에 주의하세요.',
  band: '등급대: 학기 평균등급의 정수 부분입니다. 예: 2.37등급 → 2등급대.',
  cmpdiff: '차이 = 오른쪽 학생 − 왼쪽 학생. 등급 숫자가 작을수록 좋으므로 ▲(청록)는 오른쪽이 더 좋음, ▼(주황)는 더 나쁨입니다.',
  why: '판정 근거: 아래 판정 순서에서 처음 걸린 조건입니다. 상위권하락 → 학급내상위권 → 상위권도약 → 단일과목붕괴형 → 전반하락형 → 상승형 → 정체형 → 일반형'
};
function typeTip(t) {
  const M = curModel(); const S = M ? M.S : CUR.s5; const bL = (M && M.ctx.baseLabel) || '기준선';
  switch (t) {
    case '학급내상위권': return '모든 학기 평균이 ' + S.topAvg + '등급 이내이고 크게 내려오지 않음. 석차등급은 학년 전체 기준입니다.';
    case '상위권도약': return bL + '은 ' + S.topAvg + '등급 밖이었으나 최근 학기에 ' + S.topAvg + '등급 이내로 진입';
    case '상위권하락': return '모든 학기 ' + S.topAvg + '등급 이내이지만 ' + bL + ' 대비 ' + S.drop + '등급 이상 내려옴';
    case '상승형': return bL + ' 대비 최근 학기가 ' + S.rise + '등급 이상 좋아짐';
    case '단일과목붕괴형': return '한 교과군이 본인 전체 평균보다 ' + S.collapse + '등급 이상 낮음';
    case '전반하락형': return bL + ' 대비 최근 학기가 ' + S.drop + '등급 이상 나빠짐';
    case '정체형': return bL + '과 최근 학기 차이가 ' + S.flat + '등급 이내이고 최근 학기 평균이 ' + S.midLine + '등급 이상';
    default: return '위 어느 유형에도 해당하지 않음';
  }
}
function tip(label, key) { return '<span class="tip" tabindex="0" data-tip="' + esc(key) + '">' + esc(label) + '</span>'; }
let tipEl = null, tipFor = null;
function showTip(el) {
  const key = el.getAttribute('data-tip'), ty = el.getAttribute('data-type');
  const text = ty ? typeTip(ty) : (TIPS[key] || key);
  if (!text) return;
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.id = 'tipBox'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
  tipEl.textContent = text;
  tipEl.classList.add('on');
  const r = el.getBoundingClientRect(), tw = Math.min(320, window.innerWidth - 16);
  tipEl.style.maxWidth = tw + 'px';
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let x = r.left + r.width / 2 - w / 2; x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
  let y = r.top - h - 8; if (y < 8) y = r.bottom + 8;
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  tipFor = el;
}
function hideTip() { if (tipEl) tipEl.classList.remove('on'); tipFor = null; }
document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-tip],[data-type]'); if (el && el !== tipFor) showTip(el); else if (!el && tipFor) hideTip(); });
document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('[data-tip],[data-type]'); if (el) showTip(el); });
document.addEventListener('focusout', hideTip);
document.addEventListener('scroll', hideTip, true);
document.addEventListener('touchstart', e => { const el = e.target.closest && e.target.closest('[data-tip],[data-type]'); if (el) showTip(el); else hideTip(); }, { passive: true });

/* ---------- 학생 검색 콤보박스 ---------- */
const SRCH = { items: [], idx: -1 };
function searchStudents(q) {
  q = q.replace(/\s/g, '');
  if (!q) return [];
  const out = [];
  Object.values(MODELS).forEach(M => M.studs.forEach(s => {
    const code = String(s.banNo) + String(s.no).padStart(2, '0');
    const ok = /^\d+$/.test(q) ? (String(s.no) === q || code === q) : (s.name.indexOf(q) >= 0 || (s.ban.replace(/\s/g, '') + s.no + '번').indexOf(q) >= 0);
    if (ok) out.push({ M, s });
  }));
  return out.slice(0, 12);
}
function renderSearchList() {
  const box = $('#srchList');
  if (!SRCH.items.length) { box.innerHTML = $('#stuSearch').value.trim() ? '<div class="sr-empty">찾는 학생이 없습니다</div>' : ''; box.classList.toggle('on', !!$('#stuSearch').value.trim()); return; }
  box.innerHTML = SRCH.items.map((o, i) => '<div class="sr-item' + (i === SRCH.idx ? ' on' : '') + '" role="option" data-si="' + i + '"><b>' + esc(dn(o.s.name)) + '</b><span>' + esc(o.s.ban) + ' ' + o.s.no + '번</span>' + typePill(o.s.type) + '</div>').join('');
  box.classList.add('on');
}
function pickSearch(i) {
  const o = SRCH.items[i]; if (!o) return;
  UI.grade = String(o.M.grade); UI.ck = o.s.ck; UI.sk = o.s.key;
  $('#stuSearch').value = ''; SRCH.items = []; renderSearchList(); $('#srchList').classList.remove('on');
  $('#stuSearch').blur();
  showTab('card');
}
function bindSearch() {
  const inp = $('#stuSearch'), box = $('#srchList');
  inp.addEventListener('input', () => { SRCH.items = searchStudents(inp.value); SRCH.idx = SRCH.items.length ? 0 : -1; renderSearchList(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (SRCH.items.length) { SRCH.idx = (SRCH.idx + 1) % SRCH.items.length; renderSearchList(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (SRCH.items.length) { SRCH.idx = (SRCH.idx - 1 + SRCH.items.length) % SRCH.items.length; renderSearchList(); } }
    else if (e.key === 'Enter') { e.preventDefault(); pickSearch(SRCH.idx < 0 ? 0 : SRCH.idx); }
    else if (e.key === 'Escape') { inp.value = ''; SRCH.items = []; renderSearchList(); box.classList.remove('on'); }
  });
  inp.addEventListener('focus', () => { if (!Object.keys(MODELS).length) inp.placeholder = '먼저 성적을 올려 주세요'; else inp.placeholder = '학생 검색 (이름·번호)'; });
  box.addEventListener('mousedown', e => { const it = e.target.closest('[data-si]'); if (it) { e.preventDefault(); pickSearch(Number(it.getAttribute('data-si'))); } });
  inp.addEventListener('blur', () => setTimeout(() => box.classList.remove('on'), 120));
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('.mbg')) { e.preventDefault(); inp.focus(); }
  });
}

/* ---------- 진행 표시 ---------- */
function progress(title) {
  const bg = document.createElement('div');
  bg.className = 'mbg prog-bg';
  bg.innerHTML = '<div class="modal prog"><h3>' + esc(title) + '</h3><div class="pbar"><i></i></div><div class="pmsg muted">준비 중…</div></div>';
  document.body.appendChild(bg);
  const bar = $('.pbar i', bg), msg = $('.pmsg', bg);
  return {
    async set(i, n, text) { bar.style.width = (n ? Math.round(i / n * 100) : 0) + '%'; msg.textContent = (text || '') + (n ? ' (' + i + '/' + n + ')' : ''); await new Promise(r => setTimeout(r, 0)); },
    done() { bar.style.width = '100%'; setTimeout(() => bg.remove(), 180); }
  };
}

/* ---------- 창 전체 드롭 ---------- */
let dragDepth = 0;
function hasFiles(e) { return e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0; }
window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $('#dropOverlay').classList.add('on'); });
window.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#dropOverlay').classList.remove('on'); });
window.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault(); dragDepth = 0; $('#dropOverlay').classList.remove('on');
  const fs = Array.from(e.dataTransfer.files || []);
  if (fs.length) handleFiles(fs);
});

/* ---------- 버튼 물결 ---------- */
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('.btn,.hbtn,.tabs button,.subtabs button,.dock button');
  if (!b || b.disabled) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2;
  const s = document.createElement('span');
  s.className = 'rip'; s.style.width = s.style.height = d + 'px';
  s.style.left = (e.clientX - r.left - d / 2) + 'px'; s.style.top = (e.clientY - r.top - d / 2) + 'px';
  b.appendChild(s);
  setTimeout(() => s.remove(), 520);
});

function initUx() {
  uxLoad(); applyTheme();
  document.documentElement.classList.toggle('masked', UX.mask);
  const t = $('#tglMask'); t.checked = UX.mask; t.onchange = () => setMask(t.checked);
  $('#maskChip').onclick = () => setMask(false);
  $('#btnView').onclick = e => { e.stopPropagation(); openViewMenu($('#viewPop').hidden); };
  document.addEventListener('click', e => { if (!$('#viewPop').hidden && !e.target.closest('.vmenu')) openViewMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#viewPop').hidden) { openViewMenu(false); $('#btnView').focus(); } });
  $$('[data-theme-set]').forEach(b => b.onclick = () => setTheme(b.getAttribute('data-theme-set')));
  syncViewMenu();
  if (window.matchMedia) { try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!UX.theme) applyTheme(); }); } catch (e) { } }
  bindSearch();
}
