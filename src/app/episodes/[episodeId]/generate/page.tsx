import { GenerationScreen } from "@/features/generation/components/GenerationScreen";
import { MOCK_JOB } from "@/features/generation/mocks/job";

export const metadata = { title: "이미지 생성 — 샥툰" };

export default async function Page({
  params,
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  // 실제로는 Supabase Realtime 으로 잡 상태를 구독한다. 지금은 한 순간을 고정해 둔 목이다.
  return <GenerationScreen initial={{ ...MOCK_JOB, episodeId }} />;
}
