"use client";

import { useState, useTransition } from "react";
import { Button, ChoiceCard, Field, Modal } from "@/components/ui";
import { saveAssetAction } from "@/features/platform/actions";
import type { Asset, AssetKind } from "@/features/platform/data/types";

const KINDS: { id: AssetKind; title: string; description: string }[] = [
  { id: "character", title: "캐릭터", description: "회차마다 같은 얼굴로 나올 인물" },
  { id: "location", title: "장소", description: "반복해서 나오는 배경" },
  { id: "prop", title: "소품", description: "손에 들리거나 놓이는 물건" },
  { id: "style", title: "스타일", description: "그림체 프리셋" },
];

export interface AssetFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 없으면 새로 만들기. */
  asset?: Asset | null;
  defaultKind: AssetKind;
}

/**
 * 열 때마다 초기값에서 시작해야 하므로 부모가 key 로 새로 마운트한다.
 * useEffect 로 상태를 되돌리면 렌더 중에 한 번 더 그리게 된다.
 */
export function AssetFormModal({
  open,
  onClose,
  asset,
  defaultKind,
}: AssetFormModalProps) {
  const [kind, setKind] = useState<AssetKind>(asset?.kind ?? defaultKind);
  const [name, setName] = useState(asset?.name ?? "");
  const [description, setDescription] = useState(asset?.description ?? "");
  const [tags, setTags] = useState(asset?.tags.join(", ") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();


  const tagList = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // 캐릭터 태그는 5개까지. DB 제약과 같은 값을 화면에서도 먼저 막는다.
  const tooManyTags = tagList.length > 5;

  function submit() {
    if (!name.trim()) {
      setError("이름을 적어 주세요.");
      return;
    }
    if (tooManyTags) {
      setError("태그는 5개까지만 넣을 수 있어요.");
      return;
    }
    start(async () => {
      const r = await saveAssetAction(asset?.id ?? null, {
        kind,
        name: name.trim(),
        description: description.trim() || null,
        tags: tagList,
      });
      if (r.ok) onClose();
      else setError(r.message);
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={asset ? "에셋 수정" : "에셋 추가"}
      description={
        asset
          ? "바꾼 내용은 다음 화부터 적용돼요. 지난 회차는 그대로예요."
          : "한 번 등록해 두면 모든 회차에 고정 레퍼런스로 들어가요."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button loading={pending} onClick={submit}>
            {asset ? "저장" : "추가"}
          </Button>
        </>
      }
    >
      {!asset && (
        <div role="group" aria-label="에셋 종류" className="grid grid-cols-2 gap-2">
          {KINDS.map((k) => (
            <ChoiceCard
              key={k.id}
              title={k.title}
              description={k.description}
              selected={kind === k.id}
              onClick={() => setKind(k.id)}
            />
          ))}
        </div>
      )}

      <Field label="이름" value={name} onChange={setName} placeholder="부장님" />

      <Field
        label="설명"
        multiline
        rows={3}
        value={description}
        onChange={setDescription}
        placeholder="50대, 넥타이, 항상 팔짱. 목소리가 크다."
        help="생성할 때 이 문장이 그대로 들어가요. 구체적일수록 일관성이 올라가요."
        optional
      />

      <Field
        label="특징 태그"
        value={tags}
        onChange={setTags}
        placeholder="넥타이, 팔짱"
        error={tooManyTags ? "태그는 5개까지만 넣을 수 있어요." : undefined}
        help="쉼표로 구분해 5개까지."
        optional
      />

      {error && <p className="text-body-sm text-danger">{error}</p>}
    </Modal>
  );
}
