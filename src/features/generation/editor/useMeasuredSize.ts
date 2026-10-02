"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 캔버스가 들어갈 칸의 폭을 잰다. konva Stage 는 픽셀 크기를 받아야 해서
 * CSS 로 늘릴 수 없다 — 부모 크기를 재서 넘겨야 한다.
 */
export function useMeasuredSize<T extends HTMLElement>(max = 720) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // 정사각 캔버스라 짧은 쪽에 맞춘다. 세로가 모자라면 아래가 잘린다.
      setSize(Math.floor(Math.min(width, height, max)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [max]);

  return { ref, size };
}
