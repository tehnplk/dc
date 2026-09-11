import { prisma } from './db'

type Me = { canManage: boolean; role: string; amp: string | null; org_code: string }

/**
 * หมู่บ้านที่ผู้ใช้คนนี้ยุ่งได้
 *   สสจ./บัญชีสำรอง = ทั้งจังหวัด · สสอ. = ทั้งอำเภอตัวเอง · หน่วยบริการ = เฉพาะเขตรับผิดชอบใน hos_village
 * คืน null = ไม่จำกัด
 */
export async function areaScope(me: Me): Promise<string[] | null> {
  if (me.canManage) return null
  if (me.role === 'district') return me.amp ? [me.amp] : []
  const rows = await prisma.hos_village.findMany({
    where: { org_code: me.org_code },
    select: { area_code: true },
  })
  return rows.map((r) => r.area_code)
}

/** แปลงขอบเขตเป็นเงื่อนไขของ prisma (สสอ. เก็บเป็น prefix อำเภอ จึงใช้ startsWith) */
export function areaWhere(scope: string[] | null) {
  if (scope === null) return {}
  if (scope.length === 0) return { code: { in: [] as string[] } }
  return scope[0].length === 4
    ? { code: { startsWith: scope[0] } }
    : { code: { in: scope } }
}

export function inScope(scope: string[] | null, code: string) {
  if (scope === null) return true
  return scope.some((s) => code.startsWith(s))
}
