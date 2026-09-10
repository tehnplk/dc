'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, hasUserChoice, readTheme, THEME_ATTR, THEME_KEY, type Theme } from '@/lib/theme'

export function ThemeToggle() {
  // เริ่มที่ null ให้ตรงกับ HTML ที่เซิร์ฟเวอร์ส่งมา (เซิร์ฟเวอร์ไม่รู้ทั้ง localStorage
  // และ prefers-color-scheme) แล้วค่อยอ่านของจริงหลัง mount ไม่งั้น hydration mismatch
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(readTheme())

    // 1) เครื่องเปลี่ยนธีมระหว่างเปิดหน้าอยู่ — สีเปลี่ยนตาม CSS แล้ว แต่ไอคอนต้องตามด้วย
    //    (เฉพาะตอนผู้ใช้ยังไม่เคยเลือกเอง ถ้าเลือกแล้วต้องไม่ถูกทับ)
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onSystem = () => {
      if (!hasUserChoice()) setTheme(mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onSystem)

    // 2) สลับธีมในแท็บอื่น — แท็บนี้ต้องเปลี่ยนตาม ไม่ใช่ค้างคนละธีม
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return
      const root = document.documentElement
      if (e.newValue === 'light' || e.newValue === 'dark') {
        applyTheme(e.newValue, false)   // แท็บที่เขียนจำให้แล้ว ไม่ต้องเขียนซ้ำ
        setTheme(e.newValue)
      } else {
        root.removeAttribute(THEME_ATTR)   // ถูกล้างค่า -> กลับไปเดินตามเครื่อง
        setTheme(mq.matches ? 'dark' : 'light')
      }
    }
    addEventListener('storage', onStorage)

    return () => {
      mq.removeEventListener('change', onSystem)
      removeEventListener('storage', onStorage)
    }
  }, [])

  const toggle = () => {
    const next: Theme = (theme ?? readTheme()) === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  const dark = theme === 'dark'
  const label = theme === null ? 'สลับธีม' : dark ? 'โหมดมืด' : 'โหมดสว่าง'
  const action = theme === null ? '' : ` (กดเพื่อเปลี่ยนเป็น${dark ? 'สว่าง' : 'มืด'})`
  const Icon = dark ? Moon : Sun

  return (
    <button
      type="button"
      onClick={toggle}
      title={label + action}
      aria-label={label + action}
      aria-pressed={dark}
      className="flex size-11 cursor-pointer items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
    >
      {/* ก่อน mount ยังไม่รู้ธีมจริง ซ่อนไอคอนไว้กันไอคอนกระพริบผิดด้าน */}
      <Icon size={20} strokeWidth={1.75} aria-hidden className={theme ? '' : 'invisible'} />
    </button>
  )
}
