import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import type { Database } from "./database.types";

/** 서버 컴포넌트와 Route Handler 용. 요청마다 새로 만든다. */
export async function createClient() {
  const { url, anonKey } = supabaseEnv();
  const store = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) {
            store.set(name, value, options);
          }
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 미들웨어가 갱신을 맡는다.
        }
      },
    },
  });
}
