/**
 * 내보내는 PNG 의 AI 생성 메타데이터. 브라우저·Node 어디서나 돈다(검증 스크립트가 쓴다).
 */

/**
 * PNG 에 tEXt 청크로 AI 생성 표시를 남긴다(IHDR 바로 뒤).
 * 키워드는 PNG 규격의 "Software"·"Comment" 와 IPTC 의 디지털 소스 유형 값을 쓴다.
 */
export function withAiMetadata(png: Uint8Array): Uint8Array {
  const entries: [string, string][] = [
    ["Software", "Sharktoon"],
    ["Comment", "AI-generated image (Sharktoon)"],
    ["DigitalSourceType", "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"],
  ];
  const chunks = entries.map(([k, v]) => textChunk(k, v));
  // 시그니처 8바이트 + IHDR(길이 4 + 타입 4 + 데이터 13 + CRC 4) = 33
  const at = 33;
  const total = png.length + chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  out.set(png.subarray(0, at), 0);
  let offset = at;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  out.set(png.subarray(at), offset);
  return out;
}

function textChunk(keyword: string, text: string): Uint8Array {
  const data = new TextEncoder().encode(`${keyword}\0${text}`);
  const type = new TextEncoder().encode("tEXt");
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

let CRC_TABLE: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
