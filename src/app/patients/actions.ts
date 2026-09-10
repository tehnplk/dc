'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'

export type CaseFile = { id: string; name: string | null; path: string }

export type Activity = {
  seq: number
  date: string | null
  time: string | null
  name: string | null
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

export async function getCaseActivities(caseId: string): Promise<Activity[]> {
  // ค่ามาจากฝั่ง client ต้องกันไว้ก่อน BigInt() จะโยน error ถ้าไม่ใช่ตัวเลขล้วน
  if (!/^\d{1,18}$/.test(caseId)) return []

  const rows = await prisma.v_case_activity.findMany({
    where: { case_id: BigInt(caseId) },
    orderBy: { seq: 'asc' },
  })

  return rows.map((r) => ({
    seq: r.seq ?? 0,
    date: r.date_act ? r.date_act.toISOString() : null,
    time: r.time_act_txt,
    name: r.activity_name,
    docs: files(r.documents),
    photos: files(r.photos),
    performer: r.performer,
  }))
}

export type AcceptState = { error?: string; ok?: string }

/** กดรับเคส — กติกาพื้นที่/กันรับซ้ำ บังคับที่ DB (trigger + partial unique index) ไม่ใช่ที่นี่ */
export async function acceptCase(_prev: AcceptState, fd: FormData): Promise<AcceptState> {
  const caseId = fd.get('caseId')
  if (typeof caseId !== 'string' || !/^\d{1,18}$/.test(caseId)) return { error: 'เคสไม่ถูกต้อง' }

  const me = await currentUser()
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
    if (String(e).includes('ไม่อยู่ในพื้นที่รับผิดชอบ')) {
      return { error: `เคสนี้ไม่อยู่ในพื้นที่รับผิดชอบของ ${me.org.name}` }
    }
    console.error('acceptCase', e)
    return { error: 'รับเคสไม่สำเร็จ ลองใหม่อีกครั้ง' }
  }

  revalidatePath('/patients')
  revalidatePath('/report')
  return { ok: 'รับเคสแล้ว' }
}
