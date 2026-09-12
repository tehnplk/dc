'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { popoverUp } from '@/lib/ui'

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const pad = (n: number) => String(n).padStart(2, '0')
/** ค่าที่ส่งเข้า server ยังเป็น yyyy-mm-dd ค.ศ. เหมือน <input type="date"> เดิม */
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}
const show = (s: string) => {
  const d = parse(s)
  return d ? `${d.getDate()} ${SHORT[d.getMonth()]} ${d.getFullYear() + 543}` : ''
}

type Props = {
  name: string
  defaultValue?: string
  /** ส่ง value + onChange มาถ้าจะคุมค่าจากข้างนอก (เช่นวันหนึ่งต้องตามอีกวันหนึ่ง) */
  value?: string
  onChange?: (v: string) => void
  required?: boolean
  className?: string
}

/**
 * ปฏิทิน พ.ศ. — <input type="date"> ของเบราว์เซอร์บังคับเป็น ค.ศ. และ mm/dd/yyyy ตาม locale เครื่อง
 * ช่องที่เห็นเป็นข้อความไทยอ่านอย่างเดียว (ถือ required ไว้ให้เบราว์เซอร์เตือนเอง)
 * ส่วนค่าจริงอยู่ใน hidden input ชื่อเดิม ฝั่ง server จึงไม่ต้องแก้อะไร
 */
export function ThaiDate({ name, defaultValue = '', value, onChange, required, className }: Props) {
  const [own, setOwn] = useState(defaultValue)
  const val = value ?? own
  const setVal = (v: string) => { setOwn(v); onChange?.(v) }
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => {
    const d = parse(defaultValue) ?? new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const box = useRef<HTMLDivElement>(null)
  const [up, setUp] = useState(false)

  const toggle = () => {
    const d = parse(val)                   // เปิดมาที่เดือนของค่าปัจจุบันเสมอ เผื่อถูกตั้งจากข้างนอก
    if (d) setView(new Date(d.getFullYear(), d.getMonth(), 1))
    setUp(popoverUp(box.current, 310))     // ที่ว่างข้างล่างไม่พอก็กางขึ้นบนแทน
    setOpen((o) => !o)
  }

  // ปิดเมื่อคลิกนอกกล่องหรือกด Esc — เลียนแบบ popup ของ input date ตัวจริง
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

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1)
    const last = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
    // ช่องว่างหน้าวันที่ 1 ให้ตรงคอลัมน์วันในสัปดาห์
    return [...Array<null>(first.getDay()).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)]
  }, [view])

  const move = (months: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + months, 1))
  const today = iso(new Date())

  return (
    <div ref={box} className="relative">
      <input type="hidden" name={name} value={val} />
      <input
        readOnly
        required={required}
        value={show(val)}
        placeholder="วว ดด ปปปป"
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
        aria-haspopup="dialog"
        className={`${className} cursor-pointer pr-7`}
      />
      <CalendarDays
        size={15} strokeWidth={1.75} aria-hidden
        className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-fg-muted"
      />

      {open && (
        <div className={`absolute z-50 w-[min(16rem,calc(100vw-3rem))] ${up ? 'bottom-full mb-1' : 'top-full mt-1'} rounded-sm border border-line bg-surface p-2 shadow-lg`}>
          <div className="mb-1 flex items-center gap-1">
            <Nav onClick={() => move(-12)} title="ปีก่อน"><ChevronsLeft size={15} /></Nav>
            <Nav onClick={() => move(-1)} title="เดือนก่อน"><ChevronLeft size={15} /></Nav>
            <div className="flex-1 text-center text-sm font-medium">
              {MONTHS[view.getMonth()]} {view.getFullYear() + 543}
            </div>
            <Nav onClick={() => move(1)} title="เดือนถัดไป"><ChevronRight size={15} /></Nav>
            <Nav onClick={() => move(12)} title="ปีถัดไป"><ChevronsRight size={15} /></Nav>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {DOW.map((d) => <div key={d} className="py-1 text-[11px] text-fg-muted">{d}</div>)}
            {days.map((d, i) => {
              if (d === null) return <div key={`b${i}`} />
              const v = iso(new Date(view.getFullYear(), view.getMonth(), d))
              return (
                <button
                  key={v} type="button"
                  onClick={() => { setVal(v); setOpen(false) }}
                  className={`cursor-pointer rounded-sm py-2 text-sm transition-colors duration-150 sm:py-1 ${
                    v === val ? 'bg-primary font-medium text-bg'
                      : v === today ? 'border border-primary text-fg hover:bg-surface-2'
                      : 'text-fg hover:bg-surface-2'
                  }`}
                >
                  {d}
                </button>
              )
            })}
          </div>

          <div className="mt-1 flex gap-2 border-t border-line pt-1.5 text-xs">
            <button type="button" onClick={() => { setVal(today); setOpen(false) }}
                    className="cursor-pointer text-primary hover:underline">วันนี้</button>
            <button type="button" onClick={() => { setVal(''); setOpen(false) }}
                    className="ml-auto cursor-pointer text-fg-muted hover:text-fg hover:underline">ล้าง</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Nav({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} title={title} aria-label={title}
      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg sm:size-6"
    >
      {children}
    </button>
  )
}
