/**
 * เบอร์โทรไทย: 081-234-5678 (มือถือ 10 หลัก), 02-123-4567 (กรุงเทพฯ), 055-123-456 (ต่างจังหวัด)
 * เก็บลง DB เป็นตัวเลขล้วน ขีดใส่ให้ตอนแสดงเท่านั้น
 */
export function maskTel(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 10)
  // กรุงเทพฯ ขึ้นต้น 02 รหัสพื้นที่ 2 หลัก ที่เหลือ (มือถือ/ต่างจังหวัด) 3 หลัก
  const head = d.startsWith('02') ? 2 : 3
  return [d.slice(0, head), d.slice(head, head + 3), d.slice(head + 3)].filter(Boolean).join('-')
}
