# 샥툰

AI 인스타툰 연재 서비스. 가보자IT.

사연 한 줄로 5분 안에 첫 인스타툰을 게시하고, 일관된 캐릭터로 다음 화까지 이어 만들게 하는 것이 목표다.

## 지금 상태

클로즈드 베타 목표일 **2026-09-28**. 스캐폴드와 공통 컴포넌트까지 올라와 있고 화면은 아직 없다.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

| 경로 | 내용 |
|---|---|
| `/` | 로그인 |
| `/onboarding/character` `/story` `/result` | 온보딩 3단계 |
| `/home` `/assets` `/series/[id]` | 홈·에셋 라이브러리·회차 타임라인 |
| `/admin` | 운영 — 첫 게시 완주율, 생성 실패율, 온보딩 깔때기, 환불 내역 |
| `/episodes/[id]/storyboard` `/generate` `/editor` | 콘티·생성 진행률·컷 편집기 |
| `/terms` `/privacy` | 약관·개인정보 처리방침 |
| `/design` | 공통 컴포넌트 12개 |

**Supabase 키가 없으면 목 데이터로 돈다.** 화면 위에 그렇다는 띠가 뜨고,
`.env.local` 에 키를 채우면 같은 화면이 실제 데이터로 바뀐다
(`src/features/platform/data/index.ts`).

## 문서

| | |
|---|---|
| [PRD · 기능명세](docs/샥툰_PRD_기능명세_합본.md) | 기준 문서. 범위·일정·정책·데이터 모델 |
| [디자인 가이드](docs/디자인_가이드.md) | 디자인 시스템과 와이어프레임 링크, 토큰 사용법 |
| [접점 계약](src/contracts/README.md) | 두 사람의 코드가 만나는 타입 |

## 구조

```
design/            디자인 토큰 (tokens.css). Tailwind 매핑은 src/app/globals.css
src/app/           라우트
src/components/ui/ 공통 컴포넌트 — 디자인 시스템 참조 구현
src/contracts/     접점 계약. 상대 합의 없이 바꾸지 않는다
src/features/generation/  웅싯(A) — 콘티·생성·편집기·게시 패키지
src/features/platform/    태일(B) — 온보딩·에셋·크레딧·결제·피드·앱
src/lib/           공용 유틸
```

코드베이스가 하나라 프론트/백엔드가 아니라 **도메인 수직 분담**이다. 각자 담당 기능의 화면·API·DB·테스트를
끝까지 책임지고, 코드 리뷰는 교차로 한다. 자세한 분담은 PRD 부록 E.

## 규칙

- 토큰 값을 코드에 박지 않는다. `#0a7d8d` 가 아니라 `bg-brand`.
- 크레딧을 쓰는 버튼은 `cost` 를 준다. 소모량을 누르기 전에 밝힌다.
- 생성 실패는 예외가 아니라 상태다. 실패 컷은 남기고, 재시도와 환불 안내를 그 자리에 둔다.
- 텍스트와 말풍선은 이미지에 굽지 않는다.
