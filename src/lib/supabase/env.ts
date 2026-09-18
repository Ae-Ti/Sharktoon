/**
 * 데이터 출처를 고른다.
 *
 * 기본은 자동이다 — Supabase 키가 있으면 실제 저장소, 없으면 목.
 * NEXT_PUBLIC_DATA_SOURCE 로 강제할 수 있다. 키가 있어도 목으로 돌려
 * 화면만 빠르게 보거나, 목 상태를 섞지 않고 실 데이터만 보고 싶을 때 쓴다.
 */

export type DataSource = "mock" | "supabase";

export function dataSource(): DataSource {
  const forced = process.env.NEXT_PUBLIC_DATA_SOURCE;
  if (forced === "mock" || forced === "supabase") return forced;
  return hasSupabaseKeys() ? "supabase" : "mock";
}

export function hasSupabaseKeys(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** 화면이 실제 저장소를 쓰는가. 목 안내 띠와 로그인 동작이 이 값을 본다. */
export function isSupabaseConfigured(): boolean {
  return dataSource() === "supabase";
}

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_DATA_SOURCE=supabase 인데 키가 없습니다. .env.example 참고.",
    );
  }
  return { url, anonKey };
}
