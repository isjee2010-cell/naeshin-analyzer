/* ===== app0_icons.js : 단색 선 아이콘 (24×24, currentColor, 직접 그린 도형) ===== */
'use strict';
const ICONS = {
  logo: '<path d="M4 4v16h16"/><path d="M8 15l3.5-4 3 2.5L20 7"/>',
  upload: '<path d="M12 15V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  download: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  class: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M15.5 5.3a3 3 0 0 1 0 5.4"/><path d="M17.5 13.6A5.5 5.5 0 0 1 20.5 19"/>',
  card: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10.5" r="2"/><path d="M6 16.5a3 3 0 0 1 6 0"/><path d="M14.5 9.5h3.5M14.5 13h3.5"/>',
  grade: '<path d="M4 20V11M10 20V5M16 20v-6M3 20h18"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  help: '<path d="M12 7.5V20"/><path d="M3 5.5h5.5A3.5 3.5 0 0 1 12 9a3.5 3.5 0 0 1 3.5-3.5H21V18h-5.5A3.5 3.5 0 0 0 12 20a3.5 3.5 0 0 0-3.5-2H3z"/>',
  print: '<path d="M7 9V4h10v5"/><path d="M7 17H5.5A1.5 1.5 0 0 1 4 15.5v-5A1.5 1.5 0 0 1 5.5 9h13a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17"/><path d="M7 14h10v6H7z"/>',
  save: '<path d="M5.5 4h10l4.5 4.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4z"/><path d="M8 4v4.5h7V4M8 20v-6h8v6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5v2"/>',
  package: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
  compare: '<path d="M4 8h14"/><path d="M15 4.5L18.5 8 15 11.5"/><path d="M20 16H6"/><path d="M9 12.5L5.5 16 9 19.5"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  folder: '<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 12.5h9l1-12.5"/><path d="M10.5 11v5M13.5 11v5"/>'
};
function ic(name, cls) {
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
}
/* 문자열 속 <i data-ic="이름"></i> 자리를 실제 아이콘으로 채운다 (나중에 그려지는 화면까지 자동) */
function hydrateIcons(root) {
  (root || document).querySelectorAll('i[data-ic]:not([data-icd])').forEach(el => { el.setAttribute('data-icd', '1'); el.outerHTML = ic(el.getAttribute('data-ic')); });
}
(function watchIcons() {
  const run = () => hydrateIcons(document);
  if (document.body) { run(); new MutationObserver(muts => { for (const m of muts) if (m.addedNodes.length) { run(); break; } }).observe(document.body, { childList: true, subtree: true }); }
  else document.addEventListener('DOMContentLoaded', watchIcons);
})();
