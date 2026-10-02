import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 셀카·에셋 레퍼런스 업로드가 서버 액션으로 온다. 파일 상한(10MB, images.ts)에
      // multipart 경계 여유를 더한 값이다.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
