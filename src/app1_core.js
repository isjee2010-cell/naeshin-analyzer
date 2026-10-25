/* ===== app1_core.js : 상수·유틸·파싱·분석·저장소 ===== */
'use strict';
const APP_ID = 'naeshin-analyzer';
const APP_NAME = '내신 성적 분석 도우미';
const APP_VERSION = '1.4';
const APP_DATE = '2026-10-25';
const APP_REPO = 'github.com/isjee2010-cell/naeshin-analyzer';
const LS_PREFIX = 'naeshinAnalyzer:';
const TYPES = ['학급내상위권', '상위권도약', '상위권하락', '상승형', '단일과목붕괴형', '전반하락형', '정체형', '일반형'];
const KIND_NAME = { 1: '교과', 2: '예체능', 3: '교양' };
function kindLabel(r) { return r.kind === 2 && String(r.gyo).indexOf('과학') >= 0 ? '과학탐구실험' : KIND_NAME[r.kind]; }

/* ---------- 유틸 ---------- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.from((r || document).querySelectorAll(s)); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function nz(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(t => t.text).join('').trim();
    if ('result' in v) return nz(v.result);
    if ('text' in v) return nz(v.text);
    if ('w' in v) return nz(v.w);
  }
  return String(v).trim();
}
function isNum(s) { return s !== '' && s != null && !isNaN(Number(String(s).replace(/,/g, ''))); }
/* VBA Val() : 앞쪽 숫자만 읽음, 없으면 0 */
function val(s) {
  const m = String(s == null ? '' : s).trim().replace(/,/g, '').match(/^[+-]?(\d+\.?\d*|\.\d+)/);
  return m ? parseFloat(m[0]) : 0;
}
/* VBA Round (은행가 반올림) */
function vround(x, d) {
  const p = Math.pow(10, d == null ? 2 : d), m = x * p, f = Math.floor(m), diff = m - f;
  let r;
  if (Math.abs(diff - 0.5) < 1e-9) r = (f % 2 === 0) ? f : f + 1;
  else r = Math.floor(m + 0.5);
  return r / p;
}
/* VBA Format(x,"0.00") 처럼 고정 소수 표기 */
function fx(x, d) {
  if (x === '' || x == null || isNaN(x)) return '';
  const p = Math.pow(10, d), neg = x < 0, a = Math.abs(x);
  const s = (Math.floor(a * p + 0.5 + 1e-9) / p).toFixed(d);
  return (neg && Number(s) !== 0 ? '-' : '') + s;
}
function gs(x) { return Number.isInteger(x) ? String(x) : String(x); }
function nowStamp() {
  const d = new Date(), z = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
}
function newId() { return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function sortTerms(a) {
  return a.slice().sort((x, y) => { const [h1, s1] = x.split('-').map(Number), [h2, s2] = y.split('-').map(Number); return h1 - h2 || s1 - s2; });
}
function termCmp(x, y) { const [h1, s1] = x.split('-').map(Number), [h2, s2] = y.split('-').map(Number); return (h1 - h2) || (s1 - s2); }
function termLabel(t) { const [h, s] = t.split('-'); return h + '학년 ' + s + '학기'; }
function koCount(n) { return ({ 1: '한', 2: '두', 3: '세', 4: '네', 5: '다섯', 6: '여섯' }[n] || n) + ' 학기'; }
function normKey(s) { return String(s || '').replace(/\s+/g, '').replace(/Ⅰ/g, '1').replace(/Ⅱ/g, '2').replace(/Ⅲ/g, '3'); }

/* ---------- 설정 기본값 ---------- */
const SET_DEF = [
  { k: 'collapse', label: '붕괴기준', unit: '등급', v5: 1.5, v9: 2.5, desc: "특정 교과군이 본인 전체 평균보다 이 값 이상 낮으면 '단일과목붕괴형'" },
  { k: 'drop', label: '하락기준', unit: '등급', v5: 0.7, v9: 1.2, desc: "기준선(직전 학년 평균) 대비 최근 학기 평균이 이 값 이상 나빠지면 '전반하락형'" },
  { k: 'rise', label: '상승기준', unit: '등급', v5: 0.5, v9: 0.8, desc: "기준선 대비 최근 학기 평균이 이 값 이상 좋아지면 '상승형'" },
  { k: 'flat', label: '정체기준', unit: '등급', v5: 0.3, v9: 0.5, desc: "기준선과 최근 학기 차이가 이 값 이내면 '정체형' 후보" },
  { k: 'midLine', label: '정체형하한등급', unit: '등급', v5: 3, v9: 5, desc: '정체형은 최근 학기 평균이 이 값 이상(등급 숫자가 클 때)일 때만 판정' },
  { k: 'topAvg', label: '상위형기준', unit: '등급', v5: 2, v9: 3, desc: "모든 학기 평균이 이 값 이내면 '학급내상위권'" },
  { k: 'minN', label: '과목최소표본', unit: '명', v5: 20, v9: 20, desc: '수강자수가 이 값 미만인 과목은 과목별 분석에서 노란색으로 표시(해석 주의)' },
  { k: 'crNext', label: '다음학기예상학점', unit: '학점', v5: 0, v9: 0, desc: '다음 학기 목표 등급 계산에 쓰는 예상 이수학점. 0이면 최근 학기와 같다고 가정' },
  { k: 'trSmall', label: '추이소폭기준', unit: '등급', v5: 0.2, v9: 0.3, desc: "학기별 추이에서 '소폭 상승·하락'과 '상승·하락'을 가르는 값" },
  { k: 'trBig', label: '추이대폭기준', unit: '등급', v5: 0.5, v9: 0.8, desc: "학기별 추이에서 '큰 폭 상승·하락'으로 분류하는 값" }
];
const SET_ALIAS = { '2학년2학기예상학점': 'crNext', '다음학기예상학점': 'crNext' };
const MAP_DEF = [
  ['국어', '국어', ''], ['수학', '수학', ''], ['영어', '영어', ''],
  ['사회(역사/도덕포함)', '사회', ''], ['사회', '사회', ''], ['과학', '과학', ''],
  ['기술·가정/정보', '기술·정보', ''], ['기술·가정', '기술·정보', ''], ['정보', '기술·정보', ''],
  ['제2외국어/한문', '제2외국어·한문', ''], ['제2외국어', '제2외국어·한문', ''], ['한문', '제2외국어·한문', ''],
  ['체육', '체육', '예체능 - 등급 산출 제외'], ['예술', '예술', '예체능 - 등급 산출 제외'], ['교양', '교양', 'P 과목 - 등급 산출 제외']
];
function defaultCur() {
  const s5 = {}, s9 = {};
  SET_DEF.forEach(d => { s5[d.k] = d.v5; s9[d.k] = d.v9; });
  return { v: 1, s5, s9, map: MAP_DEF.map(r => ({ src: r[0], grp: r[1], note: r[2] })), scaleMode: 'auto', termMode: 'auto', updatedAt: 0 };
}
function emptyDb(fileId) { return { v: 1, fileId: fileId || newId(), updatedAt: 0, classes: {}, tomb: {}, demo: false }; }

/* ---------- 나이스 원본 파싱 (원본 VBA ParseFile 이식 + 머리글 인식) ---------- */
function extractBanNo(t) {
  const p = t.indexOf('반'); if (p < 0) return 0;
  let d = '';
  for (let i = p - 1; i >= 0; i--) { const c = t[i]; if (c >= '0' && c <= '9') d = c + d; else if (d) break; }
  return d ? Number(d) : 0;
}
function cleanBan(t) {
  const m = String(t).match(/(\d+)\s*학년\s*(\d+)\s*반/);
  return m ? (m[1] + '학년 ' + m[2] + '반') : String(t).trim();
}
function baseName(n) { return String(n || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, ''); }
const DEF_COLS1 = { no: 0, name: 1, hak: 2, sem: 3, gyo: 4, sub: 5, cr: 6, score: 7, ach: 8, rank: 10, cnt: 11 };
const DEF_COLS2 = { no: 0, name: 1, hak: 2, sem: 3, gyo: 4, sub: 5, cr: 6, ach: 7 };
function headerCols(row) {
  const cells = row.map(c => nz(c).replace(/\s+/g, ''));
  const idx = (f) => cells.findIndex(f);
  const sub = idx(c => c === '과목' || c === '과목명');
  if (sub < 0) return null;
  const cr = idx(c => /^(학점|단위|단위수|학점수|이수학점|이수단위)$/.test(c));
  if (cr < 0) return null;
  const o = { sub, cr };
  const put = (k, f) => { const i = idx(f); if (i >= 0) o[k] = i; };
  put('no', c => c === '번호');
  put('name', c => c === '성명' || c === '이름');
  put('hak', c => c === '학년');
  put('sem', c => c === '학기');
  put('gyo', c => c === '교과' || c === '교과명');
  put('score', c => c.indexOf('원점수') === 0);
  put('ach', c => c.indexOf('성취도') === 0 && c.indexOf('성취도별') < 0);
  if (o.ach == null) put('ach', c => c === '이수여부' || c === '평가');
  put('rank', c => c.indexOf('석차등급') === 0);
  put('cnt', c => c.indexOf('수강자수') === 0);
  return o;
}
/* aoa : 2차원 배열(첫 시트), fileName : 반 표기 대체용 */
function parseNeis(aoa, fileName) {
  let banRaw = '';
  for (let i = 0; i < Math.min(6, aoa.length) && !banRaw; i++) {
    for (let p = 0; p < 4; p++) {
      const a = nz((aoa[i] || [])[p]);
      if (a.indexOf('반') >= 0 && a.indexOf('학년') >= 0) { banRaw = a; break; }
    }
  }
  if (!banRaw) banRaw = baseName(fileName);
  const ban = cleanBan(banRaw), banNo = extractBanNo(banRaw);
  const gm = String(banRaw).match(/(\d+)\s*학년\s*\d+\s*반/);
  let cols = Object.assign({}, DEF_COLS1), mode = 1;
  let curNo = '', curName = '', curHak = '', curSem = '';
  const stu = {}, rows = [], warn = [];
  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i] || [];
    const a = nz(row[0]);
    if (a.indexOf('체육') >= 0 && a.indexOf('예술') >= 0) { mode = 2; cols = Object.assign({}, DEF_COLS2); curNo = curName = curHak = curSem = ''; continue; }
    if (a.indexOf('교양교과') >= 0) { mode = 3; cols = Object.assign({}, DEF_COLS2); curNo = curName = curHak = curSem = ''; continue; }
    const hc = headerCols(row);
    if (hc) { cols = Object.assign({}, mode === 1 ? DEF_COLS1 : DEF_COLS2, hc); continue; }
    if (a.indexOf('번') >= 0 && a.indexOf('호') >= 0 && a.length <= 5) continue;
    if (a.indexOf('이수학점') >= 0 || a.indexOf('이수단위') >= 0) continue;
    const g = k => cols[k] == null ? '' : nz(row[cols[k]]);
    const an = g('no');
    if (an !== '' && isNum(an.replace(/\s/g, ''))) curNo = an.replace(/\s/g, '');
    let b = g('name'); if (b) curName = b.replace(/\s/g, '');
    b = g('hak'); if (b) curHak = b;
    b = g('sem'); if (b) curSem = b;
    const gyo = g('gyo'), sub = g('sub');
    if (!sub || !curName) continue;
    const no = Math.round(val(curNo)), hak = Math.round(val(curHak)), sem = Math.round(val(curSem));
    if (!hak || !sem) { warn.push((i + 1) + '행: 학년·학기를 읽지 못했습니다'); continue; }
    if (!stu[no]) stu[no] = curName;
    const cr = val(g('cr'));
    let score = '', avg = '', ach = '', rank = '', cnt = '';
    if (mode === 1) {
      const s = g('score'), p = s.indexOf('/');
      if (p >= 0) { score = val(s.slice(0, p)); avg = val(s.slice(p + 1)); }
      ach = g('ach');
      const am = ach.match(/^([A-EP])\s*\((\d+)\)$/);
      if (am) { ach = am[1]; if (cols.cnt == null || g('cnt') === '') cnt = Number(am[2]); }
      const rk = g('rank');
      rank = (rk !== '' && isNum(rk)) ? val(rk) : '';
      if (cnt === '') cnt = val(g('cnt'));
    } else {
      ach = g('ach');
    }
    rows.push([no, hak, sem, gyo, sub, cr, score, avg, ach, rank, cnt, mode]);
  }
  return { ban, banRaw, banNo, grade: gm ? Number(gm[1]) : 0, stu, rows, warn, fileName: String(fileName || '') };
}
function classKey(c) { return normKey(c.ban); }
function classSig(c) { return hashStr(JSON.stringify([c.stu, c.rows])); }

/* ---------- 분석 모델 ---------- */
/* 사용자가 넣은 글자(교과명 등)를 키로 쓰는 사전은 프로토타입 없는 객체로 만든다 (「__proto__」 같은 이름 대비) */
function dict() { return Object.create(null); }
const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
function safeKey(k) { return typeof k === 'string' && BAD_KEYS.indexOf(k) < 0; }
function validClass(c) { return !!c && typeof c === 'object' && typeof c.ban === 'string' && Array.isArray(c.rows) && !!c.stu && typeof c.stu === 'object' && c.rows.every(r => Array.isArray(r)); }
function mapLookup(cur) {
  const m = dict();
  (cur.map || []).forEach(r => { if (r.src) m[normKey(r.src)] = r.grp || r.src; });
  return m;
}
function classGrade(c) {
  if (c.grade) return c.grade;
  let mx = 0; c.rows.forEach(r => { if (r[1] > mx) mx = r[1]; });
  return mx;
}
/* 학년별로 묶은 분석 모델 */
function buildModels(db, cur) {
  const mp = mapLookup(cur);
  const byG = {};
  Object.values(db.classes).forEach(c => { const g = classGrade(c); (byG[g] = byG[g] || []).push(c); });
  const models = {};
  Object.keys(byG).forEach(g => { models[g] = buildModel(byG[g], cur, mp, Number(g)); });
  return models;
}
function buildModel(classes, cur, mp, grade) {
  classes = classes.slice().sort((a, b) => (a.banNo - b.banNo) || a.ban.localeCompare(b.ban));
  const recs = [];
  let maxRank = 0;
  const unmapped = dict();
  classes.forEach(c => {
    const ck = classKey(c);
    c.rows.forEach(r => {
      const [no, hak, sem, gyo, sub, cr, score, avg, ach, rank, cnt, kind] = r;
      let grp;
      if (kind === 1) {
        grp = mp[normKey(gyo)];
        if (grp == null) { grp = gyo; unmapped[gyo] = 1; }
      } else grp = gyo;
      if (rank !== '' && rank > maxRank) maxRank = rank;
      recs.push({ ck, ban: c.ban, banNo: c.banNo, no, name: c.stu[no] || String(no), hak, sem, term: hak + '-' + sem, gyo, sub, cr, score, avg, ach, rank, cnt, kind, grp,
        dev: (score !== '' && avg !== '') ? score - avg : '' });
    });
  });
  const scale = cur.scaleMode === '5' ? 5 : cur.scaleMode === '9' ? 9 : (maxRank > 5 ? 9 : 5);
  const S = Object.assign({}, scale === 9 ? cur.s9 : cur.s5);
  const termsAll = sortTerms(Array.from(new Set(recs.filter(r => r.kind === 1 && r.rank !== '').map(r => r.term))));
  let curTerm = termsAll[termsAll.length - 1] || '';
  if (cur.termMode && cur.termMode !== 'auto' && termsAll.indexOf(cur.termMode) >= 0) curTerm = cur.termMode;
  const terms = curTerm ? termsAll.filter(t => termCmp(t, curTerm) <= 0) : [];
  const useRecs = curTerm ? recs.filter(r => termCmp(r.term, curTerm) <= 0) : recs;
  const ctx = makeCtx(terms, curTerm, scale);
  const studs = [];
  const idx = dict();
  useRecs.forEach(r => {
    const k = r.ck + '#' + r.no;
    if (!idx[k]) { idx[k] = { key: k, ck: r.ck, ban: r.ban, banNo: r.banNo, no: r.no, name: r.name, R: [] }; studs.push(idx[k]); }
    idx[k].R.push(r);
  });
  studs.forEach(s => analyzeStudent(s, ctx, S));
  return { grade, classes, recs: useRecs, recsAll: recs, scale, S, termsAll, terms, curTerm, ctx, studs, unmapped: Object.keys(unmapped), maxRank };
}
/* 기준선·다음 학기 등 학기 문맥 */
function makeCtx(terms, curTerm, scale) {
  const ctx = { terms, curTerm, scale, curLabel: curTerm ? termLabel(curTerm) : '' };
  if (!curTerm) return ctx;
  const [H, Sm] = curTerm.split('-').map(Number);
  ctx.H = H; ctx.Sm = Sm;
  /* 판정 기준선 : 직전 학년 평균(원본의 '1학년 평균'), 1학년 2학기 시점이면 1-1 */
  if (H >= 2) { ctx.base = { hak: H - 1 }; ctx.baseLabel = (H - 1) + '학년 평균'; }
  else if (Sm === 2) { ctx.base = { term: '1-1' }; ctx.baseLabel = '1학년 1학기'; }
  else { ctx.base = null; ctx.baseLabel = ''; }
  /* 다음 학기 목표 */
  if (Sm === 1) { ctx.next = H + '-2'; ctx.tYear = H; }
  else if (H < 3) { ctx.next = (H + 1) + '-1'; ctx.tYear = H + 1; }
  else { ctx.next = ''; }
  if (ctx.next) {
    ctx.nextLabel = termLabel(ctx.next);
    ctx.nextShort = ctx.next;
    if (ctx.tYear >= 2) { ctx.tBase = { hak: ctx.tYear - 1 }; ctx.tBaseLabel = (ctx.tYear - 1) + '학년 평균'; }
    else ctx.tBase = null;
    ctx.tYearLabel = ctx.tYear + '학년 평균';
  }
  return ctx;
}
function wavg(R, f) {
  let sc = 0, sr = 0;
  for (const r of R) {
    if (r.kind !== 1 || r.rank === '') continue;
    if (f.term && r.term !== f.term) continue;
    if (f.grp != null && f.grp !== '' && r.grp !== f.grp) continue;
    if (f.hak && r.hak !== f.hak) continue;
    if (f.sem && r.sem !== f.sem) continue;
    sc += r.cr; sr += r.cr * r.rank;
  }
  return sc === 0 ? '' : vround(sr / sc, 2);
}
function creditSel(R, f) {
  let sc = 0;
  for (const r of R) {
    if (r.kind !== 1 || r.rank === '') continue;
    if (f.term && r.term !== f.term) continue;
    if (f.hak && r.hak !== f.hak) continue;
    if (f.sem && r.sem !== f.sem) continue;
    sc += r.cr;
  }
  return sc;
}
function termCredit(R, t) { let s = 0; R.forEach(r => { if (r.term === t && r.kind === 1) s += r.cr; }); return s === 0 ? '' : s; }
function analyzeStudent(s, ctx, S) {
  const R = s.R;
  s.tv = ctx.terms.map(t => wavg(R, { term: t }));
  s.overall = wavg(R, {});
  s.base = ctx.base ? wavg(R, ctx.base) : '';
  s.curAvg = ctx.curTerm ? wavg(R, { term: ctx.curTerm }) : '';
  s.diff = (s.base !== '' && s.curAvg !== '') ? vround(s.curAvg - s.base, 2) : '';
  const grps = [];
  R.forEach(r => { if (r.kind === 1 && grps.indexOf(r.grp) < 0) grps.push(r.grp); });
  s.groups = grps.map(g => {
    const tv = ctx.terms.map(t => wavg(R, { term: t, grp: g }));
    const all = wavg(R, { grp: g });
    const gap = (all !== '' && s.overall !== '') ? all - s.overall : '';
    return { g, tv, all, gap };
  });
  let wg = '', wgap = -99, bg = '', bgap = 99;
  s.groups.forEach(o => { if (o.gap !== '') { if (o.gap > wgap) { wgap = o.gap; wg = o.g; } if (o.gap < bgap) { bgap = o.gap; bg = o.g; } } });
  s.worst = wg; s.worstGap = wgap; s.best = bg; s.bestGap = bgap;
  const c = classify(s, ctx, S);
  s.type = c[0]; s.why = c[1];
  s.target = targetGrade(s, ctx, S);
  s.ach = ctx.terms.map(t => 'ABCDE'.split('').map(L => R.filter(r => r.kind === 1 && r.term === t && r.ach === L).length));
  s.achAll = 'ABCDE'.split('').map(L => R.filter(r => r.kind === 1 && r.ach === L).length);
}
/* 원본 ClassifyType 이식 (학기 수·기준선 일반화) */
function classify(s, ctx, S) {
  const tv = s.tv, a3 = s.curAvg;
  const first = tv.length ? tv[0] : '';
  const base = s.base !== '' ? s.base : first;
  const baseLabel = s.base !== '' ? ctx.baseLabel : (ctx.terms[0] ? termLabel(ctx.terms[0]) : '');
  const hasAll = base !== '' && a3 !== '';
  const d = hasAll ? a3 - base : 0;
  const T = S.topAvg, n = tv.length;
  if (n && tv.every(x => x !== '')) {
    if (tv.every(x => x <= T)) {
      if (d >= S.drop) return ['상위권하락', koCount(n) + ' 모두 평균 ' + gs(T) + '등급 이내이나, ' + baseLabel + ' ' + fx(base, 2) + '등급에서 ' + ctx.curLabel + ' ' + fx(a3, 2) + '등급으로 ' + fx(d, 1) + '등급 내려옴'];
      if (d <= -S.rise) return ['학급내상위권', koCount(n) + ' 모두 평균 ' + gs(T) + '등급 이내이며, ' + baseLabel + ' 대비 ' + fx(Math.abs(d), 1) + '등급 올라선 상태임'];
      return ['학급내상위권', koCount(n) + ' 모두 평균 ' + gs(T) + '등급 이내를 유지하고 있음'];
    }
  }
  if (base !== '' && a3 !== '') {
    if (base > T && a3 <= T) return ['상위권도약', baseLabel + ' ' + fx(base, 2) + '등급에서 ' + ctx.curLabel + ' ' + fx(a3, 2) + '등급으로 올라 상위권(' + gs(T) + '등급 이내)에 진입'];
  }
  if (s.worst && s.worstGap >= S.collapse) return ['단일과목붕괴형', s.worst + ' 교과군이 전체 평균보다 ' + fx(s.worstGap, 1) + '등급 낮음'];
  if (hasAll) {
    if (d >= S.drop) return ['전반하락형', baseLabel + ' 대비 ' + fx(d, 1) + '등급 하락'];
    if (d <= -S.rise) return ['상승형', baseLabel + ' 대비 ' + fx(Math.abs(d), 1) + '등급 상승'];
    if (Math.abs(d) <= S.flat && a3 >= S.midLine) return ['정체형', baseLabel + ' 대비 변동이 ' + fx(Math.abs(d), 1) + '등급 이내로 거의 없음'];
  }
  return ['일반형', '뚜렷한 특이 패턴이 관찰되지 않음'];
}
/* 원본 TargetGrade 이식 : 다음 학기 목표 등급 */
function targetGrade(s, ctx, S) {
  const o = { need: '', verdict: '', B: '', gSo: '', crSo: 0 };
  if (!ctx.next) { o.verdict = '다음 학기 없음'; o.comment = '마지막 학기까지의 자료라 다음 학기 목표 등급은 계산하지 않습니다.'; return o; }
  const R = s.R;
  o.B = ctx.tBase ? wavg(R, ctx.tBase) : '';
  const sameYear = ctx.next.split('-')[1] === '2';
  if (sameYear) {
    o.gSo = wavg(R, { hak: ctx.tYear, sem: 1 });
    o.crSo = creditSel(R, { hak: ctx.tYear, sem: 1 });
    const crNext = S.crNext > 0 ? S.crNext : o.crSo;
    if (o.B === '' || o.gSo === '' || o.crSo === 0 || crNext === 0) { o.verdict = '자료 부족'; }
    else {
      let need = (o.B * (o.crSo + crNext) - o.crSo * o.gSo) / crNext;
      need = Math.floor(need * 100 + 1e-9) / 100;
      setVerdict(o, need, ctx.scale);
    }
  } else {
    if (o.B === '') o.verdict = '자료 부족';
    else setVerdict(o, Math.floor(o.B * 100 + 1e-9) / 100, ctx.scale);
  }
  o.comment = targetComment(o, ctx, sameYear);
  return o;
}
function setVerdict(o, need, scale) {
  if (need < 1) { o.need = ''; o.verdict = '이번 학기만으로는 도달 불가'; }
  else if (need >= scale) { o.need = fx(need, 2); o.verdict = '현 수준 유지로 달성'; }
  else { o.need = fx(need, 2); o.verdict = fx(need, 2) + '등급 이내 필요'; }
}
function targetComment(o, ctx, sameYear) {
  const nL = ctx.nextLabel, bL = ctx.tBaseLabel || '기준 학년 평균';
  if (o.B === '' || (sameYear && o.gSo === '')) return (sameYear ? bL.replace(' 평균', '') + ' 또는 ' + termLabel(ctx.tYear + '-1') : bL.replace(' 평균', '')) + ' 등급 자료가 부족해 목표를 산출할 수 없습니다.';
  if (!sameYear) {
    return ctx.nextLabel + '에 학점가중 평균 ' + o.need + '등급 이내를 받으면 ' + ctx.tYear + '학년 출발이 ' + bL + '보다 좋아집니다. ' +
      '새 학년 첫 학기는 과목이 바뀌는 시기이므로, 약한 교과군을 미리 정해 방학 동안 준비하도록 안내하세요.';
  }
  const g1L = termLabel(ctx.tYear + '-1');
  const d = o.gSo - o.B;
  if (o.verdict === '이번 학기만으로는 도달 불가') {
    return g1L + ' 성적이 ' + bL + '보다 ' + fx(Math.abs(d), 2) + '등급 낮아, ' + nL + ' 성적만으로는 ' + bL + '을 회복하기 어렵습니다. ' +
      '회복보다는 하락 폭을 줄이는 것을 목표로 잡고, 과목 수를 좁혀 접근하는 편이 현실적입니다.';
  }
  if (o.verdict === '현 수준 유지로 달성') {
    return g1L + ' 성적이 이미 ' + bL + '보다 ' + fx(Math.abs(d), 2) + '등급 좋습니다. ' + nL + '에 큰 하락만 없으면 ' + ctx.tYearLabel + '이 ' + bL + '을 앞섭니다. ' +
      '현재 학습 방식을 유지하는 것이 목표입니다.';
  }
  if (d > 0) {
    return g1L + '에 ' + bL + '보다 ' + fx(d, 2) + '등급 밀렸습니다. ' + nL + '에 학점가중 평균 ' + o.need + '등급 이내를 받으면 ' + ctx.tYearLabel + '이 ' + bL + '을 회복합니다. ' +
      '이 숫자를 학생과 공유하고, 어느 과목에서 몇 등급을 끌어올릴지 함께 배분해 보세요.';
  }
  return g1L + '가 ' + bL + '보다 ' + fx(Math.abs(d), 2) + '등급 앞서 있습니다. ' + nL + '에 ' + o.need + '등급 이내를 유지하면 우위가 지켜집니다.';
}
function trendBand(d, S) {
  if (d <= -S.trBig) return '큰 폭 상승';
  if (d <= -S.trSmall) return '상승';
  if (d <= 0) return '소폭 상승';
  if (d < S.trSmall) return '소폭 하락';
  if (d < S.trBig) return '하락';
  return '큰 폭 하락';
}
const BANDS = ['큰 폭 상승', '상승', '소폭 상승', '소폭 하락', '하락', '큰 폭 하락'];
function bandCrit(S) {
  return [S.trBig + '등급 이상 상승', S.trSmall + ' ~ ' + S.trBig + '등급 상승', S.trSmall + '등급 미만 상승',
    S.trSmall + '등급 미만 하락', S.trSmall + ' ~ ' + S.trBig + '등급 하락', S.trBig + '등급 이상 하락'];
}
/* 종합 진단 문장 : 판정과 같은 기준선·설정값을 씀 */
function makeDiagnosis(s, ctx, S, nameOverride) {
  if (s.overall === '') return '산출 가능한 석차등급 자료가 부족합니다.';
  let t = (nameOverride != null ? nameOverride : s.name) + ' 학생의 ' + ctx.terms.length + '개 학기 전체 평균등급은 ' + fx(s.overall, 2) + '등급입니다. ';
  const base = s.base !== '' ? s.base : (s.tv.length ? s.tv[0] : '');
  const bL = s.base !== '' ? ctx.baseLabel : (ctx.terms[0] ? termLabel(ctx.terms[0]) : '');
  if (base !== '' && s.curAvg !== '' && ctx.terms.length > 1) {
    const d = s.curAvg - base;
    if (d <= -S.rise) t += bL + ' ' + fx(base, 2) + '등급에서 ' + ctx.curLabel + ' ' + fx(s.curAvg, 2) + '등급으로 뚜렷하게 올라섰습니다. 상승 흐름을 유지하는 것이 이번 학기 과제입니다.';
    else if (d >= S.drop) t += bL + ' ' + fx(base, 2) + '등급에서 ' + ctx.curLabel + ' ' + fx(s.curAvg, 2) + '등급으로 내려왔습니다. 하락이 언제부터 시작됐는지 학생과 함께 짚어볼 필요가 있습니다.';
    else t += bL + ' 대비 큰 변동 없이 비슷한 수준을 유지하고 있습니다. 현재 방식으로는 변화가 크지 않을 가능성이 있습니다.';
  }
  return t;
}
function prescription(t) {
  switch (t) {
    case '학급내상위권': return "성적대 자체는 상위권이므로 학습법을 흔들기보다 심화 활동과 세특 소재 확보에 시간을 쓰도록 안내. 다만 판정 근거에 '내려오는 중'이라고 적힌 학생은 상위권이라는 이유로 넘기지 말고, 어느 과목에서 밀렸는지 먼저 확인할 것. 남은 학기 선택과목을 진로와 연결해 미리 설계하도록 개별 면담 1회 권장.";
    case '상위권하락': return '성적대는 아직 상위권이지만 방향이 아래로 향하고 있어 조기 개입이 필요. 중하위권 하락과 원인이 다른 경우가 많음. 학습량 부족보다 과목 난도 상승, 선택과목 부적합, 번아웃, 경쟁 심화 중 무엇인지 먼저 구분할 것. 학생이 하락을 스스로 인지하고 있는지 확인하는 것이 첫 질문.';
    case '상위권도약': return '짧은 기간에 상위권으로 올라선 사례로, 무엇을 바꿔서 올랐는지 학생 스스로 말로 정리하게 할 것. 이 학생의 방법은 같은 반 다른 학생에게도 참고가 됨. 상위권 유지는 진입보다 어려우므로 남은 학기 선택과목 설계와 세특 소재 확보를 지금부터 시작하도록 안내.';
    case '상승형': return "상승 원인을 학생 스스로 말로 정리하게 하는 것이 핵심. '무엇을 바꿔서 올랐는지' 확인하고 그 방법을 취약 과목으로 확장하도록 지도. 과도한 목표 상향은 지양.";
    case '단일과목붕괴형': return '전반 학습습관 문제가 아니므로 생활 지도보다 과목 특정 개입이 효과적. 해당 교과 담당 선생님과 학생 상태 공유, 결손 지점(어느 단원부터인지) 확인 후 보충 계획 수립.';
    case '전반하락형': return '학습법보다 생활·정서 요인 점검이 먼저. 수면, 스마트폰, 교우관계, 가정 상황을 면담에서 확인. 과목 수를 늘리지 말고 1~2과목만 목표로 좁혀 성공 경험을 만들 것. 2주 간격 짧은 면담 권장.';
    case '정체형': return '노력량이 아니라 학습 방법 자체를 점검할 시점. 오답 관리 방식, 시험 준비 시작 시점, 인출 연습 여부를 구체적으로 확인. 같은 방식의 반복은 같은 결과로 이어짐을 학생과 공유.';
    default: return '특이 패턴이 없어 정기 면담으로 관리. 학생 스스로 느끼는 어려움 과목을 먼저 듣고, 교과군 프로파일과 학생의 체감이 일치하는지 확인.';
  }
}
function groupComment(g) {
  if (g.indexOf('국어') >= 0) return '지문 독해 속도와 근거 찾기 훈련. 문학은 작품 정리, 독서는 배경지식 확장이 축.';
  if (g.indexOf('수학') >= 0) return '결손 단원 역추적이 우선. 문제량보다 오답 재풀이 주기 확보가 성적 변화를 만듦.';
  if (g.indexOf('영어') >= 0) return '어휘량과 구문 분석이 기초. 교과서 지문 반복 정독으로 내신 대비 가능.';
  if (g.indexOf('사회') >= 0 || g.indexOf('역사') >= 0) return '개념 간 관계 정리(흐름·인과)가 핵심. 단순 암기보다 구조화 노트가 효과적.';
  if (g.indexOf('과학') >= 0) return '개념 이해 후 문제 적용 단계에서 막히는 경우가 많음. 실험·그래프 해석 연습 병행.';
  if (g.indexOf('정보') >= 0 || g.indexOf('기술') >= 0) return '수행평가 비중을 먼저 확인. 실습 과제 완성도 관리가 성적에 직접 반영됨.';
  return '해당 교과 담당 선생님과 학습 상태를 공유해 구체적 지도 방향을 잡을 것.';
}

/* ---------- 학년 단위 집계 (원본 매크로2 이식) ---------- */
function gradeStats(M) {
  const st = M.studs, nT = M.terms.length;
  const termAvg = M.terms.map((t, i) => { let s = 0, c = 0; st.forEach(x => { if (x.tv[i] !== '') { s += x.tv[i]; c++; } }); return { n: c, avg: c ? vround(s / c, 2) : '' }; });
  const typeCnt = TYPES.map(t => st.filter(x => x.type === t).length);
  /* 반별 비교 */
  const bans = M.classes.map(c => {
    const ck = classKey(c), xs = st.filter(x => x.ck === ck);
    const mean = arr => { let s = 0, n = 0; arr.forEach(v => { if (v !== '') { s += v; n++; } }); return { s, n }; };
    const tm = M.terms.map((t, i) => mean(xs.map(x => x.tv[i])));
    const bm = mean(xs.map(x => x.base)), cm = mean(xs.map(x => x.curAvg));
    const tavg = tm.map(o => o.n ? vround(o.s / o.n, 2) : '');
    const deltas = [];
    for (let i = 1; i < nT; i++) deltas.push((tm[i - 1].n && tm[i].n) ? vround(tm[i].s / tm[i].n - tm[i - 1].s / tm[i - 1].n, 2) : '');
    return { ban: c.ban, ck, n: xs.length, nBase: bm.n, tavg, deltas,
      base: bm.n ? vround(bm.s / bm.n, 2) : '', cur: cm.n ? vround(cm.s / cm.n, 2) : '',
      diff: (bm.n && cm.n) ? vround(cm.s / cm.n - bm.s / bm.n, 2) : '' };
  });
  /* 반별 교과군 평균 : 석차등급이 있는 교과군만 */
  const grps = [];
  M.recs.forEach(r => { if (r.kind === 1 && r.rank !== '' && grps.indexOf(r.grp) < 0 && grps.length < 20) grps.push(r.grp); });
  const banGrp = M.classes.map(c => {
    const ck = classKey(c);
    return { ban: c.ban, v: grps.map(g => { let s = 0, n = 0; st.forEach(x => { if (x.ck === ck) { const o = x.groups.find(y => y.g === g); if (o && o.all !== '') { s += o.all; n++; } } }); return n ? vround(s / n, 2) : ''; }) };
  });
  /* 과목별 분석 */
  const subs = [], sIdx = dict();
  M.recs.forEach(r => {
    if (r.kind !== 1) return;
    const k = r.sub + '\u0001' + r.term;
    let o = sIdx[k];
    if (!o) { o = sIdx[k] = { sub: r.sub, term: r.term, grp: r.grp, my: 0, ssum: 0, sc: 0, avg: 0, cnt: 0, gd: new Array(M.scale).fill(0) }; subs.push(o); }
    o.my++;
    if (r.score !== '') { o.ssum += r.score; o.sc++; }
    if (r.avg !== '') o.avg = r.avg;
    if (r.cnt !== '' && r.cnt > 0) o.cnt = r.cnt;
    if (r.rank !== '') { const k2 = Math.round(r.rank); if (k2 >= 1 && k2 <= M.scale) o.gd[k2 - 1]++; }
  });
  subs.forEach(o => { o.mean = o.sc ? vround(o.ssum / o.sc, 1) : ''; o.small = o.cnt > 0 && o.cnt < M.S.minN; });
  subs.sort((a, b) => termCmp(a.term, b.term));
  /* 유형별 명단 (전체 평균 오름차순) */
  const typeLists = TYPES.map(t => st.filter(x => x.type === t).slice().sort((a, b) => (a.overall === '' ? 99 : a.overall) - (b.overall === '' ? 99 : b.overall)));
  /* 학기별 평균등급대 분포 */
  const dist = M.terms.map((t, i) => { const d = new Array(M.scale).fill(0); let tot = 0; st.forEach(x => { const v = x.tv[i]; if (v !== '') { let b = Math.floor(v); if (b < 1) b = 1; if (b > M.scale) b = M.scale; d[b - 1]++; tot++; } }); return { d, tot }; });
  /* 기준선 → 최근 학기 변화 구간 */
  const bandList = BANDS.map(() => []);
  let bandTot = 0;
  st.forEach(x => { if (x.base !== '' && x.curAvg !== '') { const d = x.curAvg - x.base; bandList[BANDS.indexOf(trendBand(d, M.S))].push({ x, d }); bandTot++; } });
  return { termAvg, typeCnt, bans, grps, banGrp, subs, typeLists, dist, bandList, bandTot };
}

/* ---------- DB 조작 ---------- */
function addClassToDb(db, c) {
  const k = classKey(c);
  c.loadedAt = Date.now();
  c.sig = classSig(c);
  db.classes[k] = c;
  delete db.tomb[k];
}
function removeClassFromDb(db, k) {
  delete db.classes[k];
  db.tomb[k] = Date.now();
}
/* 기록 합치기 : 반 단위, 최신 우선, 삭제 표시 반영, 내용 서명으로 중복 거르기 */
function mergeDb(dst, src) {
  const res = { added: 0, updated: 0, same: 0, older: 0, removed: 0, bad: 0 };
  Object.keys(src.tomb || {}).forEach(k => {
    const t = src.tomb[k];
    if (!safeKey(k) || typeof t !== 'number') return;
    if (dst.classes[k] && (dst.classes[k].loadedAt || 0) < t) { delete dst.classes[k]; dst.tomb[k] = t; res.removed++; }
    else if (!dst.classes[k] && (dst.tomb[k] || 0) < t) dst.tomb[k] = t;
  });
  Object.keys(src.classes || {}).forEach(k => {
    const c = src.classes[k];
    if (!safeKey(k) || !validClass(c)) { res.bad++; return; }
    const d = Object.prototype.hasOwnProperty.call(dst.classes, k) ? dst.classes[k] : null;
    if ((dst.tomb[k] || 0) > (c.loadedAt || 0)) { res.older++; return; }
    if (!d) { dst.classes[k] = c; delete dst.tomb[k]; res.added++; return; }
    if ((d.sig || classSig(d)) === (c.sig || classSig(c))) { res.same++; return; }
    if ((c.loadedAt || 0) > (d.loadedAt || 0)) { dst.classes[k] = c; res.updated++; } else res.older++;
  });
  return res;
}
function dbCounts(db) {
  let ns = 0, nr = 0;
  Object.values(db.classes).forEach(c => { ns += Object.keys(c.stu).length; nr += c.rows.length; });
  return { nc: Object.keys(db.classes).length, ns, nr };
}

/* ---------- 저장소 (HTML 자체 저장 + A안 + 동시 사용 보호) ---------- */
const ST = { handle: null, lastWriteMod: 0, dirty: false, timer: null, saving: false, warnedConcurrent: false, stopped: false, template: '' };
function readJsonBlock(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch (e) { return null; }
}
function lsKey() { return LS_PREFIX + DB.fileId; }
function lsHas() { try { return !!localStorage.getItem(lsKey()); } catch (e) { return false; } }
function lsWrite() {
  try { localStorage.setItem(lsKey(), JSON.stringify({ db: DB, cur: CUR, at: Date.now() })); return true; } catch (e) { return false; }
}
function lsRead() { try { const s = localStorage.getItem(lsKey()); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function lsRemove() { try { localStorage.removeItem(lsKey()); } catch (e) { } }
function lsOtherKeys() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(LS_PREFIX) === 0 && k !== lsKey()) out.push(k); } } catch (e) { }
  return out;
}
function jsonForBlock(o) { return JSON.stringify(o).replace(/</g, '\\u003c').replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029'); }
function blockRe(id) { const S = 'scr' + 'ipt'; return new RegExp('(<' + S + '[^>]*id="' + id + '"[^>]*>)([\\s\\S]*?)(</' + S + '>)'); }
function replaceBlock(html, id, obj) {
  const re = blockRe(id);
  if (!re.test(html)) throw new Error('블록 ' + id + '를 찾지 못했습니다');
  const body = jsonForBlock(obj);
  return html.replace(re, (m, a, b, c) => a + body + c);
}
function extractBlock(html, id) {
  const m = html.match(blockRe(id));
  if (!m) return null;
  try { return JSON.parse(m[2]); } catch (e) { return null; }
}
function buildHtml(db, cur) {
  let h = ST.template;
  h = replaceBlock(h, 'J-DB', db);
  h = replaceBlock(h, 'J-CUR', cur);
  return h;
}
function markDirty() {
  DB.updatedAt = Date.now();
  ST.dirty = true;
  updateSaveState();
  clearTimeout(ST.timer);
  ST.timer = setTimeout(save, 600);
}
async function save() {
  clearTimeout(ST.timer); ST.timer = null;
  if (ST.handle && !ST.stopped) {
    try {
      await writeToHandle();
      lsRemove();
      ST.dirty = false; updateSaveState();
      return true;
    } catch (e) {
      console.warn(e);
      lsWrite();
      ST.dirty = true; updateSaveState('파일 저장 실패 — 임시 저장됨');
      toast('파일에 저장하지 못해 이 PC 브라우저에 임시로 남겼습니다. ' + (e && e.message ? e.message : ''), 'warn');
      return false;
    }
  }
  lsWrite();
  ST.dirty = true; updateSaveState();
  return false;
}
async function writeToHandle() {
  if (ST.saving) { await new Promise(r => setTimeout(r, 300)); }
  ST.saving = true;
  try {
    const f = await ST.handle.getFile();
    if (ST.lastWriteMod && f.lastModified - ST.lastWriteMod > 1000) {
      const txt = await f.text();
      const other = extractBlock(txt, 'J-DB');
      if (other && other.fileId && other.fileId !== DB.fileId) {
        ST.stopped = true;
        updateSaveState('자동 저장 멈춤');
        modal('다른 파일로 바뀌었습니다', '<p>연결된 HTML 파일이 다른 기록 파일로 바뀌어 덮어쓰지 않고 자동 저장을 멈췄습니다.</p><p>지금 화면의 기록은 <b><i data-ic="lock"></i>백업·지우기 → 엑셀로 백업만 받기</b>로 먼저 챙겨 주세요.</p>');
        throw new Error('다른 기록 파일');
      }
      if (other) {
        const r = mergeDb(DB, other);
        const msg = '다른 창이나 다른 사람이 같은 파일을 고친 흔적이 있어 먼저 합친 뒤 저장했습니다(추가 ' + r.added + ', 갱신 ' + r.updated + '). 한 파일은 한 사람·한 창에서만 써 주세요.';
        if (!ST.warnedConcurrent) { ST.warnedConcurrent = true; modal('동시에 고친 흔적이 있습니다', '<p>' + esc(msg) + '</p>'); }
        else toast(msg, 'warn');
        if (typeof renderAll === 'function') renderAll();
      }
    }
    const w = await ST.handle.createWritable();
    await w.write(buildHtml(DB, CUR));
    await w.close();
    const f2 = await ST.handle.getFile();
    ST.lastWriteMod = f2.lastModified;
  } finally { ST.saving = false; }
}
function saveSettings() { CUR.updatedAt = Date.now(); markDirty(); }
/* IndexedDB 핸들 기억 */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(APP_ID, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbSet(k, v) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('h', 'readwrite'); t.objectStore('h').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
async function idbGet(k) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('h', 'readonly'); const q = t.objectStore('h').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function idbDel(k) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('h', 'readwrite'); t.objectStore('h').delete(k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
async function idbHasHandle() { try { return !!(await idbGet('h:' + DB.fileId)); } catch (e) { return false; } }
