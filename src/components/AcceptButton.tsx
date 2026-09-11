'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { CircleAlert, HandHelping } from 'lucide-react'
import { acceptCase, type AcceptState } from '@/app/(app)/patients/actions'

type Props = { caseId: string; caseNo: string | null; patient: string | null; place: string | null }

export function AcceptButton({ caseId, caseNo, patient, place }: Props) {
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
          className="m-auto w-[min(26rem,92vw)] rounded-md border border-line bg-surface p-0 text-fg backdrop:bg-black/50"
        >
          <div className="px-6 pt-7 pb-5 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
              <HandHelping size={30} strokeWidth={1.5} aria-hidden />
            </div>
            <h2 id={`accept-title-${caseId}`} className="text-lg font-semibold">ยืนยันรับเคส</h2>
            <p className="mt-2 text-sm text-fg-muted">
              {patient ?? `เคส ${caseId}`}
              {place && <><br />{place}</>}
            </p>
            <p className="mt-1 font-mono text-xs text-fg-muted">{caseNo ?? ''}</p>
            <p className="mt-3 text-xs text-fg-muted">
              รับแล้วเคสจะขึ้นเป็นของหน่วยงานคุณ หน่วยอื่นจะกดรับไม่ได้
            </p>

            {state.error && (
              <p className="mt-4 flex items-center justify-center gap-1.5 rounded-sm bg-warn-soft px-3 py-2 text-xs text-warn">
                <CircleAlert size={14} strokeWidth={1.75} aria-hidden />{state.error}
              </p>
            )}
          </div>

          <form action={submit} className="flex gap-2 border-t border-line px-6 py-4">
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
              {pending ? 'กำลังรับ…' : 'ยืนยันรับเคส'}
            </button>
          </form>
        </dialog>
      )}
    </>
  )
}
