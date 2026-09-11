'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'

export type CaseFile = { id: string; name: string | null; path: string }

export type Activity = {
  /** id ของแถวใน case_activity — null = ลำดับ 1/2 ที่ view สร้างเอง แก้/ลบไม่ได้ */
  id: string | null
  seq: number
  date: string | null
  time: string | null
  name: string | null
  note: string | null
  docs: CaseFile[]      // pdf เท่านั้น (DB มี CHECK บังคับไว้)
  photos: CaseFile[]
  performer: string | null
}

/** jsonb จาก v_case_activity เป็น any ฝั่ง type ต้องกรองรูปทรงเองก่อนส่งออกไป client */
function files(v: unknown): CaseFile[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((f) => {
    const path = (f as { path?: unknown })?.path
    if (typeof path !== 'string' || !path.startsWith('/uploads/')) return []
    const { id, name } = f as { id?: unknown; name?: unknown }
    return [{ id: String(id ?? path), name: typeof name === 'string' ? name : null, path }]
  })
}

/** หัวข้อย่อยของโมดัล — ข้อมูลผู้ป่วยที่ต้องเห็นตอนอ่านไทม์ไลน์ */
export type CaseHead = {
  name: string | null
  gender: string | null
  age: string | null
  onset: string | null
  visit: string | null
  disease: string | null
  ptype: string | null
}

export async function getCase(caseId: string): Promise<{ head: CaseHead | null; rows: Activity[] }> {
  // ค่ามาจากฝั่ง client ต้องกันไว้ก่อน BigInt() จะโยน error ถ้าไม่ใช่ตัวเลขล้วน
  if (!/^\d{1,18}$/.test(caseId)) return { head: null, rows: [] }
  const id = BigInt(caseId)

  const [c, rows] = await Promise.all([
    prisma.case_report.findUnique({
      where: { id },
      select: {
        pname: true, fname: true, lname: true, gender: true, age_y: true, age_m: true,
        date_onset: true, date_visit: true, patient_type: true,
        disease: { select: { name_th: true } },
      },
    }),
    prisma.v_case_activity.findMany({ where: { case_id: id }, orderBy: { seq: 'asc' } }),
  ])

  const head: CaseHead | null = c && {
    name: [c.pname, c.fname, c.lname].filter(Boolean).join(' ') || null,
    gender: c.gender === 'M' ? 'ชาย' : c.gender === 'F' ? 'หญิง' : null,
    age: [c.age_y != null && `${c.age_y} ปี`, c.age_m != null && `${c.age_m} ด.`]
      .filter(Boolean).join(' ') || null,
    onset: c.date_onset?.toISOString() ?? null,
    visit: c.date_visit?.toISOString() ?? null,
    disease: c.disease?.name_th ?? null,
    ptype: c.patient_type,
  }

  return { head, rows: rows.map((r) => ({
    id: r.activity_id === null ? null : String(r.activity_id),
    seq: r.seq ?? 0,
    date: r.date_act ? r.date_act.toISOString() : null,
    time: r.time_act_txt,
    name: r.activity_name,
    note: r.note,
    docs: files(r.documents),
    photos: files(r.photos),
    performer: r.performer,
  })) }
}

export type AcceptState = { error?: string; ok?: string }

/** กดรับเคส — กติกาพื้นที่/กันรับซ้ำ บังคับที่ DB (trigger + partial unique index) ไม่ใช่ที่นี่ */
export async function acceptCase(_prev: AcceptState, fd: FormData): Promise<AcceptState> {
  const caseId = fd.get('caseId')
  if (typeof caseId !== 'string' || !/^\d{1,18}$/.test(caseId)) return { error: 'เคสไม่ถูกต้อง' }

  const me = await currentUser()
  if (me.readonly) return { error: 'บัญชีผู้ดูแลระบบดูข้อมูลผู้ป่วยได้อย่างเดียว' }
  if (!me.canCase) return { error: 'บทบาทของคุณรับเคสไม่ได้' }
  try {
    // วัน/เวลารับ ปล่อยให้ DEFAULT ของ DB ลง (เวลาไทย) ไม่ใช่นาฬิกาของ node
    await prisma.case_acceptance.create({
      data: { case_id: BigInt(caseId), org_code: me.org_code, accepted_by: me.id },
      select: { id: true },
    })
  } catch (e) {
    const code = (e as { code?: string }).code
    // P2010/P2002 = ชนกติกาที่ DB ไม่ใช่บั๊ก บอกเป็นภาษาคนไป ที่เหลือกลืนไว้
    if (code === 'P2002') return { error: 'เคสนี้มีหน่วยอื่นกดรับไปแล้ว' }
    if (String(e).includes('รับเคสไม่ได้')) return { error: 'บทบาทของคุณรับเคสไม่ได้' }
    console.error('acceptCase', e)
    return { error: 'รับเคสไม่สำเร็จ ลองใหม่อีกครั้ง' }
  }

  revalidatePath('/patients')
  revalidatePath('/report')
  return { ok: 'รับเคสแล้ว' }
}
