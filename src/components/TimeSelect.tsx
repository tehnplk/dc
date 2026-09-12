'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { popoverUp } from '@/lib/ui'

const pad = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
// นาทีทีละ 5 — เวลาวินิจฉัยไม่ต้องละเอียดกว่านี้ และเลื่อนหาง่ายกว่า 60 ตัวเลือก
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5))

const pick = 'w-full cursor-pointer rounded-sm border border-line bg-surface px-2 py-2 text-center font-mono text-base text-fg transition-colors duration-150 hover:border-primary focus:border-primary sm:py-1.5 sm:text-sm'

type Props = {
  name: string
  defaultValue?: string
  required?: boolean
  className?: string
}

/**
 * ป๊อปอัปของตัวเอง ข้างในเป็น dropdown ชั่วโมงกับนาทีแยกกัน
 * ค่าจริงอยู่ใน hidden input เป็น HH:MM เหมือน <input type="time"> เดิม server ไม่ต้องแก้
 */
export function TimeSelect({ name, defaultValue = '', required, className }: Props) {
  const [h, setH] = useState(defaultValue.slice(0, 2))
  const [m, setM] = useState(defaultValue.slice(3, 5))
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const [up, setUp] = useState(false)

  const toggle = () => {
    setUp(popoverUp(box.current, 140))     // ที่ว่างข้างล่างไม่พอก็กางขึ้นบนแทน
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc, true)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc, true)
    }
  }, [open])

  // เลือกแต่ชั่วโมงก็ใช้ได้ นาทีถือเป็น 00
  const value = h ? `${h}:${m || '00'}` : ''

  return (
    <div ref={box} className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        readOnly
        required={required}
        value={value ? `${value} น.` : ''}
        placeholder="นาฬิกา:นาที"
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
        aria-haspopup="dialog"
        className={`${className} cursor-pointer pr-7`}
      />
      <Clock
        size={15} strokeWidth={1.75} aria-hidden
        className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-fg-muted"
      />

      {open && (
        <div className={`absolute z-50 w-[min(17rem,calc(100vw-3rem))] ${up ? 'bottom-full mb-1' : 'top-full mt-1'} rounded-sm border border-line bg-surface p-2 shadow-lg`}>
          <div className="grid grid-cols-2 gap-2">
            <select value={h} onChange={(e) => setH(e.target.value)} aria-label="นาฬิกา" className={pick}>
              <option value="">นาฬิกา</option>
              {HOURS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {/* นาทีเป็นค่าสุดท้ายที่ต้องเลือก เลือกแล้วปิดเลย ไม่ต้องกดตกลงซ้ำ */}
            <select value={m} onChange={(e) => { setM(e.target.value); if (e.target.value) setOpen(false) }}
                    aria-label="นาที" className={pick}>
              <option value="">นาที</option>
              {MINUTES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="mt-2 flex gap-2 border-t border-line pt-1.5 text-xs">
            <button
              type="button"
              onClick={() => {
                const n = new Date()
                setH(pad(n.getHours()))
                // ปัดเข้าช่วง 5 นาที ตันที่ 55 ไม่ให้ล้นไป 60 แล้วชั่วโมงเพี้ยน
                setM(pad(Math.min(Math.round(n.getMinutes() / 5), 11) * 5))
              }}
              className="cursor-pointer text-primary hover:underline"
            >
              ตอนนี้
            </button>
            <button type="button" onClick={() => { setH(''); setM(''); setOpen(false) }}
                    className="cursor-pointer text-fg-muted hover:text-fg hover:underline">ล้าง</button>
            <button type="button" onClick={() => setOpen(false)}
                    className="ml-auto cursor-pointer font-medium text-primary hover:underline">ตกลง</button>
          </div>
        </div>
      )}
    </div>
  )
}

