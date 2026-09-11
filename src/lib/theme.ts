export type Theme = 'light' | 'dark'

export const THEME_KEY = 'theme'
export const THEME_ATTR = 'data-theme'

// ขนาดตัวอักษรของตารางข้อมูล (มีผลเฉพาะ grid ไม่ยุ่งกับส่วนอื่นของหน้า)
export type GridFont = 'sm' | 'md' | 'lg'
export const FONT_KEY = 'gridFont'
export const FONT_ATTR = 'data-grid-font'
// size = ขนาดตัว "ก" บนปุ่ม ให้เห็นผลลัพธ์จากหน้าตาปุ่มเลย ไม่ต้องอ่านคำ
export const FONTS: { id: GridFont; label: string; size: string }[] = [
  { id: 'sm', label: 'เล็ก', size: 'text-[11px]' },
  { id: 'md', label: 'ปกติ', size: 'text-[14px]' },
  { id: 'lg', label: 'ใหญ่', size: 'text-[18px]' },
]

export function readGridFont(): GridFont {
  const v = document.documentElement.getAttribute(FONT_ATTR)
  return v === 'sm' || v === 'lg' ? v : 'md'
}

export function applyGridFont(f: GridFont) {
  const root = document.documentElement
  if (f === 'md') root.removeAttribute(FONT_ATTR)
  else root.setAttribute(FONT_ATTR, f)
  try {
    if (f === 'md') localStorage.removeItem(FONT_KEY)
    else localStorage.setItem(FONT_KEY, f)
  } catch {
    // เปลี่ยนได้อยู่ แค่ไม่จำข้ามหน้า
  }
}

/** ธีมที่กำลังแสดงอยู่จริง อ่านจาก DOM ก่อน ถ้าไม่ถูกบังคับไว้ค่อยดูค่าของเครื่อง */
export function readTheme(): Theme {
  const forced = document.documentElement.getAttribute(THEME_ATTR)
  if (forced === 'light' || forced === 'dark') return forced
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** ผู้ใช้เลือกไว้เองหรือยัง (ยังไม่เลือก = เดินตามเครื่อง) */
export function hasUserChoice(): boolean {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark'
  } catch {
    return false // โหมดส่วนตัว/ปิด site data — ถือว่ายังไม่เลือก เดินตามเครื่องแทน
  }
}

/** เขียนธีมลง DOM (+ จำไว้) ปิด transition ชั่วขณะไม่ให้ทั้งหน้าค่อย ๆ เปลี่ยนสี */
export function applyTheme(theme: Theme, persist = true) {
  const root = document.documentElement
  root.classList.add('theme-switching')
  root.setAttribute(THEME_ATTR, theme)
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // สลับได้อยู่ แค่ไม่จำข้ามหน้า
    }
  }
  requestAnimationFrame(() => root.classList.remove('theme-switching'))
}

/**
 * ฝังใน <head> ต้องรันตอน parse ก่อน paint ไม่งั้นเห็นธีมผิดวาบก่อนสลับ
 * ใช้ค่าคงที่ชุดเดียวกับโค้ดข้างบน จะได้ไม่หลุดกันเวลาแก้
 */
export const uiInitScript =
  `try{var d=document.documentElement,t=localStorage.getItem('${THEME_KEY}');` +
  `if(t==='light'||t==='dark')d.setAttribute('${THEME_ATTR}',t);` +
  `var f=localStorage.getItem('${FONT_KEY}');` +
  `if(f==='sm'||f==='lg')d.setAttribute('${FONT_ATTR}',f)}catch(e){}`
