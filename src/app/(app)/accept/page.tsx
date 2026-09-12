import Link from 'next/link'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { can } from '@/lib/role'
import { Inbox } from 'lucide-react'
import { CaseTable } from '@/components/CaseTable'
import { SearchBox } from '@/components/SearchBox'
import { Filters } from '@/components/Filters'
import { currentEpiYear, epiWhere } from '@/lib/epi'
import { epiYearOpts } from '@/lib/epi.server'
import { PAGE_SIZE, pageOf } from '@/lib/ui'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: PageProps<'/accept'>) {
  const me = await currentUser()
  const sp = await searchParams
  const page = pageOf(sp.page)

  // ทะเบียนรับ = เคสที่หน่วยงานตัวเองกดรับและยังถืออยู่ (v_case_list join เฉพาะแถว active)
  const q = typeof sp.q === 'string' && sp.q ? sp.q : undefined
  const onset = epiWhere(sp.year)   // ตั้งต้นที่ปีระบาดปัจจุบัน (ดู lib/epi.ts)
  const where = {
    accepted_org_code: me.org_code,
    date_onset: onset,
    patient_name: q ? { contains: q, mode: 'insensitive' as const } : undefined,
  }
  const [cases, total, inbox, years] = await Promise.all([
    prisma.v_case_list.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.v_case_list.count({ where }),
    // เคสที่ตกในหมู่บ้านที่หน่วยงานรับผิดชอบ (hos_village) และยังไม่มีใครกดรับ
    prisma.v_case_inbox.count({ where: { org_code: me.org_code, date_onset: onset } }),
    epiYearOpts(),
  ])

  return (
    <main className="min-w-0 flex-1 bg-bg p-6">
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-primary pb-3">
        <h1 className="text-lg font-semibold">ทะเบียนรับ</h1>
        <p className="text-sm text-fg-muted">{me.org.name} · {total} รายการ</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchBox />
          <Filters filters={[{ key: 'year', prompt: 'ปีระบาด', opts: years,
                               def: String(currentEpiYear()) }]} />
        </div>
        {/* เคสรอรับของพื้นที่ตัวเอง กดไปที่ /patients เพื่อกดรับ */}
        <Link
          href="/patients"
          className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
            inbox > 0
              ? 'bg-warn-soft text-warn hover:bg-warn hover:text-bg'
              : 'text-fg-muted hover:bg-surface-2'
          }`}
        >
          <Inbox size={14} strokeWidth={1.75} aria-hidden />
          รอรับ <span className="font-mono tabular-nums">{inbox}</span> เคส
          <span className="font-normal opacity-80">(ตรงกับหมู่บ้านรับผิดชอบ)</span>
        </Link>
      </header>

      {/* หน้านี้คือเคสที่รับมาแล้วของหน่วยงานตัวเอง: ไม่ต้องมีปุ่มกดรับ และไม่ต้องบอกว่าใครรับ */}
      <CaseTable
        cases={cases}
        empty="หน่วยงานยังไม่ได้รับเคส"
        unit={false}
        addr
        canAdd
        canEdit={can.editActivity(me)}
        canRelease={can.release(me)}
        dischargeOrg={can.discharge(me) ? me.org_code : null}
        canAccept={false}
        performer={me.full_name}
        page={page}
        total={total}
      />
    </main>
  )
}
