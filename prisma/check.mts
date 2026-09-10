// ตรวจว่า prisma model ตรงกับ DB จริง: npx tsx prisma/check.ts
import 'dotenv/config'  // next โหลด .env ให้เอง สคริปต์นอก next ต้องโหลดเอง
import assert from 'node:assert/strict'
import { prisma } from '../src/lib/db'

const eq = (a: unknown, b: unknown, m: string) => assert.deepEqual(a, b, m)

const df = await prisma.c_disease.findUniqueOrThrow({ where: { code: '66' } })
eq(df.icd10, ['A90'], 'text[] ต้อง map เป็น string[]')
eq(df.control_radius_m, 100, 'ค่าปรับรายโรคต้องอ่านได้')

// view + materialized view ต้อง query ผ่าน client ได้ ไม่ใช่แค่ raw
// prisma 7 บังคับ orderBy เมื่อใส่ take
await prisma.v_case_activity.findMany({ take: 1, orderBy: { case_id: 'asc' } })
const inbox = await prisma.v_case_inbox.findMany({ take: 1, orderBy: { id: 'asc' } })
if (inbox.length) assert.ok(typeof inbox[0].lat === 'number', 'inbox ต้องส่งพิกัดเป็น lat/lon ไม่ใช่ geometry ดิบ')
await prisma.v_case_status.findMany({ take: 1, orderBy: { id: 'asc' } })
await prisma.mv_case_daily.findMany({ take: 1, orderBy: { date_onset: 'asc' } })

// เคสมีประวัติการรับได้หลายแถว (partial unique index ห้าม prisma มองเป็น 1:1)
const rel = await prisma.case_report.findMany({
  take: 1,
  orderBy: { id: 'asc' },
  include: { case_acceptance: true, case_activity: true, case_document: true },
})
if (rel.length) assert.ok(Array.isArray(rel[0].case_acceptance), 'case_acceptance ต้องเป็น array')

// geometry เป็น Unsupported: select ทั้งแถวต้องไม่พัง
await prisma.case_report.findMany({ take: 1, orderBy: { id: 'asc' } })

// adapter-pg เขียนทับ offset ของ timestamptz เป็น +00:00 เสมอ session จึงต้องเป็น UTC
const [{ TimeZone: tz }] = await prisma.$queryRaw<{ TimeZone: string }[]>`SHOW timezone`
eq(tz, 'UTC', 'session ฝั่ง prisma ต้องเป็น UTC — เช็ก options ใน src/lib/db.ts')

// timestamptz ต้องกลับมาเป็น instant เดิม (created_at ของ seed)
const seeded = await prisma.case_report.findUnique({ where: { case_no: '65-2026-000002' } })
if (seeded) {
  eq(seeded.date_report?.toISOString(), '2026-09-05T00:00:00.000Z', 'date ต้องไม่ถูก timezone เลื่อนวัน')
}

eq(await prisma.c_activity_type.count(), 9, 'activity_type ต้องมี 9 รหัส (รวม REPORT/ACCEPT)')
eq(await prisma.c_occupation.count(), 15, 'occupation ต้องมี 15 รหัส')

// lookup ที่ import จาก legacy
const areas = await prisma.c_area.groupBy({ by: ['level'], _count: true, orderBy: { level: 'asc' } })
eq(areas.map((a) => [a.level, a._count]), [[1, 1], [2, 10], [3, 93], [4, 1117]],
  'c_area ต้องมีครบ 4 ชั้น (จว./อำเภอ/ตำบล/หมู่บ้าน) จาก legacy')
assert.ok(await prisma.c_org.count() >= 212, 'c_org ต้องมีสถานพยาบาลจาก legacy')
eq((await prisma.c_org.findUniqueOrThrow({ where: { code: '10676' } })).name, 'รพ.พุทธชินราช',
  'chospital เป็น tis620 — ถ้าเพี้ยนแปลว่า CONVERT ใน import_legacy.mjs หลุด')
assert.ok(await prisma.c_org_area.count() >= 1299, 'c_org_area ต้องมีพื้นที่รับผิดชอบจาก legacy')
eq((await prisma.c_area.findUniqueOrThrow({ where: { code: '6501' } })).name, 'เมืองพิษณุโลก',
  'ภาษาไทยต้องไม่เพี้ยนตอน import')

console.log('prisma check: PASS')
await prisma.$disconnect()
