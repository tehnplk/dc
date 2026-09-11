'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { validCid } from '@/lib/cid'

export type ProfileState = { error?: string; ok?: string }

/** รายชื่อหน่วยงาน — โหลดตอนเปิดโมดัล ไม่ต้องแบก 199 แถวไปกับทุกหน้า */
export async function getOrgs() {
  await currentUser()
  return prisma.c_org.findMany({
    where: { is_active: true, deleted_at: null },
    select: { code: true, name: true },
    orderBy: { code: 'asc' },
  })
}

export async function saveProfile(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const me = await currentUser()

  const typed = String(fd.get('cid') ?? '').replace(/\D/g, '')
  if (typed && !validCid(typed)) return { error: 'เลขบัตรประชาชนไม่ถูกต้อง' }

  const org_code = String(fd.get('org_code') ?? '')
  const org = await prisma.c_org.findFirst({ where: { code: org_code, is_active: true, deleted_at: null }, select: { code: true } })
  if (!org) return { error: 'ไม่พบหน่วยงานที่เลือก' }

  const tel = String(fd.get('tel') ?? '').trim()
  if (tel && !/^[0-9\-+() ]{6,20}$/.test(tel)) return { error: 'เบอร์ติดต่อไม่ถูกต้อง' }

  try {
    await prisma.users.update({
      where: { id: me.id },
      data: {
        // ล้างช่องแล้วบันทึก = ตั้งใจลบค่า ต่างจากหน้าตั้งค่าครั้งแรกที่เว้นว่าง = ยังไม่กรอก
        cid: typed || null,
        tel: tel || null,
        org_code: org.code,
        // แจ้งเตือนต้องมีเลขบัตร ปิดช่องทางเปิดแจ้งเตือนทั้งที่ไม่มีเลข
        notify: fd.get('notify') === 'on' && !!typed,
      },
    })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      return { error: 'เลขบัตรนี้ถูกใช้กับบัญชีอื่นในระบบแล้ว' }
    }
    console.error('saveProfile', e)
    return { error: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง' }
  }

  // หน่วยงานเปลี่ยน = รายการเคสที่เห็นในทุกหน้าเปลี่ยนตาม ต้องล้างแคชทั้งชุด
  revalidatePath('/', 'layout')
  return { ok: String(Date.now()) }
}
