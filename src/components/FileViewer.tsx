'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Image as ImageIcon, X } from 'lucide-react'
import type { CaseFile } from '@/app/(app)/patients/actions'
import { MODAL } from '@/lib/ui'

type Props = { files: CaseFile[]; kind: 'image' | 'pdf'; title: string }

export function FileViewer({ files, kind, title }: Props) {
  const dlg = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)

  // mount เฉพาะตอนเปิด ไม่งั้นทุกแถวแบก dialog + iframe ไว้เปล่า ๆ
  useEffect(() => {
    if (open) dlg.current?.showModal()
  }, [open])

  if (files.length === 0) return <span className="text-fg-muted">—</span>

  const Icon = kind === 'image' ? ImageIcon : FileText
  const cur = files[Math.min(i, files.length - 1)]

  return (
    <>
      <button
        type="button"
        onClick={() => { setI(0); setOpen(true) }}
        title={`${title} ${files.length} ไฟล์`}
        aria-label={`เปิด${title} ${files.length} ไฟล์`}
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 tabular-nums transition-colors duration-150 hover:bg-surface-2 hover:text-primary"
      >
        <Icon size={12} strokeWidth={1.75} aria-hidden />{files.length}
      </button>

      {open && (
        <dialog
          ref={dlg}
          aria-label={title}
          onClose={(e) => { if (e.target === dlg.current) setOpen(false) }}
          onClick={(e) => { if (e.target === dlg.current) dlg.current?.close() }}
          className={MODAL}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            <p className="truncate text-xs text-fg-muted">{cur.name ?? cur.path}</p>
            <button
              type="button"
              onClick={() => dlg.current?.close()}
              aria-label="ปิด"
              className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <X size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </header>

          {/* มีไฟล์เดียวไม่ต้องมีแถบเลือก */}
          {files.length > 1 && (
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-2">
              {files.map((f, n) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setI(n)}
                  aria-current={n === i ? 'true' : undefined}
                  className={`cursor-pointer whitespace-nowrap rounded-sm px-2 py-1 text-xs transition-colors duration-150 ${
                    n === i ? 'bg-surface-2 font-medium text-fg' : 'text-fg-muted hover:bg-surface-2'
                  }`}
                >
                  {f.name ?? `ไฟล์ ${n + 1}`}
                </button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 bg-surface-2">
            {kind === 'image' ? (
              // next/image ไม่ช่วยอะไรตรงนี้ ไฟล์เป็นภาพผู้ใช้อัปโหลด ขนาดไม่รู้ล่วงหน้า
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cur.path}
                alt={cur.name ?? 'ภาพกิจกรรม'}
                className="mx-auto h-full w-full object-contain"
              />
            ) : (
              <iframe src={cur.path} title={cur.name ?? 'เอกสาร'} className="size-full border-0" />
            )}
          </div>
        </dialog>
      )}
    </>
  )
}
