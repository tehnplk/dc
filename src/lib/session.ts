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

  // บัญชีสำรองจาก .env ไม่มีสิทธิ์พิเศษของตัวเอง — แถวใน users ตั้ง role = province ไว้
  // ทุกอย่างหลังล็อกอินจึงตัดสินจากบทบาทอย่างเดียว ไม่ต้องรู้ว่าเข้ามาทางไหน
  return {
    ...u,
    org: u.c_org,                                   // ชื่อสั้นกว่า ใช้ทั่วแอปเป็น me.org.name
    // อำเภอของหน่วยงานที่สังกัด ใช้จำกัดขอบเขตของ role district
    amp: u.c_org.area_code?.slice(0, 4) ?? null,
  }
}
