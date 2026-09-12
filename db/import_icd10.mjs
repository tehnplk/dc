// ดึงชุดรหัส ICD-10 จาก icd101 ของ HOSxP เข้าตาราง c_icd10
//   npm run db:import:icd10
// รันซ้ำได้ (upsert ด้วย code) ต้องตั้ง BMS_URL / BMS_TOKEN ใน .env ก่อน — ดู HOSXP_API.md
//
// ทางเลือกที่ดีกว่าถ้าเข้าถึง mariadb ได้: npm run db:import:icd10:my
// ชุดใน hos11253 มีชื่อไทยครบ 97% ส่วนชุดที่มาทาง API มีแค่ 18%
import 'dotenv/config'
import pg from 'pg'

const { BMS_URL, BMS_TOKEN } = process.env
if (!BMS_URL || !BMS_TOKEN) throw new Error('ต้องตั้ง BMS_URL และ BMS_TOKEN ใน .env (ดู HOSXP_API.md)')

const PAGE = 5000

async function sql(text, params) {
  const res = await fetch(`${BMS_URL}/api/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BMS_TOKEN}` },
    body: JSON.stringify({ sql: text, app: 'BMS.PlkSrrt.Import', params }),
    signal: AbortSignal.timeout(90_000),
  })
  const body = await res.json()
  // API ตอบ 200 เสมอในระดับ HTTP ความผิดพลาดจริงอยู่ใน MessageCode
  if (body.MessageCode !== 200) throw new Error(`HOSxP ${body.MessageCode}: ${body.Message}`)
  return body.data ?? []
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()

let offset = 0
let total = 0
for (;;) {
  // เรียงตาม code เพื่อให้ LIMIT/OFFSET เดินหน้าได้แน่นอน ไม่ข้าม/ซ้ำแถว
  const rows = await sql(
    'SELECT code, name, tname, code3 FROM icd101 ORDER BY code LIMIT :lim OFFSET :off',
    { lim: { value: PAGE, value_type: 'integer' }, off: { value: offset, value_type: 'integer' } },
  )
  if (!rows.length) break

  // ยัดทีละก้อนด้วย unnest เร็วกว่าไล่ INSERT ทีละแถวมาก
  await db.query(
    `INSERT INTO c_icd10 (code, name, tname, code3)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
     ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name, tname = EXCLUDED.tname, code3 = EXCLUDED.code3`,
    [rows.map((r) => r.code), rows.map((r) => r.name), rows.map((r) => r.tname), rows.map((r) => r.code3)],
  )

  total += rows.length
  offset += PAGE
  console.log(`  ${total} แถว`)
  if (rows.length < PAGE) break
}

const [{ count }] = (await db.query('SELECT count(*)::int FROM c_icd10')).rows
console.log(`เสร็จ — c_icd10 ${count} แถว`)
await db.end()
