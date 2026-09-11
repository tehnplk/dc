'use client'

import { useActionState } from 'react'
import { CircleAlert, LogIn } from 'lucide-react'
import { superLogin, type AdminLoginState } from '@/app/auth/admin/actions'

const field = 'mt-1 block w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-primary focus:border-primary'

export function SuperLoginForm() {
  const [state, submit, pending] = useActionState<AdminLoginState, FormData>(superLogin, {})

  return (
    <form action={submit} className="space-y-3 px-6 py-6">
      <label className="block text-xs text-fg-muted">
        ชื่อผู้ใช้
        <input name="username" required autoComplete="username" className={field} />
      </label>
      <label className="block text-xs text-fg-muted">
        รหัสผ่าน
        <input name="password" type="password" required autoComplete="current-password" className={field} />
      </label>

      {state.error && (
        <p className="flex items-start gap-1.5 rounded-sm bg-warn-soft px-3 py-2 text-xs text-warn">
          <CircleAlert size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />{state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-bg transition-opacity duration-150 hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
      >
        <LogIn size={16} strokeWidth={2} aria-hidden />
        {pending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
      </button>

      <p className="text-[11px] text-fg-muted">
        บัญชีนี้ดูข้อมูลผู้ป่วยได้อย่างเดียว ใช้สำหรับจัดการระบบเท่านั้น
      </p>
    </form>
  )
}
