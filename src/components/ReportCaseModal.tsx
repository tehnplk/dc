'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createCase, type FormState } from '@/app/report/actions'
import { MODAL } from '@/lib/ui'

export type AreaOpt = { code: string; name: string | null; level: number }
type Props = { areas: AreaOpt[]; diseases: { code: string; name_th: string }[]; reporter: string | null; tel: string | null }

const field = 'w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-primary focus:border-primary'
const lbl = 'block text-xs text-fg-muted'

function F({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <label className={lbl} style={{ gridColumn: `span ${span}` }}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}

export function ReportCaseModal({ areas, diseases, reporter, tel }: Props) {
  const dlg = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [amp, setAmp] = useState('')
  const [tmb, setTmb] = useState('')
  const [state, submit, pending] = useActionState<FormState, FormData>(createCase, {})

  useEffect(() => {
    if (open) dlg.current?.showModal()
  }, [open])

  // บันทึกผ่านแล้วปิดเอง ไม่ต้องให้กดปิดซ้ำ
  useEffect(() => {
    if (state.ok) dlg.current?.close()
  }, [state.ok])

  // รหัสพื้นที่เป็น prefix อยู่แล้ว (อำเภอ 4 → ตำบล 6 → หมู่บ้าน 8) ไม่ต้อง join หา parent
  const amps = useMemo(() => areas.filter((a) => a.level === 2), [areas])
  const tmbs = useMemo(() => areas.filter((a) => a.level === 3 && amp && a.code.startsWith(amp)), [areas, amp])
  const moos = useMemo(() => areas.filter((a) => a.level === 4 && tmb && a.code.startsWith(tmb)), [areas, tmb])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="แจ้งเคสใหม่"
        aria-label="แจ้งเคสใหม่"
        className="flex size-8 cursor-pointer items-center justify-center rounded-sm bg-primary text-bg transition-opacity duration-150 hover:opacity-85"
      >
        <Plus size={18} strokeWidth={2} aria-hidden />
      </button>

      {open && (
        <dialog
          ref={dlg}
          aria-labelledby="report-title"
          onClose={(e) => { if (e.target === dlg.current) { setOpen(false); setAmp(''); setTmb('') } }}
          onClick={(e) => { if (e.target === dlg.current) dlg.current?.close() }}
          className={MODAL}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
            <h2 id="report-title" className="text-base font-semibold">แจ้งเคสเข้าระบบ</h2>
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
            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              <div className="grid grid-cols-4 gap-x-4 gap-y-3">
                <F label="โรคที่วินิจฉัย *">
                  <select name="disease_code" required defaultValue="" className={field}>
                    <option value="" disabled>เลือกโรค</option>
                    {diseases.map((d) => <option key={d.code} value={d.code}>{d.name_th}</option>)}
                  </select>
                </F>
                <F label="ประเภทผู้ป่วย">
                  <select name="patient_type" defaultValue="" className={field}>
                    <option value="">—</option>
                    <option value="OPD">OPD</option>
                    <option value="IPD">IPD</option>
                  </select>
                </F>
                <F label="เลขบัตรประชาชน" span={2}>
                  <input name="cid" inputMode="numeric" maxLength={13} className={field} />
                </F>

                <F label="คำนำหน้า"><input name="pname" className={field} /></F>
                <F label="ชื่อ"><input name="fname" className={field} /></F>
                <F label="สกุล"><input name="lname" className={field} /></F>
                <div className="grid grid-cols-3 gap-2">
                  <F label="เพศ">
                    <select name="gender" defaultValue="" className={field}>
                      <option value="">—</option>
                      <option value="M">ชาย</option>
                      <option value="F">หญิง</option>
                    </select>
                  </F>
                  <F label="อายุ (ปี)"><input name="age_y" inputMode="numeric" className={field} /></F>
                  <F label="(เดือน)"><input name="age_m" inputMode="numeric" className={field} /></F>
                </div>

                <F label="อำเภอ">
                  <select
                    value={amp}
                    onChange={(e) => { setAmp(e.target.value); setTmb('') }}
                    className={field}
                  >
                    <option value="">—</option>
                    {amps.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                  </select>
                </F>
                <F label="ตำบล">
                  <select value={tmb} onChange={(e) => setTmb(e.target.value)} disabled={!amp} className={field}>
                    <option value="">—</option>
                    {tmbs.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                  </select>
                </F>
                <F label="หมู่บ้าน / ชุมชน">
                  {/* ส่งแค่รหัส 8 หลักตัวเดียว หมู่ที่ถอดจากรหัสฝั่ง server */}
                  <select name="area_code" defaultValue="" disabled={!tmb} className={field}>
                    <option value="">—</option>
                    {moos.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                  </select>
                </F>
                <div className="grid grid-cols-2 gap-2">
                  <F label="บ้านเลขที่"><input name="addr_no" className={field} /></F>
                  <F label="โทรศัพท์"><input name="tel" inputMode="tel" className={field} /></F>
                </div>

                <F label="วันเริ่มป่วย *"><input type="date" name="date_onset" required className={field} /></F>
                <F label="วันที่พบ / รักษา"><input type="date" name="date_visit" className={field} /></F>
                <div className="grid grid-cols-2 gap-2">
                  <F label="วันที่วินิจฉัย"><input type="date" name="date_dx" className={field} /></F>
                  <F label="เวลา"><input type="time" name="time_dx" className={field} /></F>
                </div>
                <F label="ผู้แจ้ง"><input name="reporter_name" defaultValue={reporter ?? ''} className={field} /></F>

                <F label="อาการ" span={3}><input name="symptom" className={field} /></F>
                <F label="โทรศัพท์ผู้แจ้ง"><input name="reporter_tel" inputMode="tel" defaultValue={tel ?? ''} className={field} /></F>
              </div>
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
