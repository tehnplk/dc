// ขนาดโมดัลใช้ค่าเดียวกันทุกตัว ไม่ให้กล่องโตยุบตาม content
// แก้ที่นี่ที่เดียว ไม่ต้องไล่แก้ทีละ component
// text-left ต้องมี: <dialog> ยัง inherit จากจุดที่มันเกิด ปุ่มอยู่ในเซลล์ text-center ทั้งฟอร์มก็เอียงตาม
export const MODAL =
  'm-auto flex h-[88vh] w-[min(72rem,95vw)] flex-col rounded-sm border border-line bg-surface p-0 text-left text-fg backdrop:bg-black/50'

// แถวต่อหน้าของทุก datagrid
export const PAGE_SIZE = 50

/** page จาก query string — กันค่าเพี้ยน/ติดลบ/ไม่ใช่ตัวเลข ก่อนเอาไปคิด skip */
export function pageOf(v: string | string[] | undefined) {
  const n = Number(typeof v === 'string' ? v : 1)
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : 1
}

/** ช่องกรอกมาตรฐานในฟอร์ม — อยู่ที่นี่เพื่อให้ server component import ได้ด้วย */
export const field =
  'block w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-primary focus:border-primary'
