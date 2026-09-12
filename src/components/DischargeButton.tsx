'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { CircleAlert, Trash2 } from 'lucide-react'
import { dischargeCase, type DischargeState } from '@/app/(app)/accept/actions'

type Props = { caseId: string; caseNo: string | null; patient: string | null }

/** จำหน่ายเคสออกจากระบบ — ปุ่มนี้โผล่เฉพาะ สสจ. (หน้าเรียกส่ง canDischarge มาเอง) */
export function DischargeButton({ caseId, caseNo, patient }: Props) {
  const dlg = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [state, submit, pending] = useActionState<DischargeState, FormData>(dischargeCase, {})

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
        title={`จำหน่ายเคส ${caseNo ?? caseId}`}
        aria-label={`จำหน่ายเคส ${caseNo ?? caseId}`}
        className="flex size-8 cursor-pointer items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-warn"
      >
        <Trash2 size={16} strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <dialog
          ref={dlg}
          aria-labelledby={`dis-${caseId}`}
          onClose={(e) => { if (e.target === dlg.current) setOpen(false) }}
          onClick={(e) => { if (e.target === dlg.current) dlg.current?.close() }}
          className="m-auto w-[min(26rem,92vw)] rounded-md border border-line bg-surface p-0 text-left text-fg backdrop:bg-black/50"
        >
          <form action={submit}>
            <input type="hidden" name="caseId" value={caseId} />
            <div className="px-6 pt-7 pb-5 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-warn-soft text-warn">
                <Trash2 size={30} strokeWidth={1.5} aria-hidden />
              </div>
              <h2 id={`dis-${caseId}`} className="text-lg font-semibold">จำหน่ายเคสออกจากระบบ</h2>
              <p className="mt-2 text-sm text-fg-muted">{patient ?? `เคส ${caseId}`}</p>
              <p className="mt-1 font-mono text-xs text-fg-muted">{caseNo ?? ''}</p>
              <p className="mt-3 text-xs text-fg-muted">
                เคสจะหายจากทุกทะเบียนและรายงาน แต่ไม่ได้ถูกลบจริง — ประวัติการรับ/คืน/กิจกรรมยังอยู่ครบ
              </p>
              <input
                name="reason"
                required
                maxLength={255}
                placeholder="เหตุผลที่จำหน่าย *"
                className="mt-4 block w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-primary focus:border-primary"
              />
              {state.error && (
                <p className="mt-4 flex items-center justify-center gap-1.5 rounded-sm bg-warn-soft px-3 py-2 text-xs text-warn">
                  <CircleAlert size={14} strokeWidth={1.75} aria-hidden />{state.error}
                </p>
              )}
            </div>

            <div className="flex gap-2 border-t border-line px-6 py-4">
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
                className="flex-1 cursor-pointer rounded-sm bg-warn px-3 py-2 text-sm font-medium text-bg transition-opacity duration-150 hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? 'กำลังจำหน่าย…' : 'ยืนยันจำหน่าย'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  )
}
