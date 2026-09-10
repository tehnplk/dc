import { prisma } from './db'

// ยังไม่มีระบบ login — ตรึงผู้ใช้ไว้คนเดียวก่อน
// พอทำ auth เสร็จให้แก้ที่นี่ที่เดียว โค้ดที่เรียกใช้ไม่ต้องแตะ
const DEV_USERNAME = 'hos01'

export async function currentUser() {
  const u = await prisma.app_user.findUnique({
    where: { username: DEV_USERNAME },
    select: { id: true, full_name: true, position: true, tel: true, org_code: true, role: true,
              org: { select: { name: true } } },
  })
  if (!u) throw new Error(`ไม่พบผู้ใช้ ${DEV_USERNAME} — รัน npm run db:seed ก่อน`)
  return u
}
