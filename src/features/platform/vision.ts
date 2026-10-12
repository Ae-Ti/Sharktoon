/**
 * Google Gemini Vision을 사용해 사용자가 업로드한 셀카 사진에서
 * 2D 웹툰 캐릭터 특징(태그 및 외모 묘사)을 추출합니다.
 */
import "server-only";

export interface ExtractedCharacterFeatures {
  tags: string[];
  description: string;
}

export async function extractCharacterFeaturesFromSelfie(input: {
  buffer: Buffer | ArrayBuffer;
  mimeType: string;
}): Promise<ExtractedCharacterFeatures | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const base64 = Buffer.from(input.buffer).toString("base64");
    const mimeType = input.mimeType || "image/jpeg";

    const prompt = [
      "당신은 한국 2D 웹툰 캐릭터 디자이너입니다.",
      "사용자가 업로드한 셀카 사진 속 인물을 분석하여, 2D 한국 웹툰(만화) 캐릭터로 표현하기 위한 핵심 시각적 외모 특징을 추출하세요.",
      "성별, 추정 연령대, 헤어스타일(길이/색상/웨이브 등), 안경 여부, 인상적인 표정/이목구비, 옷차림을 포착하세요.",
      "반드시 다음 JSON 형식만 순수 JSON으로 반환하세요:",
      "{",
      '  "tags": ["태그1", "태그2", "태그3", "태그4"],',
      '  "description": "2D 웹툰 캐릭터 외모 요약 1문장"',
      "}",
      "tags는 3개 이상 5개 이하의 간결한 한국어 명사형 태그로 작성하세요.",
    ].join("\n");

    const models = ["gemini-3.5-flash-lite", "gemini-3.5-flash"];
    for (const model of models) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType, data: base64 } },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!res.ok) continue;

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.tags) && typeof parsed.description === "string") {
        return {
          tags: parsed.tags
            .map((t: unknown) => String(t).trim().replace(/^#/, ""))
            .filter(Boolean)
            .slice(0, 5),
          description: parsed.description.trim(),
        };
      }
    }

    return null;
  } catch (e) {
    console.error("[vision] Gemini selfie analysis error:", e);
    return null;
  }
}
