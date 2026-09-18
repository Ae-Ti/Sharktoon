import type { Metadata } from "next";
import { LegalDocument } from "@/features/platform/legal/LegalDocument";

export const metadata: Metadata = {
  title: "이용약관 · 샥툰",
};

export default function Page() {
  return <LegalDocument slug="terms" />;
}
