import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { themeInitScript } from "@/lib/theme";

// Geist ไม่มีสระ/วรรณยุกต์ไทย เบราว์เซอร์จะ fallback ไปฟอนต์ระบบซึ่งไม่เหมือนกันในแต่ละเครื่อง
const thai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// ตัวเลขในตาราง (วันที่/เวลา/ลำดับ) ใช้ตัวพิมพ์เดียวกันหมด จะได้เรียงตรงคอลัมน์
const mono = IBM_Plex_Mono({
  variable: "--font-mono-thai",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "PLK SRRT",
  description: "ระบบเฝ้าระวังทางระบาดวิทยา รง.506/507 จังหวัดพิษณุโลก",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${thai.variable} ${mono.variable} h-full antialiased`}
      // สคริปต์ด้านล่างเซ็ต data-theme ก่อน react hydrate เซิร์ฟเวอร์จึงส่ง html ที่ไม่มี attr นี้มา
      // ต่างกันแค่ attr เดียวบน <html> ตั้งใจให้เป็นแบบนี้ ไม่งั้นธีมจะกระพริบ
      suppressHydrationWarning
    >
      <head>
        {/* ต้องรันก่อน paint ไม่งั้นจะเห็นธีมสว่างวาบก่อนสลับเป็นมืด */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full font-sans">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* h-14 เท่าแถบหัว sidebar เพื่อให้เส้นขอบล่างตรงกันพอดี */}
          <header className="flex h-14 shrink-0 items-center justify-end border-b border-line bg-surface px-4">
            <ThemeToggle />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
