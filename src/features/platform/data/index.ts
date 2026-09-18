import { dataSource } from "@/lib/supabase/env";
import { mockRepository } from "./mock";
import type { PlatformRepository } from "./types";

/**
 * 화면은 이 함수만 부른다. Supabase 키가 생기면 자동으로 실제 저장소로 바뀐다.
 * 목 구현을 쓰는 동안에도 화면·라우팅·상태는 최종 형태로 만든다.
 */
export async function getRepository(): Promise<PlatformRepository> {
  if (dataSource() === "mock") return mockRepository;
  const { supabaseRepository } = await import("./supabase");
  return supabaseRepository;
}

export function usingMockData(): boolean {
  return dataSource() === "mock";
}

export * from "./types";
