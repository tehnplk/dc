// npx tsx --test src/lib/role.test.mts
import assert from 'node:assert/strict'
import test from 'node:test'
import { EDIT_WINDOW_DAYS, canEditCase, reportedAt } from './role'

// แจ้งวันที่ 12 ก.ย. 2026 เวลา 12:34 น. (ไทย) — prisma คืนมาหน้าตาแบบนี้
const CASE = {
  report_org_code: '10676',
  date_report: new Date('2026-09-12T00:00:00.000Z'),
  time_report: new Date('1970-01-01T12:34:00.000Z'),
}
const HOSPITAL = { role: 'hospital', org_code: '10676' }
// นับจากเที่ยงคืนของวันที่รายงาน ไม่ใช่จากนาทีที่แจ้ง
const DAY_START = reportedAt({ ...CASE, time_report: null }).getTime()
const daysAfter = (d: number) => new Date(DAY_START + d * 86_400_000)

test('reportedAt ตรงกับ th_ts() ของ DB (เวลาไทย 12:34 = 05:34Z)', () => {
  assert.equal(reportedAt(CASE).toISOString(), '2026-09-12T05:34:00.000Z')
  assert.equal(reportedAt({ ...CASE, time_report: null }).toISOString(), '2026-09-11T17:00:00.000Z')
})

test('หน่วยบริการเจ้าของเคสแก้ได้จนครบ 30 วัน', () => {
  assert.equal(canEditCase(HOSPITAL, CASE, daysAfter(0)), true)
  assert.equal(canEditCase(HOSPITAL, CASE, daysAfter(29.9)), true)
  assert.equal(canEditCase(HOSPITAL, CASE, daysAfter(EDIT_WINDOW_DAYS)), false, 'ครบ 30 วันพอดีถือว่าหมดสิทธิ')
  assert.equal(canEditCase(HOSPITAL, CASE, daysAfter(45)), false)
})

test('หน่วยอื่นและบทบาทอื่นแก้ไม่ได้ แม้ยังอยู่ในเวลา', () => {
  const now = daysAfter(1)
  assert.equal(canEditCase({ role: 'hospital', org_code: '07477' }, CASE, now), false, 'คนละหน่วยงาน')
  assert.equal(canEditCase({ role: 'province', org_code: '10676' }, CASE, now), false)
  assert.equal(canEditCase({ role: 'district', org_code: '10676' }, CASE, now), false)
})
