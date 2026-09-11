import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { MAX_IMAGES, MAX_IMAGE_BYTES, MAX_PDF_BYTES, isImage, isPdf } from './upload'

/** ไฟล์ที่ client ส่งมาในฟิลด์เดียวกัน — ตัดตัวว่างทิ้งก่อน */
export function filesOf(fd: FormData, key = 'files') {
  return fd.getAll(key).filter((f): f is File => f instanceof File && f.size > 0)
}

/**
 * ด่านจริงของกติกาไฟล์แนบ — ชนิดและขนาดมาจาก client ทั้งคู่
 * การบีบรูปฝั่งเบราว์เซอร์ข้ามได้ ที่นี่จึงต้องเช็คซ้ำเสมอ
 * คืนข้อความ error หรือ null ถ้าผ่าน
 */
export function checkFiles(files: File[]): string | null {
  if (files.filter((f) => isImage(f.type)).length > MAX_IMAGES) {
    return `แนบรูปได้ไม่เกิน ${MAX_IMAGES} รูป`
  }
  for (const f of files) {
    if (!isImage(f.type) && !isPdf(f.type)) return `${f.name} ไม่ใช่รูปหรือ PDF`
    const cap = isImage(f.type) ? MAX_IMAGE_BYTES : MAX_PDF_BYTES
    if (f.size > cap) return `${f.name} ใหญ่เกิน ${Math.round(cap / 1024 / 1024)} MB`
  }
  return null
}

/** เก็บลง public/uploads/ปี/เดือน/ ชื่อสุ่ม กันชื่อซ้ำและกันชื่อไฟล์ผู้ใช้พาออกนอกโฟลเดอร์ */
export async function saveUpload(f: File) {
  const now = new Date(Date.now() + 7 * 3600_000)          // โฟลเดอร์ตามเดือนไทย
  const rel = `/uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const dir = path.join(process.cwd(), 'public', rel)
  await mkdir(dir, { recursive: true })

  const ext = isPdf(f.type) ? 'pdf' : (f.type.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '')
  const name = `${randomUUID()}.${ext}`
  await writeFile(path.join(dir, name), Buffer.from(await f.arrayBuffer()))
  return { path: `${rel}/${name}`, name: f.name.slice(0, 255), mime: f.type, size: f.size }
}
