import "server-only";

import { z } from "zod";
import { parseStructured } from "../llm";

export interface ExtractedEntity {
  kind: "character" | "prop";
  role: "protagonist" | "supporting" | "animal" | "key_prop";
  name: string;
  tags: string[];
  visualDna: string;
}

const EntitySchema = z.object({
  entities: z.array(
    z.object({
      kind: z.enum(["character", "prop"]),
      role: z.enum(["protagonist", "supporting", "animal", "key_prop"]),
      name: z.string(),
      tags: z.array(z.string()),
      visualDna: z.string(),
    })
  ),
});

const EXTRACT_SYSTEM_PROMPT = `당신은 2D 한국 인스타툰 웹툰 기획자입니다.
사연을 읽고 4컷 웹툰 제작에 필요한 핵심 등장 요소(주인공, 조연, 반려동물, 주요 소품)의 시각적 DNA(Visual DNA)를 추출하세요.

규칙:
1. 주인공(나): 20대 여성, 긴 흑발 생머리와 일자 앞머리, 평범한 인간 귀(동물 귀/머리띠 절대 없음), 4컷 내내 오버핏 다크 그레이 후드집업과 흰색 티셔츠, 다크 팬츠 고정 착용.
2. 조연(수의사, 의사, 점원, 친구 등): 사연에 등장한 조연을 주인공과 성별/연령/복장을 극명히 분리하여 구체화 (예: '40대 남성 수의사, 금테 안경, 파란 셔츠 위 흰색 의사 가운').
3. 반려동물(고양이, 강아지 등): 털 색깔, 무늬, 품종, 귀/발 특징을 4컷 불변으로 매우 구체적으로 작성 (예: '주황색 줄무늬 코숏 치즈 태비 고양이, 흰 가슴털과 흰 양말 발, 분홍 코, 호기심 많은 큰 눈').
4. 주요 소품(츄르, 머그컵 등): 사연의 핵심 소품의 외형과 색상.
`;

export async function extractEntitiesFromStory(story: string): Promise<ExtractedEntity[]> {
  try {
    const res = await parseStructured({
      schema: EntitySchema,
      system: EXTRACT_SYSTEM_PROMPT,
      user: `사연:\n${story}`,
    });

    if (res.ok && res.data.entities.length > 0) {
      return res.data.entities;
    }
  } catch (e) {
    console.error("[extractEntitiesFromStory] LLM extraction error:", e);
  }

  // 폴백: 휴리스틱 분석으로 안전하게 생성
  const list: ExtractedEntity[] = [
    {
      kind: "character",
      role: "protagonist",
      name: "나",
      tags: ["20대 여성", "긴 흑발", "일자 앞머리", "인간 귀", "그레이 후드집업"],
      visualDna: "20대 여성 주인공, 긴 흑발 생머리와 일자 앞머리, 평범한 인간 귀(동물 귀 절대 없음), 오버핏 다크 그레이 후드집업과 흰색 티셔츠, 다크 팬츠 착용",
    },
  ];

  if (story.includes("고양이") || story.includes("반려묘")) {
    list.push({
      kind: "prop",
      role: "animal",
      name: "반려 고양이",
      tags: ["치즈 태비", "주황색 줄무늬", "흰 양말", "분홍 코"],
      visualDna: "귀엽고 통통한 주황색 줄무늬 코숏 치즈 태비 고양이, 흰색 가슴털과 네 발에 흰 양말 무늬, 분홍색 코, 호기심 어린 큰 눈동자",
    });
  }

  if (story.includes("수의사") || story.includes("병원") || story.includes("선생님")) {
    list.push({
      kind: "character",
      role: "supporting",
      name: "수의사 선생님",
      tags: ["40대 남성", "안경", "흰색 의사 가운"],
      visualDna: "40대 남성 동물병원 수의사, 금테 안경을 쓰고 단정한 짧은 흑발, 파란 셔츠 위에 흰색 의사 가운 착용",
    });
  }

  if (story.includes("츄르") || story.includes("간식")) {
    list.push({
      kind: "prop",
      role: "key_prop",
      name: "츄르",
      tags: ["고양이 간식", "노란색 패키지"],
      visualDna: "노란색 포장의 고양이 스틱형 짜먹는 간식(츄르)",
    });
  }

  return list;
}
