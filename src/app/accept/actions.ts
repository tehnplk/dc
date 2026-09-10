'use server'

import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { MAX_IMAGES, MAX_IMAGE_BYTES, MAX_PDF_BYTES, isImage, isPdf } from '@/lib/upload'

export type ActivityState = { error?: string; ok?: string }

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)
  return typeof v === 'string' && v.trim() ? v.trim() : null
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

  // ค่ามาจาก client ทั้งชนิดและขนาด ต้องตรวจซ้ำที่นี่ การบีบรูปฝั่งเบราว์เซอร์ข้ามได้
  const files = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.filter((f) => isImage(f.type)).length > MAX_IMAGES) {
    return { error: `แนบรูปได้ไม่เกิน ${MAX_IMAGES} รูป` }
  }
  for (const f of files) {
    if (!isImage(f.type) && !isPdf(f.type)) return { error: `${f.name} ไม่ใช่รูปหรือ PDF` }
    const cap = isImage(f.type) ? MAX_IMAGE_BYTES : MAX_PDF_BYTES
    if (f.size > cap) {
      return { error: `${f.name} ใหญ่เกิน ${Math.round(cap / 1024 / 1024)} MB` }
    }
  }

  const me = await currentUser()

  // บันทึกกิจกรรมได้เฉพาะเคสที่หน่วยงานตัวเองถืออยู่ ไม่ใช่ใครก็ได้ที่เดา id ถูก
  const own = await prisma.case_acceptance.findFirst({
    where: { case_id: BigInt(caseId), status: 'active', org_code: me.org_code },
    select: { id: true },
  })
  if (!own) return { error: 'เคสนี้ไม่ได้อยู่ในความดูแลของหน่วยงานคุณ' }

  let created
  try {
    // เขียนไฟล์ก่อนค่อยลง DB: ถ้า DB พังจะเหลือไฟล์กำพร้าซึ่งกวาดทีหลังได้
    // กลับกันถ้าลง DB ก่อนแล้วเขียนไฟล์พัง จะได้แถวที่ชี้ไฟล์ที่ไม่มีอยู่จริง
    const saved = await Promise.all(files.map(save))

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
            case_id: BigInt(caseId),
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

/** เก็บไฟล์ลง public/uploads/ปี/เดือน/ ชื่อสุ่ม กันชื่อซ้ำและกันชื่อไฟล์ผู้ใช้พาออกนอกโฟลเดอร์ */
async function save(f: File) {
  const now = new Date(Date.now() + 7 * 3600_000)          // โฟลเดอร์ตามเดือนไทย
  const rel = `/uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const dir = path.join(process.cwd(), 'public', rel)
  await mkdir(dir, { recursive: true })

  const ext = isPdf(f.type) ? 'pdf' : (f.type.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '')
  const name = `${randomUUID()}.${ext}`
  await writeFile(path.join(dir, name), Buffer.from(await f.arrayBuffer()))
  return { path: `${rel}/${name}`, name: f.name.slice(0, 255), mime: f.type, size: f.size }
}

export type ReleaseState = { error?: string; ok?: string }

/** คืนเคส: ปิดแถวรับปัจจุบันเป็น released — trigger จะดึง case_report กลับเป็น reported ให้เอง */
export async function releaseCase(_prev: ReleaseState, fd: FormData): Promise<ReleaseState> {
  const caseId = fd.get('caseId')
  if (typeof caseId !== 'string' || !/^\d{1,18}$/.test(caseId)) return { error: 'เคสไม่ถูกต้อง' }

  const me = await currentUser()
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
