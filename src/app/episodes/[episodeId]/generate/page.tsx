import { redirect } from "next/navigation";

export const metadata = { title: "이미지 생성 — 샥툰" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ episodeId: string }>;
  searchParams: Promise<{ job?: string }>;
}) {
  const { episodeId } = await params;
  const { job: jobId } = await searchParams;

  redirect(`/episodes/${episodeId}/editor${jobId ? `?job=${jobId}` : ""}`);
}
