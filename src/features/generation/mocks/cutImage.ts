/**
 * 목업용 컷 이미지. 실제 생성물이 없는 동안 `imageUrl` 자리를 채운다.
 *
 * 파일을 두지 않으려고 SVG data URI 로 만든다. 스토리지가 붙으면 이 함수만 지우고
 * 진짜 URL 을 넣으면 되고, 화면 쪽은 `imageUrl` 만 보므로 바뀌지 않는다.
 */

/** 컷마다 다른 색이되 회차 안에서는 일관되게 보이도록 브랜드 계열 안에서 돌린다. */
const PAIRS = [
  ["#0f6f7d", "#123243"],
  ["#1d5f74", "#0e2a3a"],
  ["#2b6f6a", "#12333a"],
  ["#3a6b86", "#16303f"],
  ["#4a6f7a", "#1a2f3a"],
  ["#2f5f80", "#101f2e"],
];

export function mockCutImageUrl(index: number, caption: string): string {
  const [from, to] = PAIRS[(index - 1) % PAIRS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
</linearGradient></defs>
<rect width="1080" height="1080" fill="url(#g)"/>
<circle cx="540" cy="430" r="150" fill="rgba(255,255,255,0.10)"/>
<circle cx="470" cy="400" r="16" fill="rgba(255,255,255,0.55)"/>
<circle cx="610" cy="400" r="16" fill="rgba(255,255,255,0.55)"/>
<rect x="150" y="820" width="780" height="4" rx="2" fill="rgba(255,255,255,0.18)"/>
<text x="540" y="900" font-family="sans-serif" font-size="40" font-weight="700"
 fill="rgba(255,255,255,0.72)" text-anchor="middle">${escapeXml(caption)}</text>
<text x="70" y="120" font-family="sans-serif" font-size="72" font-weight="800"
 fill="rgba(255,255,255,0.30)">${index}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\n/g, ""))}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
