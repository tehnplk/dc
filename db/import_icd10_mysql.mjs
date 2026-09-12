// ดึงชุดรหัส ICD-10 จาก icd101 ใน mariadb (docker) เข้าตาราง c_icd10
//   npm run db:import:icd10:my
// ใช้ชุดของ hos11253 เพราะมีชื่อไทยครบเกือบทุกรหัส (97%) ต่างจากชุดอื่นที่มีไม่ถึง 20%
// รันซ้ำได้ (upsert ด้วย code)
import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import pg from 'pg'

const SRC = process.env.ICD10_MYSQL_DB ?? 'hos11253'
const MYSQL = ['exec', '-i', 'mariadb', 'mariadb', '-uroot', '-p112233',
  '--default-character-set=utf8mb4', '-N', '-B', '--raw', SRC, '-e']

// JSON_ARRAYAGG ทำ charset conversion หลุด ต้อง CONVERT คอลัมน์ข้อความเอง ไม่งั้นภาษาไทยเพี้ยนเงียบ ๆ
const out = execFileSync('docker', [...MYSQL,
  `SET SESSION group_concat_max_len = 1073741824;
   SELECT JSON_ARRAYAGG(JSON_OBJECT(
     'code', code,
     'name', CONVERT(name USING utf8mb4),
     'tname', NULLIF(TRIM(CONVERT(tname USING utf8mb4)), ''),
     'code3', code3)) FROM icd101`],
  { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })

const rows = JSON.parse(out.trim().split('\n').pop())
console.log(`  อ่านจาก ${SRC}.icd101 ${rows.length} แถว`)

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
for (let i = 0; i < rows.length; i += 5000) {
  const c = rows.slice(i, i + 5000)
  await db.query(
    `INSERT INTO c_icd10 (code, name, tname, code3)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
     ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name, tname = EXCLUDED.tname, code3 = EXCLUDED.code3`,
    [c.map((r) => r.code), c.map((r) => r.name), c.map((r) => r.tname), c.map((r) => r.code3)])
}

const [{ count }] = (await db.query('SELECT count(*)::int FROM c_icd10')).rows
const [{ th }] = (await db.query('SELECT count(tname)::int AS th FROM c_icd10')).rows
console.log(`เสร็จ — c_icd10 ${count} แถว มีชื่อไทย ${th}`)
await db.end()
