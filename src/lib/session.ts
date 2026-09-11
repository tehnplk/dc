import { redirect } from 'next/navigation'
import { prisma } from './db'
import { readSession } from './auth'

const SELECT = {
  id: true, username: true, full_name: true, position: true, tel: true, org_code: true, role: true,
  c_org: { select: { name: true, area_code: true } },
} as const

/** ผู้ใช้ที่ล็อกอินอยู่ — ไม่มีเซสชันให้เด้งไปหน้าเข้าสู่ระบบ (middleware กันอีกชั้นแล้ว) */
export async function currentUser() {
  const id = await readSession()
  if (id === null) redirect('/auth/signin')

  const u = await prisma.users.findFirst({
    where: { id, is_active: true, deleted_at: null },
    select: SELECT,
  })
  // ผู้ใช้ถูกลบ/ปิดใช้งานหลังออกคุกกี้ไปแล้ว ต้องหลุดทันที ไม่ใช่รอคุกกี้หมดอายุ
  if (!u) redirect('/auth/logout')

  // บัญชีสำรองจาก .env = ผู้ดูแลระบบ ไม่ใช่เจ้าหน้าที่ระบาด
  // ดูข้อมูลผู้ป่วยได้อย่างเดียว แต่จัดการระบบได้เต็มที่
  const su = Boolean(process.env.SUPER_USER) && u.username === process.env.SUPER_USER
  return {
    ...u,
    org: u.c_org,                                   // ชื่อสั้นกว่า ใช้ทั่วแอปเป็น me.org.name
    super: su,
    readonly: su,                                   // บัญชีสำรองดูข้อมูลผู้ป่วยได้อย่างเดียว
    // อำเภอของหน่วยงานที่สังกัด ใช้จำกัดขอบเขตของ role district
    amp: u.c_org.area_code?.slice(0, 4) ?? null,
    canManage: su || u.role === 'province',         // จัดการผู้ใช้/หน่วยงาน/หมู่บ้าน
    // แจ้งเคส/รับเคสเป็นงานของ สสจ. กับหน่วยบริการ — สสอ. มีหน้าที่บันทึกกิจกรรมอย่างเดียว
    canCase: !su && (u.role === 'province' || u.role === 'hospital'),
  }
}
