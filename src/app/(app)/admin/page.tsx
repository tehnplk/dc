import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2, Home, Stethoscope, Users } from 'lucide-react'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { fmtDate } from '@/lib/datetime'
import { PAGE_SIZE, field, pageOf } from '@/lib/ui'
import { Pagination } from '@/components/Pagination'
import { SearchBox } from '@/components/SearchBox'
import { Filters } from '@/components/Filters'
import { RowForm } from '@/components/admin/RowForm'
import { AreaFields } from '@/components/admin/AreaFields'
import { Grid, td } from '@/components/admin/Grid'
import { MustReportToggle } from '@/components/admin/MustReportToggle'
import { deleteArea, deleteOrg, deleteUser, saveArea, saveOrg, saveUser } from './actions'

export const dynamic = 'force-dynamic'

type Tab = 'users' | 'orgs' | 'areas' | 'diseases'

export default async function Page({ searchParams }: PageProps<'/admin'>) {
  const me = await currentUser()
  // จัดการระบบเป็นของ สสจ./บัญชีสำรอง หน่วยบริการมีหน้าหมู่บ้านของตัวเองแยกต่างหาก
  if (!me.canManage) redirect(me.role === 'hospital' ? '/hospital/village' : '/patients')

  const sp = await searchParams
  const tab: Tab = sp.tab === 'orgs' ? 'orgs'
    : sp.tab === 'areas' ? 'areas'
    : sp.tab === 'diseases' ? 'diseases' : 'users'
  const page = pageOf(sp.page)
  const q = typeof sp.q === 'string' && sp.q ? sp.q : undefined
  const one = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : undefined)
  const amp = one(sp.amp)
  const tmb = one(sp.tmb)
  const skip = (page - 1) * PAGE_SIZE
  const like = { contains: q, mode: 'insensitive' as const }

  const [amps, tmbs] = await Promise.all([
    prisma.c_area.findMany({ where: { level: 2, deleted_at: null }, select: { code: true, name: true }, orderBy: { code: 'asc' } }),
    // ตำบลตามอำเภอที่เลือก ไม่เลือกก็ให้ครบ 93 ตำบล
    tab === 'areas'
      ? prisma.c_area.findMany({
          where: { level: 3, deleted_at: null, ...(amp ? { code: { startsWith: amp } } : {}) },
          select: { code: true, name: true },
          orderBy: { code: 'asc' },
        })
      : [],
  ])

  const roles = await prisma.user_role.findMany({ orderBy: { sort_order: 'asc' } })
  const orgs = await prisma.c_org.findMany({
    where: { is_active: true, deleted_at: null },
    select: { code: true, name: true },
    orderBy: { code: 'asc' },
  })
  const orgOptions = (
    <>
      {orgs.map((o) => <option key={o.code} value={o.code}>{o.code} · {o.name}</option>)}
    </>
  )

  return (
    <main className="min-w-0 flex-1 bg-bg p-6">
      <header className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-lg font-semibold">ผู้ดูแลระบบ</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchBox placeholder={tab === 'users' ? 'ค้นหาชื่อผู้ใช้' : 'ค้นหาชื่อหรือรหัส'} />
          <Filters
            filters={[
              { key: 'amp', prompt: 'อำเภอ', opts: amps },
              ...(tab === 'areas' ? [{ key: 'tmb', prompt: 'ตำบล', opts: tmbs }] : []),
            ]}
          />
          {tab === 'orgs' && (
            <RowForm title="เพิ่มหน่วยงาน" trigger="add" save={saveOrg}>
              <OrgFields />
            </RowForm>
          )}
          {tab === 'areas' && (
            <RowForm title="เพิ่มหมู่บ้าน" trigger="add" save={saveArea}>
              <AreaFields orgs={orgs} />
            </RowForm>
          )}
        </div>
      </header>

      <nav className="mb-4 flex gap-1 border-b-2 border-primary">
        <TabLink href="/admin" active={tab === 'users'} Icon={Users} label="จัดการผู้ใช้" />
        <TabLink href="/admin?tab=orgs" active={tab === 'orgs'} Icon={Building2} label="จัดการหน่วยงาน" />
        <TabLink href="/admin?tab=areas" active={tab === 'areas'} Icon={Home} label="จัดการหมู่บ้าน" />
        <TabLink href="/admin?tab=diseases" active={tab === 'diseases'} Icon={Stethoscope} label="โรคที่ต้องรายงาน" />
      </nav>

      {tab === 'users' && <UsersTab q={q} amp={amp} skip={skip} page={page} orgOptions={orgOptions} roles={roles} />}
      {tab === 'orgs' && <OrgsTab like={like} q={q} amp={amp} skip={skip} page={page} />}
      {tab === 'areas' && <AreasTab like={like} q={q} amp={amp} tmb={tmb} skip={skip} page={page} orgs={orgs} />}
      {tab === 'diseases' && <DiseasesTab q={q} />}
    </main>
  )
}

// ---------- ผู้ใช้ ----------
async function UsersTab({ q, amp, skip, page, orgOptions, roles }: {
  q?: string; amp?: string; skip: number; page: number; orgOptions: React.ReactNode
  roles: { code: string; name: string }[]
}) {
  const where = {
    deleted_at: null,
    ...(q ? { OR: [{ full_name: { contains: q, mode: 'insensitive' as const } },
                   { username: { contains: q, mode: 'insensitive' as const } }] } : {}),
    // อำเภอของผู้ใช้ = อำเภอที่ตั้งของหน่วยงานที่สังกัด
    ...(amp ? { c_org: { area_code: { startsWith: amp } } } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.users.findMany({
      where,
      select: {
        id: true, username: true, full_name: true, position: true, email: true, tel: true,
        role: true, is_active: true, last_login_at: true, login_count: true, notify: true,
        user_role: { select: { name: true } },
        org_code: true, c_org: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
      skip, take: PAGE_SIZE,
    }),
    prisma.users.count({ where }),
  ])

  return (
    <>
      <Grid head={['ชื่อ-สกุล', 'บัญชี', 'หน่วยงาน', 'ติดต่อ', 'บทบาท', 'สถานะ', 'เข้าล่าสุด', '']} empty={total === 0}>
        {rows.map((u) => (
          <tr key={String(u.id)} className="border-b border-line last:border-0 odd:bg-surface-2/50 hover:bg-primary-soft">
            <td className={td}>
              <div className="font-medium">{u.full_name ?? '—'}</div>
              {u.position && <div className="sub text-fg-muted">{u.position}</div>}
            </td>
            <td className={`${td} font-mono text-fg-muted`}>{u.username}</td>
            <td className={td}>{u.c_org.name}</td>
            <td className={td}>
              <div>{u.tel ?? '—'}</div>
              {u.email && <div className="sub text-fg-muted">{u.email}</div>}
            </td>
            <td className={td}>
              <RoleBadge role={u.role} name={u.user_role.name} />
            </td>
            <td className={td}>
              <Badge on={u.is_active} yes="ใช้งาน" no="ปิด" warn />
            </td>
            <td className={`${td} tabular-nums`}>
              {u.last_login_at ? fmtDate(u.last_login_at) : '—'}
              <div className="sub text-fg-muted">{u.login_count} ครั้ง</div>
            </td>
            <td className={`${td} text-center`}>
              <RowForm title={`แก้ไข ${u.full_name ?? u.username}`} trigger="edit" save={saveUser}
                       remove={deleteUser} removeKey={{ name: 'id', value: String(u.id) }}>
                <input type="hidden" name="id" value={String(u.id)} />
                <Field label="หน่วยงาน">
                  <select name="org_code" defaultValue={u.org_code} className={field}>{orgOptions}</select>
                </Field>
                <Field label="เบอร์ติดต่อ">
                  <input name="tel" defaultValue={u.tel ?? ''} className={field} />
                </Field>
                <Field label="บทบาท">
                  <select name="role" defaultValue={u.role} className={field}>
                    {roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                  </select>
                </Field>
                <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm">
                  <span className="flex-1">เปิดใช้งานบัญชี</span>
                  <input type="checkbox" name="is_active" defaultChecked={u.is_active} className="size-4 accent-primary" />
                </label>
              </RowForm>
            </td>
          </tr>
        ))}
      </Grid>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  )
}

// ---------- หน่วยงาน ----------
async function OrgsTab({ like, q, amp, skip, page }: {
  like: { contains?: string; mode: 'insensitive' }; q?: string; amp?: string; skip: number; page: number
}) {
  const where = {
    deleted_at: null,
    ...(q ? { OR: [{ name: like }, { code: { contains: q } }] } : {}),
    ...(amp ? { area_code: { startsWith: amp } } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.c_org.findMany({
      where,
      select: { code: true, name: true, org_type: true, area_code: true, is_active: true,
                _count: { select: { users: true } } },
      orderBy: { code: 'asc' },
      skip, take: PAGE_SIZE,
    }),
    prisma.c_org.count({ where }),
  ])

  return (
    <>
      <Grid head={['รหัส', 'ชื่อหน่วยงาน', 'ประเภท', 'รหัสพื้นที่', 'ผู้ใช้', 'สถานะ', '']} empty={total === 0}>
        {rows.map((o) => (
          <tr key={o.code} className="border-b border-line last:border-0 odd:bg-surface-2/50 hover:bg-primary-soft">
            <td className={`${td} font-mono`}>{o.code}</td>
            <td className={td}>{o.name}</td>
            <td className={`${td} text-fg-muted`}>{o.org_type ?? '—'}</td>
            <td className={`${td} font-mono text-fg-muted`}>{o.area_code ?? '—'}</td>
            <td className={`${td} text-right font-mono tabular-nums`}>{o._count.users}</td>
            <td className={td}><Badge on={o.is_active} yes="ใช้งาน" no="ปิด" warn /></td>
            <td className={`${td} text-center`}>
              <RowForm title={`แก้ไข ${o.name}`} trigger="edit" save={saveOrg}
                       remove={deleteOrg} removeKey={{ name: 'code', value: o.code }}>
                <OrgFields org={o} />
              </RowForm>
            </td>
          </tr>
        ))}
      </Grid>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  )
}

// ---------- หมู่บ้าน ----------
async function AreasTab({ like, q, amp, tmb, skip, page, orgs }: {
  like: { contains?: string; mode: 'insensitive' }
  q?: string; amp?: string; tmb?: string; skip: number; page: number
  orgs: { code: string; name: string }[]
}) {
  const where = {
    level: 4,
    deleted_at: null,
    ...(q ? { OR: [{ name: like }, { code: { contains: q } }] } : {}),
    // รหัสหมู่บ้านขึ้นต้นด้วยรหัสตำบล ซึ่งขึ้นต้นด้วยรหัสอำเภอ กรองด้วย prefix ตัวเดียวพอ
    ...(tmb || amp ? { code: { startsWith: tmb ?? amp } } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.c_area.findMany({
      where,
      select: { code: true, name: true, population: true, parent_code: true,
                hos_village: { select: { org_code: true, c_org: { select: { code: true, name: true } } } } },
      orderBy: { code: 'asc' },
      skip, take: PAGE_SIZE,
    }),
    prisma.c_area.count({ where }),
  ])
  // ชื่อตำบล/อำเภอของหน้านี้เท่านั้น ไม่ต้องดึง c_area ทั้ง 1221 แถว
  const parents = await prisma.c_area.findMany({
    where: { code: { in: [...new Set(rows.flatMap((r) => [r.code.slice(0, 4), r.code.slice(0, 6)]))] } },
    select: { code: true, name: true },
  })
  const nameOf = new Map(parents.map((p) => [p.code, p.name]))

  return (
    <>
      <Grid head={['รหัส', 'หมู่บ้าน/ชุมชน', 'ตำบล', 'อำเภอ', 'ประชากร', 'หน่วยรับผิดชอบ', '']} empty={total === 0}>
        {rows.map((a) => (
          <tr key={a.code} className="border-b border-line last:border-0 odd:bg-surface-2/50 hover:bg-primary-soft">
            <td className={`${td} font-mono`}>{a.code}</td>
            <td className={td}>{a.name}</td>
            <td className={`${td} text-fg-muted`}>{nameOf.get(a.code.slice(0, 6)) ?? '—'}</td>
            <td className={`${td} text-fg-muted`}>{nameOf.get(a.code.slice(0, 4)) ?? '—'}</td>
            <td className={`${td} text-right font-mono tabular-nums`}>{a.population ?? '—'}</td>
            <td className={`${td} text-fg-muted`}>
              {a.hos_village ? `${a.hos_village.c_org.code}-${a.hos_village.c_org.name}` : '—'}
            </td>
            <td className={`${td} text-center`}>
              <RowForm title={`แก้ไข ${a.name}`} trigger="edit" save={saveArea}
                       remove={deleteArea} removeKey={{ name: 'code', value: a.code }}>
                <AreaFields area={a} orgs={orgs} owner={a.hos_village?.org_code} />
              </RowForm>
            </td>
          </tr>
        ))}
      </Grid>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  )
}

// ---------- ชิ้นส่วนที่ใช้ซ้ำ ----------
function RoleBadge({ role, name }: { role: string; name: string }) {
  return (
    <span className={`rounded-sm px-1.5 py-0.5 sub font-medium ${
      role === 'hospital' ? 'text-fg-muted' : 'bg-primary-soft text-primary'
    }`}>
      {name}
    </span>
  )
}

function Badge({ on, yes, no, warn }: { on: boolean; yes: string; no: string; warn?: boolean }) {
  const off = warn ? 'bg-warn-soft text-warn' : 'text-fg-muted'
  return (
    <span className={`rounded-sm px-1.5 py-0.5 sub font-medium ${on ? 'bg-primary-soft text-primary' : off}`}>
      {on ? yes : no}
    </span>
  )
}

// ---------- โรคที่ต้องรายงาน ----------
async function DiseasesTab({ q }: { q?: string }) {
  const rows = await prisma.c_disease506.findMany({
    where: q ? { OR: [{ code: { contains: q } },
                     { name_th: { contains: q, mode: 'insensitive' } },
                     { name_en: { contains: q, mode: 'insensitive' } }] } : {},
    orderBy: { code: 'asc' },
  })

  return (
    <>
      <p className="mb-2 text-xs text-fg-muted">
        เปิดสวิตช์ = โรคนั้นขึ้นเป็นตัวเลือกในฟอร์มแจ้งเคส
      </p>
      <Grid head={['รหัส 506', 'ชื่อโรค', 'ICD10', 'ต้องรายงาน']} empty={rows.length === 0}>
        {rows.map((d) => (
          <tr key={d.code} className="border-b border-line last:border-0 odd:bg-surface-2/50 hover:bg-primary-soft">
            <td className={`${td} font-mono`}>{d.code}</td>
            <td className={td}>
              <div className="font-medium">{d.name_th}</div>
              {d.name_en && <div className="sub text-fg-muted">{d.name_en}</div>}
            </td>
            <td className={`${td} font-mono text-fg-muted`}>{d.icd10.join(', ') || '—'}</td>
            <td className={td}><MustReportToggle code={d.code} on={d.must_report} /></td>
          </tr>
        ))}
      </Grid>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-fg-muted">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  )
}

function OrgFields({ org }: { org?: { code: string; name: string; org_type: string | null; area_code: string | null; is_active: boolean } }) {
  return (
    <>
      <Field label="รหัสหน่วยงาน (5 หลัก) *">
        {/* รหัสคือคีย์ แก้ไม่ได้หลังสร้าง ไม่งั้นข้อมูลเดิมที่อ้างถึงจะหลุด */}
        <input name="code" required inputMode="numeric" maxLength={5} defaultValue={org?.code ?? ''}
               readOnly={!!org} className={`${field} font-mono ${org ? 'opacity-60' : ''}`} />
      </Field>
      <Field label="ชื่อหน่วยงาน *">
        <input name="name" required defaultValue={org?.name ?? ''} className={field} />
      </Field>
      <Field label="ประเภท">
        <input name="org_type" defaultValue={org?.org_type ?? ''} placeholder="รพ.สต. / รพช. / สสอ." className={field} />
      </Field>
      <Field label="รหัสพื้นที่ตั้ง">
        <input name="area_code" defaultValue={org?.area_code ?? ''} placeholder="8 หลัก" className={`${field} font-mono`} />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm">
        <span className="flex-1">เปิดใช้งาน</span>
        <input type="checkbox" name="is_active" defaultChecked={org?.is_active ?? true} className="size-4 accent-primary" />
      </label>
    </>
  )
}

function TabLink({ href, active, label, Icon }: {
  href: string; active: boolean; label: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`-mb-0.5 flex items-center gap-1.5 rounded-t-sm border border-b-0 px-4 py-2 text-sm transition-colors duration-150 ${
        active ? 'border-primary bg-primary font-medium text-bg'
               : 'border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg'
      }`}
    >
      <Icon size={15} strokeWidth={1.75} />{label}
    </Link>
  )
}
