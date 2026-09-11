import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createPending, createSession } from '@/lib/auth'
import { exchange } from '@/lib/sso'

const fail = (req: Request, why: string) =>
  NextResponse.redirect(new URL(`/auth/signin?error=${encodeURIComponent(why)}`, req.url))

export async function GET(req: Request) {
  const url = new URL(req.url)
  const jar = await cookies()

  const err = url.searchParams.get('error')
  if (err) return fail(req, url.searchParams.get('error_description') ?? err)

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const want = jar.get('sso_state')?.value
  const verifier = jar.get('sso_verifier')?.value
  const nonce = jar.get('sso_nonce')?.value
  const next = jar.get('sso_next')?.value ?? '/'

  // state ต้องตรงกับที่ออกไป กัน CSRF และกันคนยิง callback ตรง ๆ
  if (!code || !state || !want || state !== want || !verifier || !nonce) {
    return fail(req, 'คำขอล็อกอินไม่ถูกต้องหรือหมดอายุ ลองใหม่อีกครั้ง')
  }

  let p
  try {
    p = await exchange(code, verifier, nonce)
  } catch (e) {
    console.error('sso exchange', e)
    return fail(req, 'ยืนยันตัวตนกับ PLKHealth SSO ไม่สำเร็จ')
  }

  // เคยล็อกอินแล้ว = มีบัญชีและหน่วยงานที่จับคู่ไว้แล้ว เข้าได้เลย
  const existing = await prisma.user.findUnique({
    where: { sso_sub: p.sub },
    select: { id: true, is_active: true },
  })

  if (!existing) {
    // ครั้งแรก: ยังไม่สร้างบัญชี พักโปรไฟล์ไว้ในคุกกี้ที่เซ็นแล้ว
    // แล้วให้ผู้ใช้เลือกหน่วยงานก่อน (SSO ส่ง hoscode มาบ้างไม่มาบ้าง และบางทีก็ไม่ตรง)
    await createPending(p)
    for (const c of ['sso_state', 'sso_nonce', 'sso_verifier']) jar.delete(c)
    return NextResponse.redirect(new URL('/auth/org', req.url))
  }
  if (!existing.is_active) return fail(req, 'บัญชีนี้ถูกปิดการใช้งาน')

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      full_name: p.name,
      email: p.email,
      position: p.position,
      last_login_at: new Date(),
      login_count: { increment: 1 },
      // ไม่แตะ org_code: หน่วยงานที่ผู้ใช้เลือกไว้เองคือของจริง ไม่ให้ hoscode จาก SSO มาทับ
    },
    select: { id: true },
  })

  await createSession(user.id)
  for (const c of ['sso_state', 'sso_nonce', 'sso_verifier', 'sso_next']) jar.delete(c)

  // next มาจากคุกกี้ที่เราตั้งเอง แต่กันไว้อีกชั้น ให้เด้งได้เฉพาะ path ภายใน
  return NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', req.url))
}
