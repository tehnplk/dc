'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { CircleAlert, Pencil, Trash2, X } from 'lucide-react'
import { deleteActivity, updateActivity, type ActivityState } from '@/app/(app)/accept/actions'
import { MODAL } from '@/lib/ui'
import type { Activity } from '@/app/(app)/patients/actions'

type Props = { act: Activity; caseNo: string | null; onSaved?: () => void }

const field = 'mt-1 block w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-primary focus:border-primary'

/** แก้ไข/ลบกิจกรรม — เฉพาะหน่วยบริการที่ถือเคสอยู่ (server ตรวจซ้ำอีกชั้น) */
export function EditActivityModal({ act, caseNo, onSaved }: Props) {
  const dlg = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [state, submit, pending] = useActionState<ActivityState, FormData>(updateActivity, {})
  const [del, delSubmit, deleting] = useActionState<ActivityState, FormData>(deleteActivity, {})

  useEffect(() => {
    if (open) dlg.current?.showModal()
  }, [open])

  // callback ใน ref: ใส่ใน deps ตรง ๆ แล้ว identity เปลี่ยนทุก render จะยิงซ้ำไม่จบ
  const saved = useRef(onSaved)
  saved.current = onSaved
  useEffect(() => {
    if (state.ok || del.ok) { dlg.current?.close(); saved.current?.() }
  }, [state.ok, del.ok])

  const err = state.error || del.error
  const date = act.date ? act.date.slice(0, 10) : ''

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`แก้ไขกิจกรรมลำดับ ${act.seq}`}
        aria-label={`แก้ไขกิจกรรมลำดับ ${act.seq}`}
        className="flex size-8 cursor-pointer items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-primary"
      >
        <Pencil size={15} strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <dialog
          ref={dlg}
          aria-labelledby={`edit-act-${act.id}`}
          onClose={(e) => { if (e.target === dlg.current) setOpen(false) }}
          onClick={(e) => { if (e.target === dlg.current) dlg.current?.close() }}
          className={MODAL}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={`edit-act-${act.id}`} className="text-base font-semibold">แก้ไขกิจกรรมสอบสวนควบคุมโรค</h2>
              <p className="truncate text-sm text-fg-muted">{caseNo ?? ''} · ลำดับ {act.seq}</p>
            </div>
            <button
              type="button"
              onClick={() => dlg.current?.close()}
              aria-label="ปิด"
              className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <X size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </header>

          <form action={submit} className="flex min-h-0 flex-1 flex-col">
            <input type="hidden" name="id" value={act.id ?? ''} />
            <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-4">
              <div className="grid grid-cols-3 gap-4">
                <label className="block text-xs text-fg-muted">
                  วันที่ *
                  <input type="date" name="date_act" required defaultValue={date} className={field} />
                </label>
                <label className="block text-xs text-fg-muted">
                  เวลา
                  <input type="time" name="time_act" defaultValue={act.time?.slice(0, 5) ?? ''} className={field} />
                </label>
                <label className="block text-xs text-fg-muted">
                  ผู้ดำเนินการ
                  <input name="performer" defaultValue={act.performer ?? ''} maxLength={255} className={field} />
                </label>
              </div>

              <label className="block text-xs text-fg-muted">
                กิจกรรมที่ดำเนินการ *
                <input name="activity_name" required maxLength={255} defaultValue={act.name ?? ''} className={field} />
              </label>

              <label className="block text-xs text-fg-muted">
                รายละเอียด
                <textarea name="note" rows={4} maxLength={1000} defaultValue={act.note ?? ''} className={`${field} resize-y`} />
              </label>

              {/* ไฟล์แนบแก้ในนี้ไม่ได้ ลบกิจกรรมทีเดียวแล้วบันทึกใหม่ง่ายกว่า */}
              {(act.docs.length > 0 || act.photos.length > 0) && (
                <p className="text-xs text-fg-muted">
                  มีไฟล์แนบ {act.docs.length + act.photos.length} ไฟล์ (ลบกิจกรรมนี้ ไฟล์จะหายไปด้วย)
                </p>
              )}

              {err && (
                <p className="flex items-center gap-1.5 rounded-sm bg-warn-soft px-3 py-2 text-xs text-warn">
                  <CircleAlert size={14} strokeWidth={1.75} aria-hidden />{err}
                </p>
              )}
            </div>

            <footer className="flex shrink-0 items-center gap-3 border-t border-line px-5 py-3">
              <button
                type="submit"
                formAction={delSubmit}
                disabled={deleting}
                className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-sm text-fg-muted transition-colors duration-150 hover:border-warn hover:bg-warn-soft hover:text-warn disabled:cursor-wait"
              >
                <Trash2 size={15} strokeWidth={1.75} aria-hidden />{deleting ? 'กำลังลบ…' : 'ลบกิจกรรม'}
              </button>
              <button
                type="button"
                onClick={() => dlg.current?.close()}
                className="ml-auto cursor-pointer rounded-sm border border-line px-3 py-1.5 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={pending}
                className="cursor-pointer rounded-sm bg-primary px-4 py-1.5 text-sm font-medium text-bg transition-opacity duration-150 hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </footer>
          </form>
        </dialog>
      )}
    </>
  )
}
