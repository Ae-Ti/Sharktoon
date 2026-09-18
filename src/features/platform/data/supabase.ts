import { createClient } from "@/lib/supabase/server";
import type { AssetKind } from "@/lib/supabase/database.types";
import type { Asset, PlatformRepository, SeriesDetail } from "./types";

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

export const supabaseRepository: PlatformRepository = {
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

    const rule = (data.series_rules as unknown as
      | {
          style_preset: string;
          default_cut_count: number;
          aspect_ratio: "1:1" | "4:5";
          tone: string | null;
          fixed_hashtags: string[];
        }[]
      | null)?.[0];

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
      .select("assets(*)")
      .eq("series_id", id);

    const assets = ((links ?? []) as unknown as { assets: Record<string, never> }[])
      .map((l) => l.assets)
      .filter(Boolean) as unknown as Asset[];

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      isPublic: data.is_public,
      updatedAt: data.updated_at,
      episodeCount: episodes.length,
      rule: {
        stylePreset: rule?.style_preset ?? "simple_line",
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
    let q = db
      .from("assets")
      .select("id, kind, name, description, tags, reference_paths, asset_references(episodes(number, status))");
    if (kind) q = q.eq("kind", kind);
    const { data } = await q.order("created_at", { ascending: true });

    return (data ?? []).map((a) => {
      const refs = (a.asset_references as unknown as
        | { episodes: { number: number; status: string } | null }[]
        | null) ?? [];
      const labels = refs
        .map((r) => r.episodes)
        .filter((e): e is { number: number; status: string } => Boolean(e))
        .sort((x, y) => x.number - y.number)
        .map((e) => episodeLabel(e.number, e.status));

      return {
        id: a.id,
        kind: a.kind,
        name: a.name,
        description: a.description,
        tags: a.tags,
        // 원본은 서명 URL 로만 노출한다. 목록에서는 경로만 알고 화면에서 발급받는다.
        thumbUrl: null,
        usedIn: labels.length,
        usedInEpisodes: labels,
      };
    });
  },

  async countAssetsByKind() {
    const db = await createClient();
    const { data } = await db.from("assets").select("kind");
    return (data ?? []).reduce(
      (acc, a) => ({ ...acc, [a.kind]: acc[a.kind] + 1 }),
      { ...EMPTY_COUNT },
    );
  },
};
