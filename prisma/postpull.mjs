// สิ่งที่ prisma db pull ทับทิ้งทุกครั้ง — รันต่อท้ายเสมอ (npm run db:pull)
// idempotent: รันซ้ำได้ ไม่พัง
import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('./schema.prisma', import.meta.url)
let s = readFileSync(path, 'utf8')

// 1) partial unique index (case_accept_one_active) ทำให้ prisma มองเป็น 1:1
//    แต่ case_acceptance เก็บประวัติการรับ/คืนเคสหลายแถว ต้องเป็น 1:many
//    DB ยังบังคับ partial unique ไว้เหมือนเดิม แค่ไม่บอก prisma
s = s.replace(/\s*@unique\(map: "case_accept_one_active"[^)]*\)\)/g, '')
s = s.replace(/^(\s*case_acceptance\s+)case_acceptance\?(\s*)$/m, '$1case_acceptance[]$2')

// 2) ชื่อ back-relation ที่ introspect มา ยาวจนใช้ไม่ไหว
const rename = {
  case_acceptance_case_acceptance_accepted_byToapp_user: 'accepted_cases',
  case_acceptance_case_acceptance_released_byToapp_user: 'released_cases',
  case_activity_case_activity_created_byToapp_user: 'created_activities',
  case_activity_case_activity_updated_byToapp_user: 'updated_activities',
  case_document_case_document_approved_byToapp_user: 'approved_documents',
  case_document_case_document_created_byToapp_user: 'created_documents',
  case_document_case_document_updated_byToapp_user: 'updated_documents',
  case_report_case_report_created_byToapp_user: 'created_cases',
  case_report_case_report_deleted_byToapp_user: 'deleted_cases',
  case_report_case_report_updated_byToapp_user: 'updated_cases',
  app_user_case_acceptance_accepted_byToapp_user: 'accepted_by_user',
  app_user_case_acceptance_released_byToapp_user: 'released_by_user',
  app_user_case_activity_created_byToapp_user: 'created_by_user',
  app_user_case_activity_updated_byToapp_user: 'updated_by_user',
  app_user_case_document_approved_byToapp_user: 'approved_by_user',
  app_user_case_document_created_byToapp_user: 'created_by_user',
  app_user_case_document_updated_byToapp_user: 'updated_by_user',
  app_user_case_report_created_byToapp_user: 'created_by_user',
  app_user_case_report_deleted_byToapp_user: 'deleted_by_user',
  app_user_case_report_updated_byToapp_user: 'updated_by_user',
}
for (const [from, to] of Object.entries(rename)) {
  s = s.replace(new RegExp(`^(\\s*)${from}(\\s+)`, 'gm'), `$1${to}$2`)
}

// 3) materialized view — db pull มองไม่เห็น ต้องเติมกลับเอง
if (!s.includes('view mv_case_daily')) {
  s = `${s.trimEnd()}

/// materialized view — prisma db pull มองไม่เห็น postpull.mjs เติมกลับให้
/// REFRESH MATERIALIZED VIEW CONCURRENTLY mv_case_daily;
view mv_case_daily {
  disease_code String
  date_onset   DateTime @db.Date
  prov_code    String?
  amp_code     String?
  tmb_code     String?
  moo_code     String
  cases        BigInt
  deaths       BigInt
  controlled   BigInt
  cases_child  BigInt

  @@unique([disease_code, date_onset, moo_code])
}
`
}

writeFileSync(path, s)
console.log('postpull: patched')
