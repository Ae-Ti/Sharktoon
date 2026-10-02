import { dataSource } from "@/lib/supabase/env";
import { mockGenerationStore } from "./mock";
import type { GenerationStore } from "./types";

/** 화면과 파이프라인은 이 함수만 부른다. 플랫폼의 `getRepository()` 와 같은 규칙이다. */
export async function getGenerationStore(): Promise<GenerationStore> {
  if (dataSource() === "mock") return mockGenerationStore;
  const { supabaseGenerationStore } = await import("./supabase");
  return supabaseGenerationStore;
}

export * from "./types";
