import Link from 'next/link'
import { ClipboardPlus, Hospital, MessageSquareText } from 'lucide-react'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { can, canEditCase } from '@/lib/role'
import { CaseTable } from '@/components/CaseTable'
import { PAGE_SIZE, pageOf } from '@/lib/ui'
import { ReportCaseModal } from '@/components/ReportCaseModal'
import { SearchBox } from '@/components/SearchBox'
import { HisPatients } from '@/components/HisPatients'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: PageProps<'/report'>) {
  const sp = await searchParams
  const his = sp.tab === 'his'          // แท็บอยู่ใน URL จะได้แชร์ลิงก์/กด back ได้
  const sms = sp.tab === 'sms'
  const reg = !his && !sms              // แท็บทะเบียนแจ้ง = ค่าตั้งต้น
  const page = pageOf(sp.page)
  const me = await currentUser()

  const q = typeof sp.q === 'string' && sp.q ? sp.q : undefined
  const where = {
    report_org_code: me.org_code,
    patient_name: q ? { contains: q, mode: 'insensitive' as const } : undefined,
  }

  const [cases, total, all, waiting, areas, diseases] = await Promise.all([
    // ทะเบียนแจ้ง = เฉพาะเคสที่หน่วยงานตัวเองเป็นคนแจ้ง
    prisma.v_case_list.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.v_case_list.count({ where }),
    // เลขบนแท็บเป็นยอดทั้งทะเบียน ไม่ใช่ผลการค้น ไม่งั้นตัวเลขวูบตอนพิมพ์ค้นหา
    prisma.v_case_list.count({ where: { report_org_code: me.org_code } }),
    prisma.v_case_list.count({ where: { ...where, date_accept: null } }),
    prisma.c_area.findMany({
      where: { level: { in: [2, 3, 4] }, deleted_at: null },
      select: { code: true, name: true, level: true },
      orderBy: { code: 'asc' },
    }),
    // เฉพาะโรคที่แอดมินเปิด must_report ไว้ — icd10 ไว้ให้แท็บ HIS จับคู่รหัสวินิจฉัยจาก HIS
    prisma.c_disease506.findMany({
      where: { must_report: true },
      select: { code: true, name_th: true, icd10: true },
      orderBy: { code: 'asc' },
    }),
  ])

  // เคสที่ยังแก้ได้มักมีไม่กี่รายการ ดึงข้อมูลเดิมเฉพาะพวกนั้นพอ ไม่ต้องโหลดทั้งหน้า
  const editableIds = cases.filter((c) => c.id !== null && canEditCase(me, c)).map((c) => c.id!)
  const editRows = editableIds.length
    ? await prisma.case_report.findMany({
        where: { id: { in: editableIds } },
        select: {
          id: true, cid: true, hn: true, pname: true, fname: true, lname: true,
          gender: true, age_y: true, age_m: true, tel: true, area_code: true, addr_no: true,
          date_onset: true, date_visit: true, date_dx: true, time_dx: true,
          patient_type: true, disease_code: true, symptom: true,
          reporter_name: true, reporter_tel: true,
        },
      })
    : []
  // ฟอร์มรับวันที่เป็น yyyy-mm-dd และเวลาเป็น HH:MM ตามที่ <input>/ThaiDate ใช้
  const ymd = (d: Date | null) => d?.toISOString().slice(0, 10)
  const hm = (t: Date | null) => t?.toISOString().slice(11, 16)
  const edits = {
    areas, diseases,
    rows: Object.fromEntries(editRows.map((r) => [String(r.id), {
      cid: r.cid ?? undefined, hn: r.hn ?? undefined,
      pname: r.pname ?? undefined, fname: r.fname ?? undefined, lname: r.lname ?? undefined,
      gender: r.gender ?? undefined, age_y: r.age_y ?? undefined, age_m: r.age_m ?? undefined,
      tel: r.tel ?? undefined, area_code: r.area_code ?? undefined, addr_no: r.addr_no ?? undefined,
      date_onset: ymd(r.date_onset), date_visit: ymd(r.date_visit), date_dx: ymd(r.date_dx),
      time_dx: hm(r.time_dx), patient_type: r.patient_type ?? undefined,
      disease_code: r.disease_code, symptom: r.symptom ?? undefined,
      reporter_name: r.reporter_name ?? undefined, reporter_tel: r.reporter_tel ?? undefined,
    }])),
  }

  return (
    <main className="min-w-0 flex-1 bg-bg p-6">
      <header className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-lg font-semibold">ทะเบียนแจ้ง</h1>
        <p className="text-sm text-fg-muted">{me.org.name}</p>
        {reg && waiting > 0 && (
          <span className="rounded-sm bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
            ยังไม่มีหน่วยรับ {waiting}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {reg && <SearchBox />}
          {/* ไม่มีปุ่มที่กดแล้วถูกปฏิเสธ: บัญชีผู้ดูแลระบบดูอย่างเดียว และ สสอ. แจ้งเคสไม่ได้ */}
          {can.report(me) && (
            <ReportCaseModal areas={areas} diseases={diseases} reporter={me.full_name} tel={me.tel} />
          )}
        </div>
      </header>

      {/* แท็บเป็น <Link> ล้วน ไม่ต้องมี state ฝั่ง client */}
      <nav className="mb-4 flex gap-1 border-b-2 border-primary">
        <Tab href="/report?tab=his" active={his} Icon={Hospital} label="ผู้ป่วยใน HIS" />
        <Tab href="/report" active={reg} Icon={ClipboardPlus} label={`ทะเบียนแจ้ง (${all})`} />
        <Tab href="/report?tab=sms" active={sms} Icon={MessageSquareText} label="ทะเบียนส่งข้อความ" />
      </nav>

      {his ? (
        <HisPatients areas={areas} diseases={diseases} reporter={me.full_name} tel={me.tel} canReport={can.report(me)} />
      ) : sms ? (
        // ponytail: ยังไม่มีตารางข้อความในฐานข้อมูล — ใส่โครงแท็บไว้ก่อน
        <p className="rounded-sm border border-line bg-surface px-4 py-10 text-center text-sm text-fg-muted">
          ยังไม่มีข้อความที่ส่ง
        </p>
      ) : (
        // หน้านี้เป็นทะเบียนของผู้แจ้ง การกดรับเป็นงานฝั่งพื้นที่ ไม่ใช่ที่นี่
        <CaseTable cases={cases} empty="หน่วยงานยังไม่ได้แจ้งเคส"
                   from={false} addr canAccept={false} edits={edits} page={page} total={total} />
      )}
    </main>
  )
}

function Tab({ href, active, label, Icon }: {
  href: string; active: boolean; label: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`-mb-0.5 flex items-center gap-1.5 rounded-t-sm border border-b-0 px-4 py-2 text-sm transition-colors duration-150 ${
        active
          ? 'border-primary bg-primary font-medium text-bg'
          : 'border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg'
      }`}
    >
      <Icon size={15} strokeWidth={1.75} />{label}
    </Link>
  )
}
