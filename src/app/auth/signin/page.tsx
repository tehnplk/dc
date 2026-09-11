import { Activity, CircleAlert, LogIn } from 'lucide-react'
import { LoginCountdown } from '@/components/LoginCountdown'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: PageProps<'/auth/signin'>) {
  const sp = await searchParams
  const error = typeof sp.error === 'string' ? sp.error : null
  const next = typeof sp.next === 'string' && sp.next.startsWith('/') ? sp.next : '/'

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-bg p-6">
      <div className="w-[min(26rem,100%)] rounded-sm border border-line bg-surface">
        <div className="flex items-center gap-2.5 bg-brand px-5 py-4 text-on-brand">
          <Activity size={22} strokeWidth={2.25} aria-hidden />
          <span>
            <span className="block text-base font-bold tracking-wide">PLK SRRT</span>
            <span className="block text-[11px] leading-tight opacity-90">Network Operating System</span>
          </span>
        </div>

        <div className="px-6 py-8 text-center">
          <p className="text-sm text-fg-muted">เข้าสู่ระบบด้วย PLKHEALTH Single Sign On</p>

          {error && (
            <p className="mt-4 flex items-start gap-1.5 rounded-sm bg-warn-soft px-3 py-2 text-left text-xs text-warn">
              <CircleAlert size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          {/* ล็อกอินล้มเหลวแล้วนับถอยหลังต่อ = วนไป SSO ไม่รู้จบ ให้ผู้ใช้กดเองแทน */}
          {error ? (
            <a
              href={`/auth/login?next=${encodeURIComponent(next)}`}
              className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-bg transition-opacity duration-150 hover:opacity-85"
            >
              <LogIn size={16} strokeWidth={2} aria-hidden />ลองเข้าสู่ระบบอีกครั้ง
            </a>
          ) : (
            <LoginCountdown href={`/auth/login?next=${encodeURIComponent(next)}`} />
          )}

        </div>
      </div>
    </main>
  )
}
