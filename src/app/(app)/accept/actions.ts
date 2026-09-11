'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { checkFiles, filesOf, saveUpload } from '@/lib/files'

export type ActivityState = { error?: string; ok?: string }

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

type Me = Awaited<ReturnType<typeof currentUser>>

/**
 * ใครบันทึกกิจกรรมของเคสนี้ได้บ้าง (เช็คที่ server เสมอ ปุ่มบนหน้าจอกันได้แค่ความเผลอ)
 *   จังหวัด = ทุกเคส · อำเภอ = ทุกเคสในอำเภอตัวเอง · หน่วยบริการ = เฉพาะเคสที่ตัวเองรับไว้
 * คืนข้อความเหตุผลถ้าทำไม่ได้ คืน null ถ้าผ่าน
 */
async function cannotAdd(me: Me, caseId: bigint): Promise<string | null> {
  if (me.role === 'province') return null
  if (me.role === 'district') {
    if (!me.amp) return 'บัญชีของคุณยังไม่ได้ผูกกับอำเภอ'
    const inAmp = await prisma.case_report.count({
      where: { id: caseId, deleted_at: null, area_code: { startsWith: me.amp } },
    })
    return inAmp > 0 ? null : 'เคสนี้ไม่ได้อยู่ในอำเภอของคุณ'
  }
  const own = await prisma.case_acceptance.findFirst({
    where: { case_id: caseId, status: 'active', org_code: me.org_code },
    select: { id: true },
  })
  return own ? null : 'เคสนี้ไม่ได้อยู่ในความดูแลของหน่วยงานคุณ'
}

/**
 * แก้/ลบกิจกรรมได้เฉพาะหน่วยบริการที่ถือเคสนั้นอยู่
 * จังหวัด/อำเภอ เพิ่มได้อย่างเดียว — ของที่บันทึกไปแล้วเป็นหลักฐานของพื้นที่
 */
async function ownedActivity(me: Me, activityId: bigint) {
  if (me.readonly) return { error: 'บัญชีผู้ดูแลระบบดูข้อมูลผู้ป่วยได้อย่างเดียว' as const }
  if (me.role !== 'hospital') return { error: 'บทบาทของคุณแก้ไข/ลบกิจกรรมไม่ได้' as const }

  const act = await prisma.case_activity.findUnique({
    where: { id: activityId },
    select: { id: true, case_id: true },
  })
  if (!act) return { error: 'ไม่พบกิจกรรมนี้' as const }

  const own = await prisma.case_acceptance.findFirst({
    where: { case_id: act.case_id, status: 'active', org_code: me.org_code },
    select: { id: true },
  })
  return own ? { act } : { error: 'เคสนี้ไม่ได้อยู่ในความดูแลของหน่วยงานคุณ' as const }
}

export async function addActivity(_prev: ActivityState, fd: FormData): Promise<ActivityState> {
  const caseId = fd.get('caseId')
  if (typeof caseId !== 'string' || !/^\d{1,18}$/.test(caseId)) return { error: 'เคสไม่ถูกต้อง' }

  const date_act = str(fd, 'date_act')
  const time_act = str(fd, 'time_act')
  const activity_name = str(fd, 'activity_name')
  const note = str(fd, 'note')
  if (!date_act || !/^\d{4}-\d{2}-\d{2}$/.test(date_act)) return { error: 'ระบุวันที่ดำเนินการ' }
  if (!activity_name) return { error: 'ระบุกิจกรรมที่ดำเนินการ' }
  // ความยาวมี CHECK ที่ DB อีกชั้น ตรงนี้ไว้บอกผู้ใช้เป็นภาษาคน
  if (activity_name.length > 255) return { error: 'กิจกรรมยาวเกิน 255 ตัวอักษร' }
  if (note && note.length > 1000) return { error: 'รายละเอียดยาวเกิน 1000 ตัวอักษร' }

  const files = filesOf(fd)
  const bad = checkFiles(files)
  if (bad) return { error: bad }

  const me = await currentUser()
  if (me.readonly) return { error: 'บัญชีผู้ดูแลระบบดูข้อมูลผู้ป่วยได้อย่างเดียว' }

  const id = BigInt(caseId)
  const denied = await cannotAdd(me, id)
  if (denied) return { error: denied }

  let created
  try {
    // เขียนไฟล์ก่อนค่อยลง DB: ถ้า DB พังจะเหลือไฟล์กำพร้าซึ่งกวาดทีหลังได้
    // กลับกันถ้าลง DB ก่อนแล้วเขียนไฟล์พัง จะได้แถวที่ชี้ไฟล์ที่ไม่มีอยู่จริง
    const saved = await Promise.all(files.map(saveUpload))

    created = await prisma.$transaction(async (tx) => {
      const act = await tx.case_activity.create({
        data: {
          case_id: BigInt(caseId),
          date_act: new Date(date_act + 'T00:00:00Z'),
          time_act: time_act && /^\d{2}:\d{2}$/.test(time_act) ? new Date(`1970-01-01T${time_act}:00Z`) : null,
          activity_name,
          performer: str(fd, 'performer'),
          performer_org: me.org_code,
          note,
          created_by: me.id,
        },
        select: { id: true },
      })
      if (saved.length) {
        await tx.case_document.createMany({
          data: saved.map((f) => ({
            case_id: id,
            activity_id: act.id,
            file_path: f.path,
            file_name: f.name,
            mime_type: f.mime,
            file_size: BigInt(f.size),
            created_by: me.id,
          })),
        })
      }
      return act
    })
  } catch (e) {
    console.error('addActivity', e)
    return { error: 'บันทึกไม่สำเร็จ ตรวจสอบข้อมูลอีกครั้ง' }
  }

  revalidatePath('/accept')
  // ส่ง id กลับไป ไม่ใช่ข้อความคงที่ ฝั่ง client ใช้ค่านี้เป็นตัวรู้ว่า "บันทึกรอบใหม่แล้ว"
  return { ok: String(created.id) }
}

export type ReleaseState = { error?: string; ok?: string }

/** คืนเคส: ปิดแถวรับปัจจุบันเป็น released — trigger จะดึง case_report กลับเป็น reported ให้เอง */
export async function releaseCase(_prev: ReleaseState, fd: FormData): Promise<ReleaseState> {
  const caseId = fd.get('caseId')
  if (typeof caseId !== 'string' || !/^\d{1,18}$/.test(caseId)) return { error: 'เคสไม่ถูกต้อง' }

  const me = await currentUser()
  if (me.readonly) return { error: 'บัญชีผู้ดูแลระบบดูข้อมูลผู้ป่วยได้อย่างเดียว' }
  const note = str(fd, 'note')
  if (note && note.length > 255) return { error: 'เหตุผลยาวเกิน 255 ตัวอักษร' }

  // updateMany + เงื่อนไข org: คนอื่นยิง id มามั่ว ๆ ก็ไม่โดนแถวของหน่วยอื่น
  const { count } = await prisma.case_acceptance.updateMany({
    where: { case_id: BigInt(caseId), status: 'active', org_code: me.org_code },
    data: { status: 'released', released_at: new Date(), released_by: me.id, note },
  })
  if (count === 0) return { error: 'เคสนี้ไม่ได้อยู่ในความดูแลของหน่วยงานคุณ' }

  revalidatePath('/accept')
  revalidatePath('/patients')
  return { ok: String(Date.now()) }
}

/** แก้ไขกิจกรรม (วัน/เวลา/ชื่อกิจกรรม/รายละเอียด) — ไฟล์แนบเดิมไม่ถูกแตะ */
export async function updateActivity(_prev: ActivityState, fd: FormData): Promise<ActivityState> {
  const raw = fd.get('id')
  if (typeof raw !== 'string' || !/^\d{1,18}$/.test(raw)) return { error: 'กิจกรรมไม่ถูกต้อง' }

  const date_act = str(fd, 'date_act')
  const time_act = str(fd, 'time_act')
  const activity_name = str(fd, 'activity_name')
  const note = str(fd, 'note')
  if (!date_act || !/^\d{4}-\d{2}-\d{2}$/.test(date_act)) return { error: 'ระบุวันที่ดำเนินการ' }
  if (!activity_name) return { error: 'ระบุกิจกรรมที่ดำเนินการ' }
  if (activity_name.length > 255) return { error: 'กิจกรรมยาวเกิน 255 ตัวอักษร' }
  if (note && note.length > 1000) return { error: 'รายละเอียดยาวเกิน 1000 ตัวอักษร' }

  const me = await currentUser()
  const guard = await ownedActivity(me, BigInt(raw))
  if ('error' in guard) return { error: guard.error }

  await prisma.case_activity.update({
    where: { id: guard.act.id },
    data: {
      date_act: new Date(date_act + 'T00:00:00Z'),
      time_act: time_act && /^\d{2}:\d{2}$/.test(time_act) ? new Date(`1970-01-01T${time_act}:00Z`) : null,
      activity_name,
      performer: str(fd, 'performer'),
      note,
      updated_by: me.id,
    },
    select: { id: true },
  })

  revalidatePath('/accept')
  return { ok: String(Date.now()) }
}

/** ลบกิจกรรม — เอกสาร/รูปที่แนบไว้หายตามด้วย (FK ON DELETE CASCADE) */
export async function deleteActivity(_prev: ActivityState, fd: FormData): Promise<ActivityState> {
  const raw = fd.get('id')
  if (typeof raw !== 'string' || !/^\d{1,18}$/.test(raw)) return { error: 'กิจกรรมไม่ถูกต้อง' }

  const me = await currentUser()
  const guard = await ownedActivity(me, BigInt(raw))
  if ('error' in guard) return { error: guard.error }

  // ponytail: ไฟล์ใน /uploads ยังค้างอยู่ ถ้าพื้นที่เต็มค่อยทำสคริปต์กวาดไฟล์กำพร้า
  await prisma.case_activity.delete({ where: { id: guard.act.id } })

  revalidatePath('/accept')
  return { ok: String(Date.now()) }
}
