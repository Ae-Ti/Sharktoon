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
import { InsufficientCreditError } from "@/contracts/credit";
import { getGenerationStore } from "@/features/generation/data";
import { buildLayerTree, hydrateLayerTree } from "@/features/generation/editor/buildLayerTree";
import { withAiMetadata } from "@/features/generation/editor/pngMeta";
import { tailWedge } from "@/features/generation/editor/shapes";
import {
  HASHTAG_MAX,
  HASHTAG_MIN,
  fitDynamicTags,
  mockPostPackage,
  normalizeTags,
} from "@/features/generation/post/generate";
import { mockStoryboard } from "@/features/generation/storyboard/mock";
import { characterName } from "@/features/generation/types/storyboard";
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
    const job = await getJob(jobId, "mock-user");
    if (job && job.status !== "queued" && job.status !== "running") return job;
    await sleep(250);
  }
  throw new Error(`잡이 ${timeoutMs}ms 안에 안 끝났습니다`);
}

/** PNG 청크를 읽고 CRC 를 다시 계산해 맞춰 본다. */
function readPngChunks(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const out: { type: string; crcOk: boolean; text?: string }[] = [];
  let at = 8;
  while (at < png.length) {
    const len = view.getUint32(at);
    const type = Buffer.from(png.subarray(at + 4, at + 8)).toString("latin1");
    const crc = view.getUint32(at + 8 + len);
    const body = png.subarray(at + 4, at + 8 + len);
    let c = 0xffffffff;
    for (const b of body) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    out.push({
      type,
      crcOk: ((c ^ 0xffffffff) >>> 0) === crc,
      text: type === "tEXt" ? Buffer.from(png.subarray(at + 8, at + 8 + len)).toString("latin1") : undefined,
    });
    at += 12 + len;
  }
  return out;
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

  // --- 목 콘티: 입력한 사연과 컷 수가 그대로 보여야 한다
  {
    const story = "퇴근길에 지하철에서 졸았다. 눈을 떠 보니 종점이었다. 반대편 열차가 막차였다.";
    const four = mockStoryboard({ episodeId: "e", seriesId: "s", story, cutCount: 4 });
    const eight = mockStoryboard({ episodeId: "e", seriesId: "s", story, cutCount: 8 });
    ok(four.cuts.length === 4 && eight.cuts.length === 8, "컷 수(4·8)를 지킨다");
    ok(four.cuts.some((c) => c.scene.includes("종점")), "사연 문장이 장면에 들어간다");
    ok(
      new Set([...four.cuts, ...eight.cuts].map((c) => c.id)).size === 12,
      "두 번 만든 콘티의 컷 id 가 겹치지 않는다",
    );
    const fixed = mockStoryboard({ episodeId: "e", seriesId: "s", story, cutCount: 4, fixedCharacters: ["민지"] });
    ok(characterName(fixed, fixed.cuts[1].characterIds[0]) === "민지", "고정 캐릭터 이름을 쓴다");
  }

  // --- 레이어 트리: 콘티의 글은 이미지에 굽지 않고 벡터 레이어로 얹는다
  {
    const sb = { ...MOCK_STORYBOARD, selectedHookId: MOCK_STORYBOARD.hookOptions[0].id };
    const first = buildLayerTree({ storyboard: sb, cut: sb.cuts[0], imageUrl: "data:x", aspectRatio: "4:5" });
    ok(first.canvas.height === 1350, "4:5 는 1080×1350");
    ok(first.layers[0].kind === "background" && first.layers[0].locked === true, "배경은 맨 아래, 잠김");
    ok(first.layers.some((l) => l.name === "후킹"), "1컷에 고른 후킹이 얹힌다");
    const balloons = first.layers.filter((l) => l.kind === "balloon");
    ok(
      balloons.length === sb.cuts[0].dialogue.filter((d) => d.speakerId).length &&
        balloons.every((l) => "tail" in l && l.tail),
      "대사마다 꼬리 달린 말풍선",
    );
    const hydrated = hydrateLayerTree(
      { ...first, layers: first.layers.map((l) => ("imageUrl" in l ? { ...l, imageUrl: "" } : l)) },
      sb.cuts[0].id,
      "data:new",
    );
    ok(hydrated.layers[0].kind === "background" && "imageUrl" in hydrated.layers[0] && hydrated.layers[0].imageUrl === "data:new", "저장된 트리에 새 이미지를 다시 붙인다");
  }

  // --- 말풍선 꼬리
  {
    const box = { x: 100, y: 100, width: 400, height: 150 };
    ok(tailWedge(box, { x: 300, y: 200 }) === null, "몸통 안을 가리키는 꼬리는 안 그린다");
    const w = tailWedge(box, { x: 300, y: 400 })!;
    ok(w.base[0].y > 240 && w.base[0].y < 250 && w.tip.y === 400, "아래를 가리키면 밑변은 아랫변");
  }

  // --- 게시물 패키지(목)
  {
    const pkg = mockPostPackage(MOCK_STORYBOARD, normalizeTags(["#직장 상사", "샥툰"]));
    const total = pkg.hashtags.fixed.length + pkg.hashtags.dynamic.length;
    ok(total >= HASHTAG_MIN && total <= HASHTAG_MAX, `해시태그 ${HASHTAG_MIN}~${HASHTAG_MAX}개 (${total})`);
    ok(pkg.hashtags.fixed.join() === "직장상사,샥툰", "고정 해시태그를 정리해 따로 둔다");
    ok(!pkg.hashtags.dynamic.some((t) => pkg.hashtags.fixed.includes(t)), "동적 태그는 고정 태그와 안 겹친다");
    ok([...pkg.hashtags.fixed, ...pkg.hashtags.dynamic].every((t) => !t.startsWith("#") && !/\s/.test(t)), "태그에 #·공백 없음");
    ok(Boolean(pkg.captions.short && pkg.captions.emotional && pkg.captions.humor), "본문 3안");
    ok(fitDynamicTags(Array.from({ length: 40 }, (_, i) => `t${i}`), ["a", "b"]).length === HASHTAG_MAX - 2, "합계 25개를 넘기지 않는다");
  }

  // --- PNG AI 메타데이터
  {
    const png = Uint8Array.from(Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    ));
    const out = withAiMetadata(png);
    const chunks = readPngChunks(out);
    ok(chunks[0].type === "IHDR" && chunks.slice(1, 4).every((c) => c.type === "tEXt"), "IHDR 뒤에 tEXt 3개");
    ok(chunks.every((c) => c.crcOk), "모든 청크 CRC 가 맞는다");
    ok(chunks.some((c) => c.text?.startsWith("DigitalSourceType")), "디지털 소스 유형(AI 생성) 표시");
    ok(chunks.at(-1)?.type === "IEND", "PNG 끝이 그대로");
  }

  // --- 생성 파이프라인
  {
    const USER = "mock-user";
    const before = await repo.getCredit();

    const blockedRun = await startGeneration({
      userId: USER,
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
      userId: USER,
      storyboard: MOCK_STORYBOARD,
      mode: "agent",
    });
    if (!started.ok) throw new Error("생성 시작 실패");
    const jobId = started.job.id;
    const owner = { jobId, userId: USER, restore: async () => null };

    ok((await getJob(jobId, "someone-else")) === null, "남의 잡은 안 보인다");

    const done = await settle(jobId);
    const s = summarizeJob(done);

    // 목 생성기가 4컷째를 첫 시도에 실패시킨다
    ok(s.failed === 1 && s.done === MOCK_STORYBOARD.cuts.length - 1, "4컷째만 실패");
    ok(done.status === "partially_failed", "일부 실패 상태");
    ok(done.cuts.find((c) => c.index === 4)?.refunded === true, "실패한 컷은 환불 표시");
    ok(
      done.cuts.filter((c) => c.status === "done").every((c) => Boolean(c.imageUrl && c.imageRef)),
      "완료된 컷은 이미지와 ref 가 있다",
    );

    const spent = MOCK_STORYBOARD.cuts.length - 1;
    const afterRun = await repo.getCredit();
    ok(
      afterRun.balance === before.balance - spent,
      `실패한 컷은 환불된다 (${before.balance} → ${afterRun.balance})`,
    );
    ok(afterRun.held === 0, "끝나면 예약이 남지 않는다");

    // --- 저장소에 결과가 남는다
    const store = await getGenerationStore();
    await sleep(50);
    const savedJob = await store.getLatestJob(MOCK_STORYBOARD.episodeId);
    ok(savedJob?.id === jobId && savedJob.status === "partially_failed", "잡 사본이 저장된다");
    ok((await store.listCuts(MOCK_STORYBOARD.episodeId)).length === spent, "완료된 컷이 저장된다");

    // --- 실패 컷만 재시도
    await retryFailedCuts(owner);
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
    await sleep(50);
    const status = (await repo.getSeries("sr_villain"))?.episodes.find((e) => e.id === MOCK_STORYBOARD.episodeId)?.status;
    ok(status === "ready", "전부 나오면 회차가 '첫 화 완성'(ready)");

    // --- 한 컷 모드
    const one = await regenerateCut({
      ...owner,
      cutId: retried.cuts[0].cutId,
      intent: "keep_composition_change_expression",
      prompt: "조금 더 지쳐 보이게",
    });
    ok(one.ok, "한 컷 모드 재생성 요청");
    await settle(jobId);
    ok(
      (await getJob(jobId, USER))?.cuts[0].attempt === 2,
      "한 컷 모드도 시도 횟수를 센다",
    );

    const dirty = await regenerateCut({
      ...owner,
      cutId: retried.cuts[0].cutId,
      intent: "regenerate",
      prompt: "실존 인물인 그 배우 얼굴로",
    });
    ok(!dirty.ok, "한 컷 모드 프롬프트도 필터를 탄다");

    const stranger = await regenerateCut({ ...owner, userId: "someone-else", cutId: retried.cuts[0].cutId, intent: "regenerate" });
    ok(!stranger.ok, "남의 잡은 다시 만들 수 없다");

    // --- 잔량이 전체 비용보다 적으면 시작하지 않는다
    const left = (await repo.getCredit()).balance;
    try {
      await startGeneration({
        userId: USER,
        storyboard: { ...MOCK_STORYBOARD, cuts: [...MOCK_STORYBOARD.cuts, ...MOCK_STORYBOARD.cuts.slice(0, 4)].map((c, i) => ({ ...c, id: `x${i}`, index: i + 1 })) },
        mode: "agent",
      });
      ok(false, "잔량 부족이면 시작 전에 막는다");
    } catch (e) {
      ok(e instanceof InsufficientCreditError && e.required === 10 && e.available === left, `잔량 부족이면 시작 전에 막는다 (필요 10, 남음 ${left})`);
    }
    ok((await repo.getCredit()).balance === left, "막히면 한 크레딧도 안 잡는다");
  }

  console.log(fail === 0 ? "\n전부 통과" : `\n실패 ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
