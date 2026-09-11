import { fmtDate as d } from '@/lib/datetime'
import { ActivityModal } from './ActivityModal'
import { AcceptButton } from './AcceptButton'
import { Pagination } from './Pagination'
import { ReleaseButton } from './ReleaseButton'
// ชนิดของแถวในวิว: prisma ตั้งชื่อว่า <model>Model ไม่ใช่ชื่อวิวเปล่า ๆ
import type { v_case_listModel as v_case_list } from '@/generated/prisma/models/v_case_list'
import { PAGE_SIZE } from '@/lib/ui'

const th = 'px-3 py-2 text-left font-medium whitespace-nowrap'   // ขนาดมาจาก [data-grid] th ใน globals.css
const td = 'px-3 py-2 align-top whitespace-nowrap'
const num = `${td} font-mono tabular-nums`

// วัน-เวลา: วันที่บรรทัดบน เวลาบรรทัดล่างตัวเล็กกว่า
function DateTime({ date, time }: { date: Date | null; time: string | null }) {
  if (!date) return <>—</>
  return (
    <>
      {/* วันที่ใช้ sans: mono ทำให้จุดของ "ก.ย." กินเต็มช่อง 1 ตัวอักษร ดูเหมือนเว้น 2 ที่ */}
      <div className="font-sans tabular-nums">{d(date)}</div>
      {time && <div className="sub text-fg-muted">{time}</div>}
    </>
  )
}

// from = คอลัมน์ "จาก" ทะเบียนแจ้งไม่ต้องมี เพราะเป็นหน่วยงานตัวเองทุกแถวอยู่แล้ว
// canAdd = หน้านั้นให้บันทึกกิจกรรมได้ (ทะเบียนรับ) ไม่ส่ง = ดูได้อย่างเดียว
export function CaseTable({ cases, empty, from = true, unit = true, addr, canAdd, canEdit, addAmp,
                            canAccept = true, canRelease, performer = null, page, total }:
  { cases: v_case_list[]; empty: string; from?: boolean; unit?: boolean; addr?: boolean
    canAdd?: boolean
    /** แก้/ลบกิจกรรมได้ (ทะเบียนรับของหน่วยบริการ — เคสในนี้คือเคสที่ตัวเองรับไว้) */
    canEdit?: boolean
    /** จำกัดปุ่มเพิ่มกิจกรรมไว้เฉพาะเคสที่รหัสพื้นที่ขึ้นต้นด้วยค่านี้ (ใช้กับ role district) */
    addAmp?: string | null
    canAccept?: boolean; canRelease?: boolean; performer?: string | null
    page?: number; total?: number }) {
  return (
    <>
    {/* ตารางกว้าง ต้องเลื่อนในกล่องตัวเอง ไม่ใช่ดันทั้งหน้าให้เลื่อนแนวนอน */}
    <div className="overflow-x-auto rounded-sm border border-line bg-surface">
      <table data-grid className="w-full border-collapse">
        {/* หัวตารางใช้สีแบรนด์ทึบ ให้ตัดกับแถบสลับสีที่เป็น surface-2 จาง ๆ */}
        <thead className="bg-brand text-on-brand">
          <tr className="border-b border-line">
            <th className={`${th} text-right`}>ลำดับ</th>
            {from && <th className={th}>จาก</th>}
            <th className={th}>พบ</th>
            <th className={th}>แจ้ง</th>
            <th className={th}>ชื่อ-สกุล</th>
            <th className={th}>อำเภอ</th>
            <th className={th}>ตำบล</th>
            <th className={`${th} text-right`}>หมู่ที่</th>
            {addr && <th className={th}>บ้านเลขที่</th>}
            <th className={th}>วินิจฉัย</th>
            <th className={th}>รับ</th>
            {unit && <th className={th}>หน่วยรับ</th>}
            <th className={`${th} text-center`}>กิจกรรม</th>
            {canRelease && <th className={`${th} text-center`}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {cases.length === 0 && (
            <tr>
              <td colSpan={10 + (from ? 1 : 0) + (unit ? 1 : 0) + (addr ? 1 : 0) + (canRelease ? 1 : 0)} className="px-3 py-10 text-center text-fg-muted">{empty}</td>
            </tr>
          )}
          {/* แถบสลับสี: อ่านข้ามคอลัมน์ไม่หลุดบรรทัด — hover ใช้คนละสีจะได้ไม่จมไปกับแถบ */}
          {cases.map((c) => (
            <tr key={String(c.id)}
                className="border-b border-line transition-colors duration-150 last:border-0 odd:bg-surface-2/50 hover:bg-primary-soft">
              <td className={`${num} text-right text-fg-muted`}>{String(c.id)}</td>
              {from && <td className={td}>{c.report_org_name ?? c.report_org_code}</td>}
              <td className={num}><DateTime date={c.date_dx} time={c.time_dx_txt} /></td>
              <td className={num}><DateTime date={c.date_report} time={c.time_report_txt} /></td>
              <td className={td}>
                <div className="font-medium">{c.patient_name ?? '—'}</div>
                {c.patient_sub && <div className="sub text-fg-muted">{c.patient_sub}</div>}
              </td>
              <td className={td}>{c.amp_name ?? '—'}</td>
              <td className={td}>{c.tmb_name ?? '—'}</td>
              <td className={`${num} text-right`}>{c.moo ?? '—'}</td>
              {addr && <td className={num}>{c.addr_no ?? '—'}</td>}
              <td className={td}>
                <span className="rounded-sm bg-primary-soft px-1.5 py-0.5 sub font-medium text-primary">
                  {c.disease_name}
                </span>
              </td>
              <td className={num}>
                {c.date_accept
                  ? <DateTime date={c.date_accept} time={c.time_accept_txt} />
                  : canAccept
                  ? <AcceptButton
                      caseId={String(c.id)}
                      caseNo={c.case_no}
                      patient={c.patient_name}
                      sub={c.patient_sub}
                      disease={c.disease_name}
                      addr={[c.addr_no, c.moo && `หมู่ ${c.moo}`, c.tmb_name && `ต.${c.tmb_name}`,
                             c.amp_name && `อ.${c.amp_name}`].filter(Boolean).join(' ')}
                    />
                  : <span className="rounded-sm bg-warn-soft px-1.5 py-0.5 font-sans sub font-medium text-warn">
                      รอรับเคส
                    </span>}
              </td>
              {unit && (
                <td className={td}>
                  <div>{c.accepted_org_name ?? '—'}</div>
                  {c.accepted_by_name && (
                    <div className="sub text-fg-muted">{c.accepted_by_name}</div>
                  )}
                </td>
              )}
              <td className={`${td} text-center`}>
                {/* กิจกรรมควบคุมโรคเริ่มได้หลังมีหน่วยรับเคส เคสที่ยังไม่ถูกรับจึงไม่ต้องมีปุ่ม */}
                {c.date_accept && (
                  <div className="flex justify-center">
                    <ActivityModal
                      caseId={String(c.id)}
                      caseNo={c.case_no}
                      patient={c.patient_name}
                      canAdd={canAdd && (!addAmp || (c.area_code ?? '').startsWith(addAmp))}
                      canEdit={canEdit}
                      performer={performer}
                    />
                  </div>
                )}
              </td>
              {canRelease && (
                <td className={`${td} text-center`}>
                  {/* คืนได้เฉพาะเคสที่ยังถืออยู่ */}
                  {c.date_accept && (
                    <div className="flex justify-center">
                      <ReleaseButton caseId={String(c.id)} caseNo={c.case_no} patient={c.patient_name} />
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {total !== undefined && <Pagination page={page ?? 1} pageSize={PAGE_SIZE} total={total} />}
    </>
  )
}
