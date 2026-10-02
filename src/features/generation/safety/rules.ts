/**
 * 규칙 기반 1차 필터. 모델 호출 전에 돌기 때문에 크레딧을 잡기 전에 막는다.
 *
 * **이건 그물이지 자물쇠가 아니다.** 목록에 없는 이름은 당연히 통과하고,
 * 통과한 요청은 2차(LLM 판정)와 3차(이미지 모델 자체 정책)에서 다시 걸린다.
 * 목록을 늘려서 정확도를 올리려 들지 말고, 오탐이 나면 목록에서 빼는 쪽으로 쓴다.
 */

import { ALLOWED, blocked, type SafetyVerdict } from "./types";

/**
 * 실존 인물 신호. 특정 이름을 나열하는 대신 "실제 사람을 지목하는 말투"를 잡는다.
 * 이름 목록은 관리가 불가능하고 동명이인 오탐이 크다.
 */
const REAL_PERSON = [
  /실존\s*인물/,
  /실제\s*(사람|인물|연예인)/,
  /(연예인|아이돌|배우|가수|정치인|대통령|유튜버|인플루언서)\s*(닮|같이|처럼|얼굴|사진)/,
  /(닮은|똑같이)\s*(꼴|그려)/,
];

/** 미성년자 + 부적절 묘사가 같이 있을 때만 막는다. 미성년자 등장 자체는 막지 않는다. */
const MINOR_SUBJECT = [
  /(초등학생|중학생|고등학생|미성년자|어린이|아동|유치원생)/,
  /\b(1[0-7]|[1-9])\s*살/,
  /\b(1[0-7]|[1-9])\s*세\b/,
];

const EXPLICIT = [
  /(노출|나체|알몸|누드|벗[기은]|속옷\s*차림)/,
  /(성적|야한|음란|선정적)/,
  /(피범벅|사지\s*절단|참수|잔혹하게\s*살해)/,
];

/** 국내 인스타툰 맥락에서 실제로 자주 들어오는 IP 만 둔다. */
const THIRD_PARTY_IP = [
  /(포켓몬|피카츄|짱구|도라에몽|디즈니|미키\s*마우스|엘사|마블|아이언맨|스파이더맨|헬로키티|산리오|카카오프렌즈|라이언|춘식이|펭수|뽀로로|among\s*us|마리오)/i,
];

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

/**
 * 사연·프롬프트 텍스트를 검사한다. 캐릭터 이름처럼 사용자가 지은 고유명사는
 * 검사 대상이 아니므로 호출하는 쪽에서 사연 본문만 넘긴다.
 */
export function screenText(text: string): SafetyVerdict {
  const person = firstMatch(text, REAL_PERSON);
  if (person) return blocked("real_person", "rules", person);

  const ip = firstMatch(text, THIRD_PARTY_IP);
  if (ip) return blocked("third_party_ip", "rules", ip);

  const explicit = firstMatch(text, EXPLICIT);
  if (explicit) {
    // 미성년자 신호가 같이 있으면 더 좁은 사유로 막는다. 문구가 달라진다.
    const minor = firstMatch(text, MINOR_SUBJECT);
    return blocked(minor ? "minor" : "explicit", "rules", minor ?? explicit);
  }

  return ALLOWED;
}
