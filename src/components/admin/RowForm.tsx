'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { CircleAlert, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { AdminState } from '@/app/(app)/admin/actions'
import { field } from '@/lib/ui'

type Action = (prev: AdminState, fd: FormData) => Promise<AdminState>
type Props = {
  title: string
  trigger: 'add' | 'edit'
  save: Action
  remove?: Action
  removeKey?: { name: string; value: string }
  /** ข้อความบนปุ่มลบ ไม่ใส่ = ไอคอนถังขยะ */
  removeLabel?: string
  /** กว้างพิเศษ สำหรับ content ที่เป็นตาราง */
  wide?: boolean
  children: React.ReactNode
}


/** โมดัลฟอร์มแถวเดียว ใช้ซ้ำทั้งเพิ่ม/แก้ไข ของทุกแท็บในหน้าแอดมิน */
export function RowForm({ title, trigger, save, remove, removeKey, removeLabel, wide, children }: Props) {
  const dlg = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [state, submit, pending] = useActionState<AdminState, FormData>(save, {})
  const [del, delSubmit, deleting] = useActionState<AdminState, FormData>(
    remove ?? (async () => ({})),
    {},
  )

  useEffect(() => {
    if (open) dlg.current?.showModal()
  }, [open])
  useEffect(() => {
    if (state.ok || del.ok) dlg.current?.close()
  }, [state.ok, del.ok])

  const err = state.error || del.error

  return (
    <>
      {trigger === 'add' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm bg-primary px-3 text-sm font-medium text-bg transition-opacity duration-150 hover:opacity-85"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden />{title}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={title}
          title={title}
          className="flex size-8 cursor-pointer items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-primary"
        >
          <Pencil size={15} strokeWidth={1.75} aria-hidden />
        </button>
      )}

      {open && (
        <dialog
          ref={dlg}
          aria-label={title}
          onClose={(e) => { if (e.target === dlg.current) setOpen(false) }}
          onClick={(e) => { if (e.target === dlg.current) dlg.current?.close() }}
          className={`m-auto ${wide ? 'w-[min(52rem,95vw)]' : 'w-[min(28rem,95vw)]'} rounded-sm border border-line bg-surface p-0 text-left text-fg backdrop:bg-black/50`}
        >
          <header className="flex items-center gap-3 border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              type="button"
              onClick={() => dlg.current?.close()}
              aria-label="ปิด"
              className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <X size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </header>

          <form action={submit} className="space-y-3 px-5 py-4">
            {/* คีย์ของแถว ส่งไปทั้งตอนบันทึกและตอนลบ (ใส่ name บนปุ่มที่มี formAction ไม่ได้) */}
            {remove && removeKey && <input type="hidden" name={removeKey.name} value={removeKey.value} />}
            {children}

            {err && (
              <p className="flex items-start gap-1.5 rounded-sm bg-warn-soft px-3 py-2 text-xs text-warn">
                <CircleAlert size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />{err}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              {remove && removeKey && (
                <button
                  type="submit"
                  formAction={delSubmit}
                  disabled={deleting}
                  className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-line px-3 py-2 text-sm text-fg-muted transition-colors duration-150 hover:border-warn hover:bg-warn-soft hover:text-warn disabled:cursor-wait"
                >
                  <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                  {removeLabel}
                </button>
              )}
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
                {pending ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  )
}
