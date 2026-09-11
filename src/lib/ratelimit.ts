/**
 * จำกัดจำนวนครั้งที่ล็อกอินผิด — ใช้กับ /auth/admin ซึ่งเป็นบัญชีสิทธิ์เต็มที่รหัสมาจาก .env
 * ยอมให้ผิดได้ไม่กี่ครั้งแบบไม่หน่วง (คนพิมพ์ผิดจริง) แล้วค่อยหน่วงเพิ่มขึ้นเรื่อย ๆ
 *
 * ponytail: นับในหน่วยความจำของ process — ขึ้นหลายอินสแตนซ์เมื่อไหร่ค่อยย้ายไปเก็บใน DB/redis
 * และตัวนับจะรีเซ็ตทุกครั้งที่ deploy ใหม่ ซึ่งยอมรับได้สำหรับบัญชีเดียว
 */

/** ผิดได้ฟรีกี่ครั้งก่อนเริ่มหน่วง */
const FREE = 3
/** หน่วงกี่วินาที เมื่อผิดครั้งที่ FREE+1, +2, +3 ... (ตัวสุดท้ายใช้ซ้ำไปเรื่อย ๆ) */
const DELAYS = [5, 15, 60, 300]
/** ไม่มีความเคลื่อนไหวนานเท่านี้ = ลืมไปเลย (กันแมพโตไม่หยุด) */
const FORGET_MS = 60 * 60_000

type Entry = { fails: number; until: number; seen: number }
const hits = new Map<string, Entry>()

/** เหลืออีกกี่วินาทีถึงจะลองใหม่ได้ — 0 = ลองได้เลย */
export function retryAfter(key: string, now = Date.now()): number {
  const e = hits.get(key)
  if (!e || e.until <= now) return 0
  return Math.ceil((e.until - now) / 1000)
}

/** ล็อกอินผิด: นับเพิ่มแล้วคืนจำนวนวินาทีที่ต้องรอ */
export function fail(key: string, now = Date.now()): number {
  sweep(now)
  const e = hits.get(key) ?? { fails: 0, until: 0, seen: now }
  e.fails += 1
  e.seen = now

  const over = e.fails - FREE
  const wait = over > 0 ? DELAYS[Math.min(over, DELAYS.length) - 1] : 0
  e.until = now + wait * 1000
  hits.set(key, e)
  return wait
}

/** ล็อกอินผ่าน: ล้างประวัติของคีย์นี้ */
export function pass(key: string) {
  hits.delete(key)
}

function sweep(now: number) {
  for (const [k, e] of hits) {
    if (now - e.seen > FORGET_MS) hits.delete(k)
  }
}

/** ให้เทสรีเซ็ตสถานะได้ ไม่ได้ใช้ในแอปจริง */
export function reset() {
  hits.clear()
}
