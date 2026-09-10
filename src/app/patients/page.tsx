import { prisma } from '@/lib/db'
import { Filters, type Opt } from '@/components/Filters'
import { CaseTable } from '@/components/CaseTable'

export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: PageProps<'/patients'>) {
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : undefined)

  const [cases, amps, reportOrgs, acceptOrgs] = await Promise.all([
    prisma.v_case_list.findMany({
      where: {
        amp_code: one(sp.amp),
        report_org_code: one(sp.rorg),
        accepted_org_code: one(sp.aorg),
      },
      orderBy: { id: 'desc' },
      take: 100,
    }),
    // อำเภอทั้งหมดของจังหวัด ไม่ใช่เฉพาะที่มีเคส ตัวเลือกจะได้ไม่ขยับตามข้อมูล
    prisma.c_area.findMany({
      where: { level: 2 },
      select: { code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    // หน่วยงานมี 212 แห่ง ส่วนใหญ่ไม่เคยแจ้ง/รับเคส เอาเฉพาะที่มีจริงในข้อมูล
    prisma.$queryRaw<Opt[]>`SELECT DISTINCT report_org_code AS code, report_org_name AS name
      FROM v_case_list WHERE report_org_code IS NOT NULL ORDER BY 2`,
    prisma.$queryRaw<Opt[]>`SELECT DISTINCT accepted_org_code AS code, accepted_org_name AS name
      FROM v_case_list WHERE accepted_org_code IS NOT NULL ORDER BY 2`,
  ])
  const waiting = cases.filter((c) => !c.date_accept).length

  return (
    <main className="min-w-0 flex-1 bg-bg p-6">
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-primary pb-3">
        <h1 className="text-lg font-semibold">เคสที่รายงานเข้าระบบ</h1>
        <p className="text-sm text-fg-muted">{cases.length} รายการล่าสุด</p>
        {waiting > 0 && (
          <span className="rounded-sm bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
            รอรับเคส {waiting}
          </span>
        )}
        <div className="ml-auto">
          <Filters
            filters={[
              { key: 'amp', prompt: 'อำเภอ', opts: amps },
              { key: 'rorg', prompt: 'หน่วยงานแจ้ง', opts: reportOrgs },
              { key: 'aorg', prompt: 'หน่วยงานรับ', opts: acceptOrgs },
            ]}
          />
        </div>
      </header>

      <CaseTable cases={cases} empty="ไม่มีเคสตามเงื่อนไขที่เลือก" />

    </main>
  )
}
