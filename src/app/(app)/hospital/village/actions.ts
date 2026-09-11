'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import type { AdminState } from '@/app/(app)/admin/actions'

/** เฉพาะหน่วยบริการ — สสจ. จัดการพื้นที่รับผิดชอบจาก /admin */
async function hospital() {
  const me = await currentUser()
  if (me.role !== 'hospital') throw new Error('forbidden')
  return me
}

const done = () => {
  revalidatePath('/hospital/village')
  return { ok: String(Date.now()) }
}

/**
 * รับผิดชอบหมู่บ้านเพิ่ม (ติ๊กได้หลายหมู่บ้าน) — เลือกจากหมู่บ้านที่มีในระบบเท่านั้น ไม่ได้สร้างใหม่
 * 1 หมู่บ้าน = 1 หน่วยบริการ (hos_village.area_code เป็น PK) จึงแย่งของหน่วยอื่นไม่ได้
 */
export async function claimVillage(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await hospital()
  const codes = fd.getAll('area_code').map(String).filter(Boolean)
  if (codes.length === 0) return { error: 'เลือกหมู่บ้านอย่างน้อย 1 แห่ง' }

  const areas = await prisma.c_area.findMany({
    where: { code: { in: codes }, level: 4, deleted_at: null },
    select: { code: true, name: true, hos_village: { select: { c_org: { select: { code: true, name: true } } } } },
  })
  if (areas.length !== codes.length) return { error: 'ไม่พบหมู่บ้านบางรายการในระบบ เลือกจากรายการเท่านั้น' }

  // มีเจ้าของแล้วแม้แถวเดียวก็ไม่บันทึกทั้งชุด ผู้ใช้จะได้รู้ว่าต้องเอาอันไหนออก
  const taken = areas.find((a) => a.hos_village)
  if (taken) {
    const o = taken.hos_village!.c_org
    return { error: `${taken.name} มีหน่วยบริการรับผิดชอบอยู่แล้ว ${o.code}-${o.name}` }
  }

  await prisma.hos_village.createMany({ data: codes.map((code) => ({ area_code: code, org_code: me.org_code })) })
  return done()
}

/** ยกเลิกความรับผิดชอบ — ลบแค่การจับคู่ ตัวหมู่บ้านยังอยู่ในระบบ */
export async function releaseVillage(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await hospital()
  const code = String(fd.get('code'))

  const cases = await prisma.case_report.count({ where: { area_code: code, deleted_at: null } })
  if (cases > 0) return { error: `ยังมีเคส ${cases} รายในหมู่บ้านนี้ ยกเลิกความรับผิดชอบไม่ได้` }

  // ต้องเป็นของตัวเองเท่านั้น จะปลดของหน่วยอื่นผ่าน request ตรง ๆ ไม่ได้
  const { count } = await prisma.hos_village.deleteMany({ where: { area_code: code, org_code: me.org_code } })
  if (count === 0) return { error: 'หมู่บ้านนี้ไม่ได้อยู่ในความรับผิดชอบของหน่วยงาน' }
  return done()
}
