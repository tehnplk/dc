'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { areaScope, inScope } from '@/lib/scope'

/**
 * นอกเขตของตัวเอง = บอกไปเลยว่าใครดูแลอยู่ ผู้ใช้จะได้รู้ว่าต้องไปคุยกับใคร
 * ไม่ใช่แค่บอกว่า "ไม่ใช่ของคุณ" แล้วปล่อยให้งง
 */
async function ownerOf(code: string) {
  // 1 หมู่บ้าน = 1 หน่วยบริการ (hos_village.area_code เป็น PK)
  const row = await prisma.hos_village.findUnique({
    where: { area_code: code },
    select: { c_org: { select: { code: true, name: true } } },
  })
  return row
    ? `มีหน่วยบริการรับผิดชอบหมู่บ้านนี้ ${row.c_org.code}-${row.c_org.name}`
    : 'หมู่บ้านนี้ยังไม่มีหน่วยบริการรับผิดชอบ แจ้ง สสจ. เพื่อกำหนดพื้นที่ก่อน'
}

export type AdminState = { error?: string; ok?: string }

const ok = () => ({ ok: String(Date.now()) })
const text = (fd: FormData, k: string) => {
  const v = fd.get(k)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** จัดการผู้ใช้/หน่วยงาน: สสจ. หรือบัญชีสำรองใน .env เท่านั้น */
async function admin() {
  const me = await currentUser()
  if (!me.canManage) throw new Error('forbidden')
  return me
}

/** จัดการหมู่บ้าน: สสจ. ทั้งจังหวัด + หน่วยบริการเฉพาะเขตตัวเอง (สสอ. ไม่ได้ดูแลหมู่บ้าน) */
async function areaEditor() {
  const me = await currentUser()
  if (!me.canManage && me.role !== 'hospital') throw new Error('forbidden')
  return me
}

// ---------- ผู้ใช้ ----------
export async function saveUser(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await admin()
  const id = BigInt(String(fd.get('id')))
  const role = String(fd.get('role'))
  const is_active = fd.get('is_active') === 'on'
  if (!(await prisma.user_role.findUnique({ where: { code: role }, select: { code: true } })))
    return { error: 'บทบาทไม่ถูกต้อง' }
  // ปิดบัญชีตัวเองแล้วจะหลุดทันทีกลางคัน
  if (id === me.id && !is_active) return { error: 'ปิดบัญชีตัวเองไม่ได้' }

  const org_code = String(fd.get('org_code'))
  const org = await prisma.c_org.findUnique({ where: { code: org_code }, select: { code: true } })
  if (!org) return { error: 'ไม่พบหน่วยงานที่เลือก' }

  await prisma.users.update({
    where: { id },
    data: { role, is_active, org_code: org.code, tel: text(fd, 'tel') },
  })
  revalidatePath('/admin')
  return ok()
}

// ---------- หน่วยงาน ----------
export async function saveOrg(_prev: AdminState, fd: FormData): Promise<AdminState> {
  await admin()
  const code = String(fd.get('code') ?? '').trim()
  const name = text(fd, 'name')
  if (!/^\d{5}$/.test(code)) return { error: 'รหัสหน่วยงานต้องเป็นตัวเลข 5 หลัก' }
  if (!name) return { error: 'ระบุชื่อหน่วยงาน' }

  const data = {
    name,
    org_type: text(fd, 'org_type'),
    area_code: text(fd, 'area_code'),
    is_active: fd.get('is_active') === 'on',
  }
  try {
    // upsert: ฟอร์มเดียวใช้ได้ทั้งเพิ่มและแก้ไข รหัสคือคีย์
    await prisma.c_org.upsert({ where: { code }, create: { code, ...data }, update: data })
  } catch (e) {
    console.error('saveOrg', e)
    return { error: 'บันทึกไม่สำเร็จ ตรวจสอบรหัสพื้นที่ที่ผูกไว้' }
  }
  revalidatePath('/admin')
  return ok()
}

export async function deleteOrg(_prev: AdminState, fd: FormData): Promise<AdminState> {
  await admin()
  const code = String(fd.get('code'))
  // soft delete: เคสเก่ายังต้องแสดงชื่อหน่วยงานที่แจ้ง/รับได้ ลบจริงแล้วประวัติพัง
  const users = await prisma.users.count({ where: { org_code: code, deleted_at: null } })
  if (users > 0) return { error: `ยังมีผู้ใช้ ${users} คนสังกัดหน่วยงานนี้ ย้ายออกก่อน` }

  await prisma.c_org.update({ where: { code }, data: { deleted_at: new Date(), is_active: false } })
  revalidatePath('/admin')
  return ok()
}

// ---------- หมู่บ้าน/ชุมชน (c_area level 4) ----------
export async function saveArea(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await areaEditor()
  const code = String(fd.get('code') ?? '').trim()
  const name = text(fd, 'name')
  if (!/^\d{8}$/.test(code)) return { error: 'รหัสหมู่บ้านต้องเป็นตัวเลข 8 หลัก' }
  if (!name) return { error: 'ระบุชื่อหมู่บ้าน/ชุมชน' }

  // รหัสหมู่บ้านคือรหัสตำบล 6 หลัก + ลำดับหมู่ 2 หลัก ตำบลต้องมีอยู่จริง
  const parent_code = code.slice(0, 6)
  const tmb = await prisma.c_area.findFirst({
    where: { code: parent_code, level: 3 },
    select: { code: true },
  })
  if (!tmb) return { error: `ไม่พบตำบลรหัส ${parent_code} — รหัส 6 หลักแรกต้องเป็นตำบลที่มีอยู่` }

  // เพิ่ม/แก้ได้เฉพาะในเขตรับผิดชอบของตัวเอง (สสจ. ไม่จำกัด)
  if (!inScope(await areaScope(me), code)) return { error: await ownerOf(code) }

  const pop = String(fd.get('population') ?? '').replace(/\D/g, '')
  const data = { name, parent_code, level: 4, population: pop ? Number(pop) : null }
  try {
    await prisma.c_area.upsert({ where: { code }, create: { code, ...data }, update: data })
    // สสจ. กำหนด/ย้ายหน่วยบริการที่รับผิดชอบได้จากฟอร์มเดียวกัน หน่วยบริการแก้ของตัวเองไม่ได้
    if (me.canManage && fd.has('org_code')) {
      const org_code = text(fd, 'org_code')
      if (org_code) {
        await prisma.hos_village.upsert({
          where: { area_code: code }, create: { area_code: code, org_code }, update: { org_code },
        })
      } else {
        await prisma.hos_village.deleteMany({ where: { area_code: code } })
      }
    }
  } catch (e) {
    console.error('saveArea', e)
    return { error: 'บันทึกไม่สำเร็จ' }
  }
  revalidatePath('/admin')
  revalidatePath('/hospital/village')
  return ok()
}

export async function deleteArea(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await areaEditor()
  const code = String(fd.get('code'))
  if (!inScope(await areaScope(me), code)) return { error: await ownerOf(code) }
  // soft delete เหมือนกัน เคสที่อยู่ในหมู่บ้านนี้ยังต้องรู้ว่าชื่ออะไร
  const cases = await prisma.case_report.count({ where: { area_code: code, deleted_at: null } })
  if (cases > 0) return { error: `ยังมีเคส ${cases} รายในหมู่บ้านนี้ ลบไม่ได้` }

  await prisma.c_area.update({ where: { code }, data: { deleted_at: new Date() } })
  revalidatePath('/admin')
  revalidatePath('/hospital/village')
  return ok()
}

/** ลบผู้ใช้ (soft) — ประวัติการแจ้ง/รับเคสยังชี้มาที่แถวนี้ */
export async function deleteUser(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await admin()
  const id = BigInt(String(fd.get('id')))
  if (id === me.id) return { error: 'ลบบัญชีตัวเองไม่ได้' }

  await prisma.users.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false },
  })
  revalidatePath('/admin')
  return ok()
}

// ---------- โรคที่ต้องรายงาน ----------

/**
 * เปิด/ปิดว่าโรคไหนต้องแจ้งเข้าระบบ — ฟอร์มแจ้งเคสเอาเฉพาะโรคที่เปิดไว้ไปเป็นตัวเลือก
 * ยังผูกกับ c_disease อยู่ (case_report.disease_code อ้าง FK ไปที่นั่น และ view ก็ JOIN)
 * เปิดโรคที่ไม่มีแถวใน c_disease จึงต้องกันไว้ ไม่งั้นแจ้งเคสแล้วพังตอนบันทึก
 */
export async function toggleMustReport(_prev: AdminState, fd: FormData): Promise<AdminState> {
  await admin()
  const code = String(fd.get('code'))
  const must_report = fd.get('must_report') === 'on'

  const d = await prisma.c_disease506.findUnique({ where: { code }, select: { code: true } })
  if (!d) return { error: 'ไม่พบโรคนี้' }

  if (must_report && !(await prisma.c_disease.findUnique({ where: { code }, select: { code: true } })))
    return { error: 'โรคนี้ยังไม่มีค่าตั้งใน c_disease (SLA/รัศมี/ระยะฟักตัว) เปิดให้แจ้งเคสไม่ได้' }

  await prisma.c_disease506.update({ where: { code }, data: { must_report } })
  revalidatePath('/admin')
  revalidatePath('/report')
  return ok()
}
