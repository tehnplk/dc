'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSession } from '@/lib/auth'
import { fail, pass, retryAfter } from '@/lib/ratelimit'
import { verifySuperUser } from '@/lib/superuser'

export type AdminLoginState = { error?: string }

/** ไอพีของผู้เรียก — หลัง proxy ให้เชื่อ x-forwarded-for ตัวแรก ไม่มีเลยก็นับรวมเป็นก้อนเดียว */
async function clientKey() {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  return fwd || h.get('x-real-ip') || 'unknown'
}

export async function superLogin(_prev: AdminLoginState, fd: FormData): Promise<AdminLoginState> {
  const key = await clientKey()

  // โดนหน่วงอยู่ ไม่ต้องไปแตะรหัสผ่านเลย
  const wait = retryAfter(key)
  if (wait > 0) return { error: `ลองผิดหลายครั้งเกินไป รออีก ${wait} วินาที` }

  const id = await verifySuperUser(String(fd.get('username') ?? ''), String(fd.get('password') ?? ''))
  // ไม่บอกว่าผิดที่ชื่อหรือรหัส จะได้ไม่ช่วยคนเดาว่ามีบัญชีนี้อยู่จริง
  if (!id) {
    const next = fail(key)
    return {
      error: next > 0
        ? `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง — ลองใหม่ได้ในอีก ${next} วินาที`
        : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
    }
  }

  pass(key)
  await createSession(id)
  redirect('/admin')
}
