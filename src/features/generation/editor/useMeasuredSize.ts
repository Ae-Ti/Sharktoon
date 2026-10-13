"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 캔버스가 들어갈 칸의 폭을 잰다. konva Stage 는 픽셀 크기를 받아야 해서
 * CSS 로 늘릴 수 없다 — 부모 크기를 재서 넘겨야 한다.
 */
export function useMeasuredSize<T extends HTMLElement>(aspectRatio = 1, max = 720) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      // aspectRatio 는 height / width (예: 1:1 은 1, 4:5 는 1350/1080 = 1.25)
      // 캔버스 폭(size)과 높이(size * aspectRatio) 모두가 부모 컨테이너 안에 깔끔하게 들어가도록 계산한다.
      const maxWidthByHeight = height / (aspectRatio || 1);
      const fit = Math.floor(Math.min(width, maxWidthByHeight, max));
      setSize(Math.max(120, fit));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [aspectRatio, max]);

  return { ref, size };
}
