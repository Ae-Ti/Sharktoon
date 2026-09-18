/**
 * 콘티 목 데이터 — PRD 2.2 의 결과 모양을 그대로 채운 것.
 *
 * 화면을 만들 때 "LLM 이 이 정도는 돌려준다" 는 가정을 한 곳에 모아 둔다.
 * 실제 파이프라인이 붙으면 이 파일만 지운다.
 */

import type { Storyboard } from "../types/storyboard";

export const MOCK_EPISODE_ID = "ep_001";
export const MOCK_SERIES_ID = "sr_001";

/** 등장인물 id → 표시 이름. 에셋 라이브러리(태일)가 붙기 전까지의 대역이다. */
export const MOCK_CHARACTERS: Record<string, string> = {
  ch_me: "나",
  ch_boss: "팀장님",
  ch_dog: "설기(강아지)",
};

export const MOCK_STORYBOARD: Storyboard = {
  id: "sb_001",
  episodeId: MOCK_EPISODE_ID,
  seriesId: MOCK_SERIES_ID,
  status: "draft",
  story:
    "퇴근 10분 전에 팀장님이 내일 아침까지 해달라며 일을 넘겼다. 화가 났지만 아무 말도 못 하고 집에 왔는데, 문 열자마자 강아지가 꼬리를 흔들며 달려와서 그냥 울어버렸다.",
  cuts: [
    {
      id: "cut_1",
      index: 1,
      scene: "어두워진 사무실, 퇴근 준비를 끝낸 주인공이 가방을 메고 일어서는 순간 뒤에서 그림자가 진다",
      characterIds: ["ch_me", "ch_boss"],
      emotion: "anxious",
      camera: "medium",
      dialogue: [
        { id: "ln_1", speakerId: "ch_boss", text: "아 그거 내일 아침까지 되지?", balloon: "normal" },
      ],
      narration: "퇴근 10분 전이었다.",
    },
    {
      id: "cut_2",
      index: 2,
      scene: "주인공의 얼굴 클로즈업. 입꼬리는 올라가 있지만 눈은 웃지 않는다",
      characterIds: ["ch_me"],
      emotion: "embarrassed",
      camera: "close_up",
      dialogue: [
        { id: "ln_2", speakerId: "ch_me", text: "네... 해볼게요.", balloon: "normal" },
        { id: "ln_3", speakerId: "ch_me", text: "(왜 지금?)", balloon: "thought" },
      ],
    },
    {
      id: "cut_3",
      index: 3,
      scene: "텅 빈 지하철 안, 창에 비친 자기 얼굴을 보는 주인공. 손잡이만 흔들린다",
      characterIds: ["ch_me"],
      emotion: "sad",
      camera: "wide",
      dialogue: [],
      narration: "집까지 40분, 한마디도 못 했다는 생각만 했다.",
    },
    {
      id: "cut_4",
      index: 4,
      scene: "현관문이 열리는 순간, 문틈 사이로 강아지가 달려나오는 실루엣",
      characterIds: ["ch_me", "ch_dog"],
      emotion: "surprised",
      camera: "pov",
      dialogue: [{ id: "ln_4", speakerId: null, text: "타다다닷", balloon: "none" }],
    },
    {
      id: "cut_5",
      index: 5,
      scene: "현관 바닥에 주저앉은 주인공, 강아지가 얼굴을 핥는다. 가방은 그대로 바닥에",
      characterIds: ["ch_me", "ch_dog"],
      emotion: "sad",
      camera: "medium",
      dialogue: [{ id: "ln_5", speakerId: "ch_me", text: "...왜 이렇게 반가워해.", balloon: "whisper" }],
      narration: "참았던 게 그제야 터졌다.",
    },
    {
      id: "cut_6",
      index: 6,
      scene: "불 꺼진 거실 소파, 강아지를 안고 잠든 주인공. 노트북은 닫혀 있다",
      characterIds: ["ch_me", "ch_dog"],
      emotion: "calm",
      camera: "wide",
      dialogue: [],
      narration: "내일 아침 일은 내일의 내가 하기로 했다.",
    },
  ],
  hookOptions: [
    {
      id: "hook_1",
      text: "퇴근 10분 전에 들은 그 말",
      rationale: "시간을 먼저 던져서 무슨 말인지 궁금하게 만든다. 1컷에서 멈추지 않고 넘기게 하는 쪽.",
    },
    {
      id: "hook_2",
      text: "\"아 그거 내일 아침까지 되지?\"",
      rationale: "대사를 그대로 후킹으로 쓴다. 같은 일을 겪은 사람이 바로 자기 얘기로 읽는다.",
    },
    {
      id: "hook_3",
      text: "오늘도 네라고 대답했다",
      rationale: "결말을 먼저 보여주고 이유를 궁금하게 만든다. 공감형 댓글이 붙기 쉽다.",
    },
  ],
  selectedHookId: "hook_2",
  ctaOptions: [
    {
      id: "cta_1",
      kind: "like",
      text: "오늘도 참은 당신, 좋아요로 토닥여 주세요",
      rationale: "행동 부담이 가장 낮다. 첫 화 반응 모으기에 안전한 선택.",
    },
    {
      id: "cta_2",
      kind: "next_episode",
      text: "다음 화 — 다음 날 아침, 나는 결국 말했다",
      rationale: "연재 의도를 바로 알린다. 팔로우 전환을 노릴 때.",
    },
    {
      id: "cta_3",
      kind: "question",
      text: "여러분은 그때 뭐라고 대답했나요?",
      rationale: "댓글을 직접 유도한다. 저장·공유보다 댓글이 잘 붙는 소재다.",
    },
  ],
  selectedCtaId: null,
  createdAt: "2026-09-18T16:10:00+09:00",
  updatedAt: "2026-09-18T16:41:00+09:00",
};
