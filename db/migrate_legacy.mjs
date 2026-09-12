// ย้าย "ข้อมูลจริง" จากระบบเดิม (mariadb: mosquito) เข้าระบบใหม่
//   npm run db:migrate
//
//   patient_hos -> case_report (+ case_acceptance)   patient_dc -> case_activity   user -> users
//
// ล้างเคส/การรับ/กิจกรรม/เอกสาร/log ทั้งหมดก่อนเสมอ (ข้อมูลตัวอย่างหายด้วย) แล้วใส่ใหม่ทั้งชุด
// -> รันซ้ำได้ตลอด ผลลัพธ์เหมือนเดิมทุกครั้ง  ไม่แตะตาราง c_* และไม่แตะบัญชีผู้ใช้ที่มีอยู่
// ต้องรัน `npm run db:import` (lookup) ก่อน
// ข้ามมาเลย: sheet (staging), count_dc (ตัวนับ), patient_view_log (log เปิดดู), pic (ว่างทั้งตาราง)
import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import pg from 'pg'

const MYSQL = ['exec', '-i', 'mariadb', 'mariadb', '-uroot', '-p112233',
  '--default-character-set=utf8mb4', '-N', '-B', '--raw', 'mosquito', '-e']

function q(sql) {
  const out = execFileSync('docker',
    [...MYSQL, `SET SESSION group_concat_max_len = 1073741824; ${sql}`],
    { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  const json = out.trim().split('\n').pop()
  return json && json !== 'NULL' ? JSON.parse(json) : []
}
// JSON_ARRAYAGG ทำ charset conversion หลุด ต้อง CONVERT คอลัมน์ข้อความเอง (ดู import_legacy.mjs)
const t = (c) => `'${c}',CONVERT(${c} USING utf8mb4)`
const n = (c) => `'${c}',${c}`

const nz = (v) => (v === null || v === undefined || v === '' ? null : v)
// mysql ยอมให้เก็บ '0000-00-00' postgres ไม่ยอม — ถือว่าไม่มีค่า
const dt = (v) => (nz(v) && !v.startsWith('0000') ? v : null)
// datetime ของระบบเดิมเป็นเวลาไทยล้วน ไม่มี timezone
const ts = (v) => (dt(v) ? `${v}+07` : null)
const day = (v) => (dt(v) ? `${v} 00:00:00+07` : null)
const json = (o) => JSON.stringify(Object.fromEntries(
  Object.entries(o).filter(([, v]) => nz(v) !== null)))

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, options: '-c timezone=UTC' })

async function insert(table, cols, rows, tail = '') {
  const out = []
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const values = chunk.map((_, r) =>
      `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(',')})`).join(',')
    const res = await db.query(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES ${values} ${tail}`,
      chunk.flatMap((r) => cols.map((c) => r[c] ?? null)))
    out.push(...res.rows)
  }
  console.log(`  ${table.padEnd(16)} ${rows.length}`)
  return out
}

await db.connect()
await db.query('BEGIN')
console.log('ย้ายข้อมูลจริงจาก legacy (mosquito) — ล้างเคสเดิม/ข้อมูลตัวอย่างก่อน ->')

// ---- 0. หน่วยงานที่ chospital ไม่มี แต่มีผู้ใช้/เคสอ้างถึง (ศูนย์อนามัยที่ 2)
await db.query(
  `INSERT INTO c_org (code,name,org_type) VALUES ('14622','ศูนย์อนามัยที่ 2','18')
   ON CONFLICT (code) DO NOTHING`)

// ---- 1. ผู้ใช้ระบบเดิม — เก็บไว้เพื่ออ้างอิงประวัติเท่านั้น (ผู้แจ้ง/ผู้รับ/ผู้ลบ)
// ระบบใหม่ล็อกอินด้วย SSO เท่านั้น แถวพวกนี้จึงปิดใช้งาน + soft delete ไว้ ไม่ให้ไปโผล่ในหน้าผู้ดูแล
// password_hash = '!' เป็นค่าที่ verify ไม่ผ่านแน่ ๆ (schema บังคับให้มี sso_sub หรือ password_hash อย่างน้อยหนึ่ง)
const ROLE = { pro: 'province', amp: 'district', hos: 'hospital', pcu: 'hospital' }
const lusers = q(`SELECT JSON_ARRAYAGG(JSON_OBJECT(${[n('id'), n('username'), n('hoscode'),
  n('role'), n('email'), n('countlogin'), n('lastlogin')].join(',')})) FROM user`)

await insert('users',
  ['username', 'password_hash', 'full_name', 'email', 'org_code', 'role', 'is_active', 'login_count', 'last_login_at', 'deleted_at'],
  lusers.map((u) => ({
    username: u.username, password_hash: '!', full_name: 'ระบบเดิม', email: nz(u.email),
    org_code: u.hoscode, role: ROLE[u.role] ?? 'hospital',
    is_active: false, login_count: u.countlogin ?? 0,
    last_login_at: ts(u.lastlogin), deleted_at: new Date(),
  })),
  // รันซ้ำได้: อัปเดตเฉพาะแถวที่สคริปต์นี้สร้างไว้เอง ไม่แตะบัญชีจริง/บัญชีตัวอย่าง
  `ON CONFLICT (username) DO UPDATE SET
     full_name = EXCLUDED.full_name, org_code = EXCLUDED.org_code, role = EXCLUDED.role,
     login_count = EXCLUDED.login_count, last_login_at = EXCLUDED.last_login_at
   WHERE users.password_hash = '!'`)

// legacy user.id -> users.id (จับคู่ด้วย username เพราะ id ฝั่งใหม่ระบบเดินเลขเอง)
const { rows: urows } = await db.query('SELECT id, username FROM users WHERE username = ANY($1)',
  [lusers.map((u) => u.username)])
const byName = new Map(urows.map((r) => [r.username, Number(r.id)]))
const U = new Map(lusers.map((u) => [u.id, byName.get(u.username)]))
// created_by/updated_by/deleted_by ของ patient_hos เป็น varchar — JSON ส่งมาเป็นสตริง ต้องแปลงก่อนเทียบ
const uid = (v) => U.get(Number(v)) ?? null

// หน่วยงานไหนใช้ใครเป็น "ผู้กดรับ" ได้บ้าง — trigger บังคับว่าต้องเป็น province/hospital
// ระบบเดิมเก็บแค่ accepted_hoscode ไม่เก็บว่าใครกด เลยต้องเลือกตัวแทนของหน่วยนั้นให้
const roleOf = new Map(lusers.map((u) => [u.id, ROLE[u.role] ?? 'hospital']))
const orgOf = new Map(lusers.map((u) => [u.id, u.hoscode]))
const rep = new Map()
for (const u of lusers) {
  if (roleOf.get(u.id) !== 'district' && !rep.has(u.hoscode)) rep.set(u.hoscode, U.get(u.id))
}
// ถ้าคนที่แก้ไขเคสล่าสุดสังกัดหน่วยที่รับเคสอยู่แล้ว ใช้คนนั้น (ตรงความจริงกว่าตัวแทน)
const actor = (org, h) => {
  const hint = Number(h)
  return (orgOf.get(hint) === org && roleOf.get(hint) !== 'district'
    ? U.get(hint) : undefined) ?? rep.get(org)
}

// ---- 2. ล้างเคสเดิมทั้งหมด (รวมข้อมูลตัวอย่างที่ seed ไว้)
await db.query('TRUNCATE case_report, case_acceptance, case_activity, case_document, case_view_log RESTART IDENTITY CASCADE')

// ---- 3. เคส
const CASE_COLS = [n('id'), n('hoscode'), t('hn'), n('cid'), t('pname'), t('fname'), t('lname'),
  t('gender'), n('birth_date'), n('age_y'), n('age_m'), n('occupat'), n('moo'), t('street'),
  t('place'), t('addr'), n('tel'), t('family'), t('addr_note'), n('date_sick'), n('date_visit'),
  t('symptom'), n('dx'), n('date_dx'), t('doctor'), t('lab'), n('date_discharge'), t('note'),
  t('reporter'), t('reporter_position'), n('reporter_tel'), n('created_at'), n('created_by'),
  n('updated_at'), n('updated_by'), n('accepted_hoscode'), n('accepted_at'), t('accepted_note'),
  n('accepted_reject_at'), t('accepted_reject_note'), n('deleted_at'), n('deleted_by'), t('deleted_note')]
const lcases = q(`SELECT JSON_ARRAYAGG(JSON_OBJECT(${CASE_COLS.join(',')})) FROM patient_hos`)

const GENDER = { 'ชาย': 'M', 'หญิง': 'F' }
let swapped = 0
const caseRows = lcases.map((p) => {
  // CHECK (date_onset <= date_visit) — ระบบเดิมไม่กัน มีวันพบมาก่อนวันเริ่มป่วยอยู่บ้าง
  // เอาวันที่เร็วกว่าเป็นวันเริ่มป่วย (ต้องป่วยก่อนถึงไปหาหมอได้) ดีกว่าทิ้งวันพบ
  let date_onset = dt(p.date_sick)
  const date_visit = dt(p.date_visit)
  if (date_visit && date_visit < date_onset) { date_onset = date_visit; swapped++ }
  return {
    // เลขทะเบียนอิง id เดิม ตามหาย้อนกลับได้ และรันซ้ำได้เลขเดิมเสมอ
    case_no: `65-${p.created_at.slice(0, 4)}-${String(p.id).padStart(6, '0')}`,
    disease_code: p.dx,
    cid: nz(p.cid), hn: nz(p.hn),
    pname: nz(p.pname), fname: nz(p.fname), lname: nz(p.lname),
    gender: GENDER[p.gender] ?? null,
    birth_date: dt(p.birth_date), age_y: p.age_y, age_m: p.age_m,
    occupation_code: nz(p.occupat),
    area_code: p.moo,
    addr_no: nz(p.addr),
    // หมู่ที่ = 2 หลักท้ายรหัสพื้นที่ ('00' = เขตเทศบาล ไม่มีหมู่) ให้ตรงกับ createCase
    moo: p.moo && p.moo.slice(6) !== '00' ? String(Number(p.moo.slice(6))) : null,
    street: nz(p.street), place_name: nz(p.place), tel: nz(p.tel),
    date_onset, date_visit, date_dx: dt(p.date_dx), date_discharge: dt(p.date_discharge),
    symptom: nz(p.symptom),
    lab_result: json({ note: p.lab }),   // ระบบเดิมเก็บผลแลบเป็นข้อความก้อนเดียว
    // ช่องที่ระบบใหม่ยังไม่มีคอลัมน์ให้ เก็บไว้ใน detail ไม่ให้หาย
    detail: json({ legacy_id: p.id, doctor: p.doctor, family: p.family,
                   addr_note: p.addr_note, note: p.note, accepted_note: p.accepted_note }),
    report_org_code: p.hoscode,
    reporter_name: nz(p.reporter), reporter_position: nz(p.reporter_position),
    reporter_tel: nz(p.reporter_tel),
    date_report: p.created_at.slice(0, 10), time_report: p.created_at.slice(11, 19),
    created_at: ts(p.created_at), created_by: uid(p.created_by),
    updated_at: ts(p.updated_at ?? p.created_at), updated_by: uid(p.updated_by),
    deleted_at: day(p.deleted_at), deleted_by: uid(p.deleted_by),
    delete_reason: nz(p.deleted_note),
  }
})

const inserted = await insert('case_report', Object.keys(caseRows[0]), caseRows, 'RETURNING id, case_no')
const ID = new Map(inserted.map((r) => [Number(r.case_no.slice(-6)), Number(r.id)]))

// ---- 4. การรับเคส
// ระบบเดิมมีช่องเดียว (accepted_hoscode + accepted_at) ไม่เก็บประวัติ
//   accepted_at ว่าง = ยังไม่มีใครรับจริง — รวมพวกที่ถูกยัด '00051'/'ยังไม่รับ' ไว้เป็นที่พักเคส
//   ระบบใหม่ไม่ต้องมีที่พัก เคสที่ไม่มีใครรับก็ค้างในรายการรอรับตามปกติ
const acc = []
for (const p of lcases) {
  const case_id = ID.get(p.id)
  // เคยมีหน่วยรับแล้วคืน — ระบบเดิมเก็บเป็น "<hoscode>-<เหตุผล>" ไม่เก็บว่ารับเมื่อไร
  // ใช้วันคืนเป็นวันรับด้วย จะได้เห็นรอยใน case_journey_log
  if (dt(p.accepted_reject_at) && p.accepted_reject_note) {
    const i = p.accepted_reject_note.indexOf('-')
    const org = p.accepted_reject_note.slice(0, i)
    const by = actor(org)
    if (by) acc.push({
      case_id, org_code: org, date_accept: p.accepted_reject_at, time_accept: null,
      accepted_by: by, status: 'released',
      released_at: day(p.accepted_reject_at), released_by: by,
      note: nz(p.accepted_reject_note.slice(i + 1).trim()),
    })
  }
  if (dt(p.accepted_at) && rep.has(p.accepted_hoscode)) acc.push({
    case_id, org_code: p.accepted_hoscode,
    date_accept: p.accepted_at.slice(0, 10), time_accept: p.accepted_at.slice(11, 19),
    accepted_by: actor(p.accepted_hoscode, p.updated_by), status: 'active',
    released_at: null, released_by: null, note: null,
  })
}
// released ก่อน active: unique index ห้ามมี active ซ้ำต่อเคส
acc.sort((a, b) => Number(a.status === 'active') - Number(b.status === 'active'))
await insert('case_acceptance', Object.keys(acc[0]), acc)

// ---- 5. กิจกรรมควบคุมโรค
// ระบบเดิมเก็บเป็นข้อความก้อนเดียว ไม่มีรหัสกิจกรรม — เดารหัสจากข้อความเสี่ยงผิดกว่าปล่อยชื่อกลาง ๆ
const lact = q(`SELECT JSON_ARRAYAGG(JSON_OBJECT(${[n('patient_id'), n('dc_date'), t('dc_note'),
  n('hoscode'), n('created_at'), n('created_by'), n('updated_at'), n('updated_by')].join(',')})) FROM patient_dc`)

const actRows = lact.map((a) => ({
  case_id: ID.get(a.patient_id),
  date_act: dt(a.dc_date) ?? a.created_at.slice(0, 10),
  time_act: null, activity_code: null, activity_name: 'ควบคุมโรค',
  performer: null, performer_org: a.hoscode, note: nz(a.dc_note),
  created_at: ts(a.created_at), created_by: uid(a.created_by),
  updated_at: ts(a.updated_at ?? a.created_at), updated_by: uid(a.updated_by),
})).filter((a) => a.case_id)
await insert('case_activity', Object.keys(actRows[0]), actRows)

// ---- 6. เลขทะเบียนของเคสใหม่ต้องเดินต่อจากของเก่า ไม่งั้นชนกันแน่ ๆ
await db.query(`SELECT setval('case_no_seq', greatest($1::bigint, last_value)) FROM case_no_seq`,
  [Math.max(...lcases.map((p) => p.id))])

await db.query('COMMIT')
await db.query('REFRESH MATERIALIZED VIEW mv_case_daily')

const { rows: [s] } = await db.query(`
  SELECT (SELECT count(*) FROM case_report WHERE deleted_at IS NULL) AS live,
         (SELECT count(*) FROM case_report WHERE deleted_at IS NOT NULL) AS del,
         (SELECT count(*) FROM case_report WHERE status = 'accepted' AND deleted_at IS NULL) AS accepted,
         (SELECT count(*) FROM case_report WHERE status = 'reported' AND deleted_at IS NULL) AS waiting`)
console.log(`เสร็จ — เคสใช้งาน ${s.live} (รับแล้ว ${s.accepted} / รอรับ ${s.waiting}) จำหน่าย ${s.del}`)
if (swapped) console.log(`  หมายเหตุ: ${swapped} เคส วันพบมาก่อนวันเริ่มป่วย ใช้วันที่เร็วกว่าเป็นวันเริ่มป่วย`)
await db.end()
