/**
 * 콘텐츠 필터 — 오너: 웅싯(A). PRD 부록 A 생성 제한, 비기능 요구사항의
 * "모델 정책과 서비스 필터를 이중으로 적용한다".
 *
 * 모델이 거절하는 것과 별개로 우리 쪽에서도 막는다. 이유는 두 가지다.
 * 모델마다 정책이 다르고(오픈 이슈 1로 교체될 수 있다), 모델 호출 전에
 * 걸러야 크레딧을 잡았다가 돌려주는 왕복이 없다.
 */

export type SafetyCategory =
  /** 실존 인물 모방. */
  | "real_person"
  /** 미성년자 캐릭터의 부적절한 묘사. */
  | "minor"
  /** 타 지식재산권 캐릭터 모방. */
  | "third_party_ip"
  /** 성적·폭력적 묘사. 모델 정책과 겹치지만 우리가 먼저 막는다. */
  | "explicit";

export const SAFETY_MESSAGE: Record<SafetyCategory, string> = {
  real_person: "실제 인물을 그려 달라는 요청은 만들 수 없어요. 직접 만든 캐릭터로 바꿔주세요.",
  minor: "미성년자가 나오는 이 내용은 만들 수 없어요.",
  third_party_ip: "다른 작품의 캐릭터는 그릴 수 없어요. 직접 만든 캐릭터로 바꿔주세요.",
  explicit: "이 내용은 만들 수 없어요. 표현을 순화해 주세요.",
};

export interface SafetyVerdict {
  allowed: boolean;
  category?: SafetyCategory;
  /** 사용자에게 보여줄 문구. 무엇을 고치면 되는지까지 말한다. */
  message?: string;
  /** 무엇에 걸렸는지. 로그와 오탐 분석에만 쓰고 화면에 보여주지 않는다. */
  matched?: string;
  /** rules = 우리 규칙, model = LLM 판정. 어느 층에서 걸렸는지 남긴다. */
  layer?: "rules" | "model";
}

export const ALLOWED: SafetyVerdict = { allowed: true };

export function blocked(
  category: SafetyCategory,
  layer: "rules" | "model",
  matched?: string,
): SafetyVerdict {
  return { allowed: false, category, message: SAFETY_MESSAGE[category], matched, layer };
}
