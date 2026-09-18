"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "./data";

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
