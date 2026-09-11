'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { CircleAlert, HandHelping } from 'lucide-react'
import { acceptCase, type AcceptState } from '@/app/(app)/patients/actions'

type Props = {
  caseId: string
  caseNo: string | null          // ใช้บอกเคสตอน hover เท่านั้น ไม่ได้แสดงในกล่อง
  patient: string | null
  sub: string | null             // เพศ + อายุ
  disease: string | null
  addr: string | null            // บ้านเลขที่ หมู่ ตำบล อำเภอ
}

export function AcceptButton({ caseId, caseNo, patient, sub, disease, addr }: Props) {
  const dlg = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [state, submit, pending] = useActionState<AcceptState, FormData>(acceptCase, {})

  useEffect(() => {
    if (open) dlg.current?.showModal()
  }, [open])

  useEffect(() => {
    if (state.ok) dlg.current?.close()
  }, [state.ok])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`รับเคส ${caseNo ?? caseId}`}
        className="cursor-pointer rounded-sm bg-warn-soft px-1.5 py-0.5 font-sans text-[11px] font-medium text-warn transition-colors duration-150 hover:bg-warn hover:text-bg"
      >
        กดรับเคส
      </button>

      {open && (
        <dialog
          ref={dlg}
          aria-labelledby={`accept-title-${caseId}`}
          onClose={(e) => { if (e.target === dlg.current) setOpen(false) }}
          onClick={(e) => { if (e.target === dlg.current) dlg.current?.close() }}
          className="m-auto w-[min(24rem,92vw)] rounded-sm border border-line bg-surface p-0 text-left text-fg backdrop:bg-black/50"
        >
          <header className="flex items-center gap-2.5 border-b border-line bg-primary-soft px-5 py-3 text-primary">
            <HandHelping size={20} strokeWidth={2} aria-hidden />
            <h2 id={`accept-title-${caseId}`} className="text-base font-semibold">รับเคส</h2>
          </header>

          {/* ข้อมูลพอให้รู้ว่ากดถูกเคส ไม่ต้องอธิบายว่ารับแล้วจะเกิดอะไร */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-5 py-4 text-sm">
            <dt className="text-fg-muted">ผู้ป่วย</dt>
            <dd>
              <div className="font-medium">{patient ?? `เคส ${caseId}`}</div>
              {sub && <div className="sub text-fg-muted">{sub}</div>}
            </dd>
            <dt className="text-fg-muted">วินิจฉัย</dt>
            <dd>{disease ?? '—'}</dd>
            <dt className="whitespace-nowrap text-fg-muted">ที่อยู่ขณะป่วย</dt>
            <dd>{addr || '—'}</dd>
          </dl>

          {state.error && (
            <p className="mx-5 mb-4 flex items-start gap-1.5 rounded-sm bg-warn-soft px-3 py-2 text-xs text-warn">
              <CircleAlert size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />{state.error}
            </p>
          )}

          <form action={submit} className="flex gap-2 border-t border-line px-5 py-3">
            <input type="hidden" name="caseId" value={caseId} />
            <button
              type="button"
              onClick={() => dlg.current?.close()}
              className="flex-1 cursor-pointer rounded-sm border border-line px-3 py-2 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 cursor-pointer rounded-sm bg-primary px-3 py-2 text-sm font-medium text-bg transition-opacity duration-150 hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? 'กำลังรับ…' : 'รับเคส'}
            </button>
          </form>
        </dialog>
      )}
    </>
  )
}
