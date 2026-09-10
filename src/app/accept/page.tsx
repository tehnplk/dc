import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { CaseTable } from '@/components/CaseTable'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const me = await currentUser()

  // ทะเบียนรับ = เคสที่หน่วยงานตัวเองกดรับและยังถืออยู่ (v_case_list join เฉพาะแถว active)
  const cases = await prisma.v_case_list.findMany({
    where: { accepted_org_code: me.org_code },
    orderBy: { id: 'desc' },
    take: 100,
  })

  return (
    <main className="min-w-0 flex-1 bg-bg p-6">
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-primary pb-3">
        <h1 className="text-lg font-semibold">ทะเบียนรับ</h1>
        <p className="text-sm text-fg-muted">{me.org.name} · {cases.length} รายการ</p>
      </header>

      {/* หน้านี้คือเคสที่รับมาแล้วของหน่วยงานตัวเอง: ไม่ต้องมีปุ่มกดรับ และไม่ต้องบอกว่าใครรับ */}
      <CaseTable
        cases={cases}
        empty="หน่วยงานยังไม่ได้รับเคส"
        unit={false}
        addr
        canAdd
        canRelease
        canAccept={false}
        performer={me.full_name}
      />
    </main>
  )
}
