'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export type Opt = { code: string; name: string | null }
type Filter = { key: string; prompt: string; opts: Opt[] }   // prompt = ตัวเลือกแรก ใช้แทน label

export function Filters({ filters }: { filters: Filter[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const [pending, start] = useTransition()

  const change = (key: string, code: string) => {
    const next = new URLSearchParams(params)
    if (code) next.set(key, code)
    else next.delete(key)
    // push ไม่ใช่ replace เพื่อให้ปุ่ม back ของเบราว์เซอร์ย้อนตัวกรองได้
    start(() => router.push(next.size ? `${pathname}?${next}` : pathname))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <select
          key={f.key}
          value={params.get(f.key) ?? ''}
          onChange={(e) => change(f.key, e.target.value)}
          disabled={pending}
          aria-label={f.prompt}
          className="max-w-56 cursor-pointer rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-primary disabled:cursor-wait disabled:opacity-60"
        >
          <option value="">{f.prompt}</option>
          {f.opts.map((o) => (
            <option key={o.code} value={o.code}>{o.name ?? o.code}</option>
          ))}
        </select>
      ))}
    </div>
  )
}
