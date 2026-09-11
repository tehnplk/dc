'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { clearPending, createSession, readPending } from '@/lib/auth'
import { validCid } from '@/lib/cid'

export type OrgState = { error?: string; ok?: string }

export async function chooseOrg(_prev: OrgState, fd: FormData): Promise<OrgState> {
  // โปรไฟล์มาจากคุกกี้ที่เซ็นไว้ ไม่ใช่จากฟอร์ม — ฟอร์มส่งมาได้แค่รหัสหน่วยงาน
  const p = await readPending()
  if (!p) return { error: 'ข้อมูลการเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่' }

  const code = fd.get('org_code')
  if (typeof code !== 'string' || !code) return { error: 'เลือกหน่วยงานก่อน' }

  // ไม่บังคับกรอก แต่ถ้ากรอกต้องถูกต้อง (mask ฝั่ง client ข้ามได้ ตรวจซ้ำที่นี่)
  const typed = String(fd.get('cid') ?? '').replace(/\D/g, '')
  if (typed && !validCid(typed)) return { error: 'เลขบัตรประชาชนไม่ถูกต้อง' }
  const cid = typed || null

  const tel = String(fd.get('tel') ?? '').trim()
  if (tel && !/^[0-9\-+() ]{6,20}$/.test(tel)) return { error: 'เบอร์ติดต่อไม่ถูกต้อง' }
  const notify = fd.get('notify') === 'on' && !!cid

  const org = await prisma.c_org.findFirst({
    where: { code, is_active: true, deleted_at: null },
    select: { code: true },
  })
  if (!org) return { error: 'ไม่พบหน่วยงานที่เลือก' }

  // เข้ามาซ้ำจากปุ่ม back: มีบัญชีแล้วก็แค่เข้าเลย ไม่สร้างซ้ำ
  let user
  try {
    user = await prisma.users.upsert({
      where: { sso_sub: p.sub },
      create: {
        sso_sub: p.sub,
        cid,
        tel: tel || null,
        notify,
        username: p.provider_id ?? p.sub,
        full_name: p.name,
        email: p.email,
        position: p.position,
        org_code: org.code,
        role: 'hospital',        // ผู้ใช้ใหม่เป็นหน่วยบริการเสมอ ให้ผู้ดูแลยกระดับทีหลัง
        last_login_at: new Date(),
        login_count: 1,
      },
      update: {
        // เว้นว่าง = ไม่แตะของเดิม ไม่ใช่ลบทิ้ง
        ...(cid ? { cid } : {}),
        ...(tel ? { tel } : {}),
        notify,
        org_code: org.code,
        last_login_at: new Date(),
        login_count: { increment: 1 },
      },
      select: { id: true },
    })
  } catch (e) {
    // cid เป็น UNIQUE — ชนแปลว่าเลขนี้ผูกกับบัญชีอื่นไปแล้ว
    if ((e as { code?: string }).code === 'P2002') {
      return { error: 'เลขบัตรนี้ถูกใช้กับบัญชีอื่นในระบบแล้ว' }
    }
    console.error('chooseOrg', e)
    return { error: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง' }
  }

  await createSession(user.id)
  await clearPending()
  redirect('/')
}
