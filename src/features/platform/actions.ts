"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "./data";
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
