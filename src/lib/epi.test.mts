// npx tsx --test src/lib/epi.test.mts
import assert from 'node:assert/strict'
import test from 'node:test'
import { ALL_YEARS, currentEpiWeek, currentEpiYear, epiWeek, epiWhere, epiYearOf, toBE } from './epi'

test('ปีระบาดขึ้นปีใหม่ตามเวลาไทย ไม่ใช่ UTC', () => {
  // 31 ธ.ค. 2026 เวลา 17:00 UTC = 1 ม.ค. 2027 เวลาไทย -> ขึ้นปีระบาดใหม่แล้ว
  assert.equal(currentEpiYear(new Date('2026-12-31T17:00:00Z')), 2027)
  assert.equal(currentEpiYear(new Date('2026-12-31T16:59:59Z')), 2026)
  assert.equal(toBE(2026), 2569)
})

test('ไม่ส่งมาหรือค่าเพี้ยน = ปีปัจจุบัน, all = ทุกปี', () => {
  const now = currentEpiYear()
  assert.equal(epiYearOf(undefined), now)
  assert.equal(epiYearOf('ขยะ'), now)
  assert.equal(epiYearOf('1999'), now)            // นอกช่วงที่รับ
  assert.equal(epiYearOf(['2025']), now)          // ?year=a&year=b
  assert.equal(epiYearOf('2025'), 2025)
  assert.equal(epiYearOf(ALL_YEARS), null)
  assert.equal(epiWhere(ALL_YEARS), undefined)
})

test('ขอบปี: 31 ธ.ค. อยู่ปีเดิม 1 ม.ค. อยู่ปีใหม่', () => {
  const w = epiWhere('2025')!
  const inYear = (d: string) => new Date(d) >= w.gte && new Date(d) < w.lt
  assert.ok(inYear('2025-01-01T00:00:00Z'))       // วันแรกของปีระบาด 2568
  assert.ok(inYear('2025-12-31T00:00:00Z'))       // วันสุดท้าย
  assert.ok(!inYear('2024-12-31T00:00:00Z'))
  assert.ok(!inYear('2026-01-01T00:00:00Z'))
})

test('สัปดาห์ระบาดตัดทุก 7 วันจาก 1 ม.ค. และหยุดที่ 52', () => {
  const w = (d: string) => epiWeek(new Date(d))
  assert.equal(w('2026-01-01T00:00:00Z'), 1)
  assert.equal(w('2026-01-07T00:00:00Z'), 1)     // วันที่ 7 ยังสัปดาห์ 1
  assert.equal(w('2026-01-08T00:00:00Z'), 2)
  assert.equal(w('2025-12-24T00:00:00Z'), 52)
  assert.equal(w('2025-12-31T00:00:00Z'), 52)    // ปกติได้ 53 แต่ยุบเข้าสัปดาห์ 52
  assert.equal(w('2024-12-31T00:00:00Z'), 52)    // ปีอธิกสุรทิน
  // ปีใหม่ต้องกลับไปสัปดาห์ 1 เสมอ (ISO week จะให้เป็น 52/53 ของปีก่อน)
  assert.equal(w('2027-01-01T00:00:00Z'), 1)
})

test('สัปดาห์ระบาดปัจจุบันใช้เวลาไทย', () => {
  // 7 ม.ค. 2026 เวลา 17:00 UTC = 8 ม.ค. ที่ไทย -> ขึ้นสัปดาห์ 2 แล้ว
  assert.equal(currentEpiWeek(new Date('2026-01-07T17:00:00Z')), 2)
  assert.equal(currentEpiWeek(new Date('2026-01-07T16:59:59Z')), 1)
})
