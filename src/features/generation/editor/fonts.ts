/**
 * 작품 안 글꼴 — PRD 3.2 "한글 폰트는 20종 이상 제공한다".
 *
 * UI 글꼴(Pretendard)과 따로 관리한다(디자인 가이드). 전부 Google Fonts 의
 * SIL Open Font License 글꼴이라 상업 이용·이미지 내보내기가 된다(PRD 의존성 "라이선스").
 * 목록과 라이선스 근거는 docs/편집기_캔버스_규칙.md 에 같이 적었다.
 *
 * 글꼴 파일은 편집기에서 실제로 쓰는 것만 그때그때 불러온다. 24종을 미리 다 받으면
 * 한글 글꼴 특성상 수 MB 가 된다.
 */

export interface ToonFont {
  family: string;
  label: string;
  /** 손글씨·둥근·각진·명조 — 고르는 사람이 성격으로 찾는다. */
  tone: "손글씨" | "둥근" | "굵은" | "고딕" | "명조" | "장식";
}

export const TOON_FONTS: ToonFont[] = [
  { family: "Gaegu", label: "개구", tone: "손글씨" },
  { family: "Nanum Pen Script", label: "나눔손글씨 펜", tone: "손글씨" },
  { family: "Nanum Brush Script", label: "나눔손글씨 붓", tone: "손글씨" },
  { family: "Gamja Flower", label: "감자꽃", tone: "손글씨" },
  { family: "Hi Melody", label: "하이멜로디", tone: "손글씨" },
  { family: "Poor Story", label: "푸어스토리", tone: "손글씨" },
  { family: "Single Day", label: "싱글데이", tone: "손글씨" },
  { family: "Kirang Haerang", label: "기랑해랑", tone: "손글씨" },
  { family: "Cute Font", label: "귀여운", tone: "둥근" },
  { family: "Jua", label: "주아", tone: "둥근" },
  { family: "Dongle", label: "동글", tone: "둥근" },
  { family: "Gowun Dodum", label: "고운돋움", tone: "둥근" },
  { family: "Do Hyeon", label: "도현", tone: "굵은" },
  { family: "Black Han Sans", label: "검은고딕", tone: "굵은" },
  { family: "Bagel Fat One", label: "베이글", tone: "굵은" },
  { family: "Gasoek One", label: "가석", tone: "굵은" },
  { family: "Noto Sans KR", label: "본고딕", tone: "고딕" },
  { family: "Nanum Gothic", label: "나눔고딕", tone: "고딕" },
  { family: "Gothic A1", label: "고딕 A1", tone: "고딕" },
  { family: "Orbit", label: "오르빗", tone: "고딕" },
  { family: "Noto Serif KR", label: "본명조", tone: "명조" },
  { family: "Nanum Myeongjo", label: "나눔명조", tone: "명조" },
  { family: "Gowun Batang", label: "고운바탕", tone: "명조" },
  { family: "Song Myung", label: "송명", tone: "명조" },
  { family: "Hahmlet", label: "함렛", tone: "명조" },
  { family: "Yeon Sung", label: "연성", tone: "장식" },
  { family: "Dokdo", label: "독도", tone: "장식" },
  { family: "East Sea Dokdo", label: "동해독도", tone: "장식" },
  { family: "Stylish", label: "스타일리시", tone: "장식" },
  { family: "Gugi", label: "구기", tone: "장식" },
  { family: "Diphylleia", label: "디필레이아", tone: "장식" },
];

/** 새 레이어의 기본 글꼴. 손글씨 계열이 인스타툰에 가장 흔하다. */
export const DEFAULT_TOON_FONT = "Gaegu";

const requested = new Set<string>();

/**
 * 글꼴을 문서에 싣고 다 받을 때까지 기다린다. konva 는 캔버스에 그리므로
 * 글꼴이 오기 전에 그리면 대체 글꼴로 굳는다 — 다 받은 뒤 다시 그려야 한다.
 */
export async function ensureToonFont(family: string): Promise<void> {
  if (typeof document === "undefined") return;
  if (!TOON_FONTS.some((f) => f.family === family)) return;

  if (!requested.has(family)) {
    requested.add(family);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    // 굵기를 지정하면 그 굵기가 없는 글꼴(대부분의 한글 손글씨체)은 요청 전체가 400 이 된다.
    // 기본 굵기만 받고, 굵게는 브라우저가 합성한다.
    link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}&display=swap`;
    document.head.appendChild(link);
    await new Promise<void>((resolve) => {
      link.addEventListener("load", () => resolve(), { once: true });
      link.addEventListener("error", () => resolve(), { once: true });
      setTimeout(resolve, 4000);
    });
  }

  try {
    await document.fonts.load(`32px "${family}"`, "가나다abc");
  } catch {
    // 글꼴을 못 받아도 편집은 계속된다. 대체 글꼴로 보인다.
  }
}
