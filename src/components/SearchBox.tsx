'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { LoaderCircle, Search, X } from 'lucide-react'

/** ค้นสดระหว่างพิมพ์ หน่วง 300ms พอให้หยุดพิมพ์ก่อนค่อยยิง ไม่ใช่ทุกตัวอักษร */
export function SearchBox({ placeholder = 'ค้นหาชื่อผู้ป่วย' }: { placeholder?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const [pending, start] = useTransition()
  const q = params.get('q') ?? ''
  const [text, setText] = useState(q)
  const box = useRef<HTMLInputElement>(null)

  // ค่าใน URL เปลี่ยนจากทางอื่น (กด back / กดล้าง) ให้ช่องตามไปด้วย
  useEffect(() => {
    setText((cur) => (cur.trim() === q ? cur : q))
  }, [q])

  useEffect(() => {
    if (text.trim() === q) return
    const run = () => {
      const next = new URLSearchParams(params)
      if (text.trim()) next.set('q', text.trim())
      else next.delete('q')
      next.delete('page')   // คำค้นเปลี่ยน ชุดผลลัพธ์เปลี่ยน ต้องกลับหน้า 1
      // replace ไม่ใช่ push: พิมพ์ทีละคำไม่ควรยัด history จนปุ่ม back ใช้ไม่ได้
      // scroll:false กันหน้าเด้งขึ้นบนทุกครั้งที่พิมพ์ ตอนเลื่อนดูตารางอยู่
      start(() => router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false }))
    }
    // ล้างคำค้นไม่ต้องหน่วง ผู้ใช้รู้ผลอยู่แล้วว่าจะได้ทั้งหมดกลับมา
    if (!text.trim()) { run(); return }
    const t = setTimeout(run, 200)
    return () => clearTimeout(t)
  }, [text, q, params, pathname, router])

  // บอกทั้งหน้าให้หรี่ผลลัพธ์ตอนกำลังค้น ข้ามขอบ server/client ด้วย prop ไม่ได้
  // เลยติดธงไว้ที่ <main> แล้วให้ CSS จัดการ (ดู globals.css)
  useEffect(() => {
    const main = box.current?.closest('main')
    if (main) main.dataset.busy = pending ? 'true' : 'false'
  }, [pending])

  return (
    <div className="relative">
      {/* สลับไอคอนซ้ายเป็นตัวหมุน ไม่ไปสลับปุ่มล้างฝั่งขวา จะได้ไม่มีอะไรกระพริบ */}
      {pending
        ? <LoaderCircle size={14} strokeWidth={2} aria-hidden
                        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 animate-spin text-primary" />
        : <Search size={14} strokeWidth={1.75} aria-hidden
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />}
      <input
        ref={box}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        // ห้าม disabled ระหว่างค้น ไม่งั้นพิมพ์ต่อไม่ได้และ focus หลุด
        className="w-56 rounded-sm border border-line bg-surface py-1.5 pr-7 pl-8 text-sm text-fg transition-colors duration-150 hover:border-primary focus:border-primary"
      />
      {text && (
        <button
          type="button"
          onClick={() => { setText(''); box.current?.focus() }}
          aria-label="ล้างคำค้น"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded-sm p-1 text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <X size={12} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  )
}
