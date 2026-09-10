import { fmtDate as d } from '@/lib/datetime'
import { ActivityModal } from './ActivityModal'
import { AcceptButton } from './AcceptButton'
import { ReleaseButton } from './ReleaseButton'
import type { v_case_list } from '@/generated/prisma/models'

const th = 'px-3 py-2 text-left text-sm font-medium whitespace-nowrap'  // ใหญ่กว่าเซลล์ 2px
const td = 'px-3 py-2 align-top whitespace-nowrap'
const num = `${td} font-mono tabular-nums`

// วัน-เวลา: วันที่บรรทัดบน เวลาบรรทัดล่างตัวเล็กกว่า
function DateTime({ date, time }: { date: Date | null; time: string | null }) {
  if (!date) return <>—</>
  return (
    <>
      {/* วันที่ใช้ sans: mono ทำให้จุดของ "ก.ย." กินเต็มช่อง 1 ตัวอักษร ดูเหมือนเว้น 2 ที่ */}
      <div className="font-sans tabular-nums">{d(date)}</div>
      {time && <div className="text-[11px] text-fg-muted">{time}</div>}
    </>
  )
}

// from = คอลัมน์ "จาก" ทะเบียนแจ้งไม่ต้องมี เพราะเป็นหน่วยงานตัวเองทุกแถวอยู่แล้ว
// canAdd = หน้านั้นให้บันทึกกิจกรรมได้ (ทะเบียนรับ) ไม่ส่ง = ดูได้อย่างเดียว
export function CaseTable({ cases, empty, from = true, unit = true, addr, canAdd, canAccept = true, canRelease, performer = null }:
  { cases: v_case_list[]; empty: string; from?: boolean; unit?: boolean; addr?: boolean; canAdd?: boolean; canAccept?: boolean; canRelease?: boolean; performer?: string | null }) {
  return (
    // ตารางกว้าง ต้องเลื่อนในกล่องตัวเอง ไม่ใช่ดันทั้งหน้าให้เลื่อนแนวนอน
    <div className="overflow-x-auto rounded-sm border border-line bg-surface">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-surface-2 text-fg-muted">
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
              <td colSpan={10 + (from ? 1 : 0) + (unit ? 1 : 0) + (addr ? 1 : 0) + (canRelease ? 1 : 0)} className="px-3 py-10 text-center text-xs text-fg-muted">{empty}</td>
            </tr>
          )}
          {cases.map((c) => (
            <tr key={String(c.id)}
                className="border-b border-line transition-colors duration-150 last:border-0 hover:bg-surface-2">
              <td className={`${num} text-right text-fg-muted`}>{String(c.id)}</td>
              {from && <td className={td}>{c.report_org_name ?? c.report_org_code}</td>}
              <td className={num}><DateTime date={c.date_dx} time={c.time_dx_txt} /></td>
              <td className={num}><DateTime date={c.date_report} time={c.time_report_txt} /></td>
              <td className={td}>
                <div className="font-medium">{c.patient_name ?? '—'}</div>
                {c.patient_sub && <div className="text-[11px] text-fg-muted">{c.patient_sub}</div>}
              </td>
              <td className={td}>{c.amp_name ?? '—'}</td>
              <td className={td}>{c.tmb_name ?? '—'}</td>
              <td className={`${num} text-right`}>{c.moo ?? '—'}</td>
              {addr && <td className={num}>{c.addr_no ?? '—'}</td>}
              <td className={td}>
                <span className="rounded-sm bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary">
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
                      place={[c.tmb_name, c.amp_name].filter(Boolean).join(' · ') || null}
                    />
                  : <span className="rounded-sm bg-warn-soft px-1.5 py-0.5 font-sans text-[11px] font-medium text-warn">
                      รอรับเคส
                    </span>}
              </td>
              {unit && (
                <td className={td}>
                  <div>{c.accepted_org_name ?? '—'}</div>
                  {c.accepted_by_name && (
                    <div className="text-[11px] text-fg-muted">{c.accepted_by_name}</div>
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
                      canAdd={canAdd}
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
  )
}
