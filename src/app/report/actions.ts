'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { checkFiles, filesOf, saveUpload } from '@/lib/files'

export type FormState = { error?: string; ok?: string }

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}
const int = (fd: FormData, k: string) => {
  const v = str(fd, k)
  if (v === null) return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n < 200 ? n : null
}
const date = (fd: FormData, k: string) => {
  const v = str(fd, k)
  // <input type="date"> ส่ง yyyy-mm-dd เสมอ แต่ค่ามาจาก client ต้องกันไว้ก่อนอยู่ดี
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00Z') : null
}

export async function createCase(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await currentUser()

  const disease_code = str(fd, 'disease_code')
  const date_onset = date(fd, 'date_onset')
  const area_code = str(fd, 'area_code')
  if (!disease_code) return { error: 'เลือกโรคที่วินิจฉัยก่อน' }
  if (!date_onset) return { error: 'ระบุวันเริ่มป่วย' }
  if (area_code && !/^\d{8}$/.test(area_code)) return { error: 'พื้นที่ไม่ถูกต้อง' }

  const date_visit = date(fd, 'date_visit')
  if (date_visit && date_visit < date_onset) return { error: 'วันที่พบต้องไม่ก่อนวันเริ่มป่วย' }

  const files = filesOf(fd)
  const bad = checkFiles(files)
  if (bad) return { error: bad }

  const gender = str(fd, 'gender')
  const patient_type = str(fd, 'patient_type')
  const time_dx = str(fd, 'time_dx')

  try {
    // เขียนไฟล์ก่อนค่อยลง DB: DB พังเหลือไฟล์กำพร้าที่กวาดทีหลังได้
    // สลับลำดับจะได้แถวที่ชี้ไฟล์ที่ไม่มีอยู่จริงแทน
    const saved = await Promise.all(files.map(saveUpload))

    const c = await prisma.case_report.create({
      data: {
        disease_code,
        case_class: 'suspected',            // แจ้งเข้ามาก่อน ยืนยันผลแลบทีหลัง
        cid: str(fd, 'cid'),
        pname: str(fd, 'pname'),
        fname: str(fd, 'fname'),
        lname: str(fd, 'lname'),
        gender: gender === 'M' || gender === 'F' ? gender : null,
        age_y: int(fd, 'age_y'),
        age_m: int(fd, 'age_m'),
        area_code,
        addr_no: str(fd, 'addr_no'),
        // หมู่ที่คือ 2 หลักท้ายของรหัสพื้นที่ ไม่ต้องให้คนกรอกซ้ำ (00 = เขตเทศบาล ไม่มีหมู่)
        moo: area_code && area_code.slice(6) !== '00' ? String(Number(area_code.slice(6))) : null,
        tel: str(fd, 'tel'),
        date_onset,
        date_visit,
        date_dx: date(fd, 'date_dx'),
        time_dx: time_dx && /^\d{2}:\d{2}$/.test(time_dx) ? new Date(`1970-01-01T${time_dx}:00Z`) : null,
        patient_type: patient_type === 'OPD' || patient_type === 'IPD' ? patient_type : null,
        symptom: str(fd, 'symptom'),
        report_org_code: me.org_code,
        reporter_name: str(fd, 'reporter_name'),
        reporter_position: me.position,
        reporter_tel: str(fd, 'reporter_tel'),
        created_by: me.id,
        // เอกสารระดับเคส (ไม่ผูกกิจกรรม) — activity_id เว้นว่างไว้
        case_document: saved.length
          ? { create: saved.map((f) => ({
              file_path: f.path, file_name: f.name, mime_type: f.mime,
              file_size: BigInt(f.size), created_by: me.id,
            })) }
          : undefined,
      },
      select: { case_no: true },
    })
    revalidatePath('/report')
    revalidatePath('/patients')
    return { ok: `แจ้งเคสแล้ว เลขทะเบียน ${c.case_no}` }
  } catch (e) {
    // CHECK / FK ที่ DB เป็นด่านสุดท้าย ข้อความดิบไม่ควรหลุดไปหน้าเว็บ
    console.error('createCase', e)
    return { error: 'บันทึกไม่สำเร็จ ตรวจสอบข้อมูลอีกครั้ง' }
  }
}
