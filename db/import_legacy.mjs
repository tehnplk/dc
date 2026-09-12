// นำเข้า lookup table จาก legacy (mariadb: mosquito) เข้าตาราง c_* ของระบบใหม่
//   npm run db:import
// รันซ้ำได้ (upsert ทุกตาราง) และไม่แตะข้อมูล transaction
//
// อ่านจาก mariadb ผ่าน docker exec + JSON_ARRAYAGG จึงไม่ต้องลง mysql client เพิ่ม
import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import pg from 'pg'

const MYSQL = ['exec', '-i', 'mariadb', 'mariadb', '-uroot', '-p112233',
  '--default-character-set=utf8mb4', '-N', '-B', '--raw', 'mosquito', '-e']

function q(sql) {
  // group_concat_max_len ค่า default ตัด JSON_ARRAYAGG ทิ้งกลางทาง
  const out = execFileSync('docker',
    [...MYSQL, `SET SESSION group_concat_max_len = 1073741824; ${sql}`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  const json = out.trim().split('\n').pop()
  return json && json !== 'NULL' ? JSON.parse(json) : []
}

// legacy ปนกันสองชุดอักขระ: chospital เป็น tis620 ตารางอื่นเป็น utf8mb3
// และ JSON_ARRAYAGG ทำ charset conversion หลุด (JSON_OBJECT เดี่ยว ๆ ไม่หลุด)
// จึงต้อง CONVERT ทุกคอลัมน์ข้อความเอง ไม่งั้นได้ภาษาไทยเพี้ยนแบบเงียบ ๆ
const t = (col) => `CONVERT(${col} USING utf8mb4)`

const rows = (table, cols, where = '') =>
  q(`SELECT JSON_ARRAYAGG(JSON_OBJECT(${cols})) FROM \`${table}\` ${where}`)

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, options: '-c timezone=UTC' })

// insert แบบ upsert ทีละก้อน — ตารางใหญ่สุดพันกว่าแถว ไม่ต้อง COPY
async function upsert(table, cols, conflict, update, data) {
  if (!data.length) return 0
  for (let i = 0; i < data.length; i += 500) {
    const chunk = data.slice(i, i + 500)
    const values = chunk.map((_, r) =>
      `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(',')})`).join(',')
    const set = update.length
      ? `DO UPDATE SET ${update.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}`
      : 'DO NOTHING'
    await db.query(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES ${values}
       ON CONFLICT (${conflict}) ${set}`,
      chunk.flatMap((r) => cols.map((c) => r[c] ?? null)))
  }
  console.log(`  ${table.padEnd(16)} ${data.length}`)
  return data.length
}

await db.connect()
console.log('นำเข้าจาก legacy (mosquito) ->')

// ---- 1. พื้นที่: จังหวัด > อำเภอ > ตำบล > หมู่บ้าน (ต้องเรียงตามชั้น FK จะได้ไม่หลุด)
const PROV = { '65': 'พิษณุโลก' }
// legacy ยัด "(ส่งกลับ)สสจ." เป็นอำเภอปลอมรหัส xx00 ไว้เป็นที่ทิ้งเคสที่ไม่มีเจ้าของ
// ระบบใหม่ไม่ใช้ท่านี้ (คืนเคสมี case_acceptance.status='released' อยู่แล้ว) กรองทิ้งตั้งแต่นำเข้า
const amps = rows('camp', `'code',code,'name',${t('name')},'population',POP`)
  .filter((a) => !a.code.endsWith('00'))
const provCodes = [...new Set(amps.map((a) => a.code.slice(0, 2)))]
await upsert('c_area', ['code', 'level', 'name', 'parent_code', 'population'], 'code',
  ['name'], provCodes.map((code) => ({ code, level: 1, name: PROV[code] ?? code, parent_code: null, population: null })))

await upsert('c_area', ['code', 'level', 'name', 'parent_code', 'population'], 'code',
  ['name', 'population'],
  amps.map((a) => ({ ...a, level: 2, parent_code: a.code.slice(0, 2) })))

await upsert('c_area', ['code', 'level', 'name', 'parent_code', 'population'], 'code',
  ['name', 'population'],
  rows('ctmb', `'code',code,'name',${t('name')},'parent_code',amp,'population',POP`)
    .map((t) => ({ ...t, level: 3 })))

await upsert('c_area', ['code', 'level', 'name', 'parent_code', 'population'], 'code',
  ['name', 'population'],
  rows('cmoo', `'code',code,'name',${t('name')},'parent_code',tmb,'population',POP`)
    .map((m) => ({ ...m, level: 4 })))

// ---- 2. หน่วยงาน: tamboncode '00' คือ สสจ./สสอ. ที่ไม่ผูกตำบล -> area_code ปล่อยว่าง
const areaCodes = new Set((await db.query('SELECT code FROM c_area')).rows.map((r) => r.code))
await upsert('c_org', ['code', 'name', 'org_type', 'area_code', 'is_active'], 'code',
  ['name', 'org_type', 'area_code', 'is_active'],
  rows('chospital', `'code',hoscode,'name',${t('hosname')},'org_type',off_type,` +
    `'area_code',concat(provincecode,amphurcode,tamboncode),'is_active',status_open`)
    .map((o) => ({
      ...o,
      area_code: areaCodes.has(o.area_code) ? o.area_code : null,
      is_active: o.is_active === '1',
    })))

// ---- 3. พื้นที่รับผิดชอบของแต่ละหน่วย (ทิ้งแถวที่ชี้ไปหน่วย/พื้นที่ที่ไม่มีจริง)
// ระบบเดิมให้หมู่บ้านเดียวมีได้หลายหน่วย ระบบใหม่บังคับ 1 หมู่บ้าน = 1 หน่วย
// เลือกรหัสหน่วยน้อยสุดไว้ ผลลัพธ์เหมือนเดิมทุกครั้งที่ import ไม่ขึ้นกับลำดับแถว
const orgCodes = new Set((await db.query('SELECT code FROM c_org')).rows.map((r) => r.code))
const byVillage = new Map()
for (const r of rows('cpcumoo', "'org_code',pcucode,'area_code',moo")) {
  if (!orgCodes.has(r.org_code) || !areaCodes.has(r.area_code)) continue
  const cur = byVillage.get(r.area_code)
  if (!cur || r.org_code < cur.org_code) byVillage.set(r.area_code, r)
}
const pcumoo = [...byVillage.values()]
await upsert('hos_village', ['area_code', 'org_code'], 'area_code', ['org_code'], pcumoo)

// ---- 4. อาชีพ
await upsert('c_occupation', ['code', 'name'], 'code', ['name'],
  rows('coccupat', `'code',code,'name',${t('name')}`))

// ---- 5. โรค: legacy มีแค่รหัส+ชื่อ ค่าตั้งทางระบาดวิทยาที่ seed ไว้ (รัศมี/ระยะฟักตัว/must_report) ต้องไม่ถูกทับ
// name_th อยู่ใน update list ไม่ได้ ไม่งั้นชื่อไทยที่ seed ไว้จะถูกทับด้วยชื่ออังกฤษ
// แต่ต้องส่งค่ามาด้วย เพราะ ON CONFLICT ยังเช็ก NOT NULL ของ tuple ที่จะ insert ก่อนเสมอ
await upsert('c_disease506', ['code', 'name_th', 'name_en'], 'code', ['name_en'],
  rows('cdx', `'code',code,'name_en',${t('name')}`).map((x) => ({ ...x, name_th: x.name_en })))

const [{ count }] = (await db.query('SELECT count(*)::int FROM c_area')).rows
console.log(`เสร็จ — c_area ${count} แถว`)
await db.end()
