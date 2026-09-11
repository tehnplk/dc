'use client'

import { useEffect, useState } from 'react'
import { CaseSensitive } from 'lucide-react'
import { applyGridFont, readGridFont, FONTS, type GridFont } from '@/lib/theme'

/** ปรับขนาดตัวอักษรเฉพาะตารางข้อมูล — ส่วนอื่นของหน้าไม่ขยับ */
export function GridFontToggle() {
  // เริ่ม null ให้ตรงกับ HTML ที่เซิร์ฟเวอร์ส่งมา (เซิร์ฟเวอร์ไม่รู้ localStorage)
  const [cur, setCur] = useState<GridFont | null>(null)
  useEffect(() => setCur(readGridFont()), [])

  const i = Math.max(0, FONTS.findIndex((f) => f.id === (cur ?? 'md')))
  const f = FONTS[i]

  return (
    <div className="px-3 py-2 text-sm text-fg-muted">
      <span className="flex items-center gap-2">
        <CaseSensitive size={16} strokeWidth={1.75} aria-hidden />
        <span className="flex-1">ขนาดตัวอักษรตาราง</span>
        <span className={`text-xs ${cur ? '' : 'invisible'}`}>{f.label}</span>
      </span>

      <span className={`mt-1.5 flex items-center gap-2 ${cur ? '' : 'invisible'}`}>
        {/* ก เล็ก/ใหญ่ ขนาบสองข้าง บอกทิศทางของสไลเดอร์โดยไม่ต้องมีคำอธิบาย */}
        <span aria-hidden className="text-[11px] leading-none">ก</span>
        <input
          type="range"
          min={0}
          max={FONTS.length - 1}
          step={1}
          value={i}
          onChange={(e) => {
            const next = FONTS[Number(e.target.value)].id
            applyGridFont(next)
            setCur(next)
          }}
          aria-label="ขนาดตัวอักษรตาราง"
          aria-valuetext={f.label}
          className="h-1.5 flex-1 cursor-pointer accent-primary"
        />
        <span aria-hidden className="text-[18px] leading-none">ก</span>
      </span>
    </div>
  )
}
