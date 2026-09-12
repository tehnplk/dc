import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Activity, ChartColumnBig, CircleCheck, Clock, Inbox, Map as MapIcon, TriangleAlert } from 'lucide-react'
import { EpiCurve, type EpiYear } from '@/components/EpiCurve'
import { COMPARE_YEARS, currentEpiWeek, currentEpiYear, toBE } from '@/lib/epi'
import { BarList } from '@/components/BarList'
import { CaseMap, type MapCase } from '@/components/CaseMap'

export const dynamic = 'force-dynamic'

type Kpi = {
  cases: bigint; waiting: bigint; accepted: bigint; closed: bigint
  in_time: bigint; investigated: bigint; last7: bigint; prev7: bigint
}
type Week = { yr: number; wk: number; cases: number }
type Row = { label: string | null; cases: bigint; extra: bigint | null }

const n = (v: bigint | null | undefined) => Number(v ?? 0)
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100))

export default async function Page({ searchParams }: PageProps<'/dashboard'>) {
  const gis = (await searchParams).tab === 'gis'
  const thisYear = currentEpiYear()
  const firstYear = thisYear - COMPARE_YEARS + 1

  // แท็บแผนที่ไม่ต้องใช้ตัวเลขรวม ยิงคนละ query ไปเลย ไม่ต้องคิดทั้งสองชุดทุกครั้ง
  if (gis) {
    const rows = await prisma.$queryRaw<MapCase[]>`
      SELECT c.id::text, c.case_no,
             nullif(btrim(concat_ws(' ', c.pname, c.fname, c.lname)), '') AS name,
             d.name_th AS disease, c.disease_code,
             to_char(c.date_onset, 'DD/MM/YYYY') AS onset,
             amp.name AS amp, tmb.name AS tmb,
             (a.id IS NOT NULL) AS accepted,
             ST_Y(c.geom) AS lat, ST_X(c.geom) AS lon
      FROM case_report c
      JOIN c_disease506 d ON d.code = c.disease_code
      LEFT JOIN c_area tmb ON tmb.code = left(c.area_code, 6)
      LEFT JOIN c_area amp ON amp.code = left(c.area_code, 4)
      LEFT JOIN case_acceptance a ON a.case_id = c.id AND a.status = 'active'
      WHERE c.deleted_at IS NULL AND c.geom IS NOT NULL`

    return (
      <main className="min-w-0 flex-1 bg-bg p-6">
        <Head gis />
        <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
          <span>{rows.length} เคสที่มีพิกัด</span>
          <span className="ml-auto">วงทึบ = มีหน่วยรับแล้ว · วงจาง = รอรับเคส · สีตามโรค</span>
        </div>
        <CaseMap cases={rows} />
      </main>
    )
  }

  const [[k], weeks, byAmp, byDisease, byAge] = await Promise.all([
    prisma.$queryRaw<Kpi[]>`
      SELECT
        count(*)                                                     AS cases,
        count(*) FILTER (WHERE s.owner_org_code IS NULL)             AS waiting,
        count(*) FILTER (WHERE s.owner_org_code IS NOT NULL)         AS accepted,
        count(*) FILTER (WHERE s.status IN ('controlled','closed'))  AS closed,
        count(*) FILTER (WHERE s.investigated_in_time)               AS in_time,
        count(*) FILTER (WHERE s.first_activity_at IS NOT NULL)      AS investigated,
        count(*) FILTER (WHERE s.date_report >  current_date - 7)    AS last7,
        count(*) FILTER (WHERE s.date_report <= current_date - 7
                           AND s.date_report >  current_date - 14)   AS prev7
      FROM v_case_status s`,

    // เส้นโค้งระบาดเทียบ 3 ปีระบาดล่าสุด นับตามวันเริ่มป่วย ไม่ใช่วันรายงาน
    // สูตรสัปดาห์ต้องตรงกับ epiWeek() ใน lib/epi.ts (ตัดทุก 7 วันจาก 1 ม.ค.)
    prisma.$queryRaw<Week[]>`
      SELECT extract(year from date_onset)::int AS yr,
             least((extract(doy from date_onset)::int - 1) / 7 + 1, 52)::int AS wk,
             count(*)::int AS cases
      FROM case_report
      WHERE deleted_at IS NULL
        AND date_onset >= make_date(${firstYear}, 1, 1)
        AND date_onset <  make_date(${thisYear + 1}, 1, 1)
      GROUP BY 1, 2`,

    // อัตราป่วยต่อแสนประชากร ใช้ประชากรของอำเภอที่ import มา
    prisma.$queryRaw<Row[]>`
      SELECT a.name AS label, count(c.id) AS cases,
             CASE WHEN a.population > 0
                  THEN round(count(c.id) * 100000.0 / a.population) END AS extra
      FROM c_area a
      LEFT JOIN case_report c ON c.deleted_at IS NULL AND left(c.area_code, 4) = a.code
      WHERE a.level = 2
      GROUP BY a.name, a.population
      HAVING count(c.id) > 0
      ORDER BY 2 DESC`,

    prisma.$queryRaw<Row[]>`
      SELECT d.name_th AS label, count(c.id) AS cases, NULL::bigint AS extra
      FROM c_disease506 d
      JOIN case_report c ON c.disease_code = d.code AND c.deleted_at IS NULL
      GROUP BY 1 ORDER BY 2 DESC`,

    prisma.$queryRaw<Row[]>`
      SELECT g.label, count(c.id) AS cases, NULL::bigint AS extra
      FROM (VALUES ('0-4',0,4),('5-14',5,14),('15-24',15,24),('25-44',25,44),
                   ('45-59',45,59),('60+',60,200)) g(label, lo, hi)
      LEFT JOIN case_report c
        ON c.deleted_at IS NULL AND c.age_y BETWEEN g.lo AND g.hi
      GROUP BY g.label, g.lo ORDER BY g.lo`,
  ])

  const cases = n(k?.cases)
  const trend = n(k?.last7) - n(k?.prev7)

  // กาง 52 ช่องให้ครบทุกปี สัปดาห์ที่ไม่มีเคส = 0 ไม่ใช่ช่องว่าง
  // ปีปัจจุบันตัดที่สัปดาห์ล่าสุด ไม่งั้นเส้นดิ่งเป็น 0 ยาวไปจนสิ้นปี เหมือนโรคหายไปแล้ว
  const thisWeek = currentEpiWeek()
  const curve: EpiYear[] = Array.from({ length: COMPARE_YEARS }, (_, i) => {
    const year = thisYear - i
    return {
      year,
      cases: Array.from({ length: 52 }, (_, w) =>
        year === thisYear && w + 1 > thisWeek ? null : 0),
    }
  })
  for (const r of weeks) {
    const line = curve.find((c) => c.year === r.yr)
    if (line) line.cases[r.wk - 1] = r.cases
  }

  return (
    <main className="min-w-0 flex-1 bg-bg p-6">
      <Head />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="เคสทั้งหมด" value={cases} Icon={Activity}
             sub={`7 วันล่าสุด ${n(k?.last7)} ราย (${trend >= 0 ? '+' : ''}${trend} เทียบสัปดาห์ก่อน)`} />
        <Kpi label="รอรับเคส" value={n(k?.waiting)} Icon={Inbox} warn={n(k?.waiting) > 0}
             sub={`${pct(n(k?.waiting), cases)}% ของทั้งหมด`} />
        <Kpi label="มีหน่วยรับแล้ว" value={n(k?.accepted)} Icon={CircleCheck}
             sub={`${pct(n(k?.accepted), cases)}% ของทั้งหมด`} />
        <Kpi label="สอบสวนแล้ว" value={n(k?.investigated)} Icon={Clock}
             sub={`ทันเวลา ${pct(n(k?.in_time), n(k?.investigated))}%`} />
        <Kpi label="ควบคุมโรค/ปิดเคส" value={n(k?.closed)} Icon={TriangleAlert}
             sub={`${pct(n(k?.closed), cases)}% ของทั้งหมด`} />
      </div>

      <section className="mt-4 rounded-sm border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">
          เส้นโค้งการระบาด · เทียบรายสัปดาห์ ปี {toBE(firstYear)}–{toBE(thisYear)} (ตามวันเริ่มป่วย)
        </h2>
        <EpiCurve years={curve} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <BarList title="รายอำเภอ" unit="ราย" note="ชี้ที่แท่งเพื่อดูอัตราต่อแสน"
                 rows={byAmp.map((r) => ({ label: r.label ?? '—', value: n(r.cases), extra: r.extra === null ? null : n(r.extra) }))} />
        <BarList title="รายโรค" unit="ราย"
                 rows={byDisease.map((r) => ({ label: r.label ?? '—', value: n(r.cases), extra: null }))} />
        <BarList title="กลุ่มอายุ" unit="ราย"
                 rows={byAge.map((r) => ({ label: r.label ?? '—', value: n(r.cases), extra: null }))} />
      </div>
    </main>
  )
}

function Kpi({ label, value, sub, Icon, warn }: {
  label: string; value: number; sub: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; warn?: boolean
}) {
  return (
    <div className="rounded-sm border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-xs text-fg-muted">
        <Icon size={14} strokeWidth={1.75} />{label}
      </div>
      <p className={`mt-2 font-mono text-3xl tabular-nums ${warn ? 'text-warn' : 'text-fg'}`}>{value}</p>
      <p className="mt-1 text-[11px] text-fg-muted">{sub}</p>
    </div>
  )
}

/** หัวหน้า + แท็บ ใช้ร่วมกันทั้งสองมุมมอง */
function Head({ gis }: { gis?: boolean }) {
  return (
    <>
      <header className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-lg font-semibold">แดชบอร์ดเฝ้าระวัง</h1>
        <p className="text-sm text-fg-muted">จ.พิษณุโลก · ข้อมูลทั้งหมดในระบบ</p>
      </header>
      <nav className="mb-4 flex gap-1 border-b-2 border-primary">
        <Tab href="/dashboard" active={!gis} Icon={ChartColumnBig} label="Dashboard" />
        <Tab href="/dashboard?tab=gis" active={!!gis} Icon={MapIcon} label="GIS" />
      </nav>
    </>
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
