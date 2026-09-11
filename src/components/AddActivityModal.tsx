'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { addActivity, type ActivityState } from '@/app/(app)/accept/actions'
import { MAX_IMAGES } from '@/lib/upload'
import { FilePicker } from './FilePicker'
import { MODAL } from '@/lib/ui'

type Props = { caseId: string; caseNo: string | null; patient: string | null; performer: string | null; onSaved?: () => void }

const field = 'mt-1 block w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-primary focus:border-primary'

export function AddActivityModal({ caseId, caseNo, patient, performer, onSaved }: Props) {
  const dlg = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [state, submit, pending] = useActionState<ActivityState, FormData>(addActivity, {})

  useEffect(() => {
    if (open) dlg.current?.showModal()
  }, [open])

  // เก็บ callback ไว้ใน ref: ถ้าใส่ใน deps ตรง ๆ พอ parent re-render แล้ว identity เปลี่ยน
  // effect จะยิงซ้ำทั้งที่ state.ok ค่าเดิม กลายเป็นลูปโหลดไม่จบ
  const saved = useRef(onSaved)
  saved.current = onSaved
  useEffect(() => {
    if (state.ok) { dlg.current?.close(); saved.current?.() }
  }, [state.ok])

  // ค่าเริ่มต้นเป็นวันนี้ตามเวลาไทย ไม่ใช่ UTC ของเครื่องผู้ใช้
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

  const send = (e: React.FormEvent<HTMLFormElement>) => {
    // ประกอบ FormData เอง เพราะไฟล์ที่ส่งคือตัวที่บีบแล้ว ไม่ใช่ตัวใน <input>
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    files.forEach((f) => fd.append('files', f))
    // ต้องอยู่ใน transition ไม่งั้น pending ของ useActionState ไม่ขยับ ปุ่มไม่ล็อกตอนกำลังส่ง
    startTransition(() => submit(fd))
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setFiles([]); setOpen(true) }}
        title={`เพิ่มกิจกรรมของเคส ${caseNo ?? caseId}`}
        aria-label={`เพิ่มกิจกรรมของเคส ${caseNo ?? caseId}`}
        className="flex w-full cursor-pointer items-center justify-center gap-2 bg-primary-soft px-3 py-3 text-sm font-medium text-primary transition-colors duration-150 hover:bg-primary hover:text-bg"
      >
        <Plus size={18} strokeWidth={2.5} aria-hidden />เพิ่มกิจกรรม
      </button>

      {open && (
        <dialog
          ref={dlg}
          aria-labelledby={`add-act-${caseId}`}
          onClose={(e) => { if (e.target === dlg.current) setOpen(false) }}
          onClick={(e) => { if (e.target === dlg.current) dlg.current?.close() }}
          className={MODAL}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={`add-act-${caseId}`} className="text-base font-semibold">เพิ่มกิจกรรมสอบสวนควบคุมโรค</h2>
              <p className="truncate text-sm text-fg-muted">
                {caseNo ?? `เคส ${caseId}`}{patient ? ` · ${patient}` : ''}
              </p>
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

          <form onSubmit={send} className="flex min-h-0 flex-1 flex-col">
            <input type="hidden" name="caseId" value={caseId} />
            <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-4">
              <div className="grid grid-cols-3 gap-4">
                <label className="block text-xs text-fg-muted">
                  วันที่ *
                  <input type="date" name="date_act" required defaultValue={today} className={field} />
                </label>
                <label className="block text-xs text-fg-muted">
                  เวลา
                  <input type="time" name="time_act" className={field} />
                </label>
                <label className="block text-xs text-fg-muted">
                  ผู้ดำเนินการ
                  <input name="performer" defaultValue={performer ?? ''} maxLength={255} className={field} />
                </label>
              </div>

              <label className="block text-xs text-fg-muted">
                กิจกรรมที่ดำเนินการ *
                <input name="activity_name" required maxLength={255} placeholder="เช่น พ่นสารเคมีครั้งที่ 1" className={field} />
              </label>

              <label className="block text-xs text-fg-muted">
                รายละเอียด
                <textarea name="note" rows={4} maxLength={1000} className={`${field} resize-y`} />
              </label>

              <FilePicker
                label={`ไฟล์แนบ — รูปไม่เกิน ${MAX_IMAGES} รูป (บีบให้เหลือรูปละ ≤1 MB ให้อัตโนมัติ) และ PDF`}
                kind="both"
                files={files}
                onChange={setFiles}
              />
            </div>

            <footer className="flex shrink-0 items-center gap-3 border-t border-line px-5 py-3">
              {state.error && <p className="text-sm text-warn">{state.error}</p>}
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
