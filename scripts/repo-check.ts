/**
 * 목 저장소의 동작 검증. `npm run check:repo`.
 *
 * Supabase 키 없이 돌릴 수 있는 유일한 회귀 테스트라 CI 에서도 돌린다.
 * 여기서 회차 id 충돌(같은 밀리초에 만든 두 회차가 같은 id 를 받아
 * 앞 회차의 사연이 덮어써지던 문제)을 잡았다.
 */
import { mockRepository as r } from "@/features/platform/data/mock";
import { InsufficientCreditError } from "@/contracts/credit";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "  OK " : "FAIL "} ${m}`); if (!c) fail++; };

async function main() {
  // --- 에셋 CRUD
  const created = await r.createAsset({ kind: "prop", name: "머그컵2", description: null, tags: ["파란"] });
  ok((await r.listAssets("prop")).some(a => a.id === created.id), "에셋 추가");

  const edited = await r.updateAsset(created.id, { kind: "prop", name: "빨간 머그", description: "이 나감", tags: [] });
  ok(edited.name === "빨간 머그" && edited.description === "이 나감", "에셋 수정");

  await r.deleteAsset(created.id);
  ok(!(await r.listAssets("prop")).some(a => a.id === created.id), "에셋 삭제");

  try { await r.deleteAsset("as_me"); ok(false, "참조 있는 에셋 삭제 차단"); }
  catch (e) { ok(e instanceof Error && e.message.includes("회차"), "참조 있는 에셋 삭제 차단"); }

  const counts = await r.countAssetsByKind();
  const all = await r.listAssets();
  ok(Object.values(counts).reduce((a, b) => a + b, 0) === all.length, "종류별 개수 합 == 전체");

  // --- 시리즈
  const s = await r.createSeries({ title: "테스트 시리즈", description: null,
    rule: { stylePreset: "파스텔", defaultCutCount: 4, aspectRatio: "1:1", tone: "존댓말", fixedHashtags: ["#t"] } });
  ok((await r.listSeries()).some(x => x.id === s.id), "시리즈 생성");

  await r.updateSeriesRule(s.id, { stylePreset: "굵은 선", defaultCutCount: 8, aspectRatio: "4:5", tone: null, fixedHashtags: [] });
  const detail = await r.getSeries(s.id);
  ok(detail?.rule.stylePreset === "굵은 선" && detail.rule.defaultCutCount === 8, "생성 규칙 수정");

  await r.setSeriesAssets(s.id, ["as_me", "as_meeting"]);
  ok((await r.getSeries(s.id))?.assets.length === 2, "시리즈 에셋 고정");

  const ep = await r.createEpisode(s.id, "테스트 사연");
  const d2 = await r.getSeries(s.id);
  ok(ep.number === 1 && d2?.episodeCount === 1, "회차 생성과 번호");

  ok((await r.getSeries("없는id")) === null, "없는 시리즈 조회 null");

  // --- 온보딩 → 회차 컨텍스트
  const started = await r.startEpisode({ story: "퇴근길에 강아지가 달려왔다", cutCount: 6 });
  const ctx = await r.getEpisodeContext(started.episodeId);
  ok(ctx?.story === "퇴근길에 강아지가 달려왔다", "사연이 회차 컨텍스트로 전달");
  ok(ctx?.cutCount === 6, "컷 수 전달");
  ok(ctx?.rule != null && Array.isArray(ctx?.assets), "생성 규칙·에셋 동봉");
  ok((await r.getEpisodeContext("없는id")) === null, "없는 회차 컨텍스트 null");

  const second = await r.startEpisode({ story: "두 번째", cutCount: 4, seriesId: started.seriesId });
  const ctx2 = await r.getEpisodeContext(second.episodeId);
  ok(ctx2?.number === 2 && second.seriesId === started.seriesId, "같은 시리즈의 2화");

  // --- 크레딧 원장
  const b0 = (await r.getCredit()).balance;
  const h1 = await r.holdCredit({ amount: 6, reason: "cut_image", jobId: "j1" });
  const b1 = await r.getCredit();
  ok(b1.balance === b0 - 6 && b1.held === 6, "hold: 잔량 감소·예약 증가");

  await r.commitCredit(h1);
  const b2 = await r.getCredit();
  ok(b2.balance === b0 - 6 && b2.held === 0, "commit: 예약만 해제");
  ok(b2.delta === undefined, "commit 후 delta 비움");

  const h2 = await r.holdCredit({ amount: 1, reason: "cut_image", jobId: "j2" });
  const amt = await r.refundCredit(h2, "실패");
  const b3 = await r.getCredit();
  ok(amt === 1 && b3.balance === b0 - 6 && b3.held === 0, "refund: 잔량 복구");

  try { await r.commitCredit(h2); ok(false, "정산된 hold 재정산 차단"); }
  catch { ok(true, "정산된 hold 재정산 차단"); }

  try { await r.holdCredit({ amount: 9999, reason: "cut_image", jobId: "j3" }); ok(false, "잔량 초과 차단"); }
  catch (e) { ok(e instanceof InsufficientCreditError, "잔량 초과 차단"); }

  // --- 출석
  const a1 = await r.checkIn();
  ok(a1.granted === 4 && a1.streak === 7, "7일 연속 출석 보너스 3크레딧");
  try { await r.checkIn(); ok(false, "중복 출석 차단"); }
  catch { ok(true, "중복 출석 차단"); }

  // --- 관리자
  const ov = await r.getAdminOverview();
  ok(ov != null && ov.funnel.length === 5, "관리자 깔때기 5단계");
  ok(ov!.generation.failureRate > 0 && ov!.generation.failureRate < 1, "실패율 0~1 범위");

  console.log(fail === 0 ? "\n전부 통과" : `\n실패 ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}
main();
