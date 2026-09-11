// SRRT Agent = โปรแกรมเล็ก ๆ ที่รันบนเครื่องผู้ใช้ใน รพ. ต่อกับ HIS แล้วเปิดพอร์ตไว้ให้เว็บเรียก
// ทำแบบนี้เพราะ HIS อยู่ในวงแลนของโรงพยาบาล เซิร์ฟเวอร์เว็บเข้าไม่ถึง
export const AGENT_URL = 'http://localhost:5050'

/** แถวผู้ป่วยที่ agent ต้องส่งกลับมา — สัญญาเริ่มต้นระหว่างเว็บกับ agent */
export type HisPatient = {
  hn?: string
  cid?: string
  pname?: string
  fname?: string
  lname?: string
  gender?: string          // M / F
  age_y?: number
  date_onset?: string      // yyyy-mm-dd
  date_visit?: string
  diag_code?: string       // ICD10 หรือรหัสโรครายงาน
  diag_name?: string
  patient_type?: string    // OPD / IPD
}

/** เช็คว่า agent เปิดอยู่ไหม — no-cors อ่าน body ไม่ได้ แต่บอกได้ว่าต่อติด */
export async function pingAgent(): Promise<boolean> {
  try {
    await fetch(AGENT_URL, { mode: 'no-cors', signal: AbortSignal.timeout(3000) })
    return true
  } catch {
    return false
  }
}

/**
 * ดึงรายชื่อผู้ป่วยจาก HIS ผ่าน agent
 * ต้องเป็น fetch ปกติ (ไม่ใช่ no-cors) เพราะต้องอ่าน body — agent จึงต้องส่ง
 * Access-Control-Allow-Origin มาด้วย ต่อไม่ติดกับอ่านไม่ได้จึงแยกสาเหตุกันที่นี่
 */
export async function fetchHisPatients(): Promise<
  { ok: true; rows: HisPatient[] } | { ok: false; reason: 'offline' | 'cors' | 'bad' }
> {
  let res: Response
  try {
    res = await fetch(`${AGENT_URL}/patients`, { signal: AbortSignal.timeout(8000) })
  } catch {
    // แยกให้ออกว่า "ไม่ได้เปิดโปรแกรม" กับ "เปิดแล้วแต่ไม่ยอมให้เว็บอ่าน"
    return { ok: false, reason: (await pingAgent()) ? 'cors' : 'offline' }
  }
  if (!res.ok) return { ok: false, reason: 'bad' }
  try {
    const body = await res.json()
    const rows = Array.isArray(body) ? body : Array.isArray(body?.rows) ? body.rows : null
    return rows ? { ok: true, rows } : { ok: false, reason: 'bad' }
  } catch {
    return { ok: false, reason: 'bad' }
  }
}
