'use server'

import { redirect } from 'next/navigation'
import { createSession } from '@/lib/auth'
import { verifySuperUser } from '@/lib/superuser'

export type AdminLoginState = { error?: string }

export async function superLogin(_prev: AdminLoginState, fd: FormData): Promise<AdminLoginState> {
  const id = await verifySuperUser(String(fd.get('username') ?? ''), String(fd.get('password') ?? ''))
  // ไม่บอกว่าผิดที่ชื่อหรือรหัส จะได้ไม่ช่วยคนเดาว่ามีบัญชีนี้อยู่จริง
  if (!id) return { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }

  await createSession(id)
  redirect('/admin')
}
