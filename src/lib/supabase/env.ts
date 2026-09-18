/**
 * Supabase 키가 아직 없어도 앱이 돌아야 한다. 프로젝트 연결 전에는
 * 목 저장소로 화면을 만들고, 키가 생기면 이 함수가 true 가 되면서
 * 실제 저장소로 갈아탄다.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다. .env.example 참고.",
    );
  }
  return { url, anonKey };
}
