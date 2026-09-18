"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "./data";
import {
  InsufficientCreditError,
  type CreditSpendReason,
} from "@/contracts/credit";
import type { AssetInput, SeriesInput, SeriesRule } from "./data/types";

/** 출석 체크. 하루 1크레딧, 7일 연속이면 3크레딧을 더 준다. */
export async function checkInAction(): Promise<
  { ok: true; granted: number; streak: number } | { ok: false; message: string }
> {
  try {
    const repo = await getRepository();
    const { granted, streak } = await repo.checkIn();
    revalidatePath("/home");
    return { ok: true, granted, streak };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "출석에 실패했어요",
    };
  }
}

type Fail = { ok: false; message: string };
type Result = { ok: true } | Fail;
type ResultWithId = { ok: true; id: string } | Fail;

function fail(e: unknown): Fail {
  return {
    ok: false,
    message: e instanceof Error ? e.message : "처리하지 못했어요",
  };
}

export async function saveAssetAction(
  id: string | null,
  input: AssetInput,
): Promise<Result> {
  try {
    const repo = await getRepository();
    if (id) await repo.updateAsset(id, input);
    else await repo.createAsset(input);
    revalidatePath("/assets");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAssetAction(id: string): Promise<Result> {
  try {
    const repo = await getRepository();
    await repo.deleteAsset(id);
    revalidatePath("/assets");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createSeriesAction(
  input: SeriesInput,
): Promise<ResultWithId> {
  try {
    const repo = await getRepository();
    const s = await repo.createSeries(input);
    revalidatePath("/home");
    return { ok: true, id: s.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateSeriesRuleAction(
  seriesId: string,
  rule: SeriesRule,
): Promise<Result> {
  try {
    const repo = await getRepository();
    await repo.updateSeriesRule(seriesId, rule);
    revalidatePath(`/series/${seriesId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 다음 화를 연다. 번호는 서버가 정한다. */
export async function createEpisodeAction(
  seriesId: string,
  story: string,
): Promise<ResultWithId> {
  try {
    const repo = await getRepository();
    const ep = await repo.createEpisode(seriesId, story);
    revalidatePath(`/series/${seriesId}`);
    return { ok: true, id: ep.id };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 온보딩에서 받은 사연으로 시리즈와 1화를 연다.
 * 여기서 만들어진 episodeId 로 콘티·생성 화면이 컨텍스트를 읽는다.
 */
export async function startEpisodeAction(input: {
  story: string;
  cutCount: number;
  seriesId?: string;
}): Promise<{ ok: true; episodeId: string; seriesId: string } | Fail> {
  try {
    const repo = await getRepository();
    const r = await repo.startEpisode(input);
    revalidatePath("/home");
    return { ok: true, ...r };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 생성 요청 직전에 부른다 — 오너: 태일(B), 호출: 웅싯(A).
 * 부족하면 code "insufficient" 로 돌아온다. 버튼을 막지 말고 충전 시트를 연다.
 */
export async function holdCreditAction(input: {
  amount: number;
  reason: CreditSpendReason;
  jobId: string;
}): Promise<
  | { ok: true; holdId: string }
  | { ok: false; code: "insufficient"; required: number; available: number }
  | Fail
> {
  try {
    const repo = await getRepository();
    const holdId = await repo.holdCredit(input);
    return { ok: true, holdId };
  } catch (e) {
    if (e instanceof InsufficientCreditError) {
      return {
        ok: false,
        code: "insufficient",
        required: e.required,
        available: e.available,
      };
    }
    return fail(e);
  }
}

/** 생성이 성공했을 때. 차감이 확정된다. */
export async function commitCreditAction(holdId: string): Promise<Result> {
  try {
    const repo = await getRepository();
    await repo.commitCredit(holdId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 생성이 실패했을 때. 자동 환불이고 사용자에게 보이게 알린다. */
export async function refundCreditAction(
  holdId: string,
  reason: string,
): Promise<{ ok: true; amount: number } | Fail> {
  try {
    const repo = await getRepository();
    const amount = await repo.refundCredit(holdId, reason);
    return { ok: true, amount };
  } catch (e) {
    return fail(e);
  }
}
