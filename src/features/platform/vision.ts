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
    const buf = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(new Uint8Array(input.buffer));
    const base64 = buf.toString("base64");
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

/**
 * 카카오톡 대화 캡처, SNS/커뮤니티 글, 메모 사진 등에서
 * 인스타툰용 사연 내용을 추출하고 생생한 스토리로 재구성합니다.
 */
export async function extractStoryFromImage(input: {
  buffer: Buffer | ArrayBuffer;
  mimeType: string;
}): Promise<string | null> {
  const buf = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(new Uint8Array(input.buffer));
  const base64 = buf.toString("base64");
  const mimeType = input.mimeType || "image/jpeg";

  // 1. OpenAI GPT-4o-mini Vision 우선 시도
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: [
                "당신은 인스타툰/웹툰 기획 작가입니다.",
                "사용자가 올린 카카오톡 대화 캡처, SNS/커뮤니티 글 캡처, 메모 사진 속 내용을 읽고 웹툰 4컷~8컷으로 만들기 좋은 생생한 사연으로 재구성하세요.",
                "- 카톡 대화인 경우 등장인물 간의 대화와 티키타카, 재미 포인트, 갈등 상황을 생생하게 담아주세요.",
                "- 커뮤니티 글/사연인 경우 핵심 사연과 억울함/감동/반전 포인트를 읽기 쉽게 정리해 주세요.",
                "- 인스타툰 콘티 제작의 사연 입력창에 바로 들어갈 텍스트이므로, 머리말이나 안내말('다음은 정리한 내용입니다' 등) 없이 순수 사연 본문만 깔끔하게 작성하세요.",
              ].join("\n"),
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "이 캡처 이미지의 대화/사연 내용을 읽고, 인스타툰 회차의 사연으로 바로 쓸 수 있도록 텍스트로 정리해 주세요.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch (e) {
      console.warn("[vision] OpenAI vision extraction error, trying Gemini fallback:", e);
    }
  }

  // 2. Google Gemini Vision 폴백 시도
  const geminiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const prompt =
        "이 캡처 이미지 속의 카카오톡 대화 또는 글 내용을 읽고, 4~8컷 인스타툰으로 제작하기 좋은 사연 텍스트로 정리해 주세요. 인사말이나 안내문 없이 사연 내용만 작성하세요.";
      const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-3.5-flash"];
      for (const model of models) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
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
            }),
          },
        );
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) return text;
        }
      }
    } catch (e) {
      console.warn("[vision] Gemini vision extraction error:", e);
    }
  }

  return null;
}

