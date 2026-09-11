import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // badge ของ dev อยู่มุมซ้ายล่างทับปุ่มธีมท้าย sidebar กดไม่ได้
  devIndicators: { position: "bottom-right" },

  // กันเว็บอื่นเอาไปฝัง/ดูดข้อมูล — ครอบทุก response รวม static ที่ proxy.ts ไม่ได้วิ่งผ่าน
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // ห้ามฝังใน iframe ของเว็บอื่น (clickjacking) — ใส่ทั้งสองแบบเผื่อเบราว์เซอร์เก่า
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          // ออกนอกเว็บแล้วไม่ต้องบอกว่ามาจาก URL ไหน (URL มีรหัสเคส/เงื่อนไขการค้น)
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
