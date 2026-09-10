// กติกาไฟล์แนบ ใช้ร่วมกันทั้งฝั่ง client (บีบ/กันก่อนส่ง) และ server (ด่านจริง)
export const MAX_IMAGES = 5
export const MAX_IMAGE_BYTES = 1024 * 1024        // 1 MB ต่อรูป หลังบีบแล้ว
export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const ACCEPT = 'image/*,application/pdf'

export const isImage = (t: string) => t.startsWith('image/')
export const isPdf = (t: string) => t === 'application/pdf'

/**
 * บีบรูปให้ไม่เกิน 1 MB ก่อนอัปโหลด ทำที่เบราว์เซอร์เพราะรูปจากมือถือ 4-8 MB
 * ถ้าปล่อยขึ้นไปบีบที่ server ต้องแบกทั้งแบนด์วิดท์และ lib ประมวลผลภาพ
 * ย่อด้านยาวลงก่อน แล้วค่อยไล่ลด quality — คืน File เดิมถ้าเล็กพออยู่แล้ว
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!isImage(file.type) || file.size <= MAX_IMAGE_BYTES) return file

  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()

  for (const q of [0.85, 0.7, 0.55, 0.4, 0.25]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q))
    if (blob && blob.size <= MAX_IMAGE_BYTES) {
      return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
    }
  }
  // บีบสุดแล้วยังไม่ลง ปล่อยให้ server ปฏิเสธ ดีกว่าเงียบ ๆ ส่งของเกินไป
  return file
}
