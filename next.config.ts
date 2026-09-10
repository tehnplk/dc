import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // badge ของ dev อยู่มุมซ้ายล่างทับปุ่มธีมท้าย sidebar กดไม่ได้
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
