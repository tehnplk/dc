import { notFound } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { superUserEnabled } from '@/lib/superuser'
import { SuperLoginForm } from '@/components/SuperLoginForm'

export const dynamic = 'force-dynamic'

export default function Page() {
  // ไม่ตั้งค่าใน .env = ไม่มีหน้านี้ ไม่ใช่แค่ล็อกอินไม่ผ่าน
  if (!superUserEnabled()) notFound()

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-bg p-6">
      <div className="w-[min(24rem,100%)] rounded-sm border border-line bg-surface">
        <div className="flex items-center gap-2.5 bg-brand px-5 py-4 text-on-brand">
          <ShieldCheck size={22} strokeWidth={2.25} aria-hidden />
          <span>
            <span className="block text-base font-bold tracking-wide">PLK SRRT</span>
            <span className="block text-[11px] leading-tight opacity-90">บัญชีผู้ดูแลระบบ</span>
          </span>
        </div>
        <SuperLoginForm />
      </div>
    </main>
  )
}
