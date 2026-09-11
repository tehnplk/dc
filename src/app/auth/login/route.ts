import { randomBytes, createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authorizeUrl } from '@/lib/sso'

const b64url = (b: Buffer) => b.toString('base64url')

export async function GET(req: Request) {
  const state = b64url(randomBytes(24))
  const nonce = b64url(randomBytes(24))
  const verifier = b64url(randomBytes(48))
  const challenge = b64url(createHash('sha256').update(verifier).digest())

  // เก็บของลับของรอบนี้ไว้ในคุกกี้ชั่วคราว อายุ 5 นาทีเท่าอายุ authorization code
  const jar = await cookies()
  const opt = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 300 }
  jar.set('sso_state', state, opt)
  jar.set('sso_nonce', nonce, opt)
  jar.set('sso_verifier', verifier, opt)
  // กลับไปหน้าที่ผู้ใช้ตั้งใจเข้าหลังล็อกอินเสร็จ
  jar.set('sso_next', new URL(req.url).searchParams.get('next') ?? '/', opt)

  redirect(await authorizeUrl({ state, nonce, challenge }))
}
