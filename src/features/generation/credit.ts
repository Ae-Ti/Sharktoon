/**
 * 크레딧 원장 선택 — 태일의 `CreditLedger` 를 부르기만 한다.
 *
 * Supabase 키가 없을 때 쓰는 인메모리 대역이 여기 있다. 태일 쪽에 목 원장이 없어서
 * 파이프라인이 돌지 않기 때문에 임시로 둔 것이고, `platform/credit/` 으로 옮기는 게 맞다.
 * 옮길 때 이 파일은 지운다.
 */

import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  InsufficientCreditError,
  type CreditBalance,
  type CreditLedger,
  type HoldId,
} from "@/contracts/credit";

export async function getCreditLedger(): Promise<CreditLedger> {
  if (!isSupabaseConfigured()) return memoryLedger;
  const { createCreditLedger } = await import("@/features/platform/credit/ledger");
  return createCreditLedger();
}

/** 목 저장소의 잔량(11)과 맞춰 둔다. 두 화면이 다른 숫자를 보이면 헷갈린다. */
let available = 11;
let held = 0;
const holds = new Map<string, { amount: number; status: "held" | "committed" | "refunded" }>();

let seq = 0;

/** hold → commit / refund 3단을 그대로 흉내 낸다. 화면이 보는 동작이 실제와 같아야 한다. */
const memoryLedger: CreditLedger = {
  async getBalance(): Promise<CreditBalance> {
    return { available, held, expiresAt: null };
  },

  async hold({ amount }) {
    if (available < amount) throw new InsufficientCreditError(amount, available);
    available -= amount;
    held += amount;
    const id = `hold_mem_${++seq}` as HoldId;
    holds.set(id, { amount, status: "held" });
    return id;
  },

  async commit(holdId) {
    const h = holds.get(holdId);
    if (!h || h.status !== "held") return;
    held -= h.amount;
    holds.set(holdId, { ...h, status: "committed" });
  },

  async refund(holdId) {
    const h = holds.get(holdId);
    if (!h || h.status !== "held") return;
    held -= h.amount;
    available += h.amount;
    holds.set(holdId, { ...h, status: "refunded" });
  },

  async grant({ amount }) {
    available += amount;
    return { available, held, expiresAt: null };
  },
};
