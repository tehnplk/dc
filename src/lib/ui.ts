// ขนาดโมดัลใช้ค่าเดียวกันทุกตัว ไม่ให้กล่องโตยุบตาม content
// แก้ที่นี่ที่เดียว ไม่ต้องไล่แก้ทีละ component
// text-left ต้องมี: <dialog> ยัง inherit จากจุดที่มันเกิด ปุ่มอยู่ในเซลล์ text-center ทั้งฟอร์มก็เอียงตาม
export const MODAL =
  'm-auto flex h-[88vh] w-[min(72rem,95vw)] flex-col rounded-sm border border-line bg-surface p-0 text-left text-fg backdrop:bg-black/50'
