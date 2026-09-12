/**
 * ปีระบาด — ที่เดียวที่ตอบว่า "เคสนี้อยู่ปีระบาดไหน"
 *
 * ไข้เลือดออกใช้ปีปฏิทิน (1 ม.ค. – 31 ธ.ค.) และนับตาม "วันเริ่มป่วย"
 *   - กรมควบคุมโรครายงานสะสมตั้งแต่ 1 ม.ค. ("ปี พ.ศ. 2568 ผู้ป่วยสะสม 38,687 ราย")
 *   - epidemic curve นิยามว่านับตามวันเริ่มป่วย ไม่ใช่วันแจ้ง (วันแจ้งช้ากว่าได้หลายวัน)
 *   - ต่างจากไข้หวัดใหญ่ที่ฤดูระบาดคร่อมปีใหม่ ของเราพีคหน้าฝน จบในปีปฏิทินเดียว
 *
 * ไม่มีมาตรฐานไหนเก็บปีระบาดเป็นคอลัมน์ (ทั้ง HOSxP rpt_506ds และ 43 แฟ้ม surveillance)
 * มันเป็นวิธีตัดรายงาน ไม่ใช่ข้อมูล — จึงคิดที่นี่ที่เดียว ไม่เพิ่มคอลัมน์ในตาราง
 *
 * ข้อมูลย้อนหลังไม่ถูกลบ: หน้าทำงานประจำวันกรองปีปัจจุบัน ส่วนแดชบอร์ดยังเทียบ
 * ค่ามัธยฐาน 5 ปีย้อนหลังได้ครบ
 */
/** ในโค้ดกับ URL เป็น ค.ศ. บนจอเป็น พ.ศ. */
export const toBE = (year: number) => year + 543

/** ค่าใน query string ที่แปลว่า "ไม่กรองปี" */
export const ALL_YEARS = 'all'

const TH_OFFSET_MS = 7 * 3_600_000   // ไทย UTC+7 คงที่ ไม่มี DST

/** ปีระบาดปัจจุบันตามเวลาไทย — 31 ธ.ค. สี่ทุ่มครึ่ง UTC ที่ไทยขึ้นปีใหม่แล้ว */
export function currentEpiYear(now: Date = new Date()) {
  return new Date(now.getTime() + TH_OFFSET_MS).getUTCFullYear()
}

/** จำนวนปีที่เอามาเทียบกันบนกราฟแดชบอร์ด */
export const COMPARE_YEARS = 3

/**
 * สัปดาห์ที่เท่าไรของปีระบาด (1–52) — ตัดทุก 7 วันนับจาก 1 ม.ค. สัปดาห์ 52 จึงยาว 8–9 วัน
 * จงใจไม่ใช้สัปดาห์ ISO: ISO ให้ 1 ม.ค. ไปโผล่เป็นสัปดาห์ 52/53 ของปีก่อนได้
 * เส้นปีใหม่จะกระโดดไปจบขวาสุดของกราฟ และสัปดาห์เดียวกันของแต่ละปีจะไม่ตรงตำแหน่งปฏิทินกัน
 * ต้องตรงกับสูตรใน SQL ของแดชบอร์ด: least((doy - 1) / 7 + 1, 52)
 */
export function epiWeek(d: Date) {
  const days = (d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000
  return Math.min(52, Math.floor(days / 7) + 1)
}

/** สัปดาห์ระบาดปัจจุบันตามเวลาไทย — ใช้ตัดเส้นปีนี้ ไม่ให้ดิ่งเป็น 0 ไปจนสิ้นปี */
export function currentEpiWeek(now: Date = new Date()) {
  return epiWeek(new Date(now.getTime() + TH_OFFSET_MS))
}

/** ปีระบาดที่เลือกอยู่ — null = ทุกปี · ค่าเพี้ยน/ไม่ส่งมา = ปีปัจจุบัน */
export function epiYearOf(v: string | string[] | undefined): number | null {
  if (v === ALL_YEARS) return null
  const n = Number(typeof v === 'string' ? v : NaN)
  return Number.isInteger(n) && n >= 2000 && n <= 2999 ? n : currentEpiYear()
}

/**
 * เงื่อนไข date_onset ของ prisma — undefined = ไม่กรอง
 * date_onset เป็น date ล้วน prisma เทียบที่เที่ยงคืน UTC ตรง ๆ ไม่ต้องขยับ timezone
 */
export function epiWhere(v: string | string[] | undefined) {
  const year = epiYearOf(v)
  if (year === null) return undefined
  return { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) }
}
