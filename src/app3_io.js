/* ===== app3_io.js : 엑셀 내보내기·설정 양식·배포본·파일 합치기·저장 연결·초기화 ===== */
const FONT = '맑은 고딕';
function saveBlob(data, name, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function svgSize(svg) { const w = svg.match(/width="(\d+(?:\.\d+)?)"/), h = svg.match(/height="(\d+(?:\.\d+)?)"/); return [Number(w[1]), Number(h[1])]; }
function svgToPng(svg) {
  const [w, h] = svgSize(svg);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
      const g = c.getContext('2d'); g.scale(2, 2); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      res({ data: c.toDataURL('image/png'), w, h });
    };
    img.onerror = () => rej(new Error('차트 이미지 변환 실패'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
async function addChart(wb, ws, svg, col, row) {
  try {
    const p = await svgToPng(svg);
    const id = wb.addImage({ base64: p.data, extension: 'png' });
    ws.addImage(id, { tl: { col, row }, ext: { width: p.w, height: p.h }, editAs: 'oneCell' });
  } catch (e) { console.warn(e); }
}
/* ---- 서식 도우미 (원본 StyleTitle / StyleSection / StyleHeader) ---- */
const THIN = { style: 'thin', color: { argb: 'FF808080' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
function fill(argb) { return { type: 'pattern', pattern: 'solid', fgColor: { argb } }; }
function setFont(ws) { ws.properties.defaultRowHeight = 16; }
function cellSet(ws, r, c, v, st) {
  const cell = ws.getCell(r, c);
  cell.value = (v === '' || v == null) ? null : v;
  cell.font = Object.assign({ name: FONT, size: 10 }, st && st.font);
  if (st) { if (st.fill) cell.fill = st.fill; if (st.align) cell.alignment = st.align; if (st.numFmt) cell.numFmt = st.numFmt; if (st.border) cell.border = BORDER; }
  return cell;
}
function styleTitle(ws, r, c1, c2, text, sz) {
  ws.mergeCells(r, c1, r, c2);
  cellSet(ws, r, c1, text, { font: { bold: true, size: sz, color: { argb: 'FFFFFFFF' } }, fill: fill('FF33386E'), align: { horizontal: 'center', vertical: 'middle' } });
  ws.getRow(r).height = sz >= 16 ? 30 : 24;
}
function styleSection(ws, r, c1, c2, text) {
  for (let c = c1; c <= c2; c++) { const cell = ws.getCell(r, c); cell.fill = fill('FFE8EAFB'); cell.font = { name: FONT, size: 11, bold: true }; }
  cellSet(ws, r, c1, text, { font: { bold: true, size: 11 }, fill: fill('FFE8EAFB') });
}
function styleHeader(ws, r, c1, vals) {
  vals.forEach((v, i) => cellSet(ws, r, c1 + i, v, { font: { bold: true }, fill: fill('FFEEF0FB'), align: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: 1 }));
}
function boxRange(ws, r1, c1, r2, c2, center) {
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
    const cell = ws.getCell(r, c); cell.border = BORDER;
    if (!cell.font) cell.font = { name: FONT, size: 10 };
    if (center) cell.alignment = Object.assign({ horizontal: 'center', vertical: 'middle' }, cell.alignment && cell.alignment.wrapText ? { wrapText: true } : {});
  }
}
/* 좋아짐=청록, 나빠짐=주황 (화면과 같은 색) */
const C_GOOD = { argb: 'FF0E7C7B' }, C_BAD = { argb: 'FFB9530F' };
function deltaCell(ws, r, c, v, invert) {
  if (v === '' || v == null) return;
  const cell = cellSet(ws, r, c, v, { numFmt: '0.00' });
  const good = invert ? v > 0 : v < 0;
  if (v !== 0) cell.font = { name: FONT, size: 10, color: good ? C_GOOD : C_BAD };
}
function termText(ws, r, c, t) { const cell = cellSet(ws, r, c, String(t)); cell.numFmt = '@'; return cell; }
function wrapMerge(ws, r1, c1, r2, c2, text, h) {
  ws.mergeCells(r1, c1, r2, c2);
  cellSet(ws, r1, c1, text, { align: { wrapText: true, vertical: 'top' } });
  boxRange(ws, r1, c1, r2, c2);
  if (h) ws.getRow(r1).height = h;
}
function safeSheetName(s, used) {
  let n = String(s).replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31) || '시트';
  let base = n, i = 2;
  while (used.has(n)) { const suf = '(' + i++ + ')'; n = base.slice(0, 31 - suf.length) + suf; }
  used.add(n); return n;
}
function newWorkbook() { const wb = new ExcelJS.Workbook(); wb.creator = APP_NAME + ' v' + APP_VERSION; wb.created = new Date(); return wb; }

/* ---- 반별 학생카드 파일 (원본 매크로1) ---- */
async function buildClassBook(M, ck, onStep) {
  const ctx = M.ctx, S = M.S;
  const c = M.classes.find(x => classKey(x) === ck);
  const xs = M.studs.filter(s => s.ck === ck);
  const wb = newWorkbook(), used = new Set();
  /* 반요약 */
  const ws = wb.addWorksheet(safeSheetName('반요약', used));
  const nT = M.terms.length, lastCol = 2 + nT + 3 + (ctx.next ? 2 : 0) + 2;
  styleTitle(ws, 1, 1, lastCol, c.ban + ' 내신 성적 분석 요약', 16);
  let r = 3;
  styleSection(ws, r, 1, lastCol, '[1] 학생별 요약'); r++;
  const hd = ['번호', '성명'].concat(M.terms, [ctx.baseLabel || '기준선', ctx.curLabel, '차이'], ctx.next ? [ctx.next + ' 목표등급', '목표 판정'] : [], ['취약 교과군', '유형']);
  styleHeader(ws, r, 1, hd);
  M.terms.forEach((t, i) => { ws.getCell(r, 3 + i).numFmt = '@'; });
  const r1 = r; r++;
  xs.forEach(s => {
    let col = 1;
    cellSet(ws, r, col++, s.no); cellSet(ws, r, col++, s.name);
    s.tv.forEach(v => cellSet(ws, r, col++, v, { numFmt: '0.00' }));
    cellSet(ws, r, col++, s.base, { numFmt: '0.00' }); cellSet(ws, r, col++, s.curAvg, { numFmt: '0.00' });
    deltaCell(ws, r, col++, s.diff);
    if (ctx.next) {
      cellSet(ws, r, col++, s.target.need === '' ? '' : Number(s.target.need), { numFmt: '0.00' });
      const vc = cellSet(ws, r, col++, s.target.verdict);
      if (s.target.verdict === '이번 학기만으로는 도달 불가') vc.font = { name: FONT, size: 10, color: C_BAD };
      else if (s.target.verdict === '현 수준 유지로 달성') vc.font = { name: FONT, size: 10, color: C_GOOD };
    }
    cellSet(ws, r, col++, s.worst); cellSet(ws, r, col++, s.type);
    r++;
  });
  boxRange(ws, r1, 1, r - 1, lastCol, true);
  r += 1;
  if (ctx.next) {
    cellSet(ws, r, 1, '※ ' + ctx.next + ' 목표등급 : ' + ctx.tYearLabel + '이 ' + (ctx.tBaseLabel || '기준 학년 평균') + ' 이하가 되기 위해 ' + ctx.nextLabel + '에 필요한 학점가중 평균등급', { font: { italic: true, size: 9 } }); r++;
    if (ctx.next.split('-')[1] === '2') { cellSet(ws, r, 1, '※ ' + ctx.nextLabel + ' 이수학점은 [설정]의 다음학기예상학점 값을 쓰며, 0이면 ' + ctx.tYear + '학년 1학기와 같다고 가정합니다.', { font: { italic: true, size: 9 } }); r++; }
  }
  r += 1;
  styleSection(ws, r, 1, lastCol, '[2] 유형별 명단과 처방'); r++;
  TYPES.forEach(t => {
    const ls = xs.filter(s => s.type === t);
    if (!ls.length) return;
    cellSet(ws, r, 1, t + ' (' + ls.length + '명)', { font: { bold: true }, fill: fill('FFF2F2F2') });
    ws.mergeCells(r, 2, r, lastCol);
    cellSet(ws, r, 2, ls.map(s => s.no + '번 ' + s.name).join(', '), { align: { wrapText: true, vertical: 'top' } });
    ws.getRow(r).height = Math.max(16, Math.ceil(ls.length / 8) * 15);
    r++;
    ws.mergeCells(r, 1, r + 1, lastCol);
    cellSet(ws, r, 1, '▶ ' + prescription(t), { align: { wrapText: true, vertical: 'top' } });
    ws.getRow(r).height = 30;
    r += 3;
  });
  const widths = [7, 11].concat(M.terms.map(() => 8), [11, 11, 8], ctx.next ? [12, 22] : [], [16, 15]);
  widths.forEach((w, i) => ws.getColumn(i + 1).width = w);
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  /* 학생별 시트 */
  for (const [si, s] of xs.entries()) {
    if (onStep) await onStep(si, xs.length, s);
    const w2 = wb.addWorksheet(safeSheetName(String(s.no).padStart(2, '0') + '_' + s.name, used));
    await buildStudentSheet(wb, w2, M, s);
  }
  /* 원자료 */
  dumpRaw(wb.addWorksheet(safeSheetName('원자료', used)), M.recs.filter(x => x.ck === ck));
  return wb;
}
async function buildStudentSheet(wb, ws, M, s) {
  const ctx = M.ctx, S = M.S, R = s.R;
  [13, 13, 20, 10, 10, 10, 10, 10, 10, 10].forEach((w, i) => ws.getColumn(i + 1).width = w);
  let r = 1;
  styleTitle(ws, r, 1, 10, s.ban + '  ' + s.no + '번  ' + s.name + '   내신 성적 분석', 16);
  r = 3;
  styleSection(ws, r, 1, 10, '[1] 학기별 평균등급 추이'); r++;
  let r1 = r;
  styleHeader(ws, r, 1, ['학기', '이수학점', '평균등급', '직전 대비']); r++;
  M.terms.forEach((t, i) => {
    cellSet(ws, r, 1, t + '학기'); cellSet(ws, r, 2, termCredit(R, t)); cellSet(ws, r, 3, s.tv[i], { numFmt: '0.00' });
    if (i > 0 && s.tv[i] !== '' && s.tv[i - 1] !== '') deltaCell(ws, r, 4, vround(s.tv[i] - s.tv[i - 1], 2)); else cellSet(ws, r, 4, '-');
    r++;
  });
  boxRange(ws, r1, 1, r - 1, 4, true);
  await addChart(wb, ws, svgTrend(M.terms, s.tv, M.scale, 330, 200), 5, r1 - 2);
  r = Math.max(r + 2, r1 + 12);
  styleSection(ws, r, 1, 10, '[2] 성취도 분포 (교과 과목 기준)'); r++;
  r1 = r; styleHeader(ws, r, 1, ['학기', 'A', 'B', 'C', 'D', 'E']); r++;
  M.terms.forEach((t, i) => { cellSet(ws, r, 1, t + '학기'); s.ach[i].forEach((n, k) => cellSet(ws, r, 2 + k, n)); r++; });
  cellSet(ws, r, 1, '합계', { font: { bold: true } }); s.achAll.forEach((n, k) => cellSet(ws, r, 2 + k, n, { font: { bold: true } }));
  boxRange(ws, r1, 1, r, 6, true); r += 2;
  styleSection(ws, r, 1, 10, '[3] ' + M.terms.length + '개 학기 종합 진단'); r++;
  wrapMerge(ws, r, 1, r + 2, 10, makeDiagnosis(s, ctx, S), 22); r += 4;
  ws.getRow(r - 1).addPageBreak();
  /* 2쪽 */
  styleTitle(ws, r, 1, 10, '■ 교과군 프로파일', 14); r += 2;
  styleSection(ws, r, 1, 10, '[4] 교과군별 평균등급'); r++;
  r1 = r;
  styleHeader(ws, r, 1, ['교과군'].concat(M.terms, ['전체', '전체평균 대비']));
  M.terms.forEach((t, i) => ws.getCell(r, 2 + i).numFmt = '@');
  r++;
  const gcol = 2 + M.terms.length;
  s.groups.forEach(g => {
    cellSet(ws, r, 1, g.g); g.tv.forEach((v, i) => cellSet(ws, r, 2 + i, v, { numFmt: '0.00' }));
    cellSet(ws, r, gcol, g.all, { numFmt: '0.00' });
    if (g.gap !== '') { const cc = cellSet(ws, r, gcol + 1, vround(g.gap, 2), { numFmt: '0.00' }); cc.font = { name: FONT, size: 10, color: g.gap > 0 ? C_BAD : C_GOOD }; }
    r++;
  });
  boxRange(ws, r1, 1, r - 1, gcol + 1, true);
  const chartCol = Math.max(gcol + 2, 7);
  const gsvg = svgGroups(s.groups, s.overall, M.scale, 300);
  if (chartCol <= 8) { await addChart(wb, ws, gsvg, chartCol - 1, r1 - 2); }
  const gh = svgSize(gsvg)[1];
  r = Math.max(r + 2, r1 + Math.ceil(gh / 20) + 1);
  if (chartCol > 8) { await addChart(wb, ws, gsvg, 0, r - 1); r += Math.ceil(gh / 20) + 1; }
  styleSection(ws, r, 1, 10, '[5] 과목별 상세 (전 학기)'); r++;
  r1 = r;
  styleHeader(ws, r, 1, ['학기', '교과군', '과목', '학점', '원점수', '과목평균', '편차', '성취도', '석차등급', '수강자수']); r++;
  M.terms.forEach(t => R.filter(x => x.kind === 1 && x.term === t).forEach(x => {
    termText(ws, r, 1, x.term); cellSet(ws, r, 2, x.grp); cellSet(ws, r, 3, x.sub); cellSet(ws, r, 4, x.cr);
    cellSet(ws, r, 5, x.score); cellSet(ws, r, 6, x.avg, { numFmt: '0.0' });
    if (x.dev !== '') { const cc = cellSet(ws, r, 7, vround(x.dev, 1), { numFmt: '0.0' }); cc.font = { name: FONT, size: 10, color: x.dev > 0 ? C_GOOD : C_BAD }; }
    cellSet(ws, r, 8, x.ach); cellSet(ws, r, 9, x.rank); cellSet(ws, r, 10, x.cnt === 0 ? '' : x.cnt);
    r++;
  }));
  boxRange(ws, r1, 1, r - 1, 10, true);
  for (let i = r1 + 1; i < r; i++) ws.getCell(i, 3).alignment = { horizontal: 'left', vertical: 'middle' };
  r += 2;
  ws.getRow(r - 1).addPageBreak();
  /* 3쪽 */
  styleTitle(ws, r, 1, 10, '■ 진단과 담임 개입', 14); r += 2;
  styleSection(ws, r, 1, 10, '[6] 학습 유형 판정'); r++;
  r1 = r;
  const kv = (k, v, bold, h) => { cellSet(ws, r, 1, k); ws.mergeCells(r, 2, r, 10); cellSet(ws, r, 2, v, { font: bold ? { bold: true, size: 12 } : {}, align: { wrapText: true, vertical: 'middle' } }); if (h) ws.getRow(r).height = h; r++; };
  kv('유형', s.type, true);
  kv('판정 근거', s.why);
  kv('강점 교과군', s.best ? s.best + ' (전체 평균보다 ' + fx(Math.abs(s.bestGap), 1) + '등급 높음)' : '-');
  kv('취약 교과군', s.worst ? s.worst + ' (전체 평균보다 ' + fx(Math.abs(s.worstGap), 1) + '등급 낮음) - ' + groupComment(s.worst) : '-', false, s.worst ? 32 : null);
  boxRange(ws, r1, 1, r - 1, 10); r += 1;
  const tg = s.target;
  styleSection(ws, r, 1, 10, '[7] ' + (ctx.next ? ctx.nextLabel : '다음 학기') + ' 목표 등급'); r++;
  r1 = r;
  if (ctx.next) {
    cellSet(ws, r, 1, ctx.tBaseLabel || '기준선'); cellSet(ws, r, 2, tg.B, { numFmt: '0.00' });
    if (ctx.next.split('-')[1] === '2') {
      cellSet(ws, r, 3, termLabel(ctx.tYear + '-1')); cellSet(ws, r, 4, tg.gSo, { numFmt: '0.00' }); cellSet(ws, r, 5, '차이');
      if (tg.B !== '' && tg.gSo !== '') deltaCell(ws, r, 6, vround(tg.gSo - tg.B, 2));
    }
    for (let cc = 1; cc <= 10; cc++) ws.getCell(r, cc).alignment = { horizontal: 'center' };
    r++;
    cellSet(ws, r, 1, '목표 등급'); ws.mergeCells(r, 2, r, 10);
    cellSet(ws, r, 2, tg.need !== '' ? ctx.nextLabel + '에 학점가중 평균 ' + tg.need + '등급 이내 (' + tg.verdict + ')' : tg.verdict, { font: { bold: true } }); r++;
  }
  wrapMerge(ws, r, 1, r + 1, 10, tg.comment, 24); r += 2;
  boxRange(ws, r1, 1, r - 1, 10); r += 1;
  styleSection(ws, r, 1, 10, '[8] 담임 개입 제안'); r++;
  wrapMerge(ws, r, 1, r + 2, 10, prescription(s.type), 24); r += 4;
  styleSection(ws, r, 1, 10, '[9] 체육·예술·과학탐구실험·교양 (성실성 참고)'); r++;
  r1 = r; styleHeader(ws, r, 1, ['학기', '구분', '과목', '학점', '성취도/이수']); r++;
  const etc = R.filter(x => x.kind !== 1);
  if (!etc.length) { cellSet(ws, r, 1, '(자료 없음)'); r++; }
  etc.forEach(x => { termText(ws, r, 1, x.term); cellSet(ws, r, 2, kindLabel(x)); cellSet(ws, r, 3, x.sub); cellSet(ws, r, 4, x.cr); cellSet(ws, r, 5, x.ach); r++; });
  boxRange(ws, r1, 1, r - 1, 5, true); r += 1;
  styleSection(ws, r, 1, 10, '[10] 상담 메모'); r++;
  ws.mergeCells(r, 1, r + 6, 10); boxRange(ws, r, 1, r + 6, 10); ws.getCell(r, 1).alignment = { vertical: 'top', wrapText: true }; ws.getRow(r).height = 100;
  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
}
function dumpRaw(ws, recs) {
  const hd = ['반', '반번호', '번호', '성명', '학년', '학기', '교과', '과목', '학점', '원점수', '과목평균', '성취도', '석차등급', '수강자수', '구분', '교과군', '편차', '학기키'];
  styleHeader(ws, 1, 1, hd);
  recs.forEach((x, i) => {
    const row = ws.getRow(i + 2);
    row.values = [x.ban, x.banNo, x.no, x.name, x.hak, x.sem, x.gyo, x.sub, x.cr, x.score === '' ? null : x.score, x.avg === '' ? null : x.avg, x.ach, x.rank === '' ? null : x.rank,
      x.kind === 1 ? x.cnt : null, kindLabel(x), x.grp, x.dev === '' ? null : vround(x.dev, 1), x.term];
    row.font = { name: FONT, size: 9 };
    row.getCell(18).numFmt = '@';
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hd.length } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  [10, 6, 5, 9, 5, 5, 16, 18, 5, 7, 8, 7, 8, 8, 7, 12, 6, 7].forEach((w, i) => ws.getColumn(i + 1).width = w);
}
async function exportClassBook(M, ck, outer) {
  const c = M.classes.find(x => classKey(x) === ck);
  const pg = outer || progress(c.ban + ' 학생카드 엑셀 만드는 중');
  try {
    const wb = await buildClassBook(M, ck, outer ? null : (i, n) => pg.set(i, n, '학생카드 그리는 중'));
    if (!outer) await pg.set(1, 1, '파일로 묶는 중');
    const buf = await wb.xlsx.writeBuffer();
    saveBlob(buf, c.ban.replace(/\s/g, '') + '_내신분석.xlsx');
  } finally { if (!outer) pg.done(); }
}
async function exportAllClassBooks(M) {
  if (!(await confirmBox('모든 반 엑셀 받기', '<p>' + M.classes.length + '개 반의 학생카드 엑셀을 반마다 하나씩 내려받습니다. 브라우저가 「여러 파일 다운로드」를 물으면 허용해 주세요.</p>', '내려받기'))) return;
  const pg = progress('모든 반 학생카드 엑셀 만드는 중');
  try {
    for (const [i, c] of M.classes.entries()) {
      await pg.set(i, M.classes.length, c.ban + ' 처리 중');
      await exportClassBook(M, classKey(c), pg);
      await new Promise(r => setTimeout(r, 400));
    }
  } finally { pg.done(); }
}
/* ---- 학년 전체 파일 (원본 매크로2) ---- */
async function buildGradeBook(M) {
  const G = gradeStats(M), ctx = M.ctx, S = M.S;
  const wb = newWorkbook();
  /* 학년요약 */
  let ws = wb.addWorksheet('학년요약');
  styleTitle(ws, 1, 1, 8, M.grade + '학년 전체 내신 성적 분석 요약', 16);
  let r = 3;
  styleSection(ws, r, 1, 8, '[1] 기본 현황'); r++;
  let r1 = r;
  [['분석 반 수', M.classes.length + '개 반'], ['분석 학생 수', M.studs.length + '명'], ['등급 체계', M.scale + '등급'], ['최근 학기', termLabel(M.curTerm)], ['생성 일시', nowStamp()]].forEach(a => { cellSet(ws, r, 1, a[0]); cellSet(ws, r, 2, a[1]); r++; });
  boxRange(ws, r1, 1, r - 1, 2); r++;
  styleSection(ws, r, 1, 8, '[2] 학기별 학년 평균등급'); r++;
  r1 = r; styleHeader(ws, r, 1, ['학기', '인원', '평균등급']); r++;
  M.terms.forEach((t, i) => { cellSet(ws, r, 1, termLabel(t)); cellSet(ws, r, 2, G.termAvg[i].n); cellSet(ws, r, 3, G.termAvg[i].avg, { numFmt: '0.00' }); r++; });
  boxRange(ws, r1, 1, r - 1, 3, true); r++;
  styleSection(ws, r, 1, 8, '[3] 학습 유형 분포'); r++;
  r1 = r; styleHeader(ws, r, 1, ['유형', '인원', '비율', '담임 개입 방향']); ws.mergeCells(r, 4, r, 8); r++;
  TYPES.forEach((t, i) => {
    cellSet(ws, r, 1, t); cellSet(ws, r, 2, G.typeCnt[i]); cellSet(ws, r, 3, M.studs.length ? vround(G.typeCnt[i] / M.studs.length, 3) : '', { numFmt: '0.0%' });
    ws.mergeCells(r, 4, r, 8); cellSet(ws, r, 4, prescription(t), { align: { wrapText: true, vertical: 'middle' } }); ws.getRow(r).height = 62; r++;
  });
  boxRange(ws, r1, 1, r - 1, 8);
  for (let i = r1; i < r; i++) for (let c = 1; c <= 3; c++) ws.getCell(i, c).alignment = { horizontal: 'center', vertical: 'middle' };
  [17, 21, 10, 19, 19, 19, 19, 19].forEach((w, i) => ws.getColumn(i + 1).width = w);
  /* 반별비교 */
  ws = wb.addWorksheet('반별비교');
  const nT = M.terms.length, lc = 2 + nT + (nT - 1) + 3;
  styleTitle(ws, 1, 1, Math.max(8, lc), '반별 성적 비교', 16);
  r = 3; styleSection(ws, r, 1, Math.max(8, lc), '[1] 반별 학기 평균등급'); r++;
  r1 = r;
  styleHeader(ws, r, 1, ['반', '인원'].concat(M.terms, M.terms.slice(1).map((t, i) => M.terms[i] + '→' + t), [ctx.baseLabel || '기준선', ctx.curLabel, '차이']));
  M.terms.forEach((t, i) => ws.getCell(r, 3 + i).numFmt = '@');
  r++;
  G.bans.forEach(b => {
    let c = 1; cellSet(ws, r, c++, b.ban); cellSet(ws, r, c++, b.n);
    b.tavg.forEach(v => cellSet(ws, r, c++, v, { numFmt: '0.00' }));
    b.deltas.forEach(v => deltaCell(ws, r, c++, v));
    cellSet(ws, r, c++, b.base, { numFmt: '0.00' }); cellSet(ws, r, c++, b.cur, { numFmt: '0.00' }); deltaCell(ws, r, c++, b.diff);
    r++;
  });
  boxRange(ws, r1, 1, r - 1, lc, true);
  const csvg = svgClassLines(M, G);
  if (csvg) await addChart(wb, ws, csvg, lc + 1, 2);
  r += 2;
  styleSection(ws, r, 1, Math.max(8, lc), '[2] 반별 교과군 평균등급'); r++;
  r1 = r; styleHeader(ws, r, 1, ['반'].concat(G.grps)); r++;
  G.banGrp.forEach(b => { cellSet(ws, r, 1, b.ban); b.v.forEach((v, i) => cellSet(ws, r, 2 + i, v, { numFmt: '0.00' })); r++; });
  boxRange(ws, r1, 1, r - 1, G.grps.length + 1, true);
  ws.getColumn(1).width = 14; ws.getColumn(2).width = 7; for (let c = 3; c <= Math.max(lc, G.grps.length + 1); c++) ws.getColumn(c).width = 11;
  /* 과목별분석 */
  ws = wb.addWorksheet('과목별분석');
  const sc = 7 + M.scale;
  styleTitle(ws, 1, 1, sc, '과목별 성적 분포와 난이도', 16);
  ws.mergeCells(3, 1, 3, sc);
  cellSet(ws, 3, 1, '※ 과목평균과 수강자수는 학년 전체(나이스 원자료) 기준입니다. 우리 인원은 올린 반의 학생 수입니다. 수강자수가 ' + S.minN + '명 미만인 과목은 해석에 주의가 필요합니다.', { font: { italic: true }, align: { wrapText: true, vertical: 'top' } });
  ws.getRow(3).height = 28;
  r = 5; r1 = r;
  styleHeader(ws, r, 1, ['학기', '교과군', '과목', '수강자수(전체)', '과목평균', '우리 인원', '우리 평균원점수'].concat(Array.from({ length: M.scale }, (_, i) => (i + 1) + '등급'))); r++;
  G.subs.forEach(o => {
    termText(ws, r, 1, o.term); cellSet(ws, r, 2, o.grp); cellSet(ws, r, 3, o.sub); cellSet(ws, r, 4, o.cnt); cellSet(ws, r, 5, o.avg, { numFmt: '0.0' });
    cellSet(ws, r, 6, o.my); cellSet(ws, r, 7, o.mean, { numFmt: '0.0' }); o.gd.forEach((n, k) => cellSet(ws, r, 8 + k, n));
    if (o.small) { for (let c = 1; c <= sc; c++) ws.getCell(r, c).fill = fill('FFFFF2CC'); ws.getCell(r, 4).font = { name: FONT, size: 10, color: { argb: 'FFBF8F00' } }; }
    r++;
  });
  boxRange(ws, r1, 1, r - 1, sc, true);
  for (let i = r1 + 1; i < r; i++) ws.getCell(i, 3).alignment = { horizontal: 'left', vertical: 'middle' };
  ws.autoFilter = { from: { row: r1, column: 1 }, to: { row: r1, column: sc } };
  ws.getColumn(1).width = 12; ws.getColumn(2).width = 12; ws.getColumn(3).width = 20; for (let c = 4; c <= sc; c++) ws.getColumn(c).width = 11;
  /* 유형별명단 */
  ws = wb.addWorksheet('유형별명단');
  const tc = 4 + nT + 3;
  styleTitle(ws, 1, 1, tc, '학습 유형별 학년 명단', 16);
  r = 3;
  TYPES.forEach((t, ti) => {
    const ls = G.typeLists[ti];
    ws.mergeCells(r, 1, r, tc); styleSection(ws, r, 1, tc, t + '  (' + ls.length + '명)'); ws.getCell(r, 1).font = { name: FONT, size: 12, bold: true }; r++;
    ws.mergeCells(r, 1, r + 1, tc); cellSet(ws, r, 1, '▶ ' + prescription(t), { align: { wrapText: true, vertical: 'top' } }); ws.getRow(r).height = 30; r += 2;
    if (ls.length) {
      r1 = r;
      styleHeader(ws, r, 1, ['순위', '반', '번호', '성명'].concat(M.terms, [ctx.baseLabel || '기준선', '전체', '취약 교과군']));
      M.terms.forEach((x, i) => ws.getCell(r, 5 + i).numFmt = '@');
      r++;
      ls.forEach((s, i) => {
        let c = 1; cellSet(ws, r, c++, i + 1); cellSet(ws, r, c++, s.ban); cellSet(ws, r, c++, s.no); cellSet(ws, r, c++, s.name);
        s.tv.forEach(v => cellSet(ws, r, c++, v, { numFmt: '0.00' })); cellSet(ws, r, c++, s.base, { numFmt: '0.00' }); cellSet(ws, r, c++, s.overall, { numFmt: '0.00' }); cellSet(ws, r, c++, s.worst);
        r++;
      });
      boxRange(ws, r1, 1, r - 1, tc, true);
    }
    r += 2;
  });
  [6, 13, 7, 11].concat(M.terms.map(() => 10), [10, 10, 17]).forEach((w, i) => ws.getColumn(i + 1).width = w);
  /* 학기별추이 */
  ws = wb.addWorksheet('학기별추이');
  styleTitle(ws, 1, 1, 8, '학기별 학년 추이', 16);
  r = 3; styleSection(ws, r, 1, 8, '[1] 학기별 평균등급대 분포 (인원)'); r++;
  r1 = r; styleHeader(ws, r, 1, ['학기'].concat(Array.from({ length: M.scale }, (_, i) => (i + 1) + '등급대'), ['계'])); r++;
  M.terms.forEach((t, i) => { cellSet(ws, r, 1, t + '학기'); G.dist[i].d.forEach((n, k) => cellSet(ws, r, 2 + k, n)); cellSet(ws, r, 2 + M.scale, G.dist[i].tot); r++; });
  boxRange(ws, r1, 1, r - 1, 2 + M.scale, true);
  r += 1;
  await addChart(wb, ws, svgDist(M, G), 0, r - 1);
  r += Math.ceil(svgSize(svgDist(M, G))[1] / 20) + 2;
  if (ctx.baseLabel) {
    const crit = bandCrit(S);
    styleSection(ws, r, 1, 8, '[2] ' + ctx.baseLabel + ' → ' + ctx.curLabel + ' 변화 구간'); r++;
    r1 = r; styleHeader(ws, r, 1, ['구간', '기준', '인원', '비율']); r++;
    BANDS.forEach((b, i) => {
      const cc = cellSet(ws, r, 1, b, { font: { bold: true } }); cc.font = { name: FONT, size: 10, bold: true, color: i < 3 ? C_GOOD : C_BAD };
      cellSet(ws, r, 2, crit[i]); cellSet(ws, r, 3, G.bandList[i].length); cellSet(ws, r, 4, G.bandTot ? vround(G.bandList[i].length / G.bandTot, 3) : '', { numFmt: '0.0%' }); r++;
    });
    boxRange(ws, r1, 1, r - 1, 4, true);
    for (let i = r1 + 1; i < r; i++) ws.getCell(i, 2).alignment = { horizontal: 'left' };
    r += 2;
    styleSection(ws, r, 1, 8, '[3] 구간별 명단'); r++;
    BANDS.forEach((b, i) => {
      const ls = G.bandList[i];
      ws.mergeCells(r, 1, r, 8); cellSet(ws, r, 1, b + '  (' + crit[i] + ')  -  ' + ls.length + '명', { font: { bold: true }, fill: fill('FFF2F2F2') }); r++;
      if (ls.length) {
        r1 = r; styleHeader(ws, r, 1, ['반', '번호', '성명', ctx.baseLabel, ctx.curLabel, '변화', '유형', '취약 교과군']); r++;
        ls.forEach(o => { cellSet(ws, r, 1, o.x.ban); cellSet(ws, r, 2, o.x.no); cellSet(ws, r, 3, o.x.name); cellSet(ws, r, 4, o.x.base, { numFmt: '0.00' }); cellSet(ws, r, 5, o.x.curAvg, { numFmt: '0.00' }); deltaCell(ws, r, 6, vround(o.d, 2)); cellSet(ws, r, 7, o.x.type); cellSet(ws, r, 8, o.x.worst); r++; });
        boxRange(ws, r1, 1, r - 1, 8, true);
      }
      r++;
    });
  }
  ws.getColumn(1).width = 14; ws.getColumn(2).width = 22; for (let c = 3; c <= 11; c++) ws.getColumn(c).width = 12;
  wb.worksheets.forEach(w => { w.pageSetup = { orientation: (w.name === '학년요약' || w.name === '학기별추이') ? 'portrait' : 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }; });
  /* 통합원자료 */
  dumpRaw(wb.addWorksheet('통합원자료'), M.recs);
  return wb;
}
async function exportGradeBook(M) {
  const pg = progress(M.grade + '학년 전체 분석 엑셀 만드는 중');
  try {
    await pg.set(0, 2, '시트 만드는 중');
    const wb = await buildGradeBook(M);
    await pg.set(1, 2, '파일로 묶는 중');
    const buf = await wb.xlsx.writeBuffer();
    saveBlob(buf, M.grade + '학년전체_내신분석.xlsx');
  } finally { pg.done(); }
}

/* ---- 설정 양식 ---- */
async function downloadSettingsTemplate() {
  const wb = newWorkbook();
  const g = wb.addWorksheet('안내');
  g.getColumn(1).width = 100;
  ['내신 성적 분석 도우미 — 설정 양식 (v' + APP_VERSION + ')', '',
    '1. [설정] 시트의 노란 칸(5등급 값·9등급 값)을 학교 사정에 맞게 고칩니다.',
    '2. [교과군매핑] 시트에 나이스 「교과」 표기와 묶을 교과군을 적습니다. 같은 교과군 이름을 적으면 한 군으로 묶입니다.',
    '3. 도우미의 설정 탭 → 「설정 양식 올리기」로 이 파일을 올립니다. 열 순서는 바꿔도 머리글 이름으로 알아봅니다.',
    '※ 원본 매크로 파일(.xlsm)의 [설정]·[교과군매핑] 시트도 그대로 올릴 수 있습니다.'].forEach((t, i) => cellSet(g, i + 1, 1, t, i === 0 ? { font: { bold: true, size: 14 } } : {}));
  const ws = wb.addWorksheet('설정');
  cellSet(ws, 1, 1, '판정 기준 설정', { font: { bold: true, size: 14 } });
  cellSet(ws, 2, 1, '↓ 5등급 값은 2022 개정(5등급제), 9등급 값은 2015 개정(9등급제) 학생에게 씁니다. 숫자만 고치세요.', { font: { color: { argb: 'FF8C8C8C' }, italic: true } });
  styleHeader(ws, 3, 1, ['항목', '5등급 값', '9등급 값', '단위', '설명']);
  SET_DEF.forEach((d, i) => {
    const r = 4 + i;
    cellSet(ws, r, 1, d.label, { font: { bold: true } }); cellSet(ws, r, 2, CUR.s5[d.k], { fill: fill('FFFFF2CC') }); cellSet(ws, r, 3, CUR.s9[d.k], { fill: fill('FFFFF2CC') });
    cellSet(ws, r, 4, d.unit); cellSet(ws, r, 5, d.desc, { align: { wrapText: true } });
  });
  boxRange(ws, 3, 1, 3 + SET_DEF.length, 5);
  ws.dataValidations.add('B4:C' + (3 + SET_DEF.length), { type: 'decimal', operator: 'between', allowBlank: false, formulae: [0, 1000], showErrorMessage: true, errorTitle: '숫자', error: '숫자를 입력해 주세요.' });
  [20, 11, 11, 7, 80].forEach((w, i) => ws.getColumn(i + 1).width = w);
  const m = wb.addWorksheet('교과군매핑');
  cellSet(m, 1, 1, "교과 → 교과군 매핑 (나이스의 '교과' 표기를 분석용 교과군으로 묶습니다)", { font: { bold: true, size: 13 } });
  cellSet(m, 2, 1, '↓ 예: 「사회(역사/도덕포함)」 → 「사회」. 여러 교과를 한 군으로 묶으려면 교과군에 같은 이름을 적으세요.', { font: { color: { argb: 'FF8C8C8C' }, italic: true } });
  styleHeader(m, 3, 1, ['원본 교과 표기', '분석용 교과군', '비고']);
  CUR.map.forEach((x, i) => { cellSet(m, 4 + i, 1, x.src); cellSet(m, 4 + i, 2, x.grp, { fill: fill('FFFFF2CC') }); cellSet(m, 4 + i, 3, x.note); });
  boxRange(m, 3, 1, 3 + Math.max(1, CUR.map.length) + 20, 3);
  [26, 20, 30].forEach((w, i) => m.getColumn(i + 1).width = w);
  const buf = await wb.xlsx.writeBuffer();
  saveBlob(buf, 'naeshin_settings_v' + APP_VERSION + '.xlsx');
}
function wsAoa(wb, test) {
  const n = wb.SheetNames.find(test);
  return n ? sheetAoa(wb.Sheets[n]) : null;
}
function looksLikeSettings(wb) {
  const a = wsAoa(wb, n => n.replace(/\s/g, '') === '설정');
  const b = wsAoa(wb, n => n.replace(/\s/g, '').indexOf('교과군매핑') >= 0);
  return !!((a && findSetHeader(a)) || (b && findMapHeader(b)));
}
function findSetHeader(aoa) {
  for (let i = 0; i < Math.min(30, aoa.length); i++) {
    const row = (aoa[i] || []).map(c => nz(c).replace(/\s/g, ''));
    const ki = row.indexOf('항목');
    if (ki < 0) continue;
    let v5 = row.findIndex(c => c.indexOf('5등급') >= 0);
    if (v5 < 0) v5 = row.indexOf('값');
    const v9 = row.findIndex(c => c.indexOf('9등급') >= 0);
    if (v5 >= 0 || v9 >= 0) return { row: i, ki, v5, v9 };
  }
  return null;
}
function findMapHeader(aoa) {
  for (let i = 0; i < Math.min(30, aoa.length); i++) {
    const row = (aoa[i] || []).map(c => { const t = nz(c).replace(/\s/g, ''); return t.length > 16 ? '' : t; });
    const g = row.findIndex(c => c.indexOf('교과군') >= 0);
    let s = row.findIndex(c => c.indexOf('원본') >= 0);
    if (s < 0) s = row.findIndex((c, j) => j !== g && c.indexOf('교과') >= 0);
    if (g >= 0 && s >= 0 && g !== s) return { row: i, s, g, n: row.findIndex(c => c.indexOf('비고') >= 0) };
  }
  return null;
}
async function importSettingsWb(wb, name, interactive) {
  const msgs = [];
  const newS5 = Object.assign({}, CUR.s5), newS9 = Object.assign({}, CUR.s9);
  let newMap = null, nSet = 0;
  const a = wsAoa(wb, n => n.replace(/\s/g, '') === '설정');
  const hs = a && findSetHeader(a);
  if (hs) {
    for (let i = hs.row + 1; i < a.length; i++) {
      const lab = nz((a[i] || [])[hs.ki]).replace(/\s/g, '');
      if (!lab || lab[0] === '※') continue;
      const def = SET_DEF.find(d => d.label === lab) || SET_DEF.find(d => d.k === SET_ALIAS[lab]);
      if (!def) { msgs.push(['warn', '[설정] ' + (i + 1) + '행 「' + lab + '」: 모르는 항목이라 건너뜁니다.']); continue; }
      if (hs.v5 >= 0) { const v = nz(a[i][hs.v5]); if (v !== '') { if (isNum(v)) { newS5[def.k] = Number(v); nSet++; } else msgs.push(['err', '[설정] ' + (i + 1) + '행 ' + def.label + ': 숫자가 아닙니다(' + v + ').']); } }
      if (hs.v9 >= 0) { const v = nz(a[i][hs.v9]); if (v !== '') { if (isNum(v)) { newS9[def.k] = Number(v); nSet++; } else msgs.push(['err', '[설정] ' + (i + 1) + '행 ' + def.label + '(9등급): 숫자가 아닙니다(' + v + ').']); } }
      if (lab === '2학년2학기예상학점') msgs.push(['info', "'2학년2학기예상학점'은 '다음학기예상학점'으로 읽었습니다."]);
    }
    if (hs.v9 < 0) msgs.push(['info', '[설정] 9등급 값 열이 없어 5등급 값만 바꿨습니다(원본 매크로 형식).']);
  }
  const b = wsAoa(wb, n => n.replace(/\s/g, '').indexOf('교과군매핑') >= 0);
  const hm = b && findMapHeader(b);
  if (hm) {
    newMap = [];
    for (let i = hm.row + 1; i < b.length; i++) {
      const src = nz((b[i] || [])[hm.s]);
      if (!src || src[0] === '※') continue;
      const grp = nz(b[i][hm.g]) || src;
      if (newMap.find(x => normKey(x.src) === normKey(src))) { msgs.push(['warn', '[교과군매핑] ' + (i + 1) + '행 「' + src + '」: 같은 교과가 위에 있어 건너뜁니다.']); continue; }
      newMap.push({ src, grp, note: hm.n >= 0 ? nz(b[i][hm.n]) : '' });
    }
    if (!newMap.length) { msgs.push(['err', '[교과군매핑] 읽을 줄이 없어 지금 매핑을 유지합니다.']); newMap = null; }
  }
  const ok = !msgs.some(m => m[0] === 'err') || nSet || newMap;
  const html = '<p><b>' + esc(name) + '</b>에서 기준값 ' + nSet + '칸' + (newMap ? ', 교과군 매핑 ' + newMap.length + '줄' : '') + '을 읽었습니다. 「적용」을 눌러야 반영됩니다.</p>' +
    (msgs.length ? '<ul>' + msgs.map(m => '<li class="msg-' + m[0] + '">' + esc(m[1]) + '</li>').join('') + '</ul>' : '');
  return new Promise(res => {
    modal('설정 양식 인식 결과', html, [{ label: '취소', onClick: () => res(false) }, {
      label: '적용', primary: true, onClick: () => {
        if (!ok) { res(false); return; }
        CUR.s5 = newS5; CUR.s9 = newS9; if (newMap) CUR.map = newMap;
        saveSettings(); renderAll(); toast('설정을 반영했습니다.', 'ok'); res(true);
      }
    }]);
  });
}

/* ---- 배포본·파일 합치기 ---- */
function makeDistribution() {
  const db = emptyDb(newId());
  const cur = JSON.parse(JSON.stringify(CUR));
  cur.map.forEach(r => { if (r.note && r.note.indexOf('자동') >= 0) r.note = ''; });
  const html = buildHtml(db, cur);
  saveBlob(new Blob([html], { type: 'text/html' }), 'naeshin_helper_v' + APP_VERSION + '.html');
  modal('배포본을 만들었습니다', '<p>지금 설정(기준값·교과군 매핑)만 담고 성적은 하나도 없는 HTML입니다. 받은 선생님은 <b>내 폴더에 먼저 저장한 뒤</b> 열고 「<i data-ic="save"></i>파일에 저장 연결」을 누르면 됩니다.</p>');
}
async function mergeHtmlText(txt, name, logs) {
  const other = extractBlock(txt, 'J-DB');
  if (!other || !other.classes) { logs.push(['err', name + ': 도우미 기록을 찾지 못했습니다.']); return; }
  if (other.demo) { logs.push(['info', name + ': 가상 예시만 들어 있어 건너뜁니다.']); return; }
  if (DB.demo) { DB.classes = {}; DB.tomb = {}; DB.demo = false; }
  const r = mergeDb(DB, other);
  logs.push(['info', name + ': 추가 ' + r.added + '개 반, 갱신 ' + r.updated + ', 같아서 건너뜀 ' + r.same + ', 더 오래돼서 건너뜀 ' + r.older + (r.removed ? ', 삭제 반영 ' + r.removed : '') + (r.bad ? ', 손상돼 건너뜀 ' + r.bad : '')]);
  if (r.added || r.updated || r.removed) markDirty();
  renderAll();
}

/* ---- 파일에 저장 연결 ---- */
async function connectFile() {
  if (!window.showOpenFilePicker) { modal('지원하지 않는 브라우저', '<p>크롬이나 엣지에서 이 HTML 파일을 열어 주세요.</p>'); return; }
  let h;
  try { [h] = await window.showOpenFilePicker({ types: [{ description: 'HTML', accept: { 'text/html': ['.html', '.htm'] } }], multiple: false }); }
  catch (e) { return; }
  await attachHandle(h);
}
async function reconnectFile() {
  try {
    const h = await idbGet('h:' + DB.fileId);
    if (!h) return connectFile();
    await attachHandle(h);
  } catch (e) { connectFile(); }
}
async function attachHandle(h, opts) {
  opts = opts || {};
  try {
    if (h.requestPermission && (await h.requestPermission({ mode: 'readwrite' })) !== 'granted') { toast('쓰기 권한을 받지 못했습니다.', 'warn'); return false; }
  } catch (e) { }
  const f = await h.getFile();
  const txt = await f.text();
  if (txt.indexOf('data-app="' + APP_ID + '"') < 0 || !blockRe('J-DB').test(txt)) {
    modal('이 도우미 파일이 아닙니다', '<p>「' + esc(h.name) + '」은(는) 내신 성적 분석 도우미 HTML이 아닙니다. 지금 브라우저에서 연 그 파일을 골라 주세요.</p>');
    return false;
  }
  const other = extractBlock(txt, 'J-DB'), otherCur = extractBlock(txt, 'J-CUR');
  const otherHas = other && other.classes && Object.keys(other.classes).length && !other.demo;
  if (!opts.silent && other && other.fileId !== DB.fileId && otherHas) {
    const yes = await confirmBox('다른 기록이 든 파일입니다', '<p>고른 파일에는 다른 도우미의 성적(' + Object.keys(other.classes).length + '개 반)이 들어 있습니다. 지금 화면의 기록으로 <b>덮어쓸까요?</b></p><p class="muted">덮어쓰기 전에 그 파일의 기록이 필요하면 「취소」 후 그 파일을 열어 백업부터 받으세요.</p>', '덮어쓰기');
    if (!yes) return false;
  } else if (!opts.silent && other && other.fileId === DB.fileId && (other.updatedAt || 0) > (DB.updatedAt || 0)) {
    const yes = await confirmBox('파일 쪽 기록이 더 최신입니다', '<p>파일에 저장된 기록이 지금 화면보다 최신입니다. 파일 쪽 기록을 불러올까요?</p><p class="muted">「취소」를 누르면 지금 화면의 기록으로 파일을 덮어씁니다.</p>', '파일 기록 불러오기');
    if (yes) { DB = other; if (otherCur) CUR = fillCur(otherCur); }
  }
  ST.handle = h; ST.template = txt; ST.stopped = false; ST.lastWriteMod = f.lastModified;
  try { await idbSet('h:' + DB.fileId, h); } catch (e) { }
  const ok = await save();
  renderAll();
  if (ok) toast('이 HTML 파일에 저장되도록 연결했습니다. 앞으로 바뀐 내용은 자동으로 저장됩니다.', 'ok');
  return ok;
}
window.addEventListener('beforeunload', e => {
  if (ST.dirty && (ST.handle || dbCounts(DB).nc) && !DB.demo) { e.preventDefault(); e.returnValue = ''; }
});

/* ---- 가상 예시 데이터 ---- */
function loadDemo() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const SUR = '가나다라마바사아자차카타파하'.split(''), GIV = ['예시', '가상', '샘플', '연습', '보기', '모의'];
  const SUB = { '1-1': [['국어', '공통국어1', 4], ['수학', '공통수학1', 4], ['영어', '공통영어1', 4], ['사회(역사/도덕포함)', '한국사1', 3], ['사회(역사/도덕포함)', '통합사회1', 4], ['과학', '통합과학1', 4]],
    '1-2': [['국어', '공통국어2', 4], ['수학', '공통수학2', 4], ['영어', '공통영어2', 4], ['사회(역사/도덕포함)', '한국사2', 3], ['사회(역사/도덕포함)', '통합사회2', 4], ['과학', '통합과학2', 4]],
    '2-1': [['국어', '문학', 4], ['수학', '대수', 4], ['영어', '영어Ⅰ', 4], ['사회(역사/도덕포함)', '세계시민과 지리', 3], ['과학', '물리학', 3], ['과학', '화학', 3], ['기술·가정/정보', '인공지능 기초', 3]] };
  const avg = {}; Object.keys(SUB).forEach(t => SUB[t].forEach(x => avg[t + x[1]] = Math.round((55 + rnd() * 22) * 10) / 10));
  if (dbCounts(DB).nc && !DB.demo) { toast('이미 실제 성적이 있어 예시를 넣지 않았습니다.', 'warn'); return; }
  DB.classes = {}; DB.tomb = {};
  [1, 2, 3].forEach(b => {
    const stu = {}, rows = [];
    for (let n = 1; n <= 20; n++) {
      stu[n] = pick(SUR) + pick(GIV) + String(n).padStart(2, '0');
      const base = 1 + rnd() * 4, tr = (rnd() - 0.5), weak = pick(['국어', '수학', '영어', '', '', '']);
      ['1-1', '1-2', '2-1'].forEach((t, ti) => {
        const [h, s] = t.split('-').map(Number);
        SUB[t].forEach(x => {
          const lv = base + tr * ti + (rnd() - 0.5) * 1.2 + (weak && x[0].indexOf(weak) >= 0 ? 1.6 : 0);
          const rk = Math.max(1, Math.min(5, Math.round(lv)));
          const av = avg[t + x[1]], sc = Math.max(10, Math.min(100, Math.round(av + (2.5 - rk) * 7 + (rnd() - 0.5) * 10)));
          rows.push([n, h, s, x[0], x[1], x[2], sc, av, 'ABCDE'[rk - 1], rk, 150, 1]);
        });
        rows.push([n, h, s, h === 1 ? '체육' : '체육', h === 1 ? '체육' : '운동과 건강', 2, '', '', pick(['A', 'A', 'B']), '', '', 2]);
      });
    }
    addClassToDb(DB, { ban: '2학년 ' + b + '반', banNo: b, grade: 2, stu, rows, fileName: '가상 예시' });
  });
  DB.demo = true;
  ST.dirty = false;
  renderAll();
  showTab('class');
}

/* ---- 초기화 ---- */
function fillCur(c) {
  const d = defaultCur();
  c = c || {};
  c.s5 = Object.assign({}, d.s5, c.s5 || {}); c.s9 = Object.assign({}, d.s9, c.s9 || {});
  if (!Array.isArray(c.map)) c.map = d.map;
  c.scaleMode = c.scaleMode || 'auto'; c.termMode = c.termMode || 'auto';
  return c;
}
function init() {
  ST.template = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  DB = readJsonBlock('J-DB') || emptyDb();
  if (!DB.fileId) DB.fileId = newId();
  DB.classes = DB.classes || {}; DB.tomb = DB.tomb || {};
  CUR = fillCur(readJsonBlock('J-CUR'));
  const ls = lsRead();
  if (ls && ls.db && (ls.db.updatedAt || 0) > (DB.updatedAt || 0)) {
    DB = ls.db; CUR = fillCur(ls.cur); ST.dirty = true;
    setTimeout(() => toast('이 PC 브라우저에 남아 있던 임시 기록(파일에 아직 저장 안 됨)을 불러왔습니다.', 'warn'), 300);
  }
  $$('#tabs button').forEach(b => b.onclick = () => showTab(b.getAttribute('data-tab')));
  $('#btnConnect').onclick = () => { if (ST.handle && !ST.stopped) { modal('파일에 저장 중', '<p>이 HTML 파일(「' + esc(ST.handle.name) + '」)에 자동으로 저장되고 있습니다.</p>'); } else connectFile(); };
  $('#btnBackup').onclick = openBackupPanel;
  initUx();
  initPlus();
  $('#fileAny').onchange = e => handleFiles(Array.from(e.target.files));
  recompute();
  let first = 'help';
  if (dbCounts(DB).nc) { let t = null; try { t = sessionStorage.getItem(LS_PREFIX + 'ui:tab'); } catch (e) { } first = (t && $('#tab-' + t)) ? t : 'class'; }
  renderBanners(); updateSaveState();
  showTab(first);
}
window.__app = { get DB() { return DB; }, get CUR() { return CUR; }, get MODELS() { return MODELS; }, ST, parseNeis, buildModels, gradeStats, mergeDb, attachHandle, save, lsHas, buildClassBook, buildGradeBook, makeBackupWb: () => makeBackupWb(), handleFiles, renderAll, UI, showTab };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
