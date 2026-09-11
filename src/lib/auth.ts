import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'plk_session'
const PENDING_COOKIE = 'plk_pending'
// อายุเซสชันของแอปเอง 7 วัน — SSO ไม่มี refresh token เราจึงคุมอายุเอง
// access token ของ SSO หมดใน 1 ชม. แต่ใช้แค่ตอนล็อกอินครั้งเดียว ไม่ได้ใช้ต่อ
const MAX_AGE = 7 * 24 * 3600

function key() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) throw new Error('ต้องตั้ง SESSION_SECRET ยาวอย่างน้อย 32 ตัวใน .env')
  return new TextEncoder().encode(s)
}

/** คุกกี้เก็บแค่ id ของผู้ใช้ ข้อมูลจริงอ่านจาก DB ทุกครั้ง สิทธิ์เปลี่ยนแล้วมีผลทันที */
export async function createSession(userId: bigint) {
  const jwt = await new SignJWT({ uid: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key())

  ;(await cookies()).set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: 'lax',          // ต้อง lax ไม่ใช่ strict ไม่งั้น redirect กลับจาก SSO จะไม่แนบคุกกี้
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function readSession(): Promise<bigint | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    const { payload } = await jwtVerify(raw, key())
    return typeof payload.uid === 'string' ? BigInt(payload.uid) : null
  } catch {
    return null              // หมดอายุ/ลายเซ็นเพี้ยน = ถือว่ายังไม่ล็อกอิน
  }
}

/** อายุเซสชัน + จุดที่ควรต่ออายุ (middleware เอาไปใช้) */
export const SESSION_MAX_AGE = MAX_AGE
export const SESSION_RENEW_BELOW = 5 * 24 * 3600

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE)
}

/** โปรไฟล์จาก SSO ที่ยังไม่ได้สร้างบัญชี เพราะรอผู้ใช้เลือกหน่วยงานก่อน */
export type Pending = {
  sub: string; name?: string; email?: string
  provider_id?: string; hoscode?: string; hname?: string; position?: string
}

// เซ็นไว้ด้วยกุญแจเดียวกับเซสชัน กันคนแก้ sub ในคุกกี้แล้วสวมเป็นคนอื่น
export async function createPending(p: Pending) {
  const jwt = await new SignJWT({ p })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key())
  ;(await cookies()).set(PENDING_COOKIE, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  })
}

export async function readPending(): Promise<Pending | null> {
  const raw = (await cookies()).get(PENDING_COOKIE)?.value
  if (!raw) return null
  try {
    const { payload } = await jwtVerify(raw, key())
    return (payload as { p?: Pending }).p ?? null
  } catch {
    return null
  }
}

export async function clearPending() {
  (await cookies()).delete(PENDING_COOKIE)
}
