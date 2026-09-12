export const th = 'px-3 py-2 text-left font-medium whitespace-nowrap'
export const td = 'px-3 py-2 align-top whitespace-nowrap'
/** ช่องตัวเลข — กึ่งกลาง ใช้คู่กับ align={[...NUM ตรงคอลัมน์เดียวกัน]} หัวจะได้ไม่หลุดจากค่า */
export const tdNum = `${td} text-center font-mono tabular-nums`
export const NUM = 'text-center'

/**
 * ตารางของหน้าจัดการระบบ ใช้ร่วมกันทั้ง /admin และ /hospital/village
 * align = คลาสจัดตำแหน่งของหัวคอลัมน์ทีละช่อง (index ตรงกับ head)
 * หัวตารางเป็น text-left หมด ถ้าค่าในช่องไม่ใช่ซ้ายด้วยจะดูเหมือนคนละคอลัมน์
 */
export function Grid({ head, align, children, empty, emptyText = 'ไม่มีข้อมูล' }: {
  head: string[]; align?: string[]; children: React.ReactNode; empty: boolean; emptyText?: string
}) {
  return (
    <div className="overflow-x-auto rounded-sm border border-line bg-surface">
      <table data-grid className="w-full border-collapse">
        <thead className="bg-brand text-on-brand">
          <tr className="border-b border-line">
            {head.map((h, i) => <th key={i} className={`${th} ${align?.[i] ?? ''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {empty && (
            <tr><td colSpan={head.length} className="px-3 py-10 text-center text-fg-muted">{emptyText}</td></tr>
          )}
          {children}
        </tbody>
      </table>
    </div>
  )
}
