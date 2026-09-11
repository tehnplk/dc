'use client'

import { useEffect, useState } from 'react'
import { LogIn } from 'lucide-react'

/** พาไปหน้า SSO เองเมื่อครบเวลา กดเองก่อนก็ได้ หรือกดหยุดถ้ายังไม่พร้อม */
export function LoginCountdown({ href, seconds = 10 }: { href: string; seconds?: number }) {
  const [left, setLeft] = useState(seconds)
  const [stopped, setStopped] = useState(false)

  useEffect(() => {
    if (stopped) return
    if (left <= 0) {
      // location.href ไม่ใช่ router.push: ปลายทาง redirect ออกนอกโดเมนไป SSO
      location.href = href
      return
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [left, stopped, href])

  return (
    <>
      <a
        href={href}
        className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-bg transition-opacity duration-150 hover:opacity-85"
      >
        <LogIn size={16} strokeWidth={2} aria-hidden />เข้าสู่ระบบ
      </a>

      {/* aria-live: คนใช้ screen reader ต้องรู้ว่ากำลังจะถูกพาไปไหน ไม่ใช่จู่ ๆ หน้าเปลี่ยน */}
      <p className="mt-3 text-xs text-fg-muted" aria-live="polite">
        {stopped ? (
          'หยุดนับถอยหลังแล้ว กดปุ่มด้านบนเพื่อเข้าสู่ระบบ'
        ) : (
          <>
            กำลังพาไปหน้าเข้าสู่ระบบใน <span className="font-mono tabular-nums text-fg">{left}</span> วินาที
            {' · '}
            <button
              type="button"
              onClick={() => setStopped(true)}
              className="cursor-pointer underline underline-offset-2 transition-colors duration-150 hover:text-fg"
            >
              หยุด
            </button>
          </>
        )}
      </p>
    </>
  )
}
