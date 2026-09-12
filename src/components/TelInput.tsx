'use client'

import { useState } from 'react'
import { maskTel } from '@/lib/tel'

/** ช่องเบอร์โทรที่ใส่ขีดให้ตอนพิมพ์ — ฝั่ง server ถอดขีดออกก่อนเก็บ */
export function TelInput({ name, defaultValue = '', className }: {
  name: string; defaultValue?: string | null; className?: string
}) {
  const [v, setV] = useState(maskTel(defaultValue ?? ''))
  return (
    <input
      name={name} inputMode="tel" autoComplete="off"
      value={v} onChange={(e) => setV(maskTel(e.target.value))}
      placeholder="08x-xxx-xxxx"
      className={`${className} font-mono tracking-wide`}
    />
  )
}
