/* ===== app3b_backup.js : 백업·지우기·되살리기 ===== */
const BACKUP_MARK = 'NAESHIN_ANALYZER_BACKUP';
const CHUNK = 30000;
async function openBackupPanel() {
  const hasLs = lsHas(), hasH = await idbHasHandle(), others = lsOtherKeys();
  const c = dbCounts(DB);
  /* 상태 알약: ok=안전(초록), warn=주의(노랑), 그 밖=정보(기본색) */
  const st = (kind, t) => '<span class="pill ' + kind + '">' + t + '</span>';
  const html = '<div class="row" style="margin-bottom:8px">' +
    st(ST.handle ? 'ok' : 'warn', ST.handle ? '✓ 파일에 저장 연결됨' : '! 파일 미연결') +
    st(hasLs ? 'warn' : 'ok', hasLs ? '! 이 PC 브라우저에 임시 사본 있음' : '✓ 이 PC 브라우저 사본 없음') +
    st('', hasH ? '기억해 둔 파일 연결 있음' : '기억해 둔 파일 연결 없음') + '</div>' +
    '<p class="muted">지금 기록: ' + c.nc + '개 반 · 학생 ' + c.ns + '명 · 과목 기록 ' + c.nr + '건' + (others.length ? ' · 다른 도우미 파일의 임시 기록 ' + others.length + '개' : '') + '</p>' +
    '<p>파일에 저장 연결을 해 두면 브라우저에는 처음부터 사본을 남기지 않습니다(처음부터 안 남기는 습관). 「백업·지우기」는 <b>퇴근할 때 책상 정리 + 사본 챙기기</b>입니다.</p>' +
    '<p class="muted">두 기능 모두 브라우저만 정리합니다. HTML 파일과 백업 엑셀은 암호화되지 않은 파일이니 직접 관리하고, 보관·파기는 학교 개인정보 지침을 따라 주세요.</p>' +
    '<p><i data-ic="package"></i>새 버전 파일로 옮길 때도 이 백업을 씁니다.</p>';
  modal('백업·지우기', html, [
    { label: '백업 받고 이 PC 기록 지우기', danger: true, left: true, onClick: () => { setTimeout(backupAndClear, 0); } },
    { label: '닫기' },
    { label: '백업 파일로 되살리기', onClick: () => { setTimeout(pickRestore, 0); } },
    { label: '엑셀로 백업만 받기', primary: true, onClick: async () => { await downloadBackup(); } }
  ]);
}
async function makeBackupWb() {
  const wb = newWorkbook();
  const g = wb.addWorksheet('안내');
  g.getColumn(1).width = 110;
  const c = dbCounts(DB);
  ['내신 성적 분석 도우미 백업 (v' + APP_VERSION + ', ' + APP_DATE + ')', '만든 때: ' + nowStamp(), '들어 있는 기록: ' + c.nc + '개 반 · 학생 ' + c.ns + '명 · 과목 기록 ' + c.nr + '건', '',
    '⚠ 이 파일에는 학생 성적(개인정보)이 암호화되지 않은 상태로 들어 있습니다. 보관·파기는 학교 개인정보 지침을 따라 주세요.',
    '되살리기: 도우미의 「백업·지우기 → 백업 파일로 되살리기」 또는 「성적 올리기」 칸에 이 파일을 올립니다.',
    '숨김 시트(_backup)는 지우거나 고치지 마세요. 고치면 되살릴 때 손상으로 판정됩니다.'].forEach((t, i) => cellSet(g, i + 1, 1, t, i === 0 ? { font: { bold: true, size: 14 } } : i === 4 ? { font: { bold: true, color: { argb: 'FFC94C67' } } } : {}));
  const l = wb.addWorksheet('반목록');
  styleHeader(l, 1, 1, ['반', '학생 수', '과목 기록', '원본 파일', '올린 때']);
  Object.values(DB.classes).forEach((x, i) => { const r = l.getRow(i + 2); r.values = [x.ban, Object.keys(x.stu).length, x.rows.length, x.fileName || '', x.loadedAt ? new Date(x.loadedAt).toLocaleString('ko-KR') : '']; });
  [14, 8, 10, 40, 24].forEach((w, i) => l.getColumn(i + 1).width = w);
  const rw = wb.addWorksheet('통합원자료');
  const mp = mapLookup(CUR), recs = [];
  Object.values(DB.classes).forEach(x => x.rows.forEach(r => recs.push({ ban: x.ban, banNo: x.banNo, no: r[0], name: x.stu[r[0]] || '', hak: r[1], sem: r[2], gyo: r[3], sub: r[4], cr: r[5], score: r[6], avg: r[7], ach: r[8], rank: r[9], cnt: r[10], kind: r[11], grp: r[11] === 1 ? (mp[normKey(r[3])] || r[3]) : r[3], dev: (r[6] !== '' && r[7] !== '') ? r[6] - r[7] : '', term: r[1] + '-' + r[2] })));
  dumpRaw(rw, recs);
  const b = wb.addWorksheet('_backup', { state: 'hidden' });
  const json = JSON.stringify({ db: DB, cur: CUR, ver: APP_VERSION });
  b.getCell('A1').value = BACKUP_MARK; b.getCell('A2').value = 1; b.getCell('A3').value = nowStamp(); b.getCell('A4').value = json.length;
  for (let i = 0, k = 5; i < json.length; i += CHUNK, k++) b.getCell('A' + k).value = json.slice(i, i + CHUNK);
  return wb;
}
async function downloadBackup() {
  const wb = await makeBackupWb();
  const buf = await wb.xlsx.writeBuffer();
  const d = new Date(), z = n => String(n).padStart(2, '0');
  saveBlob(buf, 'naeshin_backup_' + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '_' + z(d.getHours()) + z(d.getMinutes()) + '.xlsx');
  toast('백업 엑셀을 내려받았습니다.', 'ok');
}
async function backupAndClear() {
  await downloadBackup();
  const others = lsOtherKeys();
  const html = '<p>백업 엑셀을 내려받았습니다. <b>다운로드 폴더에 파일이 있는지 먼저 확인</b>한 뒤 지워 주세요.</p>' +
    '<p>지우는 것: 이 PC 브라우저에 남은 이 도우미의 임시 기록, 기억해 둔 파일 연결.</p>' +
    (ST.handle ? '<p class="muted">파일에 저장 연결되어 있으니 HTML 파일 안의 기록은 그대로 남습니다.</p>' : '<p class="msg-warn">파일에 저장 연결이 안 되어 있어, 지우면 이 화면의 성적은 백업 엑셀에만 남습니다.</p>') +
    (others.length ? '<label><input type="checkbox" id="clrOthers"> 다른 도우미 파일의 임시 기록 ' + others.length + '개도 지우기</label>' : '');
  modal('이 PC 기록 지우기', html, [{ label: '취소' }, {
    label: '다운로드 폴더를 확인한 뒤 지우기', danger: true, onClick: async (bg) => {
      const chk = $('#clrOthers', bg);
      clearTimeout(ST.timer); ST.timer = null;
      lsRemove();
      try { await idbDel('h:' + DB.fileId); } catch (e) { }
      if (chk && chk.checked) others.forEach(k => { try { localStorage.removeItem(k); } catch (e) { } });
      try { localStorage.removeItem(LS_PREFIX + 'ui:tab'); } catch (e) { }
      ST.dirty = false; ST.handle = null;
      location.reload();
    }
  }]);
}
function pickRestore() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.xlsx';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const wb = await readWorkbook(f);
      if (!(await tryBackup(wb, f.name, null))) modal('백업 파일이 아닙니다', '<p>「' + esc(f.name) + '」에서 도우미 백업 표식을 찾지 못했습니다.</p>');
    } catch (e) { modal('읽지 못했습니다', '<p>' + esc(e.message || e) + '</p>'); }
  };
  inp.click();
}
/* 어느 업로드 경로로 올려도 백업 파일을 알아본다 */
async function tryBackup(wb, name, logs) {
  const ws = wb.Sheets['_backup'];
  if (!ws || !ws.A1 || nz(ws.A1.v) !== BACKUP_MARK) return false;
  const total = Number(ws.A4 && ws.A4.v);
  let s = '';
  for (let k = 5; ws['A' + k]; k++) s += String(ws['A' + k].v);
  if (s.length !== total) { modal('백업 파일이 손상되었습니다', '<p>「' + esc(name) + '」의 기록 길이가 맞지 않습니다(' + s.length + ' / ' + total + '). 엑셀에서 숨김 시트를 고쳤거나 파일이 잘렸을 수 있습니다.</p>'); return true; }
  let b;
  try { b = JSON.parse(s); } catch (e) { modal('백업 파일이 손상되었습니다', '<p>기록을 해석하지 못했습니다.</p>'); return true; }
  const bc = dbCounts(b.db);
  const preset = DB.demo || !dbCounts(DB).nc || !CUR.updatedAt;
  const html = '<p><b>' + esc(name) + '</b> (v' + esc(b.ver || '?') + ', ' + esc(nz(ws.A3 && ws.A3.v)) + ')</p><p>백업 기록: ' + bc.nc + '개 반 · 학생 ' + bc.ns + '명. 지금 기록에 <b>합칩니다</b>(같은 반은 더 최근에 올린 쪽을 남김).</p>' +
    '<label><input type="checkbox" id="rsCur"' + (preset ? ' checked' : '') + '> 설정(기준값·교과군 매핑)도 백업 것으로 바꾸기</label>';
  return new Promise(res => {
    modal('백업 파일로 되살리기', html, [{ label: '취소', onClick: () => res(true) }, {
      label: '되살리기', primary: true, onClick: (bg) => {
        const useCur = $('#rsCur', bg).checked;
        if (DB.demo) { DB.classes = {}; DB.tomb = {}; DB.demo = false; }
        const r = mergeDb(DB, b.db);
        if (useCur && b.cur) CUR = fillCur(b.cur);
        markDirty(); renderAll();
        const msg = '추가 ' + r.added + '개 반 · 갱신 ' + r.updated + ' · 같아서 건너뜀 ' + r.same + ' · 더 오래돼서 건너뜀 ' + r.older + (r.bad ? ' · 손상돼 건너뜀 ' + r.bad : '') + (useCur ? ' · 설정도 바꿈' : '');
        if (logs) logs.push(['info', name + ': 백업 되살리기 — ' + msg]);
        else setTimeout(() => modal('되살리기 결과', '<p>' + esc(msg) + '</p>'), 0);
        res(true);
      }
    }]);
  });
}
