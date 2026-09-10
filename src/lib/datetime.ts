// เวลาทั้งระบบแสดงเป็นเวลาไทยเสมอ ไม่ขึ้นกับ TZ ของเครื่องที่ deploy
export const TZ = 'Asia/Bangkok'

const dateFmt = new Intl.DateTimeFormat('th-TH', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ,
})
const dateTimeFmt = new Intl.DateTimeFormat('th-TH', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZone: TZ,
})

export const fmtDate = (v: Date | null) => (v ? dateFmt.format(v) : '—')
export const fmtDateTime = (v: Date | null) => (v ? dateTimeFmt.format(v) : '—')
