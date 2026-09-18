import type { Metadata } from "next";
import { LegalDocument } from "@/features/platform/legal/LegalDocument";

export const metadata: Metadata = {
  title: "개인정보 처리방침 · 샥툰",
};

export default function Page() {
  return <LegalDocument slug="privacy" />;
}
