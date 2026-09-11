import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { readPending } from '@/lib/auth'
import { SetupGate } from '@/components/SetupGate'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const p = await readPending()
  if (!p) redirect('/auth/signin')

  // ต้องเตรียมรายชื่อหน่วยงานจากฝั่ง server: ตอนนี้ยังไม่มีเซสชัน โมดัลเรียก server action ไม่ได้
  // hoscode จาก SSO ใช้เป็นค่าตั้งต้นถ้าตรงกับที่มีในระบบ ผู้ใช้ยังแก้ได้
  const [orgs, suggested] = await Promise.all([
    prisma.c_org.findMany({
      where: { is_active: true, deleted_at: null },
      select: { code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    p.hoscode
      ? prisma.c_org.findUnique({ where: { code: p.hoscode }, select: { code: true } })
      : null,
  ])

  return (
    <main className="min-h-dvh flex-1 bg-bg">
      {/* ไม่มีเนื้อหาด้านหลัง: ยังไม่มีบัญชี เลยยังเข้าหน้าไหนไม่ได้ */}
      <SetupGate
        greeting={p.name ?? p.provider_id ?? p.sub}
        org_code={suggested?.code ?? ''}
        org_name={p.hname ?? ''}
        orgs={orgs}
      />
    </main>
  )
}
