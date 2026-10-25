/* ===== app2_ui.js : 공통 UI·성적 올리기·반 요약·학생 카드·설정·간단 사용법 ===== */
let DB = null, CUR = null, MODELS = {};
const UI = { tab: 'help', grade: null, ck: null, sk: null, gsub: 'sum', cf: 'all', cft: '', cmp: null };

/* ---------- 모달·토스트 ---------- */
function modal(title, html, buttons) {
  const root = $('#modalRoot');
  const bg = document.createElement('div');
  bg.className = 'mbg';
  bg.innerHTML = '<div class="modal" role="dialog"><h3>' + esc(title) + '</h3><div class="mc">' + html + '</div><div class="mb"></div></div>';
  const mb = $('.mb', bg);
  const close = () => { if (bg.parentNode) bg.parentNode.removeChild(bg); };
  (buttons || [{ label: '확인', primary: true }]).forEach(b => {
    const el = document.createElement('button');
    el.className = 'btn' + (b.primary ? '' : ' ghost') + (b.danger ? ' danger' : '');
    if (b.left) el.style.marginRight = 'auto';
    el.textContent = b.label;
    el.onclick = async () => { let keep = false; if (b.onClick) keep = await b.onClick(bg); if (!keep) close(); };
    mb.appendChild(el);
  });
  root.appendChild(bg);
  return { el: bg, close };
}
function confirmBox(title, html, okLabel) {
  return new Promise(res => {
    modal(title, html, [{ label: '취소', onClick: () => { res(false); } }, { label: okLabel || '확인', primary: true, onClick: () => { res(true); } }]);
  });
}
/* 같은 종류 알림은 쌓지 않고 새것으로 바꾼다 (key가 같거나 kind가 같으면 교체) */
function toastSlot(key) {
  const root = $('#toastRoot');
  $$('.toast', root).forEach(x => { if (x.getAttribute('data-k') === key) x.remove(); });
  const all = $$('.toast', root); if (all.length >= 3) all[0].remove();
  return root;
}
function toast(msg, kind, key) {
  const k = key || 'n:' + (kind || 'info');
  const root = toastSlot(k);
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || '');
  t.setAttribute('data-k', k);
  t.setAttribute('role', 'status');
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => { t.remove(); }, kind === 'warn' ? 6500 : 3200);
}

/* ---------- 저장 상태·배너 ---------- */
function updateSaveState(extra) {
  const el = $('#saveState'), btn = $('#btnConnect');
  if (!el) return;
  const box = el.closest('.savebox');
  const linked = !!(ST.handle && !ST.stopped);
  btn.hidden = linked; if (box) box.classList.toggle('linked', linked);
  if (linked) {
    btn.classList.add('on');
    if (extra) { el.className = 'pill warn'; el.textContent = extra; }
    else if (ST.dirty) { el.className = 'pill warn'; el.textContent = '저장 중…'; }
    else { el.className = 'pill ok'; el.textContent = '✓ 파일에 저장됨'; }
    el.title = '연결된 파일: ' + (ST.handle.name || '');
  } else {
    btn.classList.remove('on'); btn.innerHTML = '<i data-ic="save"></i><span class="hide-m">파일에 </span>저장 연결';
    const c = dbCounts(DB);
    if (extra) { el.className = 'pill bad'; el.textContent = extra; }
    else if (c.nc && !DB.demo) { el.className = 'pill warn'; el.textContent = '! 임시 저장'; el.title = '아직 이 HTML 파일에 저장되지 않았습니다. 이 PC 브라우저에 임시로만 남아 있습니다.'; }
    else { el.className = 'pill'; el.textContent = '미연결'; el.title = '이 HTML 파일에 저장되도록 연결되어 있지 않습니다.'; }
  }
}
async function renderBanners() {
  const b = [];
  const supported = !!window.showOpenFilePicker;
  if (!supported) b.push(['bad', '이 브라우저는 「파일에 저장」을 지원하지 않습니다. 크롬이나 엣지에서 열어 주세요. (분석과 엑셀 내보내기는 됩니다)']);
  if (DB.demo) b.push(['info', '지금 보이는 성적은 <b>가상 예시 데이터</b>입니다. 실제 나이스 파일을 올리면 자동으로 지워집니다.', '<button data-act="clearDemo">예시 지우기</button>']);
  if (supported && !ST.handle && dbCounts(DB).nc && !DB.demo) {
    const has = await idbHasHandle();
    b.push(['warn', '아직 이 HTML 파일에 저장되지 않았습니다. 「<i data-ic="save"></i>파일에 저장 연결」로 지금 연 이 파일을 골라 주세요.' + (has ? ' 이전에 연결한 기록이 있습니다.' : ''), has ? '<button data-act="reconnect">다시 연결</button>' : '<button data-act="connect">연결하기</button>']);
  }
  Object.values(MODELS).forEach(M => {
    if (M.unmapped.length) b.push(['warn', esc(M.grade + '학년') + ': 교과군 매핑에 없는 교과가 있어 원문 그대로 묶었습니다 — ' + esc(M.unmapped.join(', ')), '<button data-act="goSettings">설정에서 확인</button>']);
  });
  $('#banners').innerHTML = b.map(x => '<div class="bn ' + x[0] + '"><span>' + x[1] + '</span>' + (x[2] || '') + '</div>').join('');
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.getAttribute('data-act');
  if (act === 'clearDemo') clearDemo();
  else if (act === 'connect') connectFile();
  else if (act === 'reconnect') reconnectFile();
  else if (act === 'goSettings') showTab('settings');
  else if (act === 'goTab') showTab(a.getAttribute('data-tab'));
  else if (act === 'pickFiles') $('#fileAny').click();
});

/* ---------- 탭 ---------- */
function showTab(t) {
  UI.tab = t;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.getAttribute('data-tab') === t));
  $$('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + t));
  if (t !== 'card') { const d = $('#dock'); if (d) d.classList.remove('on'); }
  hideTip && hideTip();
  renderTab(t);
  try { sessionStorage.setItem(LS_PREFIX + 'ui:tab', t); } catch (e) { }
}
function renderTab(t) {
  if (t === 'upload') renderUpload();
  else if (t === 'class') renderClass();
  else if (t === 'card') renderCard();
  else if (t === 'grade') renderGrade();
  else if (t === 'settings') renderSettings();
  else if (t === 'help') renderHelp();
}
function recompute() {
  MODELS = buildModels(DB, CUR);
  const gs2 = Object.keys(MODELS);
  if (!gs2.length) { UI.grade = null; UI.ck = null; UI.sk = null; return; }
  if (!MODELS[UI.grade]) UI.grade = gs2[gs2.length > 1 ? 0 : 0];
  const M = MODELS[UI.grade];
  if (!M.classes.find(c => classKey(c) === UI.ck)) UI.ck = classKey(M.classes[0]);
  if (!M.studs.find(s => s.key === UI.sk)) { const s0 = M.studs.find(s => s.ck === UI.ck); UI.sk = s0 ? s0.key : null; }
}
function renderAll() { recompute(); renderBanners(); updateSaveState(); renderTab(UI.tab); }
function curModel() { return UI.grade != null ? MODELS[UI.grade] : null; }
function emptyNotice() {
  return '<div class="card"><h2>아직 올린 성적이 없습니다</h2><p class="muted">「<i data-ic="upload"></i>성적 올리기」에서 나이스 교과학습발달상황 파일을 올려 주세요.</p>' + neisPathHtml() +
    '<div class="row"><button class="btn" data-act="goTab" data-tab="upload"><i data-ic="upload"></i>성적 올리기로 가기</button><button class="btn ghost" id="btnDemo2">가상 예시로 둘러보기</button></div></div>';
}
function bindDemoBtn(root) { const b = $('#btnDemo2', root); if (b) b.onclick = loadDemo; }
function gradeClassPicker(withClass) {
  const gs2 = Object.keys(MODELS);
  let h = '<div class="row" style="margin-bottom:10px">';
  if (gs2.length > 1) h += '<label>학년 <select class="sel" data-pick="grade">' + gs2.map(g => '<option value="' + g + '"' + (String(UI.grade) === g ? ' selected' : '') + '>' + esc(g) + '학년</option>').join('') + '</select></label>';
  if (withClass) {
    const M = curModel();
    h += '<label>반 <select class="sel" data-pick="class">' + M.classes.map(c => '<option value="' + esc(classKey(c)) + '"' + (classKey(c) === UI.ck ? ' selected' : '') + '>' + esc(c.ban) + '</option>').join('') + '</select></label>';
  }
  const M = curModel();
  h += '<span class="pill">' + M.scale + '등급 체계</span><span class="pill">최근 학기 ' + esc(M.curTerm || '-') + '</span>';
  if (M.ctx.baseLabel) h += '<span class="pill">비교 기준선: ' + esc(M.ctx.baseLabel) + '</span>';
  return h + '</div>';
}
document.addEventListener('change', e => {
  const p = e.target.getAttribute && e.target.getAttribute('data-pick');
  if (!p) return;
  if (p === 'grade') { UI.grade = e.target.value; UI.ck = null; UI.sk = null; recompute(); }
  if (p === 'class') { UI.ck = e.target.value; const s0 = curModel().studs.find(s => s.ck === UI.ck); UI.sk = s0 ? s0.key : null; }
  renderTab(UI.tab);
});
function tdNum(v, d) { return v === '' || v == null ? '' : fx(v, d == null ? 2 : d); }
function tdDelta(v) { if (v === '' || v == null) return '<td data-v=""></td>'; return '<td data-v="' + v + '" class="' + (v < 0 ? 'up' : v > 0 ? 'down' : '') + '">' + fx(v, 2) + arw(v) + '</td>'; }
function typePill(t) { return '<span class="tp tp-' + esc(t) + '" data-type="' + esc(t) + '">' + esc(t) + '</span>'; }

/* 나이스 내려받기 경로 (업로드 탭·간단 사용법 공용) */
const NEIS_STEPS = ['나이스', '학교생활기록부', '학생부 항목별 조회', '교과학습발달상황', '교과학습발달상황', 'XLS Data'];
function neisPathHtml(extra) {
  return '<div class="neis"><div class="neis-h"><i data-ic="folder"></i>나이스 파일 받는 법 <span class="muted">(반마다 한 번씩)</span></div><div class="path">' +
    NEIS_STEPS.map(t => '<b>' + esc(t) + '</b>').join('<span>›</span>') + '</div>' + (extra || '') + '</div>';
}
/* ---------- 성적 올리기 ---------- */
function renderUpload() {
  const root = $('#tab-upload');
  const cls = Object.entries(DB.classes).sort((a, b) => (classGrade(a[1]) - classGrade(b[1])) || (a[1].banNo - b[1].banNo));
  let h = cls.length ? '<div class="card"><h2>성적 파일 더 올리기</h2>' +
    '<div class="drop mini" id="drop"><span><i data-ic="upload"></i>반별 성적 파일을 여기에 끌어다 놓거나</span><button class="btn sm" data-act="pickFiles">파일 고르기</button></div>' +
    '<details class="neis-d"><summary>나이스 파일 받는 법 · 올릴 수 있는 파일</summary>' + neisPathHtml() + '<p class="muted" style="margin:0">백업 엑셀, 다른 선생님이 쓰던 도우미 HTML, 설정 양식도 같은 칸에 올리면 종류를 알아서 구분합니다.</p></details></div>' :
    '<div class="card"><h2>나이스 성적 파일 올리기</h2>' +
    '<div class="drop" id="drop"><div class="big">반별 성적 파일을 여기에 끌어다 놓으세요</div>' +
    '<div class="muted">여러 반 파일을 한꺼번에 놓아도 됩니다 · .xls / .xlsx 모두 가능</div>' +
    '<div style="margin-top:10px"><button class="btn" data-act="pickFiles">파일 고르기</button></div></div>' +
    neisPathHtml('<div class="muted">받은 파일은 이름을 바꾸지 않아도 됩니다. 반 정보는 파일 안의 「○학년 ○반」 표기에서 읽습니다.</div>') +
    '<p class="muted" style="margin:10px 0 0">이 칸에는 이 도우미의 <b>백업 엑셀</b>, 다른 선생님이 쓰던 <b>도우미 HTML</b>, <b>설정 양식</b>도 올릴 수 있습니다. 파일 종류는 자동으로 알아봅니다.</p></div>';
  h += '<div class="card"><h2>올린 반 (' + cls.length + '개 반)</h2>';
  if (!cls.length) {
    h += '<p class="muted">아직 없습니다.</p><button class="btn ghost" id="btnDemo">가상 예시 데이터로 둘러보기</button>';
  } else {
    h += '<div class="list-cls">' + cls.map(([k, c]) => {
      const terms = sortTerms(Array.from(new Set(c.rows.map(r => r[1] + '-' + r[2]))));
      return '<div class="cls-item"><div><b>' + esc(c.ban) + '</b> <span class="muted">· 학생 ' + Object.keys(c.stu).length + '명 · 과목 기록 ' + c.rows.length + '건 · 학기 ' + esc(terms.join(', ')) + '</span><br><span class="muted">' + esc(c.fileName || '') + (c.loadedAt ? ' · ' + esc(new Date(c.loadedAt).toLocaleString('ko-KR')) : '') + '</span></div>' +
        '<div class="row"><button class="btn sm ghost" data-goclass="' + esc(k) + '">반 요약</button><button class="btn sm danger" data-del="' + esc(k) + '">빼기</button></div></div>';
    }).join('') + '</div>';
    h += '<div class="row" style="margin-top:10px"><button class="btn danger sm" id="btnDelAll">모든 반 빼기</button></div>';
  }
  h += '</div>';
  root.innerHTML = h;
  const drop = $('#drop', root);
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); dragDepth = 0; $('#dropOverlay').classList.remove('on'); drop.classList.remove('over'); handleFiles(Array.from(e.dataTransfer.files)); });
  const bd = $('#btnDemo', root); if (bd) bd.onclick = loadDemo;
  $$('[data-del]', root).forEach(b => b.onclick = async () => {
    const k = b.getAttribute('data-del'), c = DB.classes[k], sn = snapshotClasses();
    removeClassFromDb(DB, k); markDirty(); renderAll();
    undoToast(c.ban + ' 성적을 뺐습니다.', () => restoreClasses(sn));
  });
  $$('[data-goclass]', root).forEach(b => b.onclick = () => {
    const c = DB.classes[b.getAttribute('data-goclass')];
    UI.grade = String(classGrade(c)); UI.ck = classKey(c); UI.sk = null; recompute(); showTab('class');
  });
  const da = $('#btnDelAll', root);
  if (da) da.onclick = async () => {
    if (!(await confirmBox('모든 반 빼기', '<p>올린 모든 반의 성적을 이 도우미에서 뺄까요? 설정은 그대로 남습니다.</p>', '모두 빼기'))) return;
    const sn = snapshotClasses();
    Object.keys(DB.classes).forEach(k => removeClassFromDb(DB, k)); DB.demo = false; markDirty(); renderAll();
    undoToast('모든 반 성적을 뺐습니다.', () => restoreClasses(sn));
  };
}
async function readWorkbook(file) {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array', cellDates: true, dense: false });
}
function sheetAoa(ws) { return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true }); }
/* 올린 파일 종류를 알아보고 알맞게 처리 */
async function handleFiles(files) {
  if (!files || !files.length) return;
  const neis = [], logs = [];
  const pg = files.length > 1 ? progress('파일 ' + files.length + '개 읽는 중') : null;
  for (const [fi, f] of files.entries()) {
    const name = f.name || '';
    if (pg) await pg.set(fi, files.length, name);
    try {
      if (/\.html?$/i.test(name)) {
        const txt = await f.text();
        if (txt.indexOf('data-app="' + APP_ID + '"') >= 0) { await mergeHtmlText(txt, name, logs); continue; }
      }
      const wb = await readWorkbook(f);
      if (await tryBackup(wb, name, logs)) continue;
      if (looksLikeSettings(wb)) { await importSettingsWb(wb, name); continue; }
      let best = null;
      wb.SheetNames.forEach(sn => { const p = parseNeis(sheetAoa(wb.Sheets[sn]), name); if (!best || p.rows.length > best.rows.length) best = p; });
      if (!best || !best.rows.length) { logs.push(['err', name + ': 성적 행을 찾지 못했습니다. 나이스 「교과학습발달상황」 엑셀이 맞는지 확인해 주세요.']); continue; }
      neis.push(best);
    } catch (e) {
      console.error(e);
      logs.push(['err', name + ': 읽지 못했습니다 (' + (e && e.message ? e.message : e) + ')']);
    }
  }
  if (pg) pg.done();
  if (neis.length) await applyNeis(neis, logs);
  else if (logs.length) showLogs('올린 파일 처리 결과', logs);
  $('#fileAny').value = '';
}
function showLogs(title, logs, extra) {
  modal(title, (extra || '') + '<ul>' + logs.map(l => '<li class="msg-' + l[0] + '">' + esc(l[1]) + '</li>').join('') + '</ul>');
}
async function applyNeis(list, logs) {
  /* 같은 묶음 안 중복 반 */
  const seen = {};
  const uniq = [];
  list.forEach(p => {
    const k = classKey(p);
    if (seen[k]) { logs.push(['warn', p.fileName + ': ' + p.ban + ' 파일이 두 번 들어 있어 하나만 반영했습니다(' + seen[k] + ').']); return; }
    seen[k] = p.fileName; uniq.push(p);
  });
  const dup = uniq.filter(p => DB.classes[classKey(p)] && !DB.demo);
  let replace = true;
  if (dup.length) {
    replace = await confirmBox('이미 올린 반이 있습니다', '<p>아래 반은 이미 도우미에 있습니다. 새 파일로 바꿀까요?</p><ul>' +
      dup.map(p => { const o = DB.classes[classKey(p)]; return '<li><b>' + esc(p.ban) + '</b> — 지금 ' + Object.keys(o.stu).length + '명·' + o.rows.length + '건 → 새 파일 ' + Object.keys(p.stu).length + '명·' + p.rows.length + '건</li>'; }).join('') +
      '</ul><p class="muted">「취소」를 누르면 이 반들은 건너뛰고 나머지만 반영합니다.</p>', '새 파일로 바꾸기');
  }
  if (DB.demo) { DB.classes = {}; DB.tomb = {}; DB.demo = false; logs.push(['info', '가상 예시 데이터를 지웠습니다.']); }
  let added = 0;
  const newGyo = [];
  const known = mapLookup(CUR);
  uniq.forEach(p => {
    const k = classKey(p);
    if (DB.classes[k] && !replace) { logs.push(['info', p.ban + ': 건너뛰었습니다.']); return; }
    p.rows.forEach(r => { if (r[11] === 1 && r[3] && known[normKey(r[3])] == null && newGyo.indexOf(r[3]) < 0) newGyo.push(r[3]); });
    const c = { ban: p.ban, banNo: p.banNo, grade: p.grade, stu: p.stu, rows: p.rows, fileName: p.fileName };
    addClassToDb(DB, c); added++;
    const nt = sortTerms(Array.from(new Set(p.rows.map(r => r[1] + '-' + r[2]))));
    logs.push(['info', p.ban + ': 학생 ' + Object.keys(p.stu).length + '명, 과목 기록 ' + p.rows.length + '건, 학기 ' + nt.join(', ')]);
    p.warn.slice(0, 5).forEach(w => logs.push(['warn', p.ban + ' ' + w]));
  });
  if (newGyo.length) {
    newGyo.forEach(g => CUR.map.push({ src: g, grp: g, note: '자동 추가 - 확인 필요' }));
    CUR.updatedAt = Date.now();
    logs.push(['warn', '교과군 매핑에 없던 교과를 자동으로 추가했습니다: ' + newGyo.join(', ') + ' → 설정 탭에서 묶을 교과군을 확인해 주세요.']);
  }
  if (added) markDirty();
  renderAll();
  const M = curModel();
  if (added && UI.tab === 'help') showTab('class');
  showLogs('성적 파일 ' + added + '개 반 반영', logs, M ? '<p class="muted">' + esc(M.grade + '학년 · ' + M.scale + '등급 체계 · 최근 학기 ' + M.curTerm) + '</p>' : '');
}
function clearDemo() { DB.classes = {}; DB.tomb = {}; DB.demo = false; markDirty(); renderAll(); }

/* ---------- 반 요약 ---------- */
/* 유형 색은 세 계열로: 좋음(청록) · 주의(주황) · 관찰(회남색). 좋아짐·나빠짐 색과 같은 뜻 */
const TYPE_COLORS = { '학급내상위권': '#1f8f86', '상위권도약': '#4fb5a8', '상승형': '#93d3c8', '상위권하락': '#f2b27a', '단일과목붕괴형': '#e0843f', '전반하락형': '#b9530f', '정체형': '#8a8db3', '일반형': '#c9cad9' };
const TYPE_FAMILY = { '학급내상위권': 'good', '상위권도약': 'good', '상승형': 'good', '상위권하락': 'bad', '단일과목붕괴형': 'bad', '전반하락형': 'bad', '정체형': 'mid', '일반형': 'mid' };
const TYPE_VIEW = ['학급내상위권', '상위권도약', '상승형', '상위권하락', '단일과목붕괴형', '전반하락형', '정체형', '일반형'];
function typeBar(list, prefix) {
  const n = list.length || 1;
  const cnt = TYPE_VIEW.map(t => list.filter(s => s.type === t).length);
  let bar = '<div class="tbar" role="img" aria-label="유형 분포">' + TYPE_VIEW.map((t, i) => cnt[i] ? '<span style="flex:' + cnt[i] + ';background:' + TYPE_COLORS[t] + '" data-type="' + esc(t) + '"></span>' : '').join('') + '</div>';
  bar += '<div class="tleg">' + TYPE_VIEW.map((t, i) => cnt[i] ? '<button class="tleg-i fam-' + TYPE_FAMILY[t] + '" data-jump="' + esc(prefix + t) + '" data-type="' + esc(t) + '"><i style="background:' + TYPE_COLORS[t] + '"></i>' + esc(t) + ' <b>' + cnt[i] + '</b><small>' + fx(cnt[i] / n * 100, 0) + '%</small></button>' : '').join('') + '</div>';
  return bar;
}
function bindJump(root) {
  $$('[data-jump]', root).forEach(b => b.onclick = () => {
    const el = document.getElementById(b.getAttribute('data-jump'));
    if (!el) return;
    el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  });
}
function accordionTools(sel) {
  return '<div class="row acc-tools"><button class="btn ghost sm" data-acc="open" data-sel="' + sel + '">모두 펼치기</button><button class="btn ghost sm" data-acc="close" data-sel="' + sel + '">모두 접기</button></div>';
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-acc]');
  if (!b) return;
  $$(b.getAttribute('data-sel')).forEach(d => d.open = b.getAttribute('data-acc') === 'open');
});
/* 목표 칸 하나: 숫자면 「1.44 이내」, 아니면 판정만 (중복 숫자 없이) */
function targetCell(tg) {
  const hard = tg.verdict === '이번 학기만으로는 도달 불가', keep = tg.verdict === '현 수준 유지로 달성';
  const txt = hard ? '도달 불가' : keep ? '유지로 달성' : tg.need !== '' ? tg.need + ' 이내' : tg.verdict;
  const v = hard ? 0 : tg.need !== '' ? tg.need : '';
  return '<td data-v="' + esc(v) + '" class="' + (hard ? 'down' : keep ? 'up' : '') + '" title="' + esc(tg.verdict) + '">' + esc(txt) + '</td>';
}
function kpi(v, label, cls, tipKey) { return '<div class="' + (cls || '') + '"' + (tipKey ? ' data-tip="' + tipKey + '"' : '') + '><b>' + v + '</b><span>' + label + '</span></div>'; }
function renderClass() {
  const root = $('#tab-class');
  const M = curModel();
  if (!M) { root.innerHTML = emptyNotice(); bindDemoBtn(root); return; }
  const ctx = M.ctx, xs = M.studs.filter(s => s.ck === UI.ck);
  const c = M.classes.find(x => classKey(x) === UI.ck);
  const mean = a => { const v = a.filter(x => x !== ''); return v.length ? vround(v.reduce((p, q) => p + q, 0) / v.length, 2) : ''; };
  const curM = mean(xs.map(s => s.curAvg)), baseM = mean(xs.map(s => s.base));
  const up = xs.filter(s => s.diff !== '' && s.diff < 0).length, down = xs.filter(s => s.diff !== '' && s.diff > 0).length;
  const hard = xs.filter(s => s.target.verdict === '이번 학기만으로는 도달 불가').length;
  let h = '<div class="card">' + gradeClassPicker(true) +
    '<div class="row"><button class="btn" id="xClass"><i data-ic="download"></i>이 반 학생카드 엑셀</button><button class="btn ghost" id="xAll"><i data-ic="download"></i>모든 반 엑셀 (반마다 1개)</button><button class="btn ghost" id="pClass"><i data-ic="print"></i>이 반 학생카드 인쇄</button></div></div>';
  h += '<div class="card"><h2>한눈에 보기</h2><div class="kpi">' +
    kpi(xs.length + '명', '학생 수') +
    kpi(curM === '' ? '-' : fx(curM, 2), ctx.curLabel + ' 반 평균', '', 'cur') +
    kpi(baseM === '' || curM === '' ? '-' : (curM - baseM > 0 ? '+' : '') + fx(vround(curM - baseM, 2), 2) + arw(curM - baseM), (ctx.baseLabel || '기준선') + ' 대비', curM !== '' && baseM !== '' ? (curM - baseM < 0 ? 'k-up' : curM - baseM > 0 ? 'k-down' : '') : '', 'diff') +
    kpi(up + '명', '▲ 좋아진 학생', 'k-up', 'diff') + kpi(down + '명', '▼ 나빠진 학생', 'k-down', 'diff') +
    (ctx.next ? kpi(hard + '명', '목표 도달 불가', hard ? 'k-warn' : '', 'verdict') : '') +
    '</div><h3>유형 분포 <span class="muted">— 항목을 누르면 아래 명단으로 이동</span></h3>' + typeBar(xs, 'cls-') + '</div>';
  h += '<div class="card"><h2>학생별 요약</h2>';
  h += classFilterBar(xs) + '<div class="tw"><table class="t sortable" id="clsTbl"><thead><tr><th class="stk">번호</th><th class="l">성명</th>' + M.terms.map(t => '<th>' + esc(t) + '</th>').join('') + '<th class="nosort">추이</th>' +
    '<th>' + tip(ctx.baseLabel || '기준선', 'base') + '</th><th>' + tip(ctx.curLabel, 'cur') + '</th><th>' + tip('차이', 'diff') + '</th>' +
    (ctx.next ? '<th>' + tip(ctx.next + ' 목표', 'target') + '</th>' : '') + '<th>' + tip('취약 교과군', 'worst') + '</th><th>유형</th></tr></thead><tbody>';
  xs.forEach(s => {
    const tg = s.target;
    h += '<tr data-diff="' + s.diff + '" data-type="' + esc(s.type) + '" data-hard="' + (tg.verdict === '이번 학기만으로는 도달 불가' ? 1 : 0) + '"><td class="stk">' + s.no + '</td><td class="l"><a href="#" data-stu="' + esc(s.key) + '">' + esc(dn(s.name)) + '</a></td>' + s.tv.map(v => tdHeat(v, M.scale)).join('') + '<td>' + sparkline(s.tv, M.scale) + '</td>' +
      tdHeat(s.base, M.scale) + tdHeat(s.curAvg, M.scale) + tdDelta(s.diff) +
      (ctx.next ? targetCell(tg) : '') +
      '<td>' + esc(s.worst) + '</td><td>' + typePill(s.type) + '</td></tr>';
  });
  h += '</tbody></table></div>';
  if (ctx.next) h += '<p class="muted">※ ' + esc(ctx.next) + ' 목표등급 : ' + esc(ctx.tYearLabel) + '이 ' + esc(ctx.tBaseLabel || '기준 학년 평균') + ' 이하(같거나 더 좋음)가 되려면 ' + esc(ctx.nextLabel) + '에 필요한 학점가중 평균등급' +
    (ctx.next.split('-')[1] === '2' ? '. 다음 학기 이수학점은 설정 탭의 「다음학기예상학점」을 쓰며, 0이면 ' + esc(ctx.tYear + '학년 1학기') + '와 같다고 가정합니다.' : '.') + '</p>';
  h += '<p class="muted">※ 차이·변화의 <span class="up">▲ 청록색은 등급이 좋아진 것(숫자 감소)</span>, <span class="down">▼ 주황색은 나빠진 것</span>입니다. 머리글을 누르면 정렬되고, 점선 밑줄이 있는 말에 마우스를 올리면 설명이 나옵니다.</p></div>';
  h += '<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">유형별 명단과 처방</h2>' + accordionTools('#tab-class details.acc') + '</div>';
  TYPE_VIEW.forEach(t => {
    const ls = xs.filter(s => s.type === t);
    if (!ls.length) return;
    h += '<details class="acc" open id="cls-' + esc(t) + '"><summary>' + typePill(t) + '<b>' + ls.length + '명</b><span class="acc-peek">' + ls.slice(0, 4).map(s => esc(dn(s.name))).join(', ') + (ls.length > 4 ? ' 외' : '') + '</span></summary>' +
      '<div class="acc-body"><div class="names">' + ls.map(s => '<a href="#" data-stu="' + esc(s.key) + '">' + s.no + '번 ' + esc(dn(s.name)) + '</a>').join('') + '</div><div class="presc">▶ ' + esc(prescription(t)) + '</div></div></details>';
  });
  h += '</div>';
  root.innerHTML = h;
  $$('[data-stu]', root).forEach(a => a.onclick = e => { e.preventDefault(); UI.sk = a.getAttribute('data-stu'); showTab('card'); });
  bindJump(root);
  bindClassFilter(root);
  $('#xClass', root).onclick = () => exportClassBook(M, UI.ck);
  $('#xAll', root).onclick = () => exportAllClassBooks(M);
  $('#pClass', root).onclick = () => printCards(M, xs);
}

/* ---------- SVG 차트 ---------- */
function svgTrend(labels, vals, scale, w, h, title) {
  w = w || 330; h = h || 200;
  /* 제목 아래에 값 글자가 들어갈 여백(T)을 두고, 양 끝 점이 축 숫자와 겹치지 않게 안쪽 여백(P)을 둔다 */
  const L = 30, R = 12, T = 48, B = 26, P = 22, iw = w - L - R - 2 * P, ih = h - T - B;
  const y = v => T + (v - 1) / (scale - 1) * ih;
  const x = i => L + P + (labels.length === 1 ? iw / 2 : i * iw / (labels.length - 1));
  let s = '<svg class="chart" xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><rect width="' + w + '" height="' + h + '" fill="#fff"/>';
  s += '<text x="' + (w / 2) + '" y="18" text-anchor="middle" font-size="12.5" font-weight="700" fill="#33386e">' + esc(title || '학기별 평균등급 추이') + '</text>';
  for (let g = 1; g <= scale; g++) { s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="#e6e4ef"/><text x="' + (L - 6) + '" y="' + (y(g) + 4) + '" text-anchor="end" font-size="10.5" fill="#6e6a85">' + g + '</text>'; }
  labels.forEach((l, i) => { s += '<text x="' + x(i) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="11" fill="#4b4766">' + esc(l) + '</text>'; });
  const pts = [];
  vals.forEach((v, i) => { if (v !== '' && v != null) pts.push([x(i), y(Math.min(scale, Math.max(1, v))), v]); });
  if (pts.length > 1) s += '<polyline fill="none" stroke="#6b7be0" stroke-width="2.4" points="' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '"/>';
  pts.forEach(p => {
    s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4.2" fill="#fff" stroke="#5262c9" stroke-width="2"/>' +
      '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] - 10).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="#33386e" stroke="#fff" stroke-width="3" stroke-linejoin="round" paint-order="stroke">' + fx(p[2], 2) + '</text>';
  });
  return s + '</svg>';
}
function svgGroups(groups, overall, scale, w, title) {
  const rows = groups.filter(g => g.all !== '');
  w = w || 330;
  const L = 92, R = 40, T = 42, rh = 22, h = T + rows.length * rh + 36, iw = w - L - R;
  const x = v => L + (v - 1) / (scale - 1) * iw;
  let s = '<svg class="chart" xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><rect width="' + w + '" height="' + h + '" fill="#fff"/>';
  s += '<text x="' + (w / 2) + '" y="17" text-anchor="middle" font-size="12.5" font-weight="700" fill="#33386e">' + esc(title || '교과군별 평균등급') + '</text>';
  for (let g = 1; g <= scale; g++) s += '<line x1="' + x(g) + '" x2="' + x(g) + '" y1="' + (T - 4) + '" y2="' + (h - 32) + '" stroke="#e6e4ef"/><text x="' + x(g) + '" y="' + (h - 19) + '" text-anchor="middle" font-size="10.5" fill="#6e6a85">' + g + '</text>';
  if (overall !== '' && overall != null) s += '<line x1="' + x(overall) + '" x2="' + x(overall) + '" y1="' + (T - 4) + '" y2="' + (h - 32) + '" stroke="#8a87a0" stroke-dasharray="4 3"/><text x="' + x(overall) + '" y="' + (T - 8) + '" text-anchor="middle" font-size="9.5" fill="#6e6a85">전체 ' + fx(overall, 2) + '</text>';
  rows.forEach((g, i) => {
    const cy = T + i * rh + rh / 2;
    s += '<text x="' + (L - 8) + '" y="' + (cy + 4) + '" text-anchor="end" font-size="11" fill="#33386e">' + esc(g.g) + '</text>';
    s += '<line x1="' + L + '" x2="' + x(g.all).toFixed(1) + '" y1="' + cy + '" y2="' + cy + '" stroke="#c4caf4" stroke-width="6" stroke-linecap="round"/>';
    s += '<circle cx="' + x(g.all).toFixed(1) + '" cy="' + cy + '" r="5" fill="#6b7be0"/><text x="' + (x(g.all) + 9).toFixed(1) + '" y="' + (cy + 4) + '" font-size="10.5" fill="#33386e">' + fx(g.all, 2) + '</text>';
  });
  s += '<text x="' + L + '" y="' + (h - 4) + '" font-size="9.5" fill="#8a87a0">← 좋음 (1등급)</text><text x="' + (w - R) + '" y="' + (h - 4) + '" text-anchor="end" font-size="9.5" fill="#8a87a0">나쁨 →</text>';
  return s + '</svg>';
}

/* 성취도 분포 가로 막대 (학기마다 A~E 비율, 히트맵과 같은 남보라 한 가지 색: A 옅게 → E 진하게) */
const ACH_COLORS = ['#dfe3fa', '#b4bbef', '#8792e2', '#5c69cc', '#3a44a0'];
function svgAch(labels, ach, w) {
  w = w || 330;
  const L = 44, R = 12, T = 30, rh = 22, h = T + labels.length * rh + 26, iw = w - L - R;
  let s = '<svg class="chart ach" xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><rect width="' + w + '" height="' + h + '" fill="#fff"/>';
  s += '<text x="' + (w / 2) + '" y="17" text-anchor="middle" font-size="12.5" font-weight="700" fill="#33386e">학기별 성취도 비율</text>';
  labels.forEach((t, i) => {
    const cy = T + i * rh, row = ach[i] || [], tot = row.reduce((p, q) => p + q, 0);
    s += '<text x="' + (L - 6) + '" y="' + (cy + 14) + '" text-anchor="end" font-size="10.5" fill="#4b4766">' + esc(t) + '</text>';
    if (!tot) { s += '<rect x="' + L + '" y="' + (cy + 3) + '" width="' + iw + '" height="' + (rh - 7) + '" fill="#f1f2f7"/>'; return; }
    let acc = 0;
    row.forEach((n, k) => {
      const ww = n / tot * iw; if (ww <= 0) return;
      s += '<rect x="' + (L + acc).toFixed(1) + '" y="' + (cy + 3) + '" width="' + ww.toFixed(1) + '" height="' + (rh - 7) + '" fill="' + ACH_COLORS[k] + '"/>';
      if (ww > 16) s += '<text x="' + (L + acc + ww / 2).toFixed(1) + '" y="' + (cy + 14) + '" text-anchor="middle" font-size="10" fill="' + (k >= 2 ? '#fff' : '#1f1e2b') + '">' + n + '</text>';
      acc += ww;
    });
  });
  const ly = T + labels.length * rh + 8;
  'ABCDE'.split('').forEach((c, k) => { s += '<rect x="' + (L + k * 42) + '" y="' + ly + '" width="10" height="10" fill="' + ACH_COLORS[k] + '"/><text x="' + (L + k * 42 + 14) + '" y="' + (ly + 9) + '" font-size="10" fill="#4b4766">' + c + '</text>'; });
  return s + '</svg>';
}

/* ---------- 학생 카드 (스플릿 뷰 + 플로팅 도크) ---------- */
function renderCard() {
  const root = $('#tab-card');
  const M = curModel();
  if (!M) { root.innerHTML = emptyNotice(); bindDemoBtn(root); $('#dock').classList.remove('on'); return; }
  const xs = M.studs.filter(s => s.ck === UI.ck);
  let s = M.studs.find(x => x.key === UI.sk && x.ck === UI.ck) || xs[0];
  if (s) UI.sk = s.key;
  let h = '<div class="card">' + gradeClassPicker(true) +
    '<div class="row"><button class="btn ghost sm" id="pAll"><i data-ic="print"></i>이 반 전체 인쇄</button><button class="btn ' + (UI.cmp ? '' : 'ghost ') + 'sm" id="cmpBtn"><i data-ic="compare"></i>다른 학생과 비교</button><span class="muted">학생은 왼쪽 목록이나 아래 떠 있는 ◀ ▶ 버튼으로 넘깁니다.</span></div></div>';
  h += '<div class="split"><aside class="side"><div class="side-h">학생 ' + xs.length + '명</div><div class="stu-list">' +
    xs.map(x => '<button data-sk="' + esc(x.key) + '"' + (s && x.key === s.key ? ' class="on"' : '') + '><span class="no">' + x.no + '</span><span class="nm">' + esc(dn(x.name)) + '</span><i class="dot" style="background:' + TYPE_COLORS[x.type] + '" data-type="' + esc(x.type) + '"></i></button>').join('') +
    '</div></aside><div class="main" id="cardMain"></div></div>';
  root.innerHTML = h;
  $$('[data-sk]', root).forEach(b => b.onclick = () => selectStudent(b.getAttribute('data-sk')));
  $('#pAll', root).onclick = () => printCards(M, xs);
  $('#cmpBtn', root).onclick = () => { if (UI.cmp) { UI.cmp = null; } else { const others = M.studs.filter(x => x.key !== UI.sk); const i = xs.findIndex(x => x.key === UI.sk); UI.cmp = (xs[i + 1] || xs[i - 1] || others[0] || {}).key || null; } renderCard(); };
  selectStudent(s ? s.key : null, true);
}
function selectStudent(key, first) {
  const M = curModel(); if (!M) return;
  const xs = M.studs.filter(s => s.ck === UI.ck);
  const s = xs.find(x => x.key === key);
  UI.sk = s ? s.key : null;
  const main = $('#cardMain'); if (!main) return;
  const B = UI.cmp ? M.studs.find(x => x.key === UI.cmp && x.key !== UI.sk) : null;
  if (UI.cmp && s && !B) { const o = M.studs.find(x => x.key !== s.key); UI.cmp = o ? o.key : null; }
  const B2 = UI.cmp ? M.studs.find(x => x.key === UI.cmp) : null;
  main.innerHTML = !s ? '<p class="muted">학생이 없습니다.</p>' : (B2 ? compareControls(M, s) + compareHtml(M, s, B2) : cardHtml(M, s));
  const cp = $('#cmpPick', main); if (cp) cp.onchange = () => { UI.cmp = cp.value; selectStudent(UI.sk, true); };
  const ce = $('#cmpEnd', main); if (ce) ce.onclick = () => { UI.cmp = null; renderCard(); };
  main.classList.remove('swap'); void main.offsetWidth; main.classList.add('swap');
  $$('#tab-card [data-sk]').forEach(b => { const on = b.getAttribute('data-sk') === UI.sk; b.classList.toggle('on', on); if (on && !first) b.scrollIntoView({ block: 'nearest' }); });
  if (!first) { const top = $('#tab-card .split').getBoundingClientRect().top + window.scrollY - 70; if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' }); }
  renderDock(M, xs, s);
}
function renderDock(M, xs, s) {
  const d = $('#dock');
  if (!s || UI.tab !== 'card') { d.classList.remove('on'); return; }
  const i = xs.indexOf(s);
  d.innerHTML = '<button id="dkPrev" ' + (i <= 0 ? 'disabled' : '') + ' aria-label="이전 학생">◀</button>' +
    '<div class="dk-name"><b>' + s.no + '번 ' + esc(dn(s.name)) + '</b><small>' + esc(s.ban) + ' · ' + (i + 1) + '/' + xs.length + '</small></div>' +
    '<button id="dkNext" ' + (i >= xs.length - 1 ? 'disabled' : '') + ' aria-label="다음 학생">▶</button><span class="dk-sep"></span><button id="dkPrint" class="dk-print"><i data-ic="print"></i>인쇄</button>';
  d.classList.add('on');
  $('#dkPrev').onclick = () => { if (i > 0) selectStudent(xs[i - 1].key); };
  $('#dkNext').onclick = () => { if (i < xs.length - 1) selectStudent(xs[i + 1].key); };
  $('#dkPrint').onclick = () => printCards(M, [s]);
}
/* 화면에서는 숨기고 인쇄에서만 보이는 [n] 번호 */
function sno(n) { return '<span class="sno">[' + n + '] </span>'; }
function cardHtml(M, s) {
  const ctx = M.ctx, S = M.S, R = s.R;
  let p1 = '<div class="sc-page sc-p1"><div class="sc-title">' + esc(s.ban) + '  ' + s.no + '번  ' + esc(dn(s.name)) + '   내신 성적 분석</div>';
  p1 += '<div class="sc-sec">' + sno(1) + '학기별 평균등급 추이</div><div class="sc-flex"><table class="ct"><tr><th>학기</th><th>이수학점</th><th>' + tip('평균등급', 'avg') + '</th><th>직전 대비</th></tr>';
  M.terms.forEach((t, i) => {
    let d = '-', cls = '';
    if (i > 0 && s.tv[i] !== '' && s.tv[i - 1] !== '') { const v = vround(s.tv[i] - s.tv[i - 1], 2); d = fx(v, 2) + arw(v); cls = v < 0 ? 'up' : v > 0 ? 'down' : ''; }
    p1 += '<tr><td>' + esc(t) + '학기</td><td>' + esc(termCredit(R, t)) + '</td><td>' + tdNum(s.tv[i]) + '</td><td class="' + cls + '">' + d + '</td></tr>';
  });
  p1 += '</table>' + svgTrend(M.terms, s.tv, M.scale) + '</div>';
  p1 += '<div class="sc-sec">' + sno(2) + '성취도 분포 (교과 과목 기준)</div><div class="sc-flex"><table class="ct"><tr><th>학기</th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th></tr>';
  M.terms.forEach((t, i) => { p1 += '<tr><td>' + esc(t) + '학기</td>' + s.ach[i].map(n => '<td>' + n + '</td>').join('') + '</tr>'; });
  p1 += '<tr><td><b>합계</b></td>' + s.achAll.map(n => '<td><b>' + n + '</b></td>').join('') + '</tr></table>' + svgAch(M.terms, s.ach) + '</div>';
  p1 += '<div class="sc-sec">' + sno(3) + '' + M.terms.length + '개 학기 종합 진단</div><div class="sc-box">' + esc(makeDiagnosis(s, ctx, S, dn(s.name))) + '</div></div>';

  let p2 = '<div class="sc-page"><div class="sc-title">■ 교과군 프로파일</div><div class="sc-sec">' + sno(4) + '교과군별 평균등급</div><div class="sc-flex"><table class="ct"><tr><th>교과군</th>' + M.terms.map(t => '<th>' + esc(t) + '</th>').join('') + '<th>전체</th><th>전체평균 대비</th></tr>';
  s.groups.forEach(g => {
    p2 += '<tr><td>' + esc(g.g) + '</td>' + g.tv.map(v => '<td>' + tdNum(v) + '</td>').join('') + '<td>' + tdNum(g.all) + '</td>' +
      (g.gap === '' ? '<td></td>' : '<td class="' + (g.gap > 0 ? 'down' : 'up') + '">' + fx(vround(g.gap, 2), 2) + arw(g.gap) + '</td>') + '</tr>';
  });
  p2 += '</table>' + svgGroups(s.groups, s.overall, M.scale) + '</div>';
  p2 += '<div class="sc-sec">' + sno(5) + '과목별 상세 (전 학기)</div><table class="ct full"><tr><th>학기</th><th>교과군</th><th>과목</th><th>학점</th><th>원점수</th><th>과목평균</th><th>' + tip('편차', 'dev') + '</th><th>성취도</th><th>석차등급</th><th>' + tip('수강자수', 'cnt') + '</th></tr>';
  M.terms.forEach(t => {
    R.filter(r => r.kind === 1 && r.term === t).forEach(r => {
      p2 += '<tr><td>' + esc(r.term) + '</td><td>' + esc(r.grp) + '</td><td class="l">' + esc(r.sub) + '</td><td>' + esc(r.cr) + '</td><td>' + esc(r.score) + '</td><td>' + tdNum(r.avg, 1) + '</td>' +
        (r.dev === '' ? '<td></td>' : '<td class="' + (r.dev > 0 ? 'up' : 'down') + '">' + fx(r.dev, 1) + arw(r.dev, false) + '</td>') + '<td>' + esc(r.ach) + '</td><td>' + esc(r.rank) + '</td><td>' + esc(r.cnt === 0 ? '' : r.cnt) + '</td></tr>';
    });
  });
  p2 += '</table></div>';

  const tg = s.target;
  let p3 = '<div class="sc-page"><div class="sc-title">■ 진단과 담임 개입</div><div class="sc-sec">' + sno(6) + '학습 유형 판정</div><table class="kv">' +
    '<tr><th>유형</th><td><b style="font-size:var(--fs-l)" data-type="' + esc(s.type) + '"><mark class="hl">' + esc(s.type) + '</mark></b></td></tr><tr><th>' + tip('판정 근거', 'why') + '</th><td>' + esc(s.why) + '</td></tr>' +
    '<tr><th>강점 교과군</th><td>' + (s.best ? esc(s.best) + ' (전체 평균보다 ' + fx(Math.abs(s.bestGap), 1) + '등급 높음)' : '-') + '</td></tr>' +
    '<tr><th>' + tip('취약 교과군', 'worst') + '</th><td>' + (s.worst ? esc(s.worst) + ' (전체 평균보다 ' + fx(Math.abs(s.worstGap), 1) + '등급 낮음) - ' + esc(groupComment(s.worst)) : '-') + '</td></tr></table>';
  if (ctx.next) {
    p3 += '<div class="sc-sec">' + sno(7) + '' + esc(ctx.nextLabel) + ' 목표 등급</div><table class="kv"><tr><th>' + esc(ctx.tBaseLabel || '기준선') + '</th><td>' + tdNum(tg.B) + '</td></tr>';
    if (ctx.next.split('-')[1] === '2') p3 += '<tr><th>' + esc(termLabel(ctx.tYear + '-1')) + '</th><td>' + tdNum(tg.gSo) + (tg.B !== '' && tg.gSo !== '' ? ' <span class="' + (tg.gSo - tg.B < 0 ? 'up' : 'down') + '">(차이 ' + fx(vround(tg.gSo - tg.B, 2), 2) + arw(tg.gSo - tg.B) + ')</span>' : '') + '</td></tr>';
    p3 += '<tr><th>' + tip('목표 등급', 'target') + '</th><td><b><mark class="hl">' + (tg.need !== '' ? esc(ctx.nextLabel) + '에 학점가중 평균 ' + esc(tg.need) + '등급 이내' + (/필요$/.test(tg.verdict) ? '' : ' (' + esc(tg.verdict) + ')') : esc(tg.verdict)) + '</mark></b></td></tr>' +
      '<tr><td colspan="2">' + esc(tg.comment) + '</td></tr></table>';
  } else {
    p3 += '<div class="sc-sec">' + sno(7) + '다음 학기 목표 등급</div><div class="sc-box">' + esc(tg.comment) + '</div>';
  }
  p3 += '<div class="sc-sec">' + sno(8) + '담임 개입 제안</div><div class="sc-box">' + esc(prescription(s.type)) + '</div>';
  p3 += '<div class="sc-sec">' + sno(9) + '체육·예술·과학탐구실험·교양 (성실성 참고)</div><table class="ct mid"><tr><th>학기</th><th>구분</th><th>과목</th><th>학점</th><th>성취도/이수</th></tr>';
  const etc = R.filter(r => r.kind !== 1);
  p3 += etc.length ? etc.map(r => '<tr><td>' + esc(r.term) + '</td><td>' + esc(kindLabel(r)) + '</td><td class="l">' + esc(r.sub) + '</td><td>' + esc(r.cr) + '</td><td>' + esc(r.ach) + '</td></tr>').join('') : '<tr><td colspan="5">(자료 없음)</td></tr>';
  p3 += '</table><div class="sc-sec">' + sno(10) + '상담 메모</div><div class="sc-memo"></div></div>';
  return p1 + p2 + p3;
}
function printCards(M, list) {
  if (!list || !list.length) return;
  $('#printArea').innerHTML = list.map(s => cardHtml(M, s)).join('');
  setTimeout(() => { window.print(); }, 60);
}
window.addEventListener('afterprint', () => { $('#printArea').innerHTML = ''; });

/* ---------- 설정 ---------- */
function renderSettings() {
  const root = $('#tab-settings');
  const Ms = Object.values(MODELS);
  const det = Ms.length ? Ms.map(M => M.grade + '학년: ' + (M.maxRank > 5 ? '9등급' : '5등급') + ' 감지, 학기 ' + M.termsAll.join(', ')).join(' / ') : '올린 성적 없음';
  const allTerms = sortTerms(Array.from(new Set([].concat.apply([], Ms.map(M => M.termsAll)))));
  let h = '<div class="card"><h2>분석 기준</h2><div class="grid2"><div><b>등급 체계</b><br><select class="sel" id="cfScale">' +
    [['auto', '자동 (석차등급 6 이상이 있으면 9등급)'], ['5', '5등급 (2022 개정)'], ['9', '9등급 (2015 개정)']].map(o => '<option value="' + o[0] + '"' + (CUR.scaleMode === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
    '<div><b>판정 기준 학기 (최근 학기)</b><br><select class="sel" id="cfTerm"><option value="auto"' + (CUR.termMode === 'auto' ? ' selected' : '') + '>자동 (파일에 있는 가장 최근 학기)</option>' +
    allTerms.map(t => '<option value="' + t + '"' + (CUR.termMode === t ? ' selected' : '') + '>' + esc(termLabel(t)) + '까지만</option>').join('') + '</select></div></div>' +
    '<p class="muted" style="margin:8px 0 0">지금 감지: ' + esc(det) + '. 비교 기준선은 최근 학기의 직전 학년 평균입니다(2학년 1학기면 1학년 평균). 1학년 2학기 시점에는 1학년 1학기와 비교합니다.</p></div>';
  h += '<div class="card"><h2>판정 기준값</h2><p class="muted">숫자 칸만 고치면 됩니다. 바꾸면 모든 화면에 바로 반영됩니다. 9등급 값은 5등급 값을 비율로 옮긴 가안이니, 학교 사정에 맞게 조정해 주세요.</p>' +
    '<div class="tw"><table class="t cfg"><thead><tr><th class="l">항목</th><th>5등급 값</th><th>9등급 값</th><th>단위</th><th class="l">설명</th></tr></thead><tbody>' +
    SET_DEF.map(d => '<tr><td class="l"><b>' + esc(d.label) + '</b></td><td><input type="number" step="any" data-cf="s5.' + d.k + '" value="' + esc(CUR.s5[d.k]) + '"></td><td><input type="number" step="any" data-cf="s9.' + d.k + '" value="' + esc(CUR.s9[d.k]) + '"></td><td>' + esc(d.unit) + '</td><td class="wrap">' + esc(d.desc) + '</td></tr>').join('') +
    '</tbody></table></div><div class="row" style="margin-top:8px"><button class="btn ghost sm" id="cfReset">기본값으로 되돌리기</button></div></div>';
  h += '<div class="card"><h2>교과 → 교과군 매핑</h2><p class="muted">나이스의 「교과」 표기를 분석용 교과군으로 묶습니다. 여러 교과를 한 군으로 묶으려면 교과군에 같은 이름을 적으세요. 원본에 없던 교과가 나오면 자동으로 추가되고 「확인 필요」 표시가 붙습니다.</p>' +
    '<div class="tw"><table class="t cfg"><thead><tr><th class="l">원본 교과 표기</th><th class="l">분석용 교과군</th><th class="l">비고</th><th></th></tr></thead><tbody id="mapBody">' +
    CUR.map.map((r, i) => mapRow(r, i)).join('') + '</tbody></table></div>' +
    '<div class="row" style="margin-top:8px"><button class="btn ghost sm" id="mapAdd">＋ 줄 추가</button><button class="btn ghost sm" id="mapReset">기본 매핑으로 되돌리기</button></div></div>';
  h += '<div class="card"><h2>설정 양식·배포</h2><div class="row"><button class="btn ghost" id="cfTpl"><i data-ic="download"></i>설정 양식(엑셀) 받기</button><button class="btn ghost" id="cfUp"><i data-ic="upload"></i>설정 양식 올리기</button><button class="btn" id="cfDist"><i data-ic="package"></i>배포본 만들기</button></div>' +
    '<p class="muted" style="margin:8px 0 0">설정 양식에 기준값·교과군을 적어 올리면 그대로 반영됩니다(원본 매크로 파일 .xlsm을 올려도 [설정]·[교과군매핑] 시트를 읽습니다). ' +
    '「배포본」은 지금 설정만 담고 <b>성적은 하나도 없는</b> 새 HTML 파일입니다. 다른 선생님·다른 학교에 나눠 줄 때 쓰세요.</p>' +
    '<input type="file" id="cfFile" accept=".xlsx,.xlsm,.xls" hidden></div>';
  root.innerHTML = h;
  $('#cfScale', root).onchange = e => { CUR.scaleMode = e.target.value; saveSettings(); recompute(); renderBanners(); toast('등급 체계를 바꿨습니다.'); };
  $('#cfTerm', root).onchange = e => { CUR.termMode = e.target.value; saveSettings(); recompute(); toast('판정 기준 학기를 바꿨습니다.'); };
  $$('[data-cf]', root).forEach(inp => inp.addEventListener('change', () => {
    const [grp, k] = inp.getAttribute('data-cf').split('.');
    const v = Number(inp.value);
    if (inp.value === '' || isNaN(v)) { inp.value = CUR[grp][k]; toast('숫자를 입력해 주세요.', 'warn'); return; }
    CUR[grp][k] = v; saveSettings(); recompute();
  }));
  bindMapEvents(root);
  $('#cfReset', root).onclick = () => { const sn = snapshotCur(); const d = defaultCur(); CUR.s5 = d.s5; CUR.s9 = d.s9; saveSettings(); recompute(); renderSettings(); undoToast('판정 기준값을 기본값으로 되돌렸습니다.', () => restoreCur(sn)); };
  $('#mapAdd', root).onclick = () => { CUR.map.push({ src: '', grp: '', note: '' }); const tb = $('#mapBody'); tb.insertAdjacentHTML('beforeend', mapRow(CUR.map[CUR.map.length - 1], CUR.map.length - 1)); bindMapEvents(root); };
  $('#mapReset', root).onclick = () => { const sn = snapshotCur(); CUR.map = defaultCur().map; saveSettings(); recompute(); renderSettings(); renderBanners(); undoToast('교과군 매핑을 기본값으로 되돌렸습니다.', () => restoreCur(sn)); };
  $('#cfTpl', root).onclick = downloadSettingsTemplate;
  $('#cfUp', root).onclick = () => $('#cfFile').click();
  $('#cfFile', root).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const wb = await readWorkbook(f); if (await tryBackup(wb, f.name, null)) return; await importSettingsWb(wb, f.name, true); } catch (er) { modal('읽지 못했습니다', '<p>' + esc(er.message || er) + '</p>'); } e.target.value = ''; };
  $('#cfDist', root).onclick = makeDistribution;
}
function mapRow(r, i) {
  return '<tr data-mi="' + i + '"' + (r.note && r.note.indexOf('자동') >= 0 ? ' class="auto"' : '') + '><td class="l"><input class="txt" data-mf="src" value="' + esc(r.src) + '">' + (r.note && r.note.indexOf('자동') >= 0 ? '<span class="chk">확인 필요</span>' : '') + '</td><td class="l"><input class="txt" data-mf="grp" value="' + esc(r.grp) + '"></td><td class="l"><input class="txt" data-mf="note" value="' + esc(r.note) + '"></td><td><button class="icbtn del" data-mdel title="이 줄 지우기" aria-label="이 줄 지우기"><i data-ic="trash"></i></button></td></tr>';
}
function bindMapEvents(root) {
  $$('#mapBody tr', root).forEach(tr => {
    if (tr._bound) return; tr._bound = true;
    const i = () => Number(tr.getAttribute('data-mi'));
    $$('[data-mf]', tr).forEach(inp => inp.addEventListener('change', () => {
      const r = CUR.map[i()]; if (!r) return;
      r[inp.getAttribute('data-mf')] = inp.value.trim();
      if (inp.getAttribute('data-mf') === 'grp' && r.note && r.note.indexOf('자동') >= 0) { r.note = ''; tr.classList.remove('auto'); $('[data-mf="note"]', tr).value = ''; const ck = $('.chk', tr); if (ck) ck.remove(); }
      saveSettings(); recompute(); renderBanners();
    }));
    $('[data-mdel]', tr).onclick = () => { const sn = snapshotCur(), r = CUR.map[i()]; CUR.map.splice(i(), 1); saveSettings(); recompute(); renderSettings(); renderBanners(); undoToast('「' + (r.src || '빈 줄') + '」 줄을 지웠습니다.', () => restoreCur(sn)); };
  });
}

/* ---------- 간단 사용법 ---------- */
function helpHtml() {
  return '<div class="card"><h2>내신 성적 분석 도우미 — 간단 사용법</h2>' +
    '<p>나이스에서 내려받은 <b>교과학습발달상황</b> 엑셀을 넣으면 반별 학생카드(학생당 3쪽)와 학년 전체 분석이 바로 만들어집니다. 준비물은 <b>크롬 또는 엣지</b> 하나뿐이고, 성적은 이 PC 밖으로 전송되지 않습니다.</p>' +
    neisPathHtml() +
    '<div class="roles">' +
    '<div class="role"><h4>A. 설정 담당 (학년부·정보부)</h4><ol><li><i data-ic="settings"></i>설정에서 판정 기준값과 교과군 매핑을 확인합니다.</li><li>필요하면 설정 양식(엑셀)에 적어 올립니다.</li><li>「<i data-ic="package"></i>배포본 만들기」로 성적 없는 HTML을 만들어 선생님들께 나눠 드립니다.</li></ol><button class="btn sm ghost noprint" data-act="goTab" data-tab="settings"><i data-ic="settings"></i>설정으로</button></div>' +
    '<div class="role"><h4>B. 담임 선생님</h4><ol><li>받은 HTML을 <b>내 폴더에 먼저 저장</b>한 뒤 엽니다.</li><li>「<i data-ic="save"></i>파일에 저장 연결」로 지금 연 그 파일을 고릅니다.</li><li><i data-ic="upload"></i>성적 올리기에 우리 반 나이스 파일을 끌어다 놓습니다.</li><li><i data-ic="class"></i>반 요약·<i data-ic="card"></i>학생카드에서 보고, 인쇄하거나 엑셀로 받습니다.</li></ol><button class="btn sm ghost noprint" data-act="goTab" data-tab="upload"><i data-ic="upload"></i>성적 올리기로</button></div>' +
    '<div class="role"><h4>C. 학년 분석 담당 (학년부장)</h4><ol><li>모든 반 나이스 파일을 한꺼번에 끌어다 놓습니다.</li><li><i data-ic="grade"></i>학년 분석에서 반별 비교·과목별 분석·유형별 명단을 봅니다.</li><li>「학년 전체 엑셀」과 「모든 반 엑셀」로 담임 선생님께 나눠 드립니다.</li></ol><button class="btn sm ghost noprint" data-act="goTab" data-tab="grade"><i data-ic="grade"></i>학년 분석으로</button></div>' +
    '</div>' +
    '<div class="must" style="margin-top:10px"><b>꼭 지켜 주세요</b><ul>' +
    '<li>한 파일은 <b>한 사람·한 창</b>에서만 씁니다. 같은 파일을 두 창에서 열면 저장이 엉킬 수 있습니다.</li>' +
    '<li>공용 PC에서 썼다면 마칠 때 「<i data-ic="lock"></i>백업·지우기 → 백업 받고 이 PC 기록 지우기」를 누릅니다.</li>' +
    '<li>학생 성적은 개인정보입니다. HTML 파일과 백업 엑셀은 암호화되지 않으니 보관·파기는 학교 개인정보 지침을 따릅니다.</li>' +
    '</ul></div>' +
    '<div class="move" style="margin-top:8px"><b>새 버전 파일을 받았을 때 (이사하듯 옮기기)</b><ol>' +
    '<li><b>짐 싸기</b>: 쓰던 파일에서 「<i data-ic="lock"></i>백업·지우기 → 엑셀로 백업만 받기」</li>' +
    '<li><b>짐 풀기</b>: 새 파일을 열고 「<i data-ic="lock"></i>백업·지우기 → 백업 파일로 되살리기」</li>' +
    '<li><b>새 집 열쇠</b>: 새 파일에서 「<i data-ic="save"></i>파일에 저장 연결」</li></ol></div>' +
    '<h3>이럴 땐 이렇게</h3><div class="tw"><table class="t"><tbody>' +
    '<tr><th class="l">성적 행을 찾지 못했다고 나와요</th><td>위 「나이스 파일 받는 법」 경로의 <b>XLS Data</b>로 받은 파일인지 확인합니다. 화면 캡처용 PDF·한글 파일은 읽을 수 없습니다.</td></tr>' +
    '<tr><th class="l">같은 반이 두 번 들어갔어요</th><td>같은 반 파일을 다시 올리면 「새 파일로 바꾸기」를 묻습니다. 성적이 두 번 더해지지 않습니다.</td></tr>' +
    '<tr><th class="l">교과군이 이상하게 묶여요</th><td><i data-ic="settings"></i>설정의 교과군 매핑에서 「확인 필요」 줄(자동 추가)을 알맞은 교과군으로 고칩니다.</td></tr>' +
    '<tr><th class="l">3학년(9등급) 자료예요</th><td>등급 체계는 자동으로 9등급이 됩니다. 판정 기준값의 9등급 칸을 학교 사정에 맞게 조정하세요.</td></tr>' +
    '<tr><th class="l">회의·연수에서 화면을 띄워요</th><td>위쪽 「보기」 메뉴에서 「이름 가리기」를 켜면 이름이 김○영처럼 보입니다(인쇄도 같음, 엑셀은 실명). 학생은 <i data-ic="search"></i>검색 칸에서 이름·번호로 바로 찾습니다.</td></tr>' +
    '<tr><th class="l">저장 연결 버튼이 안 돼요</th><td>크롬·엣지에서 열었는지, 메신저 첨부를 바로 연 것이 아닌지(내 폴더에 저장 후 열기) 확인합니다.</td></tr>' +
    '</tbody></table></div>' +
    '<div class="foot">내신 성적 분석 도우미 v' + APP_VERSION + ' (' + APP_DATE + ') · 새 버전·안내: ' + APP_REPO + ' · 이 파일은 어떤 서버와도 통신하지 않습니다 · 포함 라이브러리: ExcelJS (MIT, © Guyon Roche), SheetJS CE (Apache-2.0) — 전문은 HTML 파일 머리 주석에 있습니다.</div>' +
    '<div class="row noprint" style="margin-top:10px"><button class="btn ghost" id="helpPrint"><i data-ic="print"></i>A4 한 쪽으로 인쇄</button><button class="btn ghost" id="helpTour"><i data-ic="compass"></i>둘러보기 다시 보기</button></div></div>';
}
function renderHelp() {
  const root = $('#tab-help');
  root.innerHTML = '<div class="help">' + helpHtml() + '</div>';
  $('#helpTour', root).onclick = () => { window.scrollTo(0, 0); startTour(); };
  $('#helpPrint', root).onclick = () => { $('#printArea').innerHTML = '<div class="help help-print">' + helpHtml() + '</div>'; setTimeout(() => window.print(), 60); };
}
