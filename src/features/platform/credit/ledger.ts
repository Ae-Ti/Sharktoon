import { createClient } from "@/lib/supabase/server";
import {
  CREDIT_SQLSTATE,
  InsufficientCreditError,
  type CreditLedger,
  type HoldId,
} from "@/contracts/credit";

/**
 * CreditLedger 의 Supabase 구현 — 오너: 태일(B).
 *
 * 웅싯은 생성 요청 직전에 hold, 성공하면 commit, 실패하면 refund 만 부르면 된다.
 * 잔량 계산과 거래 기록은 전부 DB 함수 안에서 한 트랜잭션으로 끝난다.
 */

type PgError = { code?: string; message?: string };

function isCode(e: unknown, code: string): boolean {
  return typeof e === "object" && e !== null && (e as PgError).code === code;
}

export function createCreditLedger(): CreditLedger {
  return {
    async getBalance() {
      const db = await createClient();
      const { data } = await db
        .from("credit_accounts")
        .select("balance, held")
        .single();
      return {
        available: data?.balance ?? 0,
        held: data?.held ?? 0,
        // 이월은 월 단위 배치에서 정한다. 개별 조회에서는 알 수 없다.
        expiresAt: null,
      };
    },

    async hold({ amount, reason, jobId }) {
      const db = await createClient();
      const { data, error } = await db.rpc("credit_hold", {
        p_amount: amount,
        p_reason: reason,
        p_job_id: jobId,
      });

      if (isCode(error, CREDIT_SQLSTATE.insufficient)) {
        const { data: acc } = await db
          .from("credit_accounts")
          .select("balance")
          .single();
        throw new InsufficientCreditError(amount, acc?.balance ?? 0);
      }
      if (error) throw error;

      return data as HoldId;
    },

    async commit(holdId) {
      const db = await createClient();
      const { error } = await db.rpc("credit_commit", { p_hold_id: holdId });
      // 이미 정산된 hold 는 재시도해도 소용없다. 삼키지 말고 올린다.
      if (error) throw error;
    },

    async refund(holdId, reason) {
      const db = await createClient();
      const { error } = await db.rpc("credit_refund", {
        p_hold_id: holdId,
        p_reason: reason,
      });
      if (error) throw error;
    },

    async grant() {
      // 지급은 출석·구독·결제 웹훅이 하는 일이고, 클라이언트에서 부를 수 없다.
      // 서비스 롤로 도는 서버 루트에서 따로 구현한다.
      throw new Error("grant 는 서버 웹훅에서만 호출한다");
    },
  };
}
