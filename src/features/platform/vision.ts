import "server-only";

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

  const systemPrompt = [
    "당신은 인스타툰/웹툰 기획 작가입니다.",
    "사용자가 올린 카카오톡 대화 캡처, SNS/커뮤니티 글 캡처, 메모 사진 속 내용을 읽고 웹툰 4컷~8컷으로 만들기 좋은 생생한 사연으로 재구성하세요.",
    "- 카톡 대화인 경우 등장인물 간의 대화와 티키타카, 재미 포인트, 갈등 상황을 생생하게 담아주세요.",
    "- 커뮤니티 글/사연인 경우 핵심 사연과 억울함/감동/반전 포인트를 읽기 쉽게 정리해 주세요.",
    "- 인스타툰 콘티 제작의 사연 입력창에 바로 들어갈 텍스트이므로, 머리말이나 안내말('다음은 정리한 내용입니다' 등) 없이 순수 사연 본문만 깔끔하게 작성하세요.",
  ].join("\n");

  const userPrompt =
    "이 캡처 이미지의 대화/사연 내용을 읽고, 인스타툰 회차의 사연으로 바로 쓸 수 있도록 텍스트로 정리해 주세요.";

  // 1. Google Gemini Vision 우선 시도 (초저비용 / 일 1,500회 무료 티어)
  const geminiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const models = ["gemini-3.5-flash", "gemini-3.5-flash-lite"];
      for (const model of models) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
              contents: [
                {
                  parts: [
                    { text: userPrompt },
                    { inline_data: { mime_type: mimeType, data: base64 } },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1000,
              },
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
      console.warn("[vision] Gemini vision extraction error, falling back to OpenAI:", e);
    }
  }

  // 2. OpenAI GPT-4o-mini Vision 폴백 시도
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
              content: systemPrompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: userPrompt,
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
      console.warn("[vision] OpenAI vision extraction error:", e);
    }
  }

  return null;
}

