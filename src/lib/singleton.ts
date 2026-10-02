/**
 * 프로세스 안에 하나만 있어야 하는 상태.
 *
 * Next dev 에서는 서버 액션과 라우트 핸들러가 같은 모듈을 서로 다른 인스턴스로 싣는다.
 * 모듈 변수에 두면 액션이 넣은 잡을 /api/jobs 가 못 찾는다(2026-10-02 실 테스트, 폴링 404).
 * 인메모리 큐·목 저장소처럼 프로세스 전체가 같이 봐야 하는 값은 여기를 거친다.
 */
export function processSingleton<T>(key: string, create: () => T): T {
  const store = globalThis as typeof globalThis & {
    __sharktoon?: Map<string, unknown>;
  };
  store.__sharktoon ??= new Map();
  if (!store.__sharktoon.has(key)) store.__sharktoon.set(key, create());
  return store.__sharktoon.get(key) as T;
}
