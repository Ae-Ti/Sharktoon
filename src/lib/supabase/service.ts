import "server-only";

import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";
import type { Database } from "./database.types";

/**
 * 서비스 롤 클라이언트. RLS 를 건너뛴다.
 *
 * 생성 워커처럼 사용자 요청 밖에서 도는 일(크레딧 정산, 컷 이미지 저장, 잡 상태)만 쓴다.
 * 이 클라이언트로 읽은 값을 그대로 화면에 넘기지 않는다 — 소유자 확인은 호출하는 쪽 몫이다.
 */
export function createServiceClient() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 가 없습니다. 크레딧 정산과 생성 결과 저장은 서버 전용 키로만 합니다. .env.example 참고.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
