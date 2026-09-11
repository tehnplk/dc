import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { prisma } from './db'

/**
 * บัญชีผู้ดูแลสำรอง — ล็อกอินที่ /auth/admin ด้วยค่าใน .env ไม่ผ่าน SSO
 * มีไว้กู้ระบบ: SSO ล่ม, ยังไม่มีใครเป็น admin, หรือ admin คนเดียวหลุดออกจากระบบ
 * ไม่ตั้ง SUPER_USER/SUPER_USER_PASSWORD = ปิดทางเข้านี้ทั้งทาง
 */
export function superUserEnabled() {
  return Boolean(process.env.SUPER_USER && process.env.SUPER_USER_PASSWORD)
}

/** scrypt ของ node เอง ไม่ต้องลง bcrypt/argon เพิ่มเพื่อผู้ใช้คนเดียว */
function hash(password: string, salt = randomBytes(16).toString('hex')) {
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString('hex')}`
}

const eq = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  // เทียบแบบเวลาคงที่เสมอ ความยาวต่างกันก็ยังไม่บอกใบ้ผ่านเวลาที่ใช้
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * ตรวจรหัสกับค่าใน .env แล้วคืน id ของแถวใน user (สร้างให้ถ้ายังไม่มี)
 * ต้องมีแถวจริง เพราะทุกอย่างในระบบอ้างผู้ใช้ด้วย user.id (ผู้แจ้ง/ผู้รับเคส/ผู้บันทึก)
 */
export async function verifySuperUser(username: string, password: string): Promise<bigint | null> {
  if (!superUserEnabled()) return null
  const okUser = eq(username, process.env.SUPER_USER!)
  const okPass = eq(password, process.env.SUPER_USER_PASSWORD!)
  if (!okUser || !okPass) return null

  const code = process.env.SUPER_USER_ORG || '00051'
  const org = await prisma.c_org.findUnique({ where: { code }, select: { code: true } })
  if (!org) throw new Error(`SUPER_USER_ORG ${code} ไม่มีใน c_org`)

  const user = await prisma.user.upsert({
    where: { username: process.env.SUPER_USER! },
    create: {
      username: process.env.SUPER_USER!,
      full_name: 'ผู้ดูแลระบบ (บัญชีสำรอง)',
      // เก็บ hash จริงของรหัสใน .env ไว้ ไม่ใช่ค่าหลอก ๆ ให้ผ่าน CHECK
      password_hash: hash(password),
      org_code: org.code,
      role: 'province',   // role ไม่ได้ให้สิทธิ์จัดการระบบ สิทธิ์นั้นมาจากการเป็นบัญชีสำรอง
      last_login_at: new Date(),
      login_count: 1,
    },
    update: {
      password_hash: hash(password),   // รหัสใน .env เปลี่ยน ให้ตามไปด้วย
      role: 'province',
      is_active: true,                 // ถูกปิดบัญชีไว้ก็ต้องกลับมาใช้ได้ ไม่งั้นกู้ระบบไม่ได้
      last_login_at: new Date(),
      login_count: { increment: 1 },
    },
    select: { id: true },
  })
  return user.id
}
