'use client'

import { startTransition, useActionState } from 'react'
import type { AdminState } from '@/app/(app)/admin/actions'
import { toggleMustReport } from '@/app/(app)/admin/actions'

/** สวิตช์เปิด/ปิดโรคที่ต้องรายงาน — ติ๊กแล้วบันทึกเลย ไม่มีปุ่มยืนยัน */
export function MustReportToggle({ code, on }: { code: string; on: boolean }) {
  const [state, submit, pending] = useActionState<AdminState, FormData>(toggleMustReport, {})

  return (
    <span className="flex items-center gap-2">
      <label className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 ${
        pending ? 'cursor-wait opacity-60' : 'cursor-pointer'
      } ${on ? 'bg-primary' : 'bg-line'}`}>
        <input
          type="checkbox" checked={on} disabled={pending}
          onChange={(e) => {
            const fd = new FormData()
            fd.set('code', code)
            if (e.target.checked) fd.set('must_report', 'on')
            startTransition(() => submit(fd))
          }}
          className="peer sr-only"
        />
        <span className={`absolute size-4 rounded-full bg-surface transition-all duration-150 ${on ? 'left-6' : 'left-1'}`} />
      </label>
      {state.error && <span className="text-xs text-warn">{state.error}</span>}
    </span>
  )
}
