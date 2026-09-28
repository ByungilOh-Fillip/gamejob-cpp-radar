# GameJob C++ Career Radar

GameJob의 게임 개발 채용공고를 수집해 C++ 클라이언트 / 서버 / 엔진 직무를 탐색하는 로컬 Node.js 웹앱입니다.

## 1. 실행

Node.js 20 이상을 설치한 뒤 프로젝트 폴더에서:

```bash
npm run dev
```

**처음 실행해도 됩니다.** `node_modules`가 없으면 `npm run dev` 전에 필요한 패키지를 자동으로 `npm install`합니다.

브라우저에서 `http://localhost:3000`을 엽니다.

## 2. 크롤링

UI의 **지금 크롤링** 버튼을 누르거나:

```bash
npm run crawl
```

수집 결과는 `data/jobs.json`에 저장됩니다.

크롤러는 첫 목록 URL에서 시작해 GameJob HTML의 실제 상세 공고 링크와 페이지네이션 링크를 따라가므로 `Page=2` 같은 URL 규칙을 임의로 가정하지 않습니다.

환경변수:

- `MAX_PAGES=20` : 최대 목록 페이지 수
- `CRAWL_DELAY_MS=900` : 요청 사이 대기시간(ms)
- `PORT=3000` : 서버 포트
- `GAMEJOB_LIST_URL=...` : 시작 목록 URL

## 3. UI 기능

- 직무: 클라이언트 / 서버 / 엔진
- 엔진: Unreal Engine 5 / Unreal / Godot / Unity / 자체 엔진
- 회사 규모
- 경력
- 고용형태
- 연봉 구간: 수집된 숫자 기준으로 필터링
- 지역
- 회사 / 기술 / JD 검색
- 적합 조건 / 최근 수집 / 연봉 정렬
- 공고 상세: JD / 전형 / 지원기간 / 처우 / 회사규모 / 경력 / GameJob 원문

### 지역 정렬

현재 데이터의 지역 문자열을 기준으로 지역 필터와 정렬을 제공합니다. 실제 출퇴근 거리까지 계산하려면 각 회사 주소의 좌표화가 추가로 필요합니다. 이 버전에서는 임의의 사용자 위치를 저장하거나 추정하지 않습니다.

## 4. Docker

```bash
docker build -t gamejob-radar .
docker run --rm -p 3000:3000 gamejob-radar
```

## 주의

GameJob 페이지 구조가 변경되면 CSS 선택자나 파서 보정이 필요할 수 있습니다. 요청 빈도를 과도하게 높이지 말고 서비스의 이용약관 및 robots 정책을 확인한 뒤 사용하세요.

## 5. 트러블슈팅 및 문제 해결 기록 (2026-09-28)

이 문서는 게임잡 크롤러를 개발 및 유지보수하며 발생했던 주요 문제점(Problem)들과 해결 방법(Solution)을 정리한 기록입니다.

### 1. 상세 정보(회사명, 포지션명, JD 등) 크롤링 누락 문제

**[Problem]**
- 크롤링 결과에 회사명이 JS 코드로 들어오거나, 포지션명이 '배너'로 수집되는 등 데이터가 엉뚱하게 수집됨.
- 담당업무, 자격요건 등의 JD(Job Description)가 아예 빈 칸으로 나옴.

**[Cause]**
- 게임잡 상세 페이지의 DOM 구조 변경으로 인해 제목(`h1`, `h2`)과 회사명(`.company_name`)의 클래스가 달라짐.
- 가장 중요한 직무 상세 내용(JD)이 메인 HTML 본문에 있는 것이 아니라, 숨겨진 `<iframe>` 내부에 별도의 페이지로 로드되고 있었음.

**[Solution]**
- **정확한 DOM 선택자 활용**: 메인 페이지에 숨겨진 `<input type="hidden">` 데이터(`#GI_Title`, `#C_Name`, `#Want_Area_C`)와 `<dl class="recruit-data-item">` 데이터 테이블을 우선적으로 읽어오도록 파싱 로직 교체.
- **Iframe Fetch 추가**: 페이지 내에 포함된 `GI_Read` 관련 `<iframe>` 주소를 모두 찾아내어 추가로 HTML을 Fetch한 뒤 텍스트를 병합하는 로직 추가.

---

### 2. JD(상세 내용) 텍스트 포맷 깨짐 현상

**[Problem]**
- JD를 수집하긴 했으나, 줄바꿈(Enter) 없이 모든 글자가 한 줄로 뭉개져서(거대한 텍스트 블록) 가독성이 매우 떨어짐.

**[Cause]**
- Cheerio의 `.text()` 함수 특성 상 HTML 내의 `<br>`이나 `<p>`, `<li>` 태그의 구분을 무시하고 텍스트만 추출함.
- 이후 공백을 하나로 합치는 정제(Clean) 정규식 로직(`replace(/\s+/g, " ")`)을 거치며 줄바꿈 마저 전부 삭제됨.

**[Solution]**
- **줄바꿈 보존 로직 추가**: `.text()`를 호출하기 전, DOM 구조 내의 `<br>`을 `\n` 문자로 치환하고 블록 태그(`p, div, li` 등)의 끝에 `\n`을 강제로 추가하는 `extractFormattedText` 헬퍼 함수 도입.
- 다중행(Multiline)을 지원하는 텍스트 정제 함수를 별도로 분리하여 가독성 높은 JD 포맷팅 유지.

---

### 3. 페이지네이션(Pagination) 진행 불가 문제 (1페이지만 수집)

**[Problem]**
- 총 공고 수가 수십~수백 개에 달함에도 불구하고 항상 30~40개(1페이지 분량)만 크롤링되고 프로그램이 종료됨.

**[Cause]**
- 게임잡 사이트가 보안 및 매크로 방지를 위해 일반적인 URL 파라미터(예: `&Page=2`)를 통한 GET 방식의 페이지 이동을 무시함 (항상 1페이지 결과만 반환).
- 실제 웹사이트에서는 AJAX 방식의 `POST` 요청(`/Recruit/_GI_Job_List`)을 통해서만 다음 페이지의 HTML 조각을 받아오고 있었음.

**[Solution]**
- 크롤러의 루프 구조를 전면 수정하여, 1페이지는 일반 `GET` 방식으로 가져오되 **2페이지부터는 `URLSearchParams`를 조합하여 `POST` 방식으로 HTML을 요청**하도록 패치.
- 결과적으로 페이지네이션 차단을 완벽하게 우회하여 검색된 전체 공고(자체 엔진 포함)를 모두 수집 가능해짐.

---

### 4. 정적 웹호스팅(GitHub Pages)에서의 자동화 불가 문제

**[Problem]**
- 완성된 프로젝트를 GitHub Pages에 배포하려 했으나, GitHub Pages는 정적(Static) 파일 호스팅만 지원하므로 동적으로 크롤러를 구동하는 Node.js 백엔드 서버(`/api/crawl`)를 실행할 수 없음.

**[Cause]**
- GitHub Pages 환경의 태생적 한계.

**[Solution]**
- **GitHub Actions (Serverless CI/CD) 도입**: 매일 아침 6시(또는 코드 Push 시)에 GitHub 클라우드 서버가 백그라운드에서 크롤러(`npm run crawl:once`)를 구동하도록 `.github/workflows/deploy.yml` 작성.
- 업데이트된 `jobs.json` 결과를 포함한 전체 `public` 폴더를 GitHub Pages로 자동 빌드 및 배포하도록 파이프라인 구축 (Static API 패턴).
- 프론트엔드(`index.html`)는 백엔드 없이 `./data/jobs.json` 정적 파일을 직접 읽어오도록 수정하여 서버 유지비 없이 완전한 무인 자동화 달성.
