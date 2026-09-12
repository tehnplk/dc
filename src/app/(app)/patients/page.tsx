import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { can } from '@/lib/role'
import { Filters, type Opt } from '@/components/Filters'
import { CaseTable } from '@/components/CaseTable'
import { SearchBox } from '@/components/SearchBox'
import { PAGE_SIZE, pageOf } from '@/lib/ui'
import { currentEpiYear, epiWhere } from '@/lib/epi'
import { epiYearOpts } from '@/lib/epi.server'

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
    date_onset: epiWhere(sp.year),   // ตั้งต้นที่ปีระบาดปัจจุบัน (ดู lib/epi.ts)
    // วิวมีแถวรับเคสเฉพาะที่ status='active' -> date_accept ว่าง = ยังไม่มีใครถือเคสนี้อยู่
    // (รวมเคสที่เคยรับแล้วคืนกลับมาด้วย ซึ่งถูกแล้ว มันกลับไปรอคนรับเหมือนเดิม)
    date_accept: one(sp.acc) === 'no' ? null : one(sp.acc) === 'yes' ? { not: null } : undefined,
    amp_code: one(sp.amp),
    report_org_code: one(sp.rorg),
    accepted_org_code: one(sp.aorg),
  }

  const [cases, total, waiting, amps, reportOrgs, acceptOrgs, years] = await Promise.all([
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
    epiYearOpts(),
  ])

  // จำนวนกิจกรรมของเคสในหน้านี้ — ตาราง case_activity เก็บเฉพาะที่คนบันทึกเอง
  // ลำดับ 1 แจ้งเคส กับ 2 พื้นที่รับเคส เป็นของที่ v_case_activity สร้างให้ ไม่ได้อยู่ในตาราง
  // นับตรงจากตารางจึงไม่รวมสองอันนั้นอยู่แล้ว และนับเฉพาะ 50 แถวที่แสดง ไม่ใช่ทั้งทะเบียน
  const ids = cases.map((c) => c.id).filter((v) => v !== null)
  const acts = Object.fromEntries(
    (ids.length
      ? await prisma.case_activity.groupBy({
          by: ['case_id'],
          where: { case_id: { in: ids } },
          _count: { _all: true },
        })
      : []
    ).map((g) => [String(g.case_id), g._count._all]))

  return (
    <main className="min-w-0 flex-1 bg-bg p-6">
      {/* ตัวกรองมี 4 ชุด ใส่แถวเดียวกับหัวเรื่องแล้วมันตัดบรรทัดเองอยู่ดี แยกเป็นแถว 2 ให้ชัดไปเลย */}
      <header className="mb-4 border-b-2 border-primary pb-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-lg font-semibold">ผู้ป่วยทั้งหมด</h1>
          <p className="text-sm text-fg-muted">{total} รายการ</p>
          {waiting > 0 && (
            <span className="rounded-sm bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
              รอรับเคส {waiting}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SearchBox />
          <Filters
            filters={[
              { key: 'year', prompt: 'ปีระบาด', opts: years, def: String(currentEpiYear()) },
              { key: 'acc', prompt: 'สถานะรับเคส', def: 'all', opts: [
                { code: 'all', name: 'ทั้งหมด' },
                { code: 'no', name: 'ยังไม่รับ' },
                { code: 'yes', name: 'รับแล้ว' },
              ] },
              { key: 'amp', prompt: 'อำเภอ', opts: amps },
              { key: 'rorg', prompt: 'หน่วยงานแจ้ง', opts: reportOrgs },
              { key: 'aorg', prompt: 'หน่วยงานรับ', opts: acceptOrgs },
            ]}
          />
        </div>
      </header>

      {/* ปุ่มเพิ่มกิจกรรมต้องโผล่เฉพาะเคสที่กดแล้วผ่าน — เกณฑ์เดียวกับ cannotAdd() ฝั่ง server
          สสจ. ทุกเคส · สสอ. เฉพาะอำเภอตัวเอง (ยังไม่ผูกอำเภอ = ปิดไปเลย) · หน่วยบริการ เฉพาะเคสที่ตัวเองรับไว้ */}
      <CaseTable cases={cases} empty="ไม่มีเคสตามเงื่อนไขที่เลือก" page={page} total={total}
                 canAccept={can.accept(me)}
                 canAdd={can.addActivity(me) && (!can.districtScoped(me) || !!me.amp)}
                 addAmp={can.districtScoped(me) ? me.amp : null}
                 addOrg={can.activityOwnedOnly(me) ? me.org_code : null}
                 acts={acts}
                 performer={me.full_name} />

    </main>
  )
}
