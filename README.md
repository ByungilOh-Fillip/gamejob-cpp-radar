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
