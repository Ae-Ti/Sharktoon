"use client";

import { useEffect, useState } from "react";
import type { GenerationJob } from "@/contracts/generation";

/** 돌고 있는 동안만 부른다. 끝난 잡을 계속 찌르지 않는다. */
const INTERVAL_MS = 700;

/**
 * 잡 상태 폴링. Supabase Realtime 이 붙으면 이 훅 안만 구독으로 바꾸고
 * 화면은 그대로 둔다.
 */
export function useJobPolling(initial: GenerationJob, initialBalance: number) {
  const [job, setJob] = useState(initial);
  const [balance, setBalance] = useState(initialBalance);

  const live = job.status === "queued" || job.status === "running";

  useEffect(() => {
    if (!live) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { job: GenerationJob; balance: number };
        setJob(body.job);
        setBalance(body.balance);
      } catch {
        // 한 번 못 받아도 다음 주기에 다시 온다. 화면에 오류를 띄우지 않는다.
      }
    }, INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [live, job.id]);

  /** 재시도처럼 잡을 다시 돌린 뒤 부른다. 끝난 잡은 폴링이 멈춰 있기 때문이다. */
  async function refresh() {
    const res = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as { job: GenerationJob; balance: number };
    setJob(body.job);
    setBalance(body.balance);
  }

  return { job, setJob, live, balance, refresh };
}
