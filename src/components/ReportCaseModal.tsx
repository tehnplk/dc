'use client'

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import { createCase, updateCase, type FormState } from '@/app/(app)/report/actions'
import { maskCid } from '@/lib/cid'
import { MAX_IMAGES } from '@/lib/upload'
import { FilePicker } from './FilePicker'
import { TelInput } from './TelInput'
import { ThaiDate } from './ThaiDate'
import { TimeSelect } from './TimeSelect'
import { MODAL } from '@/lib/ui'

export type AreaOpt = { code: string; name: string | null; level: number }
export type Disease = { code: string; name_th: string; icd10?: string[] }

/** ค่าตั้งต้นของฟอร์ม — ใช้ทั้งตอนสร้างเคสจากผู้ป่วยใน HIS และตอนแก้ไขเคสเดิม */
export type Prefill = {
  cid?: string; hn?: string; pname?: string; fname?: string; lname?: string
  gender?: string; age_y?: number; age_m?: number; tel?: string
  date_onset?: string; date_visit?: string; date_dx?: string; time_dx?: string
  patient_type?: string; disease_code?: string
  area_code?: string; addr_no?: string; symptom?: string
  reporter_name?: string; reporter_tel?: string
}

type Props = {
  areas: AreaOpt[]; diseases: Disease[]; reporter: string | null; tel: string | null
  initial?: Prefill
  /** plus = ปุ่ม + บนหัวหน้า, row = ปุ่มในแถวตาราง, edit = ดินสอแก้เคสเดิม */
  trigger?: 'plus' | 'row' | 'edit'
  /** มีค่า = โหมดแก้ไข ยิงไป updateCase แทน createCase */
  caseId?: string
  /** เลขทะเบียนไว้โชว์บนหัวโมดัลตอนแก้ไข */
  caseNo?: string | null
}

const field = 'w-full rounded-sm border border-line bg-surface px-2 py-2 text-base text-fg transition-colors duration-150 hover:border-primary focus:border-primary sm:py-1.5 sm:text-sm'
const lbl = 'block text-xs text-fg-muted'

const area = `${field} min-h-16 resize-y`

// จอเล็กเรียงลงมาทีละช่อง (กริดเป็น 1 คอลัมน์) span มีผลตั้งแต่ sm ขึ้นไปเท่านั้น
// ต้องเขียนคลาสเต็มไว้ — Tailwind สแกนหาชื่อคลาสในไฟล์ ต่อสตริงเองแล้วไม่เจอ
const SPAN: Record<number, string> = {
  2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4',
  5: 'sm:col-span-5', 6: 'sm:col-span-6', 12: 'sm:col-span-12',
}

function F({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <label className={`${lbl} ${SPAN[span] ?? ''}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}

/** ท่อนของฟอร์มตามใบแจ้งเคสกระดาษ — เส้นคั่นแทนบรรทัด ------ */
function Sec({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-3 first:border-0 first:pt-0">
      {title && <h3 className="mb-2 text-xs font-semibold text-fg">{title}</h3>}
      <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-12">{children}</div>
    </section>
  )
}

// วงกลมวาดเอง: appearance-none แล้วใช้ inset shadow เจาะรูตรงกลางตอนติ๊ก
// (accent-color ของเบราว์เซอร์คุมขนาดไม่ได้ และหน้าตาต่างกันทุก OS)
const radio =
  'size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-line bg-surface transition-colors duration-150 ' +
  'checked:border-primary checked:bg-primary checked:shadow-[inset_0_0_0_3.5px_var(--color-surface)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/** กลุ่มตัวเลือกอันเดียว — ใช้ radio ไม่ใช่ checkbox เพราะเลือกได้ทีละอย่าง */
function Radios({ name, options, defaultValue, span = 1 }: {
  name: string; options: [string, string][]; defaultValue?: string; span?: number
}) {
  return (
    // สูงเท่าช่องกรอกพอดี จะได้อยู่แนวเดียวกับ input/select ที่อยู่แถวเดียวกัน
    <div className={`flex min-h-[42px] flex-wrap items-center gap-x-2 gap-y-1 sm:min-h-[34px] ${SPAN[span] ?? ''}`}>
      {options.map(([v, t]) => (
        <label
          key={v}
          className="flex cursor-pointer items-center gap-2 rounded-sm border border-transparent px-2 py-1 text-sm text-fg transition-colors duration-150 hover:bg-surface-2 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
        >
          <input type="radio" name={name} value={v} defaultChecked={defaultValue === v} className={radio} />
          {t}
        </label>
      ))}
    </div>
  )
}

export function ReportCaseModal({ areas, diseases, reporter, tel, initial, trigger = 'plus', caseId, caseNo }: Props) {
  const dlg = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [dz, setDz] = useState(initial?.disease_code ?? '')
  const [cid, setCid] = useState(maskCid(initial?.cid ?? ''))
  const [visit, setVisit] = useState(initial?.date_visit ?? '')
  // วันวินิจฉัยตามวันรับรักษาให้เอง จนกว่าผู้ใช้จะแก้เอง แล้วค่อยปล่อยอิสระ
  const [dx, setDx] = useState(initial?.date_dx ?? '')
  const [dxEdited, setDxEdited] = useState(false)
  // แก้ไขเคสเดิม: ถอดอำเภอ/ตำบลจากรหัสพื้นที่ 8 หลัก ไม่งั้น dropdown ลูกจะว่าง
  const [amp, setAmp] = useState(initial?.area_code?.slice(0, 4) ?? '')
  const [tmb, setTmb] = useState(initial?.area_code?.slice(0, 6) ?? '')
  const [imgs, setImgs] = useState<File[]>([])
  const [pdfs, setPdfs] = useState<File[]>([])
  const [state, submit, pending] = useActionState<FormState, FormData>(caseId ? updateCase : createCase, {})

  useEffect(() => {
    if (open) dlg.current?.showModal()
  }, [open])

  // บันทึกผ่านแล้วปิดเอง ไม่ต้องให้กดปิดซ้ำ
  useEffect(() => {
    if (state.ok) dlg.current?.close()
  }, [state.ok])

  const send = (e: React.FormEvent<HTMLFormElement>) => {
    // ประกอบ FormData เอง เพราะรูปที่ส่งคือตัวที่บีบแล้ว ไม่ใช่ตัวใน <input>
    // สองช่องแยกกันตอนกรอก แต่ลงปลายทางเป็น case_document ชุดเดียว
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    ;[...imgs, ...pdfs].forEach((f) => fd.append('files', f))
    startTransition(() => submit(fd))
  }

  // รหัสพื้นที่เป็น prefix อยู่แล้ว (อำเภอ 4 → ตำบล 6 → หมู่บ้าน 8) ไม่ต้อง join หา parent
  // รหัส ICD10 ติดมากับโรคอยู่แล้ว ไม่ต้องให้คนกรอก
  const icd = useMemo(() => diseases.find((d) => d.code === dz)?.icd10?.join(', ') ?? '', [diseases, dz])

  const amps = useMemo(() => areas.filter((a) => a.level === 2), [areas])
  const tmbs = useMemo(() => areas.filter((a) => a.level === 3 && amp && a.code.startsWith(amp)), [areas, amp])
  const moos = useMemo(() => areas.filter((a) => a.level === 4 && tmb && a.code.startsWith(tmb)), [areas, tmb])

  return (
    <>
      {trigger === 'edit' ? (
        <button
          type="button"
          onClick={() => { setImgs([]); setPdfs([]); setOpen(true) }}
          title={`แก้ไขเคส ${caseNo ?? ''}`}
          aria-label={`แก้ไขเคส ${caseNo ?? ''}`}
          className="flex size-8 cursor-pointer items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-primary"
        >
          <Pencil size={16} strokeWidth={1.75} aria-hidden />
        </button>
      ) : trigger === 'plus' ? (
        <button
          type="button"
          onClick={() => { setImgs([]); setPdfs([]); setOpen(true) }}
          title="แจ้งเคสใหม่"
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm bg-primary px-3 text-sm font-medium text-bg transition-opacity duration-150 hover:opacity-85"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden />แจ้งเคส
        </button>
      ) : (
        <button
          type="button"
          onClick={() => { setImgs([]); setPdfs([]); setOpen(true) }}
          title="แจ้งเคสนี้เข้าระบบ"
          className="inline-flex cursor-pointer items-center gap-1 rounded-sm border border-line px-2 py-1 text-xs text-fg transition-colors duration-150 hover:border-primary hover:bg-primary hover:text-bg"
        >
          <Plus size={13} strokeWidth={2} aria-hidden />แจ้งเคส
        </button>
      )}

      {open && (
        <dialog
          ref={dlg}
          aria-labelledby="report-title"
          onClose={(e) => { if (e.target === dlg.current) { setOpen(false); setDz(initial?.disease_code ?? ''); setCid(maskCid(initial?.cid ?? '')); setVisit(initial?.date_visit ?? ''); setDx(initial?.date_dx ?? ''); setDxEdited(false); setAmp(initial?.area_code?.slice(0, 4) ?? ''); setTmb(initial?.area_code?.slice(0, 6) ?? '') } }}
          onClick={(e) => { if (e.target === dlg.current) dlg.current?.close() }}
          className={MODAL}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 sm:px-5 sm:py-4">
            <h2 id="report-title" className="text-base font-semibold">
              {caseId ? `แก้ไขเคส ${caseNo ?? ''}` : 'แบบแจ้งเคสเข้าระบบ'}
            </h2>
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
            {caseId && <input type="hidden" name="id" value={caseId} />}
            {/* ponytail: ช่องใหม่ (addr_road, exposure, lab_result, vaccine, kin_*, เพศ LGBTQ+,
                ประเภท "พบในชุมชน") เป็นแค่ layout — createCase ยังไม่อ่าน ต้องเพิ่มคอลัมน์ก่อน */}
            <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4 sm:px-5">
              <Sec>
                <F label="ประเภท" span={5}>
                  <Radios
                    name="patient_type"
                    defaultValue={initial?.patient_type}
                    options={[['OPD', 'OPD'], ['IPD', 'IPD'], ['COMMUNITY', 'พบในชุมชน']]}
                  />
                </F>
                <F label="การวินิจฉัย *" span={4}>
                  <select
                    name="disease_code" required value={dz}
                    onChange={(e) => setDz(e.target.value)} className={field}
                  >
                    <option value="" disabled>เลือกโรค</option>
                    {diseases.map((d) => <option key={d.code} value={d.code}>{d.name_th}</option>)}
                  </select>
                </F>
                <F label="ICD10" span={3}>
                  <input value={icd} readOnly placeholder="—" className={`${field} text-fg-muted`} />
                </F>
              </Sec>

              <Sec title="ข้อมูลผู้ป่วย">
                <F label="HN" span={3}>
                  <input name="hn" defaultValue={initial?.hn ?? ''} autoComplete="off" className={`${field} font-mono tracking-wide`} />
                </F>
                <F label="เลขบัตรประชาชน" span={4}>
                  {/* เก็บเป็นเลขล้วน — ขีดใส่ให้ตอนแสดง แล้วถอดออกฝั่ง server */}
                  <input
                    name="cid" inputMode="numeric" autoComplete="off"
                    value={cid} onChange={(e) => setCid(maskCid(e.target.value))}
                    placeholder="1-2345-67890-12-3"
                    className={`${field} font-mono tracking-wide`}
                  />
                </F>
                <div className="hidden sm:col-span-5 sm:block" />

                <F label="คำนำหน้า" span={2}><input name="pname" defaultValue={initial?.pname ?? ''} className={field} /></F>
                <F label="ชื่อ" span={3}><input name="fname" defaultValue={initial?.fname ?? ''} className={field} /></F>
                <F label="นามสกุล" span={3}><input name="lname" defaultValue={initial?.lname ?? ''} className={field} /></F>
                <F label="เพศ" span={4}>
                  <Radios
                    name="gender" defaultValue={initial?.gender}
                    options={[['M', 'ชาย'], ['F', 'หญิง'], ['O', 'LGBTQ+']]}
                  />
                </F>

                <F label="อายุ (ปี)" span={2}><input name="age_y" inputMode="numeric" defaultValue={initial?.age_y ?? ''} className={field} /></F>
                <F label="(เดือน)" span={2}><input name="age_m" inputMode="numeric" defaultValue={initial?.age_m ?? ''} className={field} /></F>
                <F label="โทรศัพท์" span={3}><TelInput name="tel" defaultValue={initial?.tel} className={field} /></F>
              </Sec>

              <Sec title="วันที่">
                <F label="วันเริ่มป่วย *" span={3}><ThaiDate name="date_onset" required defaultValue={initial?.date_onset} className={field} /></F>
                <F label="วันรับรักษา / วันพบ" span={3}>
                  <ThaiDate
                    name="date_visit" value={visit} className={field}
                    onChange={(v) => { setVisit(v); if (!dxEdited) setDx(v) }}
                  />
                </F>
                <F label="วันที่วินิจฉัย" span={3}>
                  <ThaiDate
                    name="date_dx" value={dx} className={field}
                    onChange={(v) => { setDx(v); setDxEdited(true) }}
                  />
                </F>
                <F label="เวลาวินิจฉัย" span={3}><TimeSelect name="time_dx" defaultValue={initial?.time_dx} className={field} /></F>
              </Sec>

              <Sec title="ที่อยู่ขณะป่วย">
                <F label="บ้านเลขที่ / สถานที่" span={6}><input name="addr_no" defaultValue={initial?.addr_no ?? ''} className={field} /></F>
                <F label="ถนน" span={6}><input name="addr_road" className={field} /></F>

                <F label="จังหวัด" span={3}>
                  <input value="พิษณุโลก" readOnly className={`${field} text-fg-muted`} />
                </F>
                <F label="อำเภอ" span={3}>
                  <select value={amp} onChange={(e) => { setAmp(e.target.value); setTmb('') }} className={field}>
                    <option value="">—</option>
                    {amps.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                  </select>
                </F>
                <F label="ตำบล" span={3}>
                  <select value={tmb} onChange={(e) => setTmb(e.target.value)} disabled={!amp} className={field}>
                    <option value="">—</option>
                    {tmbs.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                  </select>
                </F>
                <F label="หมู่ / หมู่บ้าน / ชุมชน" span={3}>
                  {/* ส่งแค่รหัส 8 หลักตัวเดียว หมู่ที่ถอดจากรหัสฝั่ง server */}
                  <select name="area_code" defaultValue={initial?.area_code ?? ''} disabled={!tmb} className={field}>
                    <option value="">—</option>
                    {moos.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                  </select>
                </F>
              </Sec>

              <Sec title="ประวัติและอาการ">
                <F label="ประวัติการสัมผัสโรคในระยะ 14 วันก่อนป่วย" span={12}>
                  <textarea name="exposure" rows={2} placeholder="เช่น อยู่ร่วมกับผู้ป่วย อยู่ในพื้นที่เสี่ยง" className={area} />
                </F>
                <F label="อาการสำคัญและอาการแสดง" span={6}>
                  <textarea name="symptom" rows={2} defaultValue={initial?.symptom ?? ''} className={area} />
                </F>
                <F label="ผลตรวจทางห้องปฏิบัติการ" span={6}>
                  <textarea name="lab_result" rows={2} className={area} />
                </F>
              </Sec>

              <Sec title="ประวัติรับวัคซีนไข้เลือดออก">
                <textarea
                  name="vaccine" rows={2}
                  placeholder="ชนิดวัคซีน · จำนวนครั้งที่ได้รับ · รับครั้งล่าสุดเมื่อ"
                  className={`${area} sm:col-span-12`}
                />
              </Sec>

              <Sec title="ผู้ติดต่อ / ญาติ">
                <F label="ชื่อญาติ" span={5}><input name="kin_name" className={field} /></F>
                <F label="เบอร์โทร" span={3}><TelInput name="kin_tel" className={field} /></F>
                <F label="เกี่ยวข้องเป็น" span={4}><input name="kin_relation" className={field} /></F>
              </Sec>

              <Sec title="ไฟล์แนบ">
                <div className="sm:col-span-6">
                  <FilePicker
                    label={`แนบรูป — ไม่เกิน ${MAX_IMAGES} รูป (บีบให้เหลือรูปละ ≤1 MB ให้อัตโนมัติ)`}
                    kind="image" files={imgs} onChange={setImgs}
                  />
                </div>
                <div className="sm:col-span-6">
                  <FilePicker label="แนบไฟล์ — PDF เท่านั้น" kind="pdf" files={pdfs} onChange={setPdfs} />
                </div>
              </Sec>

              <Sec title="ผู้รายงาน">
                <F label="ชื่อผู้รายงาน" span={5}><input name="reporter_name" defaultValue={initial?.reporter_name ?? reporter ?? ''} className={field} /></F>
                <F label="โทรศัพท์ผู้รายงาน" span={4}><TelInput name="reporter_tel" defaultValue={initial?.reporter_tel ?? tel} className={field} /></F>
              </Sec>
            </div>

            <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line px-4 py-3 sm:px-5">
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
                {pending ? 'กำลังบันทึก…' : caseId ? 'บันทึกการแก้ไข' : 'บันทึก'}
              </button>
            </footer>
          </form>
        </dialog>
      )}
    </>
  )
}
