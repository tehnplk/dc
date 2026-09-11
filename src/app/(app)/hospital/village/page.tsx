import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { areaScope, areaWhere } from '@/lib/scope'
import { PAGE_SIZE, pageOf } from '@/lib/ui'
import { Pagination } from '@/components/Pagination'
import { SearchBox } from '@/components/SearchBox'
import { RowForm } from '@/components/admin/RowForm'
import { NameAndPopulation } from '@/components/admin/AreaFields'
import { VillagePicker } from '@/components/admin/VillagePicker'
import { Grid, td } from '@/components/admin/Grid'
import { saveArea } from '@/app/(app)/admin/actions'
import { claimVillage, releaseVillage } from './actions'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: PageProps<'/hospital/village'>) {
  const me = await currentUser()
  // สสจ./บัญชีสำรองจัดการหมู่บ้านทั้งจังหวัดที่ /admin ส่วน สสอ. ไม่ได้ดูแลหมู่บ้าน
  if (me.canManage) redirect('/admin?tab=areas')
  if (me.role !== 'hospital') redirect('/patients')

  const sp = await searchParams
  const page = pageOf(sp.page)
  const q = typeof sp.q === 'string' && sp.q ? sp.q : undefined

  // เห็นแค่หมู่บ้านของตัวเองอยู่แล้ว จึงไม่ต้องมีตัวกรองอำเภอ/ตำบล
  const where = {
    level: 4,
    deleted_at: null,
    ...areaWhere(await areaScope(me)),
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { code: { contains: q } }] } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.c_area.findMany({
      where,
      select: { code: true, name: true, population: true },
      orderBy: { code: 'asc' },
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    }),
    prisma.c_area.count({ where }),
  ])
  // ชื่อตำบล/อำเภอของแถวในหน้านี้เท่านั้น
  const parents = await prisma.c_area.findMany({
    where: { code: { in: [...new Set(rows.flatMap((r) => [r.code.slice(0, 4), r.code.slice(0, 6)]))] } },
    select: { code: true, name: true },
  })
  const nameOf = new Map(parents.map((p) => [p.code, p.name]))
  const choices = await claimable(me.amp, me.org_code)
  const ampName = me.amp ? (await prisma.c_area.findUnique({ where: { code: me.amp }, select: { name: true } }))?.name ?? null : null

  return (
    <main className="min-w-0 flex-1 bg-bg p-6">
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-primary pb-3">
        <h1 className="text-lg font-semibold">หมู่บ้านรับผิดชอบ</h1>
        <span className="text-sm text-fg-muted">{me.org.name} · {total} หมู่บ้าน</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchBox placeholder="ค้นหาชื่อหรือรหัส" />
          <RowForm title="เพิ่มหมู่บ้านรับผิดชอบ" trigger="add" save={claimVillage} wide>
            <VillagePicker choices={choices} amp={ampName} />
          </RowForm>
        </div>
      </header>

      <Grid head={['รหัส', 'หมู่ที่', 'หมู่บ้าน/ชุมชน', 'ตำบล', 'อำเภอ', 'ประชากร', 'Action']}
            empty={total === 0}
            emptyText="ยังไม่มีหมู่บ้านในความรับผิดชอบ แจ้ง สสจ. เพื่อกำหนดพื้นที่">
        {rows.map((a) => (
          <tr key={a.code} className="border-b border-line last:border-0 odd:bg-surface-2/50 hover:bg-primary-soft">
            <td className={`${td} font-mono`}>{a.code}</td>
            {/* 2 หลักท้ายของรหัสหมู่บ้านคือหมู่ที่ ไม่มีคอลัมน์แยกในฐานข้อมูล */}
            <td className={`${td} text-right font-mono tabular-nums`}>{Number(a.code.slice(6)) || '—'}</td>
            <td className={td}>{a.name}</td>
            <td className={`${td} text-fg-muted`}>{nameOf.get(a.code.slice(0, 6)) ?? '—'}</td>
            <td className={`${td} text-fg-muted`}>{nameOf.get(a.code.slice(0, 4)) ?? '—'}</td>
            <td className={`${td} text-right font-mono tabular-nums`}>{a.population ?? '—'}</td>
            <td className={`${td} text-center`}>
              <RowForm title={`แก้ไข ${a.name}`} trigger="edit" save={saveArea}
                       remove={releaseVillage} removeKey={{ name: 'code', value: a.code }}
                       removeLabel="นำออก">
                <input type="hidden" name="code" value={a.code} />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-sm bg-surface-2 px-3 py-2 text-xs">
                  <Info label="รหัสหมู่บ้าน" value={a.code} mono />
                  <Info label="หมู่ที่" value={String(Number(a.code.slice(6)) || '—')} mono />
                  <Info label="ตำบล" value={nameOf.get(a.code.slice(0, 6)) ?? '—'} />
                  <Info label="อำเภอ" value={nameOf.get(a.code.slice(0, 4)) ?? '—'} />
                </dl>
                <NameAndPopulation area={a} />
              </RowForm>
            </td>
          </tr>
        ))}
      </Grid>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </main>
  )
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={mono ? 'font-mono tabular-nums' : ''}>{value}</dd>
    </div>
  )
}

/**
 * หมู่บ้านในอำเภอเดียวกับหน่วยงาน ไว้ให้ติ๊กเลือก
 * ที่มีหน่วยอื่นดูแลอยู่ก็แสดงพร้อมชื่อหน่วยนั้นแต่ติ๊กไม่ได้ (1 หมู่บ้าน = 1 หน่วยบริการ)
 */
async function claimable(amp: string | null, orgCode: string) {
  const rows = await prisma.c_area.findMany({
    where: { level: 4, deleted_at: null, ...(amp ? { code: { startsWith: amp } } : {}) },
    select: {
      code: true, name: true,
      hos_village: { select: { org_code: true, c_org: { select: { code: true, name: true } } } },
    },
    orderBy: { code: 'asc' },
  })
  const parents = await prisma.c_area.findMany({
    where: { code: { in: [...new Set(rows.flatMap((r) => [r.code.slice(0, 4), r.code.slice(0, 6)]))] } },
    select: { code: true, name: true },
  })
  const nameOf = new Map(parents.map((p) => [p.code, p.name]))

  return rows
    .filter((r) => r.hos_village?.org_code !== orgCode)   // ที่รับผิดชอบอยู่แล้วมีในตารางข้างล่าง
    .map((r) => ({
      code: r.code,
      moo: Number(r.code.slice(6)),
      name: r.name,
      tmbCode: r.code.slice(0, 6),
      tmb: nameOf.get(r.code.slice(0, 6)) ?? '—',
      amp: nameOf.get(r.code.slice(0, 4)) ?? '—',
      owner: r.hos_village ? `${r.hos_village.c_org.code}-${r.hos_village.c_org.name}` : null,
    }))
}
