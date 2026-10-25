/* ===== app2b_views.js : 학년 분석 (원본 매크로2 시트 재현) ===== */
const GSUBS = [['sum', '학년 요약'], ['cmp', '반별 비교'], ['sub', '과목별 분석'], ['type', '유형별 명단'], ['trend', '학기별 추이']];
function renderGrade() {
  const root = $('#tab-grade');
  const M = curModel();
  if (!M) { root.innerHTML = emptyNotice(); bindDemoBtn(root); return; }
  const G = gradeStats(M);
  let h = '<div class="card">' + gradeClassPicker(false) +
    '<div class="row"><button class="btn" id="xGrade"><i data-ic="download"></i>학년 전체 분석 엑셀</button><button class="btn ghost" id="xAll2"><i data-ic="download"></i>모든 반 학생카드 엑셀 (반마다 1개)</button></div></div>';
  h += '<div class="subtabs">' + GSUBS.map(s => '<button data-gs="' + s[0] + '"' + (UI.gsub === s[0] ? ' class="on"' : '') + '>' + s[1] + '</button>').join('') + '</div>';
  h += '<div id="gview">' + gradeView(M, G, UI.gsub) + '</div>';
  root.innerHTML = h;
  $$('[data-gs]', root).forEach(b => b.onclick = () => { UI.gsub = b.getAttribute('data-gs'); renderGrade(); });
  $$('[data-gostu]', root).forEach(a => a.onclick = e => { e.preventDefault(); const s = M.studs.find(x => x.key === a.getAttribute('data-gostu')); UI.ck = s.ck; UI.sk = s.key; showTab('card'); });
  bindJump(root);
  $('#xGrade', root).onclick = () => exportGradeBook(M);
  $('#xAll2', root).onclick = () => exportAllClassBooks(M);
}
function gradeView(M, G, k) {
  const ctx = M.ctx, S = M.S;
  if (k === 'sum') {
    const xs = M.studs, mean = a => { const v = a.filter(x => x !== ''); return v.length ? vround(v.reduce((p, q) => p + q, 0) / v.length, 2) : ''; };
    const curM = mean(xs.map(s => s.curAvg)), baseM = mean(xs.map(s => s.base)), dM = curM !== '' && baseM !== '' ? vround(curM - baseM, 2) : '';
    const up = xs.filter(s => s.diff !== '' && s.diff < 0).length, down = xs.filter(s => s.diff !== '' && s.diff > 0).length;
    const hard = xs.filter(s => s.target.verdict === '이번 학기만으로는 도달 불가').length;
    const worstBan = G.bans.filter(b => b.diff !== '').sort((a, b) => b.diff - a.diff)[0];
    let h = '<div class="card"><h2>' + esc(M.grade) + '학년 전체 요약</h2><p class="muted" style="margin:-4px 0 10px">' + M.classes.length + '개 반 · 학생 ' + xs.length + '명 · ' + M.scale + '등급 체계 · 최근 학기 ' + esc(M.curTerm) + '</p><div class="kpi">' +
      kpi(curM === '' ? '-' : fx(curM, 2), ctx.curLabel + ' 학년 평균', '', 'cur') +
      kpi(dM === '' ? '-' : (dM > 0 ? '+' : '') + fx(dM, 2) + arw(dM), (ctx.baseLabel || '기준선') + ' 대비', dM === '' ? '' : dM < 0 ? 'k-up' : dM > 0 ? 'k-down' : '', 'diff') +
      kpi(up + '명', '▲ 좋아진 학생', 'k-up', 'diff') + kpi(down + '명', '▼ 나빠진 학생', 'k-down', 'diff') +
      (ctx.next ? kpi(hard + '명', '목표 도달 불가', hard ? 'k-warn' : '', 'verdict') : '') +
      (worstBan && worstBan.diff > 0 ? kpi(esc(worstBan.ban.replace(/^\d+학년\s*/, '')), '가장 많이 내려간 반 (+' + fx(worstBan.diff, 2) + ')', 'k-down') : '') + '</div>';
    h += '<h3>학기별 학년 평균등급</h3><div class="tw"><table class="t sortable"><thead><tr><th>학기</th><th>인원</th><th>' + tip('평균등급', 'avg') + '</th></tr></thead><tbody>' +
      M.terms.map((t, i) => '<tr><td>' + esc(termLabel(t)) + '</td><td>' + G.termAvg[i].n + '</td><td>' + tdNum(G.termAvg[i].avg) + '</td></tr>').join('') + '</tbody></table></div>';
    h += '<p class="muted">※ 학년 평균등급은 학생별 학기 평균등급의 단순 평균입니다.</p>';
    h += '<h3>학습 유형 분포 <span class="muted">— 항목을 누르면 유형별 명단으로 이동</span></h3>' + typeBar(M.studs, 'gtype-') + '<div class="tw" style="margin-top:10px"><table class="t sortable"><thead><tr><th>유형</th><th>인원</th><th>비율</th><th class="l">담임 개입 방향</th></tr></thead><tbody>' +
      TYPE_VIEW.map(t => { const i = TYPES.indexOf(t); return '<tr><td>' + typePill(t) + '</td><td>' + G.typeCnt[i] + '</td><td>' + (M.studs.length ? fx(G.typeCnt[i] / M.studs.length * 100, 1) + '%' : '') + '</td><td class="wrap presc-td">' + esc(prescription(t)) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    return h;
  }
  if (k === 'cmp') {
    let h = '<div class="card"><h2>반별 성적 비교</h2><h3>반별 학기 평균등급</h3><div class="tw"><table class="t sortable"><thead><tr><th class="stk">반</th><th>인원</th>' + M.terms.map(t => '<th>' + esc(t) + '</th>').join('') +
      M.terms.slice(1).map((t, i) => '<th>' + esc(M.terms[i] + '→' + t) + '</th>').join('') + '<th>' + tip(ctx.baseLabel || '기준선', 'base') + '</th><th>' + tip(ctx.curLabel, 'cur') + '</th><th>' + tip('차이', 'diff') + '</th></tr></thead><tbody>';
    G.bans.forEach(b => { h += '<tr><td class="stk">' + esc(b.ban) + '</td><td>' + b.n + '</td>' + b.tavg.map(v => tdHeat(v, M.scale)).join('') + b.deltas.map(tdDelta).join('') + tdHeat(b.base, M.scale) + tdHeat(b.cur, M.scale) + tdDelta(b.diff) + '</tr>'; });
    h += '</tbody></table></div><p class="muted">※ 인원은 반의 실제 학생 수입니다. 반 평균은 학생별 평균등급의 단순 평균입니다.</p>';
    h += '<div style="overflow-x:auto">' + svgClassLines(M, G) + '</div>';
    h += '<h3>반별 교과군 평균등급</h3><div class="tw"><table class="t sortable"><thead><tr><th class="stk">반</th>' + G.grps.map(g => '<th>' + esc(g) + '</th>').join('') + '</tr></thead><tbody>' +
      G.banGrp.map(b => '<tr><td class="stk">' + esc(b.ban) + '</td>' + b.v.map(v => tdHeat(v, M.scale)).join('') + '</tr>').join('') + '</tbody></table></div></div>';
    return h;
  }
  if (k === 'sub') {
    let h = '<div class="card"><h2>과목별 성적 분포와 난이도</h2><p class="muted">※ 과목평균과 수강자수는 학년 전체(나이스 원자료) 기준입니다. 「우리 인원」은 올린 반의 학생 수입니다. 수강자수가 ' + S.minN + '명 미만인 과목은 노란색으로 표시되니 해석에 주의하세요.</p>' +
      '<div class="row" style="margin-bottom:8px"><label>학기 <select class="sel" id="subTerm"><option value="">전체</option>' + M.terms.map(t => '<option>' + esc(t) + '</option>').join('') + '</select></label><input id="subQ" placeholder="과목·교과군 검색" style="border:1px solid var(--line);border-radius:8px;padding:5px 8px"></div>' +
      '<div class="tw" style="max-height:70vh"><table class="t sortable" id="subTbl"><thead><tr><th>학기</th><th>교과군</th><th class="l stk">과목</th><th>' + tip('수강자수(전체)', 'cnt') + '</th><th>과목평균</th><th>우리 인원</th><th>우리 평균원점수</th>' +
      Array.from({ length: M.scale }, (_, i) => '<th>' + (i + 1) + '등급</th>').join('') + '</tr></thead><tbody>';
    G.subs.forEach(o => { h += '<tr data-term="' + esc(o.term) + '" data-q="' + esc(o.sub + ' ' + o.grp) + '"' + (o.small ? ' class="small"' : '') + '><td>' + esc(o.term) + '</td><td>' + esc(o.grp) + '</td><td class="l stk">' + esc(o.sub) + '</td><td>' + (o.cnt || '-') + '</td><td>' + (o.avg ? tdNum(o.avg, 1) : '-') + '</td><td>' + o.my + '</td><td>' + (o.mean === '' ? '-' : tdNum(o.mean, 1)) + '</td>' + gdCells(o) + '</tr>'; });
    h += '</tbody></table></div></div>';
    setTimeout(() => {
      const f = () => { const t = $('#subTerm').value, q = $('#subQ').value.trim(); $$('#subTbl tbody tr').forEach(tr => { tr.style.display = ((!t || tr.getAttribute('data-term') === t) && (!q || tr.getAttribute('data-q').indexOf(q) >= 0)) ? '' : 'none'; }); };
      const a = $('#subTerm'), b = $('#subQ'); if (a) a.onchange = f; if (b) b.oninput = f;
    }, 0);
    return h;
  }
  if (k === 'type') {
    let h = '<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">학습 유형별 학년 명단</h2>' + accordionTools('#tab-grade details.acc') + '</div><p class="muted">각 유형 안에서는 전체 평균등급이 좋은 학생부터 나열합니다. 제목을 누르면 펼쳐집니다.</p>';
    TYPE_VIEW.forEach(t => {
      const ls = G.typeLists[TYPES.indexOf(t)];
      h += '<details class="acc" id="gtype-' + esc(t) + '"><summary>' + typePill(t) + '<b>' + ls.length + '명</b></summary><div class="acc-body"><div class="presc">▶ ' + esc(prescription(t)) + '</div>';
      if (ls.length) {
        h += '<div class="tw"><table class="t sortable"><thead><tr><th>순위</th><th>반</th><th>번호</th><th class="l">성명</th>' + M.terms.map(x => '<th>' + esc(x) + '</th>').join('') + '<th>' + esc(ctx.baseLabel || '기준선') + '</th><th>전체</th><th>취약 교과군</th></tr></thead><tbody>' +
          ls.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(s.ban) + '</td><td>' + s.no + '</td><td class="l"><a href="#" data-gostu="' + esc(s.key) + '">' + esc(dn(s.name)) + '</a></td>' + s.tv.map(v => tdHeat(v, M.scale)).join('') + tdHeat(s.base, M.scale) + tdHeat(s.overall, M.scale) + '<td>' + esc(s.worst) + '</td></tr>').join('') + '</tbody></table></div>';
      }
      h += '</div></details>';
    });
    h += '</div>';
    return h;
  }
  if (k === 'trend') {
    let h = '<div class="card"><h2>학기별 학년 추이</h2><h3>학기별 평균등급대 분포 (인원)</h3><div class="tw"><table class="t sortable"><thead><tr><th>학기</th>' + Array.from({ length: M.scale }, (_, i) => '<th>' + tip((i + 1) + '등급대', 'band') + '</th>').join('') + '<th>계</th></tr></thead><tbody>' +
      M.terms.map((t, i) => '<tr><td>' + esc(t) + '학기</td>' + G.dist[i].d.map(n => '<td>' + n + '</td>').join('') + '<td>' + G.dist[i].tot + '</td></tr>').join('') + '</tbody></table></div>';
    h += '<div style="overflow-x:auto;margin-top:8px">' + svgDist(M, G) + '</div>';
    if (ctx.baseLabel) {
      const crit = bandCrit(S);
      h += '<h3>' + esc(ctx.baseLabel) + ' → ' + esc(ctx.curLabel) + ' 변화 구간</h3><div class="tw"><table class="t sortable"><thead><tr><th>구간</th><th class="l">기준</th><th>인원</th><th>비율</th></tr></thead><tbody>' +
        BANDS.map((b, i) => '<tr><td class="' + (i < 3 ? 'up' : 'down') + '"><b>' + esc(b) + '</b></td><td class="l">' + esc(crit[i]) + '</td><td>' + G.bandList[i].length + '</td><td>' + (G.bandTot ? fx(G.bandList[i].length / G.bandTot * 100, 1) + '%' : '') + '</td></tr>').join('') + '</tbody></table></div>';
      h += '<div class="row" style="justify-content:space-between;margin-top:14px"><h3 style="margin:0">구간별 명단</h3>' + accordionTools('#tab-grade details.acc') + '</div>';
      BANDS.forEach((b, i) => {
        const ls = G.bandList[i];
        h += '<details class="acc"><summary><b class="' + (i < 3 ? 'up' : 'down') + '">' + esc(b) + '</b><span class="muted">(' + esc(crit[i]) + ')</span><b>' + ls.length + '명</b></summary><div class="acc-body">';
        if (ls.length) h += '<div class="tw"><table class="t sortable"><thead><tr><th>반</th><th>번호</th><th class="l">성명</th><th>' + esc(ctx.baseLabel) + '</th><th>' + esc(ctx.curLabel) + '</th><th>변화</th><th>유형</th><th>취약 교과군</th></tr></thead><tbody>' +
          ls.map(o => '<tr><td>' + esc(o.x.ban) + '</td><td>' + o.x.no + '</td><td class="l"><a href="#" data-gostu="' + esc(o.x.key) + '">' + esc(dn(o.x.name)) + '</a></td><td>' + tdNum(o.x.base) + '</td><td>' + tdNum(o.x.curAvg) + '</td>' + tdDelta(vround(o.d, 2)) + '<td>' + typePill(o.x.type) + '</td><td>' + esc(o.x.worst) + '</td></tr>').join('') + '</tbody></table></div>';
        if (!ls.length) h += '<p class="muted">해당 학생이 없습니다.</p>';
        h += '</div></details>';
      });
    } else h += '<p class="muted">비교 기준선(직전 학년 평균)이 없는 학기라 변화 구간은 계산하지 않습니다.</p>';
    return h + '</div>';
  }
  return '';
}
/* 과목별 등급 인원: 석차등급이 없는 과목은 「-」, 있으면 칸 아래에 비율 막대 */
function gdCells(o) {
  const tot = o.gd.reduce((p, q) => p + q, 0);
  if (!tot) return o.gd.map(() => '<td class="na" data-v="">-</td>').join('');
  return o.gd.map(n => '<td class="gdc" data-v="' + n + '" style="--w:' + Math.round(n / tot * 100) + '%">' + (n || '<span class="z">0</span>') + '</td>').join('');
}
const LINE_COLORS = ['#6b7be0', '#e07b9a', '#3fa887', '#e0a34b', '#9a6be0', '#4bb3e0', '#c9b13f', '#7a8494', '#d0674b', '#5c9e3f', '#b45cc7', '#3f7fa8'];
function svgClassLines(M, G) {
  const labels = M.terms, scaleMin = 1;
  let lo = 99, hi = 0;
  G.bans.forEach(b => b.tavg.forEach(v => { if (v !== '') { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
  if (hi === 0) return '';
  lo = Math.max(scaleMin, Math.floor((lo - 0.1) * 2) / 2); hi = Math.min(M.scale, Math.ceil((hi + 0.1) * 2) / 2);
  if (hi - lo < 0.5) hi = lo + 0.5;
  const w = Math.max(420, 120 + labels.length * 110), h = 240, L = 40, R = 120, T = 30, B = 26, iw = w - L - R, ih = h - T - B;
  const y = v => T + (v - lo) / (hi - lo) * ih, x = i => L + (labels.length === 1 ? iw / 2 : i * iw / (labels.length - 1));
  let s = '<svg class="chart" xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><rect width="' + w + '" height="' + h + '" fill="#fff"/><text x="' + ((w - R + L) / 2) + '" y="17" text-anchor="middle" font-size="12.5" font-weight="700" fill="#33386e">반별 학기 평균등급 (위쪽이 좋음)</text>';
  for (let g = lo; g <= hi + 1e-9; g += 0.5) s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="#eeecf4"/><text x="' + (L - 6) + '" y="' + (y(g) + 4) + '" text-anchor="end" font-size="10" fill="#6e6a85">' + g.toFixed(1) + '</text>';
  labels.forEach((l, i) => { s += '<text x="' + x(i) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="11" fill="#4b4766">' + esc(l) + '</text>'; });
  G.bans.forEach((b, bi) => {
    const c = LINE_COLORS[bi % LINE_COLORS.length];
    const pts = []; b.tavg.forEach((v, i) => { if (v !== '') pts.push([x(i), y(v)]); });
    if (pts.length > 1) s += '<polyline fill="none" stroke="' + c + '" stroke-width="2" points="' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '"/>';
    pts.forEach(p => { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="' + c + '"/>'; });
    s += '<rect x="' + (w - R + 12) + '" y="' + (T + bi * 16) + '" width="10" height="10" fill="' + c + '"/><text x="' + (w - R + 26) + '" y="' + (T + bi * 16 + 9) + '" font-size="10.5" fill="#33386e">' + esc(b.ban) + '</text>';
  });
  return s + '</svg>';
}
/* 히트맵과 같은 남보라 한 가지 색: 1등급대 옅게 → 최하 등급대 진하게 */
const DIST_COLORS = ['#e3e6fa', '#cdd2f5', '#b4bbef', '#9ba4e8', '#838ee0', '#6b78d6', '#5562c6', '#444fae', '#353e93'];
function svgDist(M, G) {
  const w = 560, rh = 26, L = 56, R = 16, T = 30, h = T + M.terms.length * rh + 34, iw = w - L - R;
  const cols = M.scale === 5 ? ['#dfe3fa', '#b4bbef', '#8792e2', '#5c69cc', '#3a44a0'] : DIST_COLORS;
  let s = '<svg class="chart" xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><rect width="' + w + '" height="' + h + '" fill="#fff"/><text x="' + (w / 2) + '" y="17" text-anchor="middle" font-size="12.5" font-weight="700" fill="#33386e">학기별 등급대 분포 (비율)</text>';
  M.terms.forEach((t, i) => {
    const cy = T + i * rh; let acc = 0; const tot = G.dist[i].tot || 1;
    s += '<text x="' + (L - 6) + '" y="' + (cy + 15) + '" text-anchor="end" font-size="11" fill="#33386e">' + esc(t) + '</text>';
    G.dist[i].d.forEach((n, k) => {
      const ww = n / tot * iw;
      if (ww > 0) { s += '<rect x="' + (L + acc).toFixed(1) + '" y="' + (cy + 3) + '" width="' + ww.toFixed(1) + '" height="' + (rh - 6) + '" fill="' + cols[k] + '"/>'; if (ww > 22) s += '<text x="' + (L + acc + ww / 2).toFixed(1) + '" y="' + (cy + 17) + '" text-anchor="middle" font-size="10" fill="' + (k >= Math.ceil(M.scale / 2) ? '#fff' : '#1f1e2b') + '">' + n + '</text>'; }
      acc += ww;
    });
  });
  const ly = T + M.terms.length * rh + 12;
  for (let k = 0; k < M.scale; k++) s += '<rect x="' + (L + k * 52) + '" y="' + ly + '" width="10" height="10" fill="' + cols[k] + '"/><text x="' + (L + k * 52 + 14) + '" y="' + (ly + 9) + '" font-size="10" fill="#4b4766">' + (k + 1) + '등급대</text>';
  return s + '</svg>';
}
