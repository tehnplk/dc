'use client'

import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, RefreshCw, Search } from 'lucide-react'
import { AGENT_URL, fetchHisPatients, type HisPatient } from '@/lib/his'
import { ReportCaseModal, type AreaOpt, type Disease, type Prefill } from './ReportCaseModal'

const th = 'px-3 py-2 text-left font-medium whitespace-nowrap'
const td = 'px-3 py-2 align-top whitespace-nowrap'

type State =
  | { s: 'loading' }
  | { s: 'rows'; rows: HisPatient[] }
  | { s: 'error'; reason: 'offline' | 'cors' | 'bad' }

const MSG = {
  offline: 'กรุณาเปิดโปรแกรม SRRT Agent ที่เครื่องคอมพิวเตอร์เครื่องนี้',
  cors: `เปิดโปรแกรมอยู่ แต่ ${AGENT_URL} ไม่อนุญาตให้เว็บอ่านข้อมูล (ต้องส่ง header Access-Control-Allow-Origin)`,
  bad: 'โปรแกรมตอบกลับมาในรูปแบบที่อ่านไม่ได้',
}

type Props = { areas: AreaOpt[]; diseases: Disease[]; reporter: string | null; tel: string | null; canReport?: boolean }

/** HIS ส่ง ICD10 มา ระบบเราคีย์ด้วยรหัสโรครายงาน จับคู่ผ่าน c_disease.icd10 */
function toPrefill(p: HisPatient, diseases: Disease[]): Prefill {
  const d = p.diag_code && diseases.find((x) => x.icd10?.includes(p.diag_code!))
  return {
    cid: p.cid, pname: p.pname, fname: p.fname, lname: p.lname,
    gender: p.gender === 'M' || p.gender === 'F' ? p.gender : undefined,
    age_y: p.age_y,
    date_onset: p.date_onset, date_visit: p.date_visit,
    patient_type: p.patient_type === 'OPD' || p.patient_type === 'IPD' ? p.patient_type : undefined,
    disease_code: d ? d.code : undefined,
  }
}

export function HisPatients({ areas, diseases, reporter, tel, canReport = true }: Props) {
  const [state, setState] = useState<State>({ s: 'loading' })
  // รายการนี้อยู่ในหน่วยความจำอยู่แล้ว (ดึงมาทั้งก้อนจาก agent) กรองสดในเครื่องได้เลย
  const [q, setQ] = useState('')

  // ต้องยิงจากเบราว์เซอร์ ไม่ใช่ฝั่งเซิร์ฟเวอร์: HIS อยู่ในวงแลนของ รพ. เซิร์ฟเวอร์เข้าไม่ถึง
  const load = useCallback(async () => {
    setState({ s: 'loading' })
    const r = await fetchHisPatients()
    setState(r.ok ? { s: 'rows', rows: r.rows } : { s: 'error', reason: r.reason })
  }, [])

  useEffect(() => { load() }, [load])

  if (state.s === 'loading') {
    return <p className="rounded-sm border border-line bg-surface px-4 py-10 text-center text-xs text-fg-muted">
      กำลังเชื่อมต่อ SRRT Agent…
    </p>
  }

  if (state.s === 'error') {
    return (
      <div className="rounded-sm border border-line bg-surface px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-warn-soft text-warn">
          <CircleAlert size={30} strokeWidth={1.5} aria-hidden />
        </div>
        <p className="text-sm font-medium">{MSG[state.reason]}</p>
        <p className="mt-1 font-mono text-xs text-fg-muted">{AGENT_URL}/patients</p>
        <button
          type="button"
          onClick={load}
          className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-bg transition-opacity duration-150 hover:opacity-85"
        >
          <RefreshCw size={14} strokeWidth={2} aria-hidden />ลองใหม่
        </button>
      </div>
    )
  }

  const key = q.trim().toLowerCase()
  const rows = key
    ? state.rows.filter((p) => [p.pname, p.fname, p.lname].filter(Boolean).join(' ').toLowerCase().includes(key))
    : state.rows

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
        <span>{rows.length} รายจาก HIS{key && ` (จาก ${state.rows.length})`}</span>
        <div className="relative">
          <Search size={14} strokeWidth={1.75} aria-hidden
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อผู้ป่วย"
            aria-label="ค้นหาชื่อผู้ป่วย"
            className="w-56 rounded-sm border border-line bg-surface py-1.5 pr-2 pl-8 text-sm text-fg transition-colors duration-150 hover:border-primary focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={load}
          className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-line px-2 py-1 transition-colors duration-150 hover:border-primary hover:text-primary"
        >
          <RefreshCw size={12} strokeWidth={1.75} aria-hidden />รีเฟรช
        </button>
      </div>

      <div className="overflow-x-auto rounded-sm border border-line bg-surface">
        <table data-grid className="w-full border-collapse">
          <thead className="bg-brand text-on-brand">
            <tr className="border-b border-line">
              <th className={th}>HN</th>
              <th className={th}>เลขบัตร</th>
              <th className={th}>ชื่อ-สกุล</th>
              <th className={th}>เพศ</th>
              <th className={`${th} text-right`}>อายุ</th>
              <th className={th}>วันเริ่มป่วย</th>
              <th className={th}>วันรับรักษา</th>
              <th className={th}>วินิจฉัย</th>
              <th className={th}>ประเภท</th>
              <th className={`${th} text-center`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-fg-muted">
                  ไม่มีผู้ป่วยเข้าเกณฑ์รายงานใน HIS
                </td>
              </tr>
            )}
            {rows.map((p, i) => (
              <tr key={p.hn ?? i}
                  className="border-b border-line transition-colors duration-150 last:border-0 odd:bg-surface-2/50 hover:bg-primary-soft">
                <td className={`${td} font-mono`}>{p.hn ?? '—'}</td>
                <td className={`${td} font-mono`}>{p.cid ?? '—'}</td>
                <td className={td}>{[p.pname, p.fname, p.lname].filter(Boolean).join(' ') || '—'}</td>
                <td className={td}>{p.gender === 'M' ? 'ชาย' : p.gender === 'F' ? 'หญิง' : '—'}</td>
                <td className={`${td} text-right font-mono tabular-nums`}>{p.age_y ?? '—'}</td>
                <td className={`${td} font-mono tabular-nums`}>{p.date_onset ?? '—'}</td>
                <td className={`${td} font-mono tabular-nums`}>{p.date_visit ?? '—'}</td>
                <td className={td}>{p.diag_name ?? p.diag_code ?? '—'}</td>
                <td className={td}>{p.patient_type ?? '—'}</td>
                <td className={`${td} text-center`}>
                  {canReport && <ReportCaseModal
                    areas={areas} diseases={diseases} reporter={reporter} tel={tel}
                    initial={toPrefill(p, diseases)} trigger="row"
                  />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
