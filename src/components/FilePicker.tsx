'use client'

import { useState } from 'react'
import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react'
import { MAX_IMAGES, isImage, isPdf, shrinkImage } from '@/lib/upload'

type Kind = 'image' | 'pdf' | 'both'
type Props = { label: string; kind: Kind; files: File[]; onChange: (f: File[]) => void }

const ACCEPT: Record<Kind, string> = {
  image: 'image/*',
  pdf: 'application/pdf',
  both: 'image/*,application/pdf',
}
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`)

export function FilePicker({ label, kind, files, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState<string | null>(null)

  const ok = (t: string) => (kind === 'image' ? isImage(t) : kind === 'pdf' ? isPdf(t) : isImage(t) || isPdf(t))

  const pick = async (list: FileList | null) => {
    if (!list?.length) return
    setWarn(null)
    setBusy(true)
    const next = [...files]
    for (const f of list) {
      if (!ok(f.type)) { setWarn(`${f.name} ไม่ตรงชนิดที่รับ`); continue }
      if (isImage(f.type) && next.filter((x) => isImage(x.type)).length >= MAX_IMAGES) {
        setWarn(`แนบรูปได้ไม่เกิน ${MAX_IMAGES} รูป`); continue
      }
      next.push(await shrinkImage(f))   // รูปถูกบีบให้ ≤1 MB ตั้งแต่ยังไม่ออกจากเครื่อง
    }
    onChange(next)
    setBusy(false)
  }

  return (
    <div className="text-xs text-fg-muted">
      {label}
      <div className="mt-1 rounded-sm border border-dashed border-line p-3">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-primary hover:text-primary">
          <Paperclip size={14} strokeWidth={1.75} aria-hidden />
          {busy ? 'กำลังบีบรูป…' : 'เลือกไฟล์'}
          <input
            type="file"
            multiple
            accept={ACCEPT[kind]}
            disabled={busy}
            onChange={(e) => { pick(e.target.files); e.target.value = '' }}
            className="hidden"
          />
        </label>

        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs">
                {isImage(f.type)
                  ? <ImageIcon size={14} strokeWidth={1.75} className="text-primary" aria-hidden />
                  : <FileText size={14} strokeWidth={1.75} className="text-primary" aria-hidden />}
                <span className="truncate text-fg">{f.name}</span>
                <span className="shrink-0 font-mono text-fg-muted">{kb(f.size)}</span>
                <button
                  type="button"
                  onClick={() => onChange(files.filter((_, n) => n !== i))}
                  aria-label={`เอา ${f.name} ออก`}
                  className="ml-auto shrink-0 cursor-pointer rounded-sm p-1 text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-warn"
                >
                  <X size={12} strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {warn && <p className="mt-2 text-xs text-warn">{warn}</p>}
      </div>
    </div>
  )
}
