import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { Filters, type Opt } from '@/components/Filters'
import { CaseTable } from '@/components/CaseTable'
import { SearchBox } from '@/components/SearchBox'
import { PAGE_SIZE, pageOf } from '@/lib/ui'

export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: PageProps<'/patients'>) {
  const sp = await searchParams
  const me = await currentUser()   // คุกกี้ถูกแต่บัญชีถูกลบ/ปิด ต้องหลุดที่นี่
  const one = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : undefined)

  const page = pageOf(sp.page)
  const q = one(sp.q)
  const where = {
    // ชื่อในวิวเป็น คำนำหน้า+ชื่อ+สกุล ต่อกันแล้ว ค้นคำเดียวจึงเจอทั้งชื่อและสกุล
    patient_name: q ? { contains: q, mode: 'insensitive' as const } : undefined,
    amp_code: one(sp.amp),
    report_org_code: one(sp.rorg),
    accepted_org_code: one(sp.aorg),
  }

  const [cases, total, waiting, amps, reportOrgs, acceptOrgs] = await Promise.all([
    prisma.v_case_list.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.v_case_list.count({ where }),
    // นับจากทั้งชุดที่กรอง ไม่ใช่เฉพาะหน้าปัจจุบัน ไม่งั้นตัวเลขเปลี่ยนตามหน้าที่เปิด
    prisma.v_case_list.count({ where: { ...where, date_accept: null } }),
    // อำเภอทั้งหมดของจังหวัด ไม่ใช่เฉพาะที่มีเคส ตัวเลือกจะได้ไม่ขยับตามข้อมูล
    prisma.c_area.findMany({
      where: { level: 2, deleted_at: null },
      select: { code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    // หน่วยงานมี 212 แห่ง ส่วนใหญ่ไม่เคยแจ้ง/รับเคส เอาเฉพาะที่มีจริงในข้อมูล
    prisma.$queryRaw<Opt[]>`SELECT DISTINCT report_org_code AS code, report_org_name AS name
      FROM v_case_list WHERE report_org_code IS NOT NULL ORDER BY 2`,
    prisma.$queryRaw<Opt[]>`SELECT DISTINCT accepted_org_code AS code, accepted_org_name AS name
      FROM v_case_list WHERE accepted_org_code IS NOT NULL ORDER BY 2`,
  ])

  return (
    <main className="min-w-0 flex-1 bg-bg p-6">
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-primary pb-3">
        <h1 className="text-lg font-semibold">เคสที่รายงานเข้าระบบ</h1>
        <p className="text-sm text-fg-muted">{total} รายการ</p>
        {waiting > 0 && (
          <span className="rounded-sm bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
            รอรับเคส {waiting}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchBox />
          <Filters
            filters={[
              { key: 'amp', prompt: 'อำเภอ', opts: amps },
              { key: 'rorg', prompt: 'หน่วยงานแจ้ง', opts: reportOrgs },
              { key: 'aorg', prompt: 'หน่วยงานรับ', opts: acceptOrgs },
            ]}
          />
        </div>
      </header>

      {/* สสจ. บันทึกกิจกรรมได้ทุกเคส · สสอ. เฉพาะอำเภอตัวเอง (server ตรวจซ้ำอีกชั้น) */}
      <CaseTable cases={cases} empty="ไม่มีเคสตามเงื่อนไขที่เลือก" page={page} total={total}
                 canAccept={me.canCase}
                 canAdd={me.role === 'province' || me.role === 'district'}
                 addAmp={me.role === 'district' ? me.amp : null}
                 performer={me.full_name} />

    </main>
  )
}
