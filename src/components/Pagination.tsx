'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = { page: number; pageSize: number; total: number }

/** เลขหน้าแบบย่อ: 1 … 4 5 [6] 7 8 … 20 — ไม่พ่นปุ่มเป็นร้อยเมื่อข้อมูลเยอะ */
function pages(cur: number, last: number): (number | '…')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const near = [cur - 1, cur, cur + 1].filter((p) => p > 1 && p < last)
  const out: (number | '…')[] = [1]
  if (near[0] > 2) out.push('…')
  out.push(...near)
  if (near[near.length - 1] < last - 1) out.push('…')
  out.push(last)
  return out
}

export function Pagination({ page, pageSize, total }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const [pending, start] = useTransition()

  const last = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const go = (p: number) => {
    const next = new URLSearchParams(params)
    if (p <= 1) next.delete('page')
    else next.set('page', String(p))
    start(() => router.push(next.size ? `${pathname}?${next}` : pathname))
  }

  const btn = 'flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-sm border px-2 text-xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className={`mt-3 flex flex-wrap items-center gap-2 text-xs text-fg-muted ${pending ? 'opacity-60' : ''}`}>
      <span className="tabular-nums">แสดง {from}–{to} จาก {total} รายการ</span>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={() => go(page - 1)} disabled={page <= 1 || pending}
                aria-label="หน้าก่อนหน้า" className={`${btn} border-line hover:border-primary hover:text-primary`}>
          <ChevronLeft size={14} strokeWidth={1.75} aria-hidden />
        </button>

        {pages(page, last).map((p, i) =>
          p === '…' ? (
            <span key={`gap${i}`} className="px-1">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              disabled={pending}
              aria-current={p === page ? 'page' : undefined}
              className={`${btn} tabular-nums ${p === page
                ? 'border-fg bg-surface-2 font-medium text-fg'
                : 'border-line hover:border-primary hover:text-primary'}`}
            >
              {p}
            </button>
          ),
        )}

        <button type="button" onClick={() => go(page + 1)} disabled={page >= last || pending}
                aria-label="หน้าถัดไป" className={`${btn} border-line hover:border-primary hover:text-primary`}>
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  )
}
