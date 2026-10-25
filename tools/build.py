"""내신 성적 분석 도우미 빌드: src/ + vendor/ → dist/naeshin_helper_v{버전}.html

- vendor/ 라이브러리는 vendor/SHA256SUMS 에 적힌 해시와 일치할 때만 넣습니다 (바뀐 파일이면 빌드 중단).
- 배포 HTML의 데이터 칸(J-DB)은 항상 빈 상태로 만듭니다. 성적은 들어가지 않습니다.
사용법: python3 tools/build.py
"""
import hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, VEN, DIST = (os.path.join(ROOT, d) for d in ('src', 'vendor', 'dist'))
APP_FILES = ['app0_icons.js', 'app1_core.js', 'app2_ui.js', 'app2b_views.js', 'app2c_ux.js',
             'app2d_plus.js', 'app3_io.js', 'app3b_backup.js']


def rd(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def vendor_lib(prefix):
    """SHA256SUMS에 등록된 파일 중 prefix로 시작하는 것을 해시 확인 후 읽는다."""
    sums = {}
    for line in rd(os.path.join(VEN, 'SHA256SUMS')).splitlines():
        if line.strip() and not line.startswith('#'):
            h, name = line.split()
            sums[name.lstrip('*')] = h
    names = [n for n in sums if n.startswith(prefix)]
    if len(names) != 1:
        sys.exit('vendor/SHA256SUMS 에 %s 라이브러리가 정확히 하나 있어야 합니다: %r' % (prefix, names))
    name = names[0]
    data = open(os.path.join(VEN, name), 'rb').read()
    got = hashlib.sha256(data).hexdigest()
    if got != sums[name]:
        sys.exit('해시 불일치: %s\n  기대 %s\n  실제 %s' % (name, sums[name], got))
    text = data.decode('utf-8')
    if '</script' in text.lower():
        sys.exit('%s 안에 </script 문자열이 있어 HTML에 넣을 수 없습니다' % name)
    return name, text


def main():
    core = rd(os.path.join(SRC, 'app1_core.js'))
    ver = re.search(r"APP_VERSION = '([^']+)'", core).group(1)
    app = '\n'.join(rd(os.path.join(SRC, f)) for f in APP_FILES)
    if '</script' in app.lower():
        sys.exit('앱 코드 안에 </script 문자열이 있습니다')
    xl_name, xl = vendor_lib('xlsx-')
    ex_name, ex = vendor_lib('exceljs-')
    db = {"v": 1, "fileId": "fnaeshin0001", "updatedAt": 0, "classes": {}, "tomb": {}, "demo": False}
    j = lambda o: json.dumps(o, ensure_ascii=False).replace('<', '\\u003c')
    html = rd(os.path.join(SRC, 'shell.html'))
    html = html.replace('/*@@VER@@*/', ver).replace('/*@@CSS@@*/', rd(os.path.join(SRC, 'app.css')))
    html = html.replace('/*@@DB@@*/', j(db)).replace('/*@@CUR@@*/', 'null')
    for key, val in [('/*@@XLSXJS@@*/', xl), ('/*@@EXCELJS@@*/', ex), ('/*@@APP@@*/', app)]:
        i = html.index(key)
        html = html[:i] + val + html[i + len(key):]
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, 'naeshin_helper_v%s.html' % ver)
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    h = hashlib.sha256(html.encode('utf-8')).hexdigest()
    print('빌드 완료: %s (%d bytes)\n  SHA-256 %s\n  포함: %s, %s' % (os.path.relpath(out, ROOT), len(html.encode('utf-8')), h, xl_name, ex_name))


if __name__ == '__main__':
    main()
