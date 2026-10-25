"""보안 점검 (CI와 배포 전에 실행): python3 tools/check.py dist/naeshin_helper_v*.html

1) 배포 HTML에 성적 데이터가 들어 있지 않은가
2) 외부 통신을 막는 보안 정책(CSP)이 그대로 있는가
3) 앱 코드에 외부로 데이터를 보낼 수 있는 기능(fetch 등)이나 외부 주소가 없는가
4) 저장소에 엑셀·CSV·백업 같은 자료 파일이 올라가 있지 않은가
하나라도 어긋나면 실패(종료 코드 1)합니다.
"""
import glob, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
problems = []


def fail(msg):
    problems.append(msg)


def rd(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


REQUIRED_CSP = ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "base-uri 'none'",
                "frame-src 'none'", "object-src 'none'", "worker-src 'none'"]


def check_html(path):
    html = rd(path)
    m = re.search(r'<script id="J-DB" type="application/json">(.*?)</script>', html, re.S)
    if not m:
        fail('%s: 데이터 칸(J-DB)을 찾지 못했습니다' % path)
    else:
        db = json.loads(m.group(1))
        if db.get('classes') or db.get('tomb') or db.get('demo'):
            fail('%s: 배포 HTML에 성적 데이터가 들어 있습니다' % path)
    m = re.search(r'<script id="J-CUR" type="application/json">(.*?)</script>', html, re.S)
    if not m or m.group(1).strip() != 'null':
        fail('%s: 설정 칸(J-CUR)이 비어 있지 않습니다' % path)
    csp = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">', html)
    if not csp:
        fail('%s: 보안 정책(CSP) meta가 없습니다' % path)
    else:
        if html.index(csp.group(0)) > html.index('<script'):
            fail('%s: CSP가 첫 스크립트보다 뒤에 있습니다' % path)
        for d in REQUIRED_CSP:
            if d not in csp.group(1):
                fail('%s: CSP에 %s 가 없습니다' % (path, d))
        if 'unsafe-eval' in csp.group(1) or re.search(r'https?:', csp.group(1)):
            fail('%s: CSP가 외부 주소나 eval을 허용합니다' % path)
    if re.search(r'<script[^>]+src=|<link[^>]+href=|<iframe|<img[^>]+src="https?:', html, re.I):
        fail('%s: 외부 파일을 불러오는 태그가 있습니다' % path)


NETWORK_API = re.compile(r'\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|'
                         r'RTCPeerConnection|\bnew\s+Worker\b|\beval\s*\(|new\s+Function\s*\(|\.src\s*=(?!\s*\x27data:)|window\.open\s*\(')
URL = re.compile(r'https?://(?!www\.w3\.org/2000/svg)[^\s\'"<>)]+')


def check_src():
    for p in sorted(glob.glob(os.path.join(ROOT, 'src', '*'))):
        t = rd(p)
        for i, line in enumerate(t.splitlines(), 1):
            if p.endswith('.js') and NETWORK_API.search(line):
                fail('%s:%d: 통신·코드 실행 기능 사용: %s' % (os.path.relpath(p, ROOT), i, line.strip()[:120]))
            u = URL.search(line)
            if u and not (p.endswith('shell.html') and 'apache.org/licenses' in line):
                fail('%s:%d: 외부 주소: %s' % (os.path.relpath(p, ROOT), i, u.group(0)))


BLOCKED_EXT = ('.xls', '.xlsx', '.xlsm', '.csv', '.hwp', '.hwpx', '.pdf', '.json', '.zip')


def check_tracked():
    try:
        files = subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).splitlines()
    except Exception:
        return
    for f in files:
        low = f.lower()
        if low.endswith(BLOCKED_EXT) and low not in ('tests/package.json', 'tests/package-lock.json'):
            fail('저장소에 자료 파일이 있습니다: %s (성적·명단 유출 위험)' % f)
        if low.startswith('dist/') or re.search(r'naeshin_(helper|backup)_', low):
            fail('저장소에 배포·백업 파일이 있습니다: %s (Releases에만 올립니다)' % f)


if __name__ == '__main__':
    targets = sys.argv[1:] or glob.glob(os.path.join(ROOT, 'dist', '*.html'))
    if not targets:
        fail('점검할 배포 HTML이 없습니다. 먼저 python3 tools/build.py 를 실행하세요')
    for t in targets:
        check_html(t)
    check_src()
    check_tracked()
    if problems:
        print('보안 점검 실패 (%d건)' % len(problems))
        for p in problems:
            print(' -', p)
        sys.exit(1)
    print('보안 점검 통과: %s' % ', '.join(os.path.basename(t) for t in targets))
