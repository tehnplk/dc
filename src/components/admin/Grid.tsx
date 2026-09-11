export const th = 'px-3 py-2 text-left font-medium whitespace-nowrap'
export const td = 'px-3 py-2 align-top whitespace-nowrap'

/** ตารางของหน้าจัดการระบบ ใช้ร่วมกันทั้ง /admin และ /hospital/village */
export function Grid({ head, children, empty, emptyText = 'ไม่มีข้อมูล' }: {
  head: string[]; children: React.ReactNode; empty: boolean; emptyText?: string
}) {
  return (
    <div className="overflow-x-auto rounded-sm border border-line bg-surface">
      <table data-grid className="w-full border-collapse">
        <thead className="bg-brand text-on-brand">
          <tr className="border-b border-line">
            {head.map((h, i) => <th key={i} className={th}>{h}</th>)}
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
