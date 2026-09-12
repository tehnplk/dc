import { NextResponse, type NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { SESSION_COOKIE, SESSION_MAX_AGE, SESSION_RENEW_BELOW } from '@/lib/auth'

/** หน้าที่เปิดสาธารณะ ที่เหลือบังคับล็อกอินหมด รวมไฟล์ที่ผู้ใช้อัปโหลด */
function isPublic(path: string) {
  return path === '/' || path === '/dashboard' || path.startsWith('/auth/')
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * กันเว็บอื่นเรียก endpoint ของเรา (CSRF / hotlink / clickjacking)
 *   1. เมธอดที่เปลี่ยนข้อมูล ต้องมี Origin และต้องเป็นโดเมนเดียวกับที่ขอมา
 *   2. คำขอข้ามไซต์ อนุญาตเฉพาะการ "เปิดหน้าเว็บ" (คลิกลิงก์/redirect กลับจาก SSO)
 *      ที่เหลือ — <img>, <iframe>, fetch, script — ปฏิเสธหมด
 * เบราว์เซอร์เก่าที่ไม่ส่ง Sec-Fetch-* ยังผ่านข้อ 2 แต่ติดข้อ 1 กับคุกกี้ SameSite=Lax อยู่ดี
 */
function thirdParty(req: NextRequest): boolean {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')

  if (!SAFE.has(req.method)) {
    const origin = req.headers.get('origin')
    if (!origin) return true
    try {
      if (new URL(origin).host !== host) return true
    } catch {
      return true
    }
  }

  const site = req.headers.get('sec-fetch-site')
  if (site === 'cross-site' || site === 'same-site') {
    const navigation = req.method === 'GET'
      && req.headers.get('sec-fetch-mode') === 'navigate'
      && req.headers.get('sec-fetch-dest') === 'document'
    if (!navigation) return true
  }
  return false
}

/**
 * กันทุกหน้า ยกเว้นเส้นทางสาธารณะ (ไฟล์นี้ชื่อ proxy.ts — Next 16 เลิกใช้ชื่อ middleware แล้ว)
 * ต้อง verify ลายเซ็นจริง ไม่ใช่เช็คแค่ว่ามีคุกกี้ ไม่งั้นใครตั้งคุกกี้ชื่อนี้ค่าอะไรก็ได้ก็ผ่าน
 * (jose ทำงานบน edge runtime ได้ ไม่ต้องพึ่ง node crypto)
 * ตัวตนจริงยังไปตรวจซ้ำที่ currentUser() ซึ่งอ่าน DB — คุกกี้ถูกแต่บัญชีถูกปิดก็ต้องหลุด
 */
export async function proxy(req: NextRequest) {
  if (thirdParty(req)) {
    return new NextResponse('ไม่อนุญาตให้เรียกจากเว็บไซต์อื่น', { status: 403 })
  }
  if (isPublic(req.nextUrl.pathname)) return NextResponse.next()

  // ตอนพัฒนา ตั้ง DEV_UID ใน .env เพื่อข้าม SSO — readSession() ใช้เงื่อนไขเดียวกัน
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_UID) return NextResponse.next()

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
    // ทุกเส้นทางรวมไฟล์อัปโหลด ยกเว้น asset ของ Next เอง (ไม่มีข้อมูลผู้ป่วย และโดนเรียกถี่)
    '/((?!_next/|favicon.ico).*)',
  ],
}
