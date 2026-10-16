import fs from "fs";
import path from "path";

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("No OPENAI_API_KEY provided");
  process.exit(1);
}

const STYLES = [
  {
    id: "simple-line",
    name: "심플 라인",
    prompt:
      "Korean slice-of-life webtoon manhwa illustration, modern daily insta-toon style, clean uniform black ink contour outlines (1.8px), flat cel coloring with light sky blue and white accents, cozy aesthetic, simple charming character smiling pleasantly, textless, solid clean background, high quality",
  },
  {
    id: "pastel",
    name: "파스텔",
    prompt:
      "Korean webtoon manhwa illustration, soft pastel color palette, warm creamy peach and gentle warm tones, rounded cozy lineart, lovely cute slice-of-life healing webtoon style, soft blush cheeks, cozy domestic atmosphere, textless, solid clean background, high quality",
  },
  {
    id: "bold-line",
    name: "굵은 선",
    prompt:
      "Korean webtoon manhwa illustration, graphic pop-art comic style, bold thick black ink outlines (4.5px stroke weight), punchy vibrant solid colors with striking contrast, dynamic expressive character, graphic novel cel shading, textless, solid clean background, high quality",
  },
  {
    id: "cheerful-comic",
    name: "명랑 코믹",
    prompt:
      "Korean comedy webtoon manhwa illustration, lively energetic comedy cartoon style, bright sunny yellow and vibrant red tones, dynamic cheerful facial expression with sparkling eyes and joyful grin, lighthearted sitcom comedy manhwa aesthetic, textless, solid clean background, high quality",
  },
  {
    id: "colored-pencil",
    name: "감성 색연필",
    prompt:
      "Korean essay webtoon manhwa illustration, textured colored pencil sketch and gentle soft watercolor wash fills, warm paper grain texture, subtle organic sketch contour lines, cozy emotional slice-of-life aesthetic, artistic hand-drawn look, textless, solid clean background, high quality",
  },
  {
    id: "modern-k-webtoon",
    name: "모던 K-웹툰",
    prompt:
      "Modern Korean romance drama webtoon manhwa illustration, refined delicate ink contour lineart, sleek stylish character design with sharp attractive jawline and detailed expressive eyes with highlights, sophisticated mint-teal and navy palette, trendy webtoon aesthetic, textless, solid clean background, high quality",
  },
];

const OUT_DIR = path.join(process.cwd(), "public/styles");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function generateStyle(style: typeof STYLES[0]) {
  console.log(`[Generating] ${style.name} (${style.id})...`);
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2.5-sunburst",
      prompt: style.prompt,
      n: 1,
      size: "1024x1024",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to generate ${style.name}: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const item = data.data?.[0];
  const outPath = path.join(OUT_DIR, `${style.id}.png`);

  if (item?.b64_json) {
    fs.writeFileSync(outPath, Buffer.from(item.b64_json, "base64"));
    console.log(`[Saved] ${outPath} (b64)`);
  } else if (item?.url) {
    const imgRes = await fetch(item.url);
    const buf = await imgRes.arrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(buf));
    console.log(`[Saved] ${outPath} (url download)`);
  } else {
    throw new Error(`No image data in response for ${style.name}`);
  }
}

async function main() {
  for (const s of STYLES) {
    const outPath = path.join(OUT_DIR, `${s.id}.png`);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
      console.log(`[Skip] Already exists: ${s.name}`);
      continue;
    }
    await generateStyle(s);
  }
  console.log("All styles generated successfully!");
}

main().catch((err) => {
  console.error("Generation error:", err);
  process.exit(1);
});
