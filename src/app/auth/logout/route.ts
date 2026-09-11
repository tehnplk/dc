import { redirect } from 'next/navigation'
import { clearSession } from '@/lib/auth'

// SSO ไม่มี endpoint logout — ล้างเซสชันฝั่งเราอย่างเดียว
// ส่งไป /dashboard ไม่ใช่ /auth/signin: หน้านั้นนับถอยหลังแล้วยิงเข้า SSO เอง
// ซึ่ง SSO ยังจำเซสชันอยู่ = เด้งกลับเข้าระบบทันที กลายเป็นออกไม่ได้
export async function GET() {
  await clearSession()
  redirect('/dashboard')
}

export const POST = GET
