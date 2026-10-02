# 생성 & 편집 — 오너: 웅싯(A)

콘티 생성(2.2), 이미지 생성과 큐(3.1), 레이어 편집기(3.2), 게시물 패키지(4.1),
릴스 애니메이션(5.1), 콘텐츠 필터.

접점 타입은 `src/contracts/`에 있다. 크레딧은 `CreditLedger`를 호출만 하고 구현하지 않는다.

크레딧 정산(hold·commit·refund)은 **생성 워커(`pipeline.ts`)만** 부른다. 서버 액션으로 화면에 열지 않는다 —
열면 사용자가 생성 중인 hold 를 직접 환불할 수 있다(마이그레이션 0005).

| 자리 | 하는 일 |
|---|---|
| `data/` | 콘티·잡·컷·게시물 패키지 저장소. 목/Supabase 두 구현, `getGenerationStore()` |
| `pipeline.ts` | 큐 등록, 컷별 hold → 생성 → 저장 → commit / refund |
| `storyboard/` | 콘티 생성(LLM 또는 사연으로 짠 목) |
| `post/` | 게시물 패키지(캡션 3안·해시태그·첫 댓글) |
| `editor/` | 캔버스, 꼬리·스냅·확대, 글꼴, 처음 레이어 만들기, PNG·ZIP 내보내기 |
| `llm.ts` | 구조화 출력 호출(Claude Opus 5.5) |
