import { createClient } from "@/lib/supabase/server";
import { createCreditLedger } from "@/features/platform/credit/ledger";
import { resolveImages } from "./images";
import type { AssetKind } from "@/lib/supabase/database.types";
import type {
  AccountStatus,
  AdminOverview,
  CreditDetail,
  RefundRequest,
  Asset,
  AssetInput,
  PlatformRepository,
  SeriesDetail,
  SeriesInput,
  SeriesRule,
} from "./types";

/**
 * Supabase 구현. 프로젝트 키가 채워지면 이 쪽이 쓰인다.
 * RLS 가 소유자 범위를 강제하므로 쿼리에 owner_id 조건을 따로 걸지 않는다.
 */

const EMPTY_COUNT: Record<AssetKind, number> = {
  character: 0,
  location: 0,
  prop: 0,
  style: 0,
};

/** 회차 번호를 "3화" 같은 라벨로. 초안은 표시를 달리한다. */
function episodeLabel(number: number, status: string) {
  return status === "published" ? `${number}화` : `${number}화 초안`;
}

type AssetRow = {
  id: string;
  kind: AssetKind;
  name: string;
  description: string | null;
  tags: string[];
  reference_paths: string[];
};

/** 에셋 행 → 화면 모양. 레퍼런스 경로는 서명 URL 로 바꾼다(소유자 경로만). */
async function toAssets(
  ownerId: string,
  rows: AssetRow[],
  usage: (id: string) => string[] = () => [],
): Promise<Asset[]> {
  const urls = await resolveImages(
    "assets",
    ownerId,
    rows.flatMap((r) => r.reference_paths ?? []),
  );
  return rows.map((r) => {
    const referenceUrls = (r.reference_paths ?? [])
      .map((p) => urls.get(p))
      .filter((u): u is string => Boolean(u));
    const used = usage(r.id);
    return {
      id: r.id,
      kind: r.kind,
      name: r.name,
      description: r.description,
      tags: r.tags,
      thumbUrl: referenceUrls[0] ?? null,
      referenceUrls,
      usedIn: used.length,
      usedInEpisodes: used,
    };
  });
}

type RuleRow = {
  style_preset: string;
  default_cut_count: number;
  aspect_ratio: "1:1" | "4:5";
  tone: string | null;
  fixed_hashtags: string[];
};

/**
 * series_rules 는 series 와 1:1(기본 키가 series_id)이라 PostgREST 가 배열이 아니라
 * 객체로 준다. 예전 코드는 `[0]` 으로 읽어서 실제 저장소에서는 규칙이 늘 기본값으로
 * 보였다(2026-10-02 실 테스트: 파스텔을 골랐는데 심플 라인). 둘 다 받는다.
 */
function oneRule(value: unknown): RuleRow | undefined {
  if (Array.isArray(value)) return value[0] as RuleRow | undefined;
  return (value as RuleRow | null) ?? undefined;
}

async function requireUserId(): Promise<string> {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) throw new Error("로그인이 필요해요");
  return data.user.id;
}

export const supabaseRepository: PlatformRepository = {
  async currentUserId() {
    const db = await createClient();
    const { data } = await db.auth.getUser();
    return data.user?.id ?? null;
  },

  async getProfile() {
    const db = await createClient();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return null;

    const { data } = await db
      .from("profiles")
      .select("id, display_name, avatar_url, plan, keep_selfie_original")
      .eq("id", auth.user.id)
      .single();
    if (!data) return null;

    return {
      id: data.id,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      plan: data.plan,
      keepSelfieOriginal: data.keep_selfie_original,
    };
  },

  async getCredit() {
    const db = await createClient();
    const { data } = await db
      .from("credit_accounts")
      .select("balance, held")
      .single();
    return { balance: data?.balance ?? 0, held: data?.held ?? 0 };
  },

  async getAttendance() {
    const db = await createClient();
    const { data } = await db
      .from("attendance")
      .select("attended_on, streak")
      .order("attended_on", { ascending: false })
      .limit(1);

    const last = data?.[0];
    if (!last) return { checkedInToday: false, streak: 0 };

    // 출석일 계산은 DB 와 같은 Asia/Seoul 기준이어야 한다.
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    return { checkedInToday: last.attended_on === today, streak: last.streak };
  },

  async checkIn() {
    const db = await createClient();
    const { data, error } = await db.rpc("attendance_check_in");
    if (error) throw error;
    const row = data?.[0];
    return {
      streak: row?.streak ?? 0,
      granted: row?.granted ?? 0,
      balance: row?.balance ?? 0,
    };
  },

  async listSeries() {
    const db = await createClient();
    const { data } = await db
      .from("series")
      .select("id, title, description, is_public, updated_at, episodes(count)")
      .order("updated_at", { ascending: false });

    return (data ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      isPublic: s.is_public,
      episodeCount:
        (s.episodes as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
      updatedAt: s.updated_at,
    }));
  },

  async getSeries(id) {
    const db = await createClient();
    const { data } = await db
      .from("series")
      .select(
        "id, title, description, is_public, updated_at, series_rules(*), episodes(id, number, title, status, cut_count, published_at)",
      )
      .eq("id", id)
      .single();
    if (!data) return null;

    const rule = oneRule(data.series_rules);

    const episodes = ((data.episodes ?? []) as unknown as {
      id: string;
      number: number;
      title: string | null;
      status: SeriesDetail["episodes"][number]["status"];
      cut_count: number;
      published_at: string | null;
    }[])
      .map((e) => ({
        id: e.id,
        number: e.number,
        title: e.title,
        status: e.status,
        cutCount: e.cut_count,
        publishedAt: e.published_at,
      }))
      .sort((a, b) => a.number - b.number);

    const { data: links } = await db
      .from("series_assets")
      .select("assets(id, kind, name, description, tags, reference_paths)")
      .eq("series_id", id);

    const ownerId = await requireUserId();
    const assets = await toAssets(
      ownerId,
      ((links ?? []) as unknown as { assets: AssetRow | null }[])
        .map((l) => l.assets)
        .filter((a): a is AssetRow => Boolean(a)),
    );

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      isPublic: data.is_public,
      updatedAt: data.updated_at,
      episodeCount: episodes.length,
      rule: {
        stylePreset: rule?.style_preset ?? "심플 라인",
        defaultCutCount: rule?.default_cut_count ?? 6,
        aspectRatio: rule?.aspect_ratio ?? "4:5",
        tone: rule?.tone ?? null,
        fixedHashtags: rule?.fixed_hashtags ?? [],
      },
      episodes,
      assets,
    };
  },

  async listAssets(kind) {
    const db = await createClient();
    const ownerId = await requireUserId();
    let q = db
      .from("assets")
      .select("id, kind, name, description, tags, reference_paths, asset_references(episodes(number, status))");
    if (kind) q = q.eq("kind", kind);
    const { data } = await q.order("created_at", { ascending: true });
    const rows = data ?? [];

    const labelsOf = new Map(
      rows.map((a) => {
        const refs = (a.asset_references as unknown as
          | { episodes: { number: number; status: string } | null }[]
          | null) ?? [];
        return [
          a.id,
          refs
            .map((r) => r.episodes)
            .filter((e): e is { number: number; status: string } => Boolean(e))
            .sort((x, y) => x.number - y.number)
            .map((e) => episodeLabel(e.number, e.status)),
        ] as const;
      }),
    );

    return toAssets(ownerId, rows, (id) => labelsOf.get(id) ?? []);
  },

  async countAssetsByKind() {
    const db = await createClient();
    const { data } = await db.from("assets").select("kind");
    return (data ?? []).reduce(
      (acc, a) => ({ ...acc, [a.kind]: acc[a.kind] + 1 }),
      { ...EMPTY_COUNT },
    );
  },

  async createAsset(input: AssetInput) {
    const db = await createClient();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) throw new Error("로그인이 필요해요");

    const { data, error } = await db
      .from("assets")
      .insert({ ...input, owner_id: auth.user.id })
      .select("id, kind, name, description, tags, reference_paths")
      .single();
    if (error) throw error;

    const [asset] = await toAssets(auth.user.id, [data]);
    return asset;
  },

  async updateAsset(id: string, input: AssetInput) {
    const db = await createClient();
    const { data, error } = await db
      .from("assets")
      .update(input)
      .eq("id", id)
      .select("id, kind, name, description, tags, reference_paths, asset_references(episodes(number, status))")
      .single();
    if (error) throw error;

    const labels = ((data.asset_references as unknown as
      | { episodes: { number: number; status: string } | null }[]
      | null) ?? [])
      .map((r) => r.episodes)
      .filter((e): e is { number: number; status: string } => Boolean(e))
      .sort((x, y) => x.number - y.number)
      .map((e) => episodeLabel(e.number, e.status));

    const [asset] = await toAssets(await requireUserId(), [data], () => labels);
    return asset;
  },

  async deleteAsset(id: string) {
    const db = await createClient();
    // 참조하는 회차가 있으면 지우지 않는다. 지난 회차의 일관성이 깨진다.
    const { count } = await db
      .from("asset_references")
      .select("*", { count: "exact", head: true })
      .eq("asset_id", id);
    if (count && count > 0) {
      throw new Error(
        `${count}개 회차가 이 에셋을 쓰고 있어요. 먼저 회차에서 빼 주세요.`,
      );
    }
    const { error } = await db.from("assets").delete().eq("id", id);
    if (error) throw error;
  },

  async setAssetReferences(assetId: string, refs: string[]) {
    const db = await createClient();
    const { error } = await db
      .from("assets")
      .update({ reference_paths: refs })
      .eq("id", assetId);
    if (error) throw error;
  },

  async addAssetReference(assetId: string, ref: string) {
    const db = await createClient();
    const { data, error } = await db
      .from("assets")
      .select("reference_paths")
      .eq("id", assetId)
      .single();
    if (error) throw error;
    const { error: updateError } = await db
      .from("assets")
      .update({ reference_paths: [ref, ...(data.reference_paths ?? [])].slice(0, 8) })
      .eq("id", assetId);
    if (updateError) throw updateError;
  },

  async recordAssetReferences(episodeId: string, assetIds: string[]) {
    if (assetIds.length === 0) return;
    const db = await createClient();
    const { error } = await db
      .from("asset_references")
      .upsert(
        assetIds.map((asset_id) => ({ episode_id: episodeId, asset_id })),
        { onConflict: "episode_id,asset_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  },

  async createSeries(input: SeriesInput) {
    const db = await createClient();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) throw new Error("로그인이 필요해요");

    const { data, error } = await db
      .from("series")
      .insert({
        owner_id: auth.user.id,
        title: input.title,
        description: input.description,
      })
      .select("id, title, description, is_public, updated_at")
      .single();
    if (error) throw error;

    await db.from("series_rules").insert({
      series_id: data.id,
      style_preset: input.rule.stylePreset,
      default_cut_count: input.rule.defaultCutCount,
      aspect_ratio: input.rule.aspectRatio,
      tone: input.rule.tone,
      fixed_hashtags: input.rule.fixedHashtags,
    });

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      isPublic: data.is_public,
      episodeCount: 0,
      updatedAt: data.updated_at,
    };
  },

  async updateSeriesRule(seriesId: string, rule: SeriesRule) {
    const db = await createClient();
    const { error } = await db
      .from("series_rules")
      .update({
        style_preset: rule.stylePreset,
        default_cut_count: rule.defaultCutCount,
        aspect_ratio: rule.aspectRatio,
        tone: rule.tone,
        fixed_hashtags: rule.fixedHashtags,
      })
      .eq("series_id", seriesId);
    if (error) throw error;
  },

  async setSeriesAssets(seriesId: string, assetIds: string[]) {
    const db = await createClient();
    await db.from("series_assets").delete().eq("series_id", seriesId);
    if (assetIds.length === 0) return;
    const { error } = await db
      .from("series_assets")
      .insert(assetIds.map((asset_id) => ({ series_id: seriesId, asset_id })));
    if (error) throw error;
  },

  async createEpisode(seriesId: string, story: string) {
    const db = await createClient();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) throw new Error("로그인이 필요해요");

    const { data: last } = await db
      .from("episodes")
      .select("number")
      .eq("series_id", seriesId)
      .order("number", { ascending: false })
      .limit(1);

    const { data: rule } = await db
      .from("series_rules")
      .select("default_cut_count")
      .eq("series_id", seriesId)
      .single();

    const number = (last?.[0]?.number ?? 0) + 1;
    const { data, error } = await db
      .from("episodes")
      .insert({
        series_id: seriesId,
        owner_id: auth.user.id,
        number,
        story,
        cut_count: rule?.default_cut_count ?? 6,
      })
      .select("id, number, title, status, cut_count, published_at")
      .single();
    if (error) throw error;

    return {
      id: data.id,
      number: data.number,
      title: data.title,
      status: data.status,
      cutCount: data.cut_count,
      publishedAt: data.published_at,
    };
  },

  async getResumable() {
    const db = await createClient();
    const { data } = await db
      .from("episodes")
      .select("id, number, status, cut_count, series_id, series(title)")
      .neq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(1);

    const e = data?.[0];
    if (!e) return null;
    const series = e.series as unknown as { title: string } | null;
    return {
      seriesId: e.series_id,
      seriesTitle: series?.title ?? "",
      episodeId: e.id,
      number: e.number,
      status: e.status,
      cutCount: e.cut_count,
    };
  },

  async getEpisodeContext(episodeId: string) {
    const db = await createClient();
    const { data } = await db
      .from("episodes")
      .select("id, series_id, number, story, cut_count, series(title, series_rules(*))")
      .eq("id", episodeId)
      .single();
    if (!data) return null;

    const series = data.series as unknown as { title: string; series_rules: unknown } | null;
    const rule = oneRule(series?.series_rules);

    const { data: links } = await db
      .from("series_assets")
      .select("assets(id, kind, name, description, tags, reference_paths)")
      .eq("series_id", data.series_id);

    const assets = await toAssets(
      await requireUserId(),
      ((links ?? []) as unknown as { assets: AssetRow | null }[])
        .map((l) => l.assets)
        .filter((a): a is AssetRow => Boolean(a)),
    );

    return {
      episodeId: data.id,
      seriesId: data.series_id,
      seriesTitle: series?.title ?? "",
      number: data.number,
      story: data.story ?? "",
      cutCount: data.cut_count,
      rule: {
        stylePreset: rule?.style_preset ?? "심플 라인",
        defaultCutCount: rule?.default_cut_count ?? 6,
        aspectRatio: rule?.aspect_ratio ?? "4:5",
        tone: rule?.tone ?? null,
        fixedHashtags: rule?.fixed_hashtags ?? [],
      },
      assets,
    };
  },

  async startEpisode({ story, cutCount, seriesId, stylePreset, characterAssetId }) {
    const db = await createClient();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) throw new Error("로그인이 필요해요");

    let sid = seriesId;
    if (!sid) {
      // 온보딩에는 아직 시리즈가 없다. 첫 화를 담을 곳을 같이 만든다.
      const { data: created, error } = await db
        .from("series")
        .insert({ owner_id: auth.user.id, title: story.slice(0, 12) || "새 시리즈" })
        .select("id")
        .single();
      if (error) throw error;
      sid = created.id;
      const { error: ruleError } = await db.from("series_rules").insert({
        series_id: sid,
        default_cut_count: cutCount,
        style_preset: stylePreset ?? "심플 라인",
      });
      if (ruleError) throw ruleError;
    }

    if (characterAssetId) {
      // 온보딩에서 만든 캐릭터는 이 시리즈의 고정 에셋이 된다. 2화부터 자동으로 붙는다.
      const { error: linkError } = await db
        .from("series_assets")
        .upsert(
          { series_id: sid as string, asset_id: characterAssetId },
          { onConflict: "series_id,asset_id", ignoreDuplicates: true },
        );
      if (linkError) throw linkError;
    }

    const { data: last } = await db
      .from("episodes")
      .select("number")
      .eq("series_id", sid)
      .order("number", { ascending: false })
      .limit(1);

    const { data, error } = await db
      .from("episodes")
      .insert({
        series_id: sid,
        owner_id: auth.user.id,
        number: (last?.[0]?.number ?? 0) + 1,
        story,
        cut_count: cutCount,
        status: "storyboard",
      })
      .select("id")
      .single();
    if (error) throw error;

    return { episodeId: data.id, seriesId: sid as string };
  },

  async holdCredit({ userId, amount, reason, jobId }) {
    return createCreditLedger().hold({ userId, amount, reason, jobId });
  },

  async commitCredit(holdId: string) {
    await createCreditLedger().commit(holdId as never);
  },

  async refundCredit(holdId: string, reason: string) {
    return createCreditLedger().refund(holdId as never, reason);
  },

  async getAdminOverview(): Promise<AdminOverview | null> {
    const db = await createClient();
    // 집계는 security definer 함수 안에서만 열린다. 운영자가 아니면 SK004 로 막힌다.
    const [funnel, stats, refunds] = await Promise.all([
      db.rpc("admin_funnel"),
      db.rpc("admin_generation_stats"),
      db.rpc("admin_recent_refunds", { p_limit: 20 }),
    ]);
    if (funnel.error || stats.error) return null;

    const g = stats.data?.[0];
    const holds = Number(g?.holds ?? 0);
    const refunded = Number(g?.refunded ?? 0);

    return {
      funnel: (funnel.data ?? []).map((r) => ({
        step: r.step,
        users: Number(r.users),
      })),
      generation: {
        holds,
        refunded,
        failureRate: holds === 0 ? 0 : refunded / holds,
      },
      credit: {
        spent: Number(g?.spent ?? 0),
        refunded: Number(g?.refunded_amount ?? 0),
        granted: Number(g?.granted ?? 0),
      },
      recentRefunds: (refunds.data ?? []).map((r) => ({
        id: Number(r.id),
        userId: r.user_id,
        amount: Number(r.amount),
        createdAt: r.created_at,
      })),
    };
  },

  async getCreditDetail(): Promise<CreditDetail> {
    const db = await createClient();
    const [{ data: account }, { data: lots }] = await Promise.all([
      db.from("credit_accounts").select("balance, held").single(),
      db.from("credit_lots").select("kind, remaining, expires_at").gt("remaining", 0),
    ]);
    const now = Date.now();
    const live = (lots ?? []).filter((l) => !l.expires_at || Date.parse(l.expires_at) > now);
    const byKind = { free: 0, subscription: 0, purchase: 0 };
    for (const l of live) byKind[l.kind] += Number(l.remaining);
    const soonest = live
      .filter((l) => l.expires_at)
      .sort((a, b) => Date.parse(a.expires_at!) - Date.parse(b.expires_at!))[0];
    const nextExpiry = soonest
      ? {
          at: soonest.expires_at!,
          amount: live
            .filter((l) => l.expires_at === soonest.expires_at)
            .reduce((n, l) => n + Number(l.remaining), 0),
        }
      : null;
    return {
      balance: Number(account?.balance ?? 0),
      held: Number(account?.held ?? 0),
      byKind,
      nextExpiry,
    };
  },

  async getCreditPolicy() {
    const db = await createClient();
    const { data } = await db.from("credit_policy").select("*").single();
    return {
      signupBonus: Number(data?.signup_bonus ?? 8),
      attendanceDaily: Number(data?.attendance_daily ?? 0.5),
      attendanceStreakDays: Number(data?.attendance_streak_days ?? 7),
      attendanceStreakBonus: Number(data?.attendance_streak_bonus ?? 1),
      attendanceMonthlyCap: Number(data?.attendance_monthly_cap ?? 3),
      refundFeeRate: Number(data?.refund_fee_rate ?? 0.1),
    };
  },

  async getRefundQuote() {
    const db = await createClient();
    const { data, error } = await db.rpc("credit_refund_quote");
    if (error) throw error;
    const q = data?.[0];
    return {
      credits: Number(q?.credits ?? 0),
      grossKrw: Number(q?.gross_krw ?? 0),
      feeKrw: Number(q?.fee_krw ?? 0),
      netKrw: Number(q?.net_krw ?? 0),
    };
  },

  async getMyRefundRequest() {
    const db = await createClient();
    const { data } = await db
      .from("refund_requests")
      .select("id, user_id, credits, net_krw, fee_krw, reason, status, created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    const r = data?.[0];
    return r ? toRefundRequest(r) : null;
  },

  async requestRefund(reason) {
    const db = await createClient();
    const { error } = await db.rpc("request_credit_refund", { p_reason: reason ?? undefined });
    if (error) throw new Error(error.message);
  },

  async getAccountStatus() {
    const db = await createClient();
    const { data } = await db.from("profiles").select("deletion_requested_at").single();
    return accountStatus(data?.deletion_requested_at ?? null);
  },

  async requestAccountDeletion() {
    const db = await createClient();
    const { error } = await db.rpc("request_account_deletion");
    if (error) throw error;
    return this.getAccountStatus();
  },

  async cancelAccountDeletion() {
    const db = await createClient();
    const { error } = await db.rpc("cancel_account_deletion");
    if (error) throw error;
  },

  async listRefundRequests() {
    const db = await createClient();
    const { data, error } = await db.rpc("admin_list_refund_requests");
    if (error) throw new Error(error.message);
    return (data ?? []).map(toRefundRequest);
  },

  async processRefund(id, approve, note) {
    const db = await createClient();
    const { error } = await db.rpc("admin_process_refund", {
      p_id: id,
      p_approve: approve,
      p_note: note ?? undefined,
    });
    if (error) throw new Error(error.message);
  },

  async grantPurchase({ userId, credits, amountKrw, note }) {
    const db = await createClient();
    const { error } = await db.rpc("admin_grant_purchase", {
      p_user_id: userId,
      p_credits: credits,
      p_amount_krw: amountKrw,
      p_note: note ?? undefined,
    });
    if (error) throw new Error(error.message);
  },
};

function toRefundRequest(r: {
  id: string;
  user_id: string;
  credits: number;
  net_krw: number;
  fee_krw: number;
  reason: string | null;
  status: RefundRequest["status"];
  created_at: string;
}): RefundRequest {
  return {
    id: r.id,
    userId: r.user_id,
    credits: Number(r.credits),
    netKrw: Number(r.net_krw),
    feeKrw: Number(r.fee_krw),
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
  };
}

function accountStatus(requestedAt: string | null): AccountStatus {
  return {
    deletionRequestedAt: requestedAt,
    purgeAt: requestedAt ? new Date(Date.parse(requestedAt) + 30 * 86_400_000).toISOString() : null,
  };
}
