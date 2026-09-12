/**
 * สิทธิ์ตามบทบาท — ที่เดียวที่ตอบว่า "ใครทำอะไรได้"
 *
 *   province (สสจ.)      หน่วยกลางทั้งจังหวัด จัดการระบบ และจำหน่ายเคส
 *   district (สสอ.)      ดูแลระดับอำเภอ บันทึกกิจกรรมได้อย่างเดียว ไม่ถือเคส
 *   hospital (หน่วยบริการ) แจ้ง/รับ/คืนเคส และดูแลหมู่บ้านของตัวเอง
 *
 * ไฟล์นี้เป็นกติกาล้วน ๆ ไม่แตะ DB — เงื่อนไข "พื้นที่ไหน" อยู่ที่ scope.ts
 * ทั้งหน้าเว็บและ server action ต้องเรียกตัวเดียวกัน ปุ่มบนจอกันได้แค่ความเผลอ
 */

export type Role = 'province' | 'district' | 'hospital'

/** รับแค่ role พอ จะเป็น me จาก currentUser() หรือ object ที่ส่งลง client ก็ได้ */
type Actor = { role: string }

const is = (me: Actor, ...roles: Role[]) => roles.includes(me.role as Role)

export const can = {
  /** จัดการผู้ใช้ / หน่วยงาน / หมู่บ้าน / โรคที่ต้องรายงาน */
  manage: (me: Actor) => is(me, 'province'),

  /** แจ้งเคสเข้าระบบ */
  report: (me: Actor) => is(me, 'province', 'hospital'),

  /** กดรับเคส — ยังต้องผ่านเงื่อนไขพื้นที่อีกชั้น ยกเว้น acceptAnyArea */
  accept: (me: Actor) => is(me, 'province', 'hospital'),

  /** รับเคสได้ทุกพื้นที่ ไม่ต้องเป็นหมู่บ้านของตัวเอง (หน่วยกลางต้องเก็บเคสตกค้างได้) */
  acceptAnyArea: (me: Actor) => is(me, 'province'),

  /** คืนเคสที่ถืออยู่กลับเข้ารายการรอรับ */
  release: (me: Actor) => is(me, 'province', 'hospital'),

  /** จำหน่ายเคสออกจากระบบ (soft delete) — ต้องรับเคสไว้เองก่อน */
  discharge: (me: Actor) => is(me, 'province'),

  /** บันทึกกิจกรรมควบคุมโรค — สสอ. มีหน้าที่นี้อย่างเดียว */
  addActivity: (me: Actor) => is(me, 'province', 'district', 'hospital'),

  /** แก้/ลบกิจกรรม — เฉพาะหน่วยที่ถือเคส ของที่ สสจ./สสอ. บันทึกไว้เป็นหลักฐานของพื้นที่ */
  editActivity: (me: Actor) => is(me, 'hospital'),

  /** จัดการหมู่บ้านรับผิดชอบของหน่วยงานตัวเอง */
  ownVillages: (me: Actor) => is(me, 'hospital'),

  /** เห็น/ยุ่งกับพื้นที่ได้ทั้งจังหวัด ไม่ต้องจำกัดขอบเขต */
  seeAllAreas: (me: Actor) => is(me, 'province'),

  /** ขอบเขตจำกัดแค่อำเภอของตัวเอง (ใช้คู่กับ me.amp) */
  districtScoped: (me: Actor) => is(me, 'district'),
}

// ---------- แก้ไขเคส ----------

/** หน่วยบริการแก้เคสของตัวเองได้ภายในกี่วัน นับจากวันที่รายงาน (เริ่มนับตั้งแต่เที่ยงคืนของวันนั้น) */
export const EDIT_WINDOW_DAYS = 30

// ไทยเป็น UTC+7 คงที่ ไม่มี DST — ทั้งระบบยึดเวลาไทย (ดู TZ ใน datetime.ts)
const TH_OFFSET_MS = 7 * 3_600_000

// วิว (v_case_list) ประกาศทุกคอลัมน์เป็น nullable รับ null ไว้เลยแล้วตัดสินว่าแก้ไม่ได้
type Reported = { report_org_code: string | null; date_report: Date | null; time_report: Date | null }

/**
 * instant จริงของการแจ้ง
 * prisma คืน date_report เป็นเที่ยงคืน "UTC" ของวันไทย และ time_report เป็นเวลาในวันนับจาก epoch
 * บวกกันตรง ๆ จะได้เวลาไทยแต่ติดป้ายว่า UTC ต้องถอย 7 ชม. ให้ตรงกับ th_ts() ฝั่ง DB
 */
export function reportedAt(c: Reported & { date_report: Date }) {
  return new Date(c.date_report.getTime() + (c.time_report?.getTime() ?? 0) - TH_OFFSET_MS)
}

/**
 * แก้ไขข้อมูลเคสได้ไหม — หน่วยบริการแก้ได้เฉพาะเคสที่ "ตัวเองแจ้ง" และยังไม่พ้น 30 วัน
 * นับจากเที่ยงคืนของวันที่รายงาน ไม่ใช่นาทีที่กดแจ้ง จะได้อธิบายผู้ใช้ง่ายว่า "แก้ได้ 30 วัน"
 * พ้นหน้าต่างแล้วแก้ไม่ได้ เพราะข้อมูลถูกเอาไปสอบสวน/ออกรายงานแล้ว แก้ย้อนหลังทำให้ตัวเลขไม่ตรง
 */
export function canEditCase(
  me: Actor & { org_code: string },
  c: Reported,
  now: Date = new Date(),
) {
  if (!is(me, 'hospital')) return false
  if (c.report_org_code !== me.org_code || !c.date_report) return false
  // time_report: null = ต้นวันที่รายงาน ซึ่งคือจุดเริ่มนับพอดี
  const dayStart = reportedAt({ ...c, date_report: c.date_report, time_report: null }).getTime()
  return now.getTime() - dayStart < EDIT_WINDOW_DAYS * 86_400_000
}
