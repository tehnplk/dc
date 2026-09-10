import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { CaseTable } from '@/components/CaseTable'
import { ReportCaseModal } from '@/components/ReportCaseModal'
import { HisConnectButton } from '@/components/HisConnectButton'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const me = await currentUser()

  const [cases, areas, diseases] = await Promise.all([
    // ทะเบียนแจ้ง = เฉพาะเคสที่หน่วยงานตัวเองเป็นคนแจ้ง
    prisma.v_case_list.findMany({
      where: { report_org_code: me.org_code },
      orderBy: { id: 'desc' },
      take: 100,
    }),
    prisma.c_area.findMany({
      where: { level: { in: [2, 3, 4] } },
      select: { code: true, name: true, level: true },
      orderBy: { code: 'asc' },
    }),
    prisma.c_disease.findMany({ select: { code: true, name_th: true }, orderBy: { code: 'asc' } }),
  ])
  const waiting = cases.filter((c) => !c.date_accept).length

  return (
    <main className="min-w-0 flex-1 bg-bg p-6">
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-primary pb-3">
        <h1 className="text-lg font-semibold">ทะเบียนแจ้ง</h1>
        <p className="text-sm text-fg-muted">{me.org.name} · {cases.length} รายการ</p>
        {waiting > 0 && (
          <span className="rounded-sm bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
            ยังไม่มีหน่วยรับ {waiting}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <HisConnectButton />
          <ReportCaseModal areas={areas} diseases={diseases} reporter={me.full_name} tel={me.tel} />
        </div>
      </header>

      {/* หน้านี้เป็นทะเบียนของผู้แจ้ง การกดรับเป็นงานฝั่งพื้นที่ ไม่ใช่ที่นี่ */}
      <CaseTable cases={cases} empty="หน่วยงานยังไม่ได้แจ้งเคส" from={false} addr canAccept={false} />
    </main>
  )
}
