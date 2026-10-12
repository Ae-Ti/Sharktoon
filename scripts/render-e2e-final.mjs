import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";

async function renderComposite(inputPath, outputPath, { narration, dialogue, tailDirection }) {
  const baseImg = await sharp(inputPath).resize(1080, 1080).png().toBuffer();

  const bubbleX = 140;
  const bubbleY = 750;
  const bubbleW = 800;
  const bubbleH = 160;

  const tailPoints = tailDirection === "left"
    ? `${bubbleX + 160},${bubbleY} ${bubbleX + 220},${bubbleY} ${bubbleX + 120},${bubbleY - 80}`
    : `${bubbleX + 580},${bubbleY} ${bubbleX + 640},${bubbleY} ${bubbleX + 680},${bubbleY - 80}`;

  const svgOverlay = `
  <svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.25"/>
      </filter>
    </defs>

    <!-- 상단 나레이션 박스 -->
    <g filter="url(#shadow)">
      <rect x="50" y="40" width="340" height="56" rx="14" fill="#1E293B" fill-opacity="0.9" stroke="#334155" stroke-width="2"/>
      <text x="220" y="76" font-family="Pretendard, Apple SD Gothic Neo, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC" text-anchor="middle" dominant-baseline="middle">
        ${narration}
      </text>
    </g>

    <!-- 하단 말풍선 (꼬리 포함) -->
    <g filter="url(#shadow)">
      <!-- 말풍선 꼬리 -->
      <polygon points="${tailPoints}" fill="#FFFFFF" stroke="#0F172A" stroke-width="6" stroke-linejoin="round"/>
      <!-- 말풍선 본체 -->
      <rect x="${bubbleX}" y="${bubbleY}" width="${bubbleW}" height="${bubbleH}" rx="32" fill="#FFFFFF" stroke="#0F172A" stroke-width="6"/>
      <!-- 안쪽 꼬리 이음새 흰색 덮개 -->
      <line x1="${tailDirection === 'left' ? bubbleX + 162 : bubbleX + 582}" y1="${bubbleY}" x2="${tailDirection === 'left' ? bubbleX + 218 : bubbleX + 638}" y2="${bubbleY}" stroke="#FFFFFF" stroke-width="8"/>
      <!-- 대사 텍스트 -->
      <text x="${bubbleX + bubbleW / 2}" y="${bubbleY + bubbleH / 2}" font-family="Pretendard, Apple SD Gothic Neo, sans-serif" font-size="34" font-weight="bold" fill="#0F172A" text-anchor="middle" dominant-baseline="middle">
        ${dialogue}
      </text>
    </g>
  </svg>
  `;

  await sharp(baseImg)
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png()
    .toFile(outputPath);

  console.log("합성 완료:", outputPath);
}

async function run() {
  const dir = "/Users/taeilbae/.gemini/antigravity/brain/731bccf6-3d9c-4e16-a108-0f1d62975c56/scratch";
  
  await renderComposite(
    `${dir}/ep-cut1.jpg`,
    `${dir}/final-cut1.png`,
    { narration: "AM 08:30 출근길 카페", dialogue: "드디어 월급날!! 오늘만을 기다렸다구 😆", tailDirection: "left" }
  );

  await renderComposite(
    `${dir}/ep-cut2.jpg`,
    `${dir}/final-cut2.png`,
    { narration: "PM 12:30 점심시간", dialogue: "사장님 여기 특상초밥 추가요! 오늘 내가 쏜다! 🍣", tailDirection: "right" }
  );

  await renderComposite(
    `${dir}/ep-cut3.jpg`,
    `${dir}/final-cut3.png`,
    { narration: "PM 03:00 사무실", dialogue: "이번 달 결제 예정 금액이 3백만원이라고...?! 😱", tailDirection: "left" }
  );

  await renderComposite(
    `${dir}/ep-cut4.jpg`,
    `${dir}/final-cut4.png`,
    { narration: "PM 11:30 내 방 침대", dialogue: "뭐 어때... 다음 달의 내가 알아서 갚겠지... zzz 🐱", tailDirection: "left" }
  );
}

run();
