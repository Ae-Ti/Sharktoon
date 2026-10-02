/**
 * 생성 영역의 동작 검증 — 오너: 웅싯(A). `npm run check:generation`.
 *
 * 태일의 `check:repo` 와 같은 자리다. Supabase 키도 ANTHROPIC_API_KEY 도 없이
 * 도는 회귀 테스트라 CI 에서 돌린다.
 *
 * `pipeline.ts` 가 `server-only` 를 쓰므로 `--conditions=react-server` 로 돈다.
 */
import {
  getJob,
  regenerateCut,
  retryFailedCuts,
  startGeneration,
} from "@/features/generation/pipeline";
import { MOCK_STORYBOARD } from "@/features/generation/mocks/storyboard";
import { screenText } from "@/features/generation/safety/rules";
import {
  canRedo,
  canUndo,
  commit,
  initHistory,
  preview,
  redo,
  undo,
} from "@/features/generation/editor/history";
import { MOCK_LAYER_TREE } from "@/features/generation/mocks/layers";
import { isVectorLayer, type LayerKind } from "@/features/generation/types/layer";
import { summarizeJob } from "@/contracts/generation";
import { mockRepository as repo } from "@/features/platform/data/mock";

let fail = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "  OK " : "FAIL "} ${m}`);
  if (!c) fail++;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 잡이 끝날 때까지 기다린다. 목 생성기는 컷당 1.2~2.6초다. */
async function settle(jobId: string, timeoutMs = 40000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const job = await getJob(jobId);
    if (job && job.status !== "queued" && job.status !== "running") return job;
    await sleep(250);
  }
  throw new Error(`잡이 ${timeoutMs}ms 안에 안 끝났습니다`);
}

async function main() {
  // --- 콘텐츠 필터
  ok(!screenText("실존 인물인 그 배우처럼 그려줘").allowed, "실존 인물 차단");
  ok(!screenText("피카츄가 나오는 이야기").allowed, "타 IP 차단");
  ok(
    screenText("중학생이 학교에서 발표하는 이야기").allowed,
    "미성년자 등장 자체는 통과",
  );
  ok(
    !screenText("중학생이 나오는 야한 장면").allowed,
    "미성년자 + 부적절 묘사 차단",
  );
  ok(screenText("퇴근길에 강아지를 만난 이야기").allowed, "평범한 사연 통과");
  ok(
    screenText("실존 인물인 그 배우처럼 그려줘").category === "real_person",
    "차단 사유가 실존 인물",
  );

  // --- 레이어 타입
  const vectorKinds: LayerKind[] = ["balloon", "text", "narration", "sfx"];
  ok(
    vectorKinds.every(isVectorLayer) &&
      !isVectorLayer("background") &&
      !isVectorLayer("character"),
    "벡터는 말풍선·텍스트·나레이션·효과음만",
  );

  // --- 편집 이력
  {
    const base = MOCK_LAYER_TREE;
    const moved = { ...base, layers: [...base.layers] };
    let h = initHistory(base);
    ok(!canUndo(h) && !canRedo(h), "이력 초기 상태");

    // 드래그 중 preview 는 쌓이지 않는다
    h = preview(h, moved);
    h = preview(h, moved);
    ok(!canUndo(h), "드래그 중 preview 는 이력에 안 쌓임");

    // 조작이 끝나면 한 칸
    h = commit(h, moved, base);
    ok(canUndo(h) && h.past.length === 1, "드래그 한 번은 이력 한 칸");

    h = undo(h);
    ok(h.present === base && canRedo(h), "실행 취소로 원래 트리");

    h = redo(h);
    ok(h.present === moved, "다시 실행");

    // 되돌린 뒤 새로 고치면 앞으로 갈 곳이 사라진다
    h = undo(h);
    h = commit(h, moved, base);
    ok(!canRedo(h), "되돌린 뒤 새 변경이면 redo 없어짐");
  }

  // --- 생성 파이프라인
  {
    const before = await repo.getCredit();

    const blockedRun = await startGeneration({
      userId: "u_check",
      storyboard: {
        ...MOCK_STORYBOARD,
        cuts: MOCK_STORYBOARD.cuts.map((c) => ({ ...c, scene: "피카츄가 서 있다" })),
      },
      mode: "agent",
    });
    ok(!blockedRun.ok, "컷 장면도 필터를 탄다");
    ok(
      (await repo.getCredit()).balance === before.balance,
      "필터에 막히면 크레딧을 안 잡는다",
    );

    const started = await startGeneration({
      userId: "u_check",
      storyboard: MOCK_STORYBOARD,
      mode: "agent",
    });
    if (!started.ok) throw new Error("생성 시작 실패");
    const jobId = started.job.id;

    const done = await settle(jobId);
    const s = summarizeJob(done);

    // 목 생성기가 4컷째를 첫 시도에 실패시킨다
    ok(s.failed === 1 && s.done === MOCK_STORYBOARD.cuts.length - 1, "4컷째만 실패");
    ok(done.status === "partially_failed", "일부 실패 상태");
    ok(
      done.cuts.filter((c) => c.status === "done").every((c) => Boolean(c.imageUrl)),
      "완료된 컷은 이미지가 있다",
    );

    const spent = MOCK_STORYBOARD.cuts.length - 1;
    const afterRun = await repo.getCredit();
    ok(
      afterRun.balance === before.balance - spent,
      `실패한 컷은 환불된다 (${before.balance} → ${afterRun.balance})`,
    );
    ok(afterRun.held === 0, "끝나면 예약이 남지 않는다");

    // --- 실패 컷만 재시도
    await retryFailedCuts(jobId);
    const retried = await settle(jobId);
    ok(retried.status === "succeeded", "재시도 후 전부 성공");
    ok(
      retried.cuts.find((c) => c.index === 4)?.attempt === 2,
      "재시도한 컷만 시도 횟수 증가",
    );
    ok(
      retried.cuts.filter((c) => c.index !== 4).every((c) => c.attempt === 1),
      "성공한 컷은 건드리지 않는다",
    );
    ok(
      (await repo.getCredit()).balance === before.balance - spent - 1,
      "재시도는 새로 차감된다",
    );

    // --- 한 컷 모드
    const one = await regenerateCut({
      jobId,
      cutId: retried.cuts[0].cutId,
      intent: "keep_composition_change_expression",
      prompt: "조금 더 지쳐 보이게",
    });
    ok(one.ok, "한 컷 모드 재생성 요청");
    await settle(jobId);
    ok(
      (await getJob(jobId))?.cuts[0].attempt === 2,
      "한 컷 모드도 시도 횟수를 센다",
    );

    const dirty = await regenerateCut({
      jobId,
      cutId: retried.cuts[0].cutId,
      intent: "regenerate",
      prompt: "실존 인물인 그 배우 얼굴로",
    });
    ok(!dirty.ok, "한 컷 모드 프롬프트도 필터를 탄다");
  }

  console.log(fail === 0 ? "\n전부 통과" : `\n실패 ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
