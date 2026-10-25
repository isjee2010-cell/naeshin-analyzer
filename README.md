# 내신 성적 분석 도우미

나이스에서 내려받은 **교과학습발달상황 엑셀**을 넣으면 **반별 학생카드**(학생당 3쪽)와 **학년 전체 분석**을 바로 만들어 주는 HTML 파일 하나짜리 도구입니다.
설치할 것도, 가입할 것도 없습니다. **크롬 또는 엣지**로 파일을 열면 됩니다.

> **성적은 이 PC 밖으로 나가지 않습니다.** 서버도 계정도 통계 수집도 없고, 브라우저 보안 정책으로 외부 통신 자체를 막아 두었습니다. 자세한 내용은 아래 [개인정보와 보안](#개인정보와-보안)을 보세요.

## 내려받기

**[최신 버전 내려받기 (Releases)](https://github.com/isjee2010-cell/naeshin-analyzer/releases/latest)** · **[사용 매뉴얼 PDF 바로 받기](https://github.com/isjee2010-cell/naeshin-analyzer/releases/latest/download/naeshin_manual.pdf)**

| 파일 | 설명 |
|---|---|
| `naeshin_helper_v○.○.html` | 도우미 본체. 내 폴더에 저장한 뒤 크롬·엣지로 엽니다. |
| `naeshin_settings_v○.○.xlsx` | (선택) 판정 기준값·교과군 매핑을 엑셀로 고쳐 올릴 때 쓰는 양식 |
| `naeshin_manual.pdf` | 사용 매뉴얼 (A4 18쪽). 화면 사진에 누를 곳을 번호·빨간 상자로 표시했습니다. |
| `SHA256SUMS.txt` | 받은 파일이 원본과 같은지 확인하는 값 |

받은 파일이 원본과 같은지 확인하려면 (선택)

- Windows: `certutil -hashfile naeshin_helper_v1.4.html SHA256`
- macOS: `shasum -a 256 naeshin_helper_v1.4.html`

나온 값이 `SHA256SUMS.txt`의 값과 같으면 됩니다.

## 쓰는 법

> 화면 사진과 함께 자세히 보려면 **[사용 매뉴얼 PDF](https://github.com/isjee2010-cell/naeshin-analyzer/releases/latest/download/naeshin_manual.pdf)** 를 받아 보세요. 역할별(담임·학년부·설정 담당)로 나뉘어 있습니다.

1. **나이스 파일 받기**: 나이스 › 학교생활기록부 › 학생부 항목별 조회 › 교과학습발달상황 › 교과학습발달상황 › **XLS Data** (반마다 한 번)
2. 받은 HTML을 **내 폴더에 저장한 뒤** 크롬·엣지로 엽니다. (메신저 첨부를 바로 열지 마세요.)
3. 위쪽 「**파일에 저장 연결**」로 지금 연 그 HTML 파일을 고릅니다. 이후 기록은 이 파일 안에 저장됩니다.
4. 「성적 올리기」에 나이스 파일을 끌어다 놓습니다. 여러 반을 한꺼번에 놓아도 됩니다.
5. 「반 요약」「학생카드」「학년 분석」에서 보고, 인쇄하거나 엑셀로 받습니다.

| 누가 | 하는 일 |
|---|---|
| 설정 담당 (학년부·정보부) | 「설정」에서 판정 기준값·교과군 매핑 확인 → 「배포본 만들기」로 **성적 없는** HTML을 만들어 나눠 줌 |
| 담임 | 우리 반 나이스 파일을 올려 반 요약·학생카드 확인, 인쇄 |
| 학년부장 | 모든 반 파일을 한꺼번에 올려 학년 분석, 반별 엑셀 배부 |

- 5등급(2022 개정)·9등급(2015 개정)은 자동으로 구분합니다.
- 화면을 띄워 회의·연수를 할 때는 「보기 › 이름 가리기」를 켜면 이름이 김○영처럼 보입니다.
- 새 버전으로 옮길 때: 쓰던 파일에서 「백업·지우기 › 엑셀로 백업만 받기」 → 새 파일에서 「백업 파일로 되살리기」 → 「파일에 저장 연결」

## 개인정보와 보안

### 데이터가 있는 곳

| 위치 | 언제 | 지우는 법 |
|---|---|---|
| **HTML 파일 자체** | 「파일에 저장 연결」을 한 뒤 | 그 HTML 파일을 지우거나 「백업·지우기」 |
| 브라우저 임시 저장소 (이 PC·이 브라우저) | 저장 연결 **전**에만 임시로 | 「백업·지우기 › 백업 받고 이 PC 기록 지우기」 |
| 내려받은 엑셀·인쇄물·백업 엑셀 | 직접 받았을 때 | 학교 지침에 따라 보관·파기 |

- 성적이 들어간 HTML·백업 엑셀은 **암호화되지 않습니다.** 학생 개인정보이므로 보관·전달·파기는 학교 개인정보 보호 지침을 따르세요.
- 공용 PC에서 썼다면 마칠 때 「백업·지우기 › 백업 받고 이 PC 기록 지우기」를 누르세요.
- **성적이 들어간 HTML을 다른 사람에게 보내지 마세요.** 나눠 줄 때는 「설정 › 배포본 만들기」로 만든 성적 없는 파일을 쓰세요.

### 외부 통신을 막는 방법

- HTML 머리에 **보안 정책(Content-Security-Policy)** 이 들어 있어, 브라우저가 이 페이지의 모든 외부 요청(`connect-src`, 이미지, 폰트, 프레임, 폼 전송 등)을 차단합니다. 코드에 실수나 문제가 있어도 성적을 밖으로 보낼 길이 없습니다.
- 앱 코드에는 통신 기능(fetch, XMLHttpRequest, WebSocket 등)이 없으며, [`tools/check.py`](tools/check.py)가 매번 이를 검사합니다.
- 직접 확인: 파일을 연 상태에서 `F12` → **Network** 탭을 열고 성적 파일을 올려 보세요. 외부로 나가는 요청이 없습니다.
- 학생 이름·과목명에 공격용 코드가 들어 있어도 실행되지 않는지, 조작된 백업·HTML을 합쳐도 안전한지 [`tests/e2e.mjs`](tests/e2e.mjs)가 매번 시험합니다.

### 이슈·문의를 남길 때

- **실제 학생 이름·성적이 보이는 파일이나 화면 캡처는 절대 올리지 마세요.** 문제 재현이 필요하면 「가상 예시 데이터로 둘러보기」나 이름 가리기를 쓴 화면을 써 주세요.
- 보안 문제는 공개 이슈 대신 [SECURITY.md](SECURITY.md)의 방법으로 알려 주세요.

## 직접 만들어 보기 (개발자용)

```bash
python3 tools/build.py      # src/ + vendor/ → dist/naeshin_helper_v○.○.html
python3 tools/check.py      # 보안 점검 (데이터 없음, CSP, 통신 기능 없음, 자료 파일 미포함)

# 브라우저 시험 (가상 데이터 생성 후)
python3 -m pip install openpyxl
python3 tools/make_sample.py tests/tmp g2 && python3 tools/make_sample.py tests/tmp xss
cd tests && npm ci && npx playwright install chromium && node e2e.mjs
```

- 빌드는 같은 소스에서 항상 같은 파일이 나옵니다. Releases의 HTML과 직접 빌드한 파일의 SHA-256을 비교해 볼 수 있습니다.
- 포함 라이브러리는 `vendor/`에 있고, `vendor/SHA256SUMS`와 해시가 맞을 때만 빌드됩니다.

## 포함 라이브러리

- [ExcelJS](https://github.com/exceljs/exceljs) 4.4.0 — MIT License (엑셀 쓰기)
- [SheetJS Community Edition](https://sheetjs.com) 0.20.3 — Apache License 2.0 (엑셀 읽기)

라이선스 전문은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)와 `vendor/`에 있습니다.

## 알아 두실 점

- 분석 결과(유형 판정, 목표 등급, 처방 문구)는 **상담 참고용**입니다. 학교의 성적 관리 규정과 담임 판단이 우선합니다.
- 나이스 화면·양식이 바뀌면 파일을 읽지 못할 수 있습니다. 이럴 땐 이슈로 알려 주세요(실제 파일은 첨부하지 말고 열 제목만).

## 라이선스

MIT License © isjee2010-cell — [LICENSE](LICENSE)
