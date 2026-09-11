/** เลขบัตรประชาชนไทย: ตัวเลขล้วน 13 หลัก + หลักสุดท้ายเป็น check digit (mod 11) */
export function validCid(cid: string): boolean {
  if (!/^\d{13}$/.test(cid)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(cid[i]) * (13 - i)
  return (11 - (sum % 11)) % 10 === Number(cid[12])
}

/** 1-2345-67890-12-3 — จัดรูปตามที่พิมพ์ ผู้ใช้ทานกับบัตรได้ง่ายกว่าเลขติดกัน 13 ตัว */
export function maskCid(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 13)
  const parts = [d.slice(0, 1), d.slice(1, 5), d.slice(5, 10), d.slice(10, 12), d.slice(12, 13)]
  return parts.filter(Boolean).join('-')
}
