/**
 * ปีระบาดฝั่งที่ต้องคุย DB — แยกจาก epi.ts ที่เป็นตรรกะล้วน
 * (แบบเดียวกับ role.ts / scope.ts) เพราะ epi.ts ถูก client component import
 * ถ้าเอา prisma ไปไว้ที่นั่น bundler จะลาก pg เข้า client bundle แล้วพังที่ 'dns'
 */
import { prisma } from './db'
import { ALL_YEARS, currentEpiYear, toBE } from './epi'

/**
 * ตัวเลือกในดรอปดาวน์ — เอาเฉพาะปีที่มีเคสจริง จะได้ไม่โชว์ปีที่ระบบยังไม่เกิด
 * ใส่ปีปัจจุบันไว้เสมอ ไม่งั้นต้นปีใหม่ที่ยังไม่มีเคส ตัวเลือกที่เลือกอยู่จะหายไปจากลิสต์
 */
export async function epiYearOpts() {
  const rows = await prisma.$queryRaw<{ y: number }[]>`
    SELECT DISTINCT extract(year from date_onset)::int AS y
    FROM case_report WHERE deleted_at IS NULL ORDER BY 1 DESC`
  const years = [...new Set([currentEpiYear(), ...rows.map((r) => r.y)])].sort((a, b) => b - a)
  return [
    ...years.map((y) => ({ code: String(y), name: `ปีระบาด ${toBE(y)}` })),
    { code: ALL_YEARS, name: 'ทุกปีระบาด' },
  ]
}
