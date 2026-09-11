'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Plus, X } from 'lucide-react'
import { fmtDate } from '@/lib/datetime'
import { getCase, type Activity, type CaseHead } from '@/app/patients/actions'
import { FileViewer } from './FileViewer'
import { AddActivityModal } from './AddActivityModal'
import { MODAL } from '@/lib/ui'

// canAdd = หน้านั้นบันทึกกิจกรรมได้ (ทะเบียนรับ) ไม่ใช่ = ดูอย่างเดียว
type Props = { caseId: string; caseNo: string | null; patient: string | null; canAdd?: boolean; performer?: string | null }

export function ActivityModal({ caseId, caseNo, patient, canAdd, performer }: Props) {
  const dlg = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Activity[] | null>(null)
  const [head, setHead] = useState<CaseHead | null>(null)

  // mount <dialog> เฉพาะตอนเปิด ไม่งั้นตาราง 100 แถว = 100 dialog ซ่อนอยู่ใน DOM
  useEffect(() => {
    if (open) dlg.current?.showModal()
  }, [open])

  // ไทม์ไลน์เรียงเก่า→ใหม่ ของที่เพิ่งเกิดกับปุ่มเพิ่มอยู่ล่างสุด เปิดมาจึงเลื่อนไปท้ายเลย
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (rows) body.current?.scrollTo({ top: body.current.scrollHeight })
  }, [rows])

  const load = async () => {
    const r = await getCase(caseId)
    setHead(r.head)
    setRows(r.rows)
  }

  const show = async () => {
    // <dialog> ของเบราว์เซอร์ให้ focus trap / Esc / backdrop มาเอง ไม่ต้องลง lib modal
    setRows(null)
    setOpen(true)
    await load()
  }

  const th = 'px-3 py-2 text-left text-sm font-medium whitespace-nowrap'
  const td = 'px-3 py-2 align-top'

  return (
    <>
      <button
        type="button"
        onClick={show}
        title={`กิจกรรมของเคส ${caseNo ?? caseId}`}
        aria-label={`ดูกิจกรรมของเคส ${caseNo ?? caseId}`}
        className={`flex size-8 cursor-pointer items-center justify-center rounded-sm transition-colors duration-150 ${
          canAdd
            ? 'bg-primary-soft text-primary hover:bg-primary hover:text-bg'
            : 'text-fg-muted hover:bg-surface-2 hover:text-primary'
        }`}
      >
        {/* หน้าที่บันทึกกิจกรรมได้ ใช้ + สื่อว่ากดแล้วทำอะไรต่อได้ ไม่ใช่แค่เปิดดู */}
        {canAdd
          ? <Plus size={16} strokeWidth={2.5} aria-hidden />
          : <FileText size={16} strokeWidth={1.75} aria-hidden />}
      </button>

      {open && (
      <dialog
        ref={dlg}
        aria-labelledby={`act-title-${caseId}`}
        onClose={(e) => { if (e.target === dlg.current) setOpen(false) }}                                          // Esc / close() -> ถอด dialog ออกจาก DOM
        onClick={(e) => { if (e.target === dlg.current) dlg.current?.close() }}  // คลิกนอกกล่อง = ปิด
        className={MODAL}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={`act-title-${caseId}`} className="truncate text-base font-semibold">
              กิจกรรมสอบสวนควบคุมโรค
            </h2>
            <p className="truncate text-sm text-fg-muted">{caseNo ?? `เคส ${caseId}`}</p>
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

        {/* แถบข้อมูลผู้ป่วย: อ่านไทม์ไลน์ต้องเห็นว่าเป็นเคสใคร โรคอะไร ป่วยตั้งแต่เมื่อไหร่ */}
        {head && (
          <dl className="flex shrink-0 flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-line bg-surface-2 px-5 py-2.5 text-xs">
            <Item label="ผู้ป่วย" value={head.name} strong />
            <Item label="เพศ" value={head.gender} />
            <Item label="อายุ" value={head.age} />
            <Item label="วันเริ่มป่วย" value={fmtDate(head.onset ? new Date(head.onset) : null)} />
            <Item label="วันรับรักษา" value={fmtDate(head.visit ? new Date(head.visit) : null)} />
            <Item label="วินิจฉัย" value={head.disease} />
            <Item label="ประเภท" value={head.ptype} />
          </dl>
        )}

        <div ref={body} className="min-h-0 flex-1 overflow-auto">
          {rows === null ? (
            <p className="px-4 py-10 text-center text-xs text-fg-muted">กำลังโหลด…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-fg-muted">ยังไม่มีกิจกรรม</p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-brand text-on-brand">
                <tr className="border-b border-line">
                  <th className={`${th} text-right`}>ลำดับ</th>
                  <th className={th}>วันที่</th>
                  <th className={th}>เวลา</th>
                  <th className={th}>กิจกรรม</th>
                  <th className={`${th} text-right`}>เอกสาร</th>
                  <th className={`${th} text-right`}>รูปภาพ</th>
                  <th className={th}>ผู้ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.seq} className="border-b border-line transition-colors duration-150 last:border-0 odd:bg-surface-2/50 hover:bg-primary-soft">
                    <td className={`${td} text-right font-mono tabular-nums text-fg-muted`}>{r.seq}</td>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>
                      {fmtDate(r.date ? new Date(r.date) : null)}
                    </td>
                    <td className={`${td} whitespace-nowrap font-mono text-fg-muted`}>
                      {r.time ?? '—'}
                    </td>
                    <td className={td}>{r.name ?? '—'}</td>
                    <td className={`${td} whitespace-nowrap text-right text-fg-muted`}>
                      <FileViewer files={r.docs} kind="pdf" title="เอกสาร" />
                    </td>
                    <td className={`${td} whitespace-nowrap text-right text-fg-muted`}>
                      <FileViewer files={r.photos} kind="image" title="ภาพกิจกรรม" />
                    </td>
                    <td className={td}>{r.performer ?? '—'}</td>
                  </tr>
                ))}
                {/* แถวสุดท้ายเป็นปุ่มเพิ่ม กิจกรรมใหม่ต่อท้ายไทม์ไลน์อยู่แล้ว ปุ่มจึงอยู่ตรงนี้ */}
                {canAdd && (
                  <tr className="border-t border-line">
                    <td colSpan={7} className="p-0">
                      <AddActivityModal
                        caseId={caseId}
                        caseNo={caseNo}
                        patient={patient}
                        performer={performer ?? null}
                        onSaved={load}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </dialog>
      )}
    </>
  )
}

function Item({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={strong ? 'font-medium' : 'tabular-nums'}>{value ?? '—'}</dd>
    </div>
  )
}
