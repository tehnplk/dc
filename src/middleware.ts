import { NextResponse, type NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { SESSION_COOKIE, SESSION_MAX_AGE, SESSION_RENEW_BELOW } from '@/lib/auth'

/**
 * กันทุกหน้า ยกเว้นเส้นทางล็อกอิน
 * ต้อง verify ลายเซ็นจริง ไม่ใช่เช็คแค่ว่ามีคุกกี้ ไม่งั้นใครตั้งคุกกี้ชื่อนี้ค่าอะไรก็ได้ก็ผ่าน
 * (jose ทำงานบน edge runtime ได้ ไม่ต้องพึ่ง node crypto)
 * ตัวตนจริงยังไปตรวจซ้ำที่ currentUser() ซึ่งอ่าน DB — คุกกี้ถูกแต่บัญชีถูกปิดก็ต้องหลุด
 */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.SESSION_SECRET)
      const { payload } = await jwtVerify(token, secret)
      const res = NextResponse.next()

      // ต่ออายุแบบเลื่อน: ใช้งานอยู่เรื่อย ๆ ก็ไม่หลุด ครบ 7 วันนับจากครั้งสุดท้ายที่ใช้
      // ทำที่ middleware เพราะ server component ตั้งคุกกี้ไม่ได้
      const left = (payload.exp ?? 0) - Math.floor(Date.now() / 1000)
      if (left > 0 && left < SESSION_RENEW_BELOW) {
        const fresh = await new SignJWT({ uid: payload.uid })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime(`${SESSION_MAX_AGE}s`)
          .sign(secret)
        res.cookies.set(SESSION_COOKIE, fresh, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: SESSION_MAX_AGE,
        })
      }
      return res
    } catch {
      // ลายเซ็นเพี้ยน/หมดอายุ — ไล่ไปล็อกอินใหม่ พร้อมลบคุกกี้เสียทิ้ง
    }
  }

  const next = req.nextUrl.pathname + req.nextUrl.search
  const url = new URL('/auth/signin', req.url)
  if (next !== '/') url.searchParams.set('next', next)
  const res = NextResponse.redirect(url)
  if (token) res.cookies.delete(SESSION_COOKIE)
  return res
}

export const config = {
  matcher: [
    // ทุกหน้า ยกเว้น /auth/*, /dashboard (เปิดสาธารณะ), ไฟล์ที่ผู้ใช้อัปโหลด และไฟล์ static
    // ใช้ .+ ไม่ใช่ .* เพื่อให้ "/" หลุดออกไป (หน้านั้นแค่ redirect ไป /dashboard ซึ่งเปิดสาธารณะ)
    '/((?!auth/|dashboard|uploads/|_next/|favicon.ico).+)',
  ],
}
