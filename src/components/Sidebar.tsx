'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GridFontToggle } from './GridFontToggle'
import { ThemeToggle } from './ThemeToggle'
import { ProfileSettingsModal, type Me } from './ProfileSettingsModal'
import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ChartColumnBig,
  ShieldCheck as ShieldIcon,
  ClipboardPlus,
  ChevronUp,
  Home,
  LogIn,
  LogOut,
  Settings,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'แดชบอร์ด', Icon: ChartColumnBig },
  { href: '/patients', label: 'ผู้ป่วยทั้งหมด', Icon: Users },
  { href: '/report', label: 'ทะเบียนแจ้ง', Icon: ClipboardPlus },
  { href: '/accept', label: 'ทะเบียนรับ', Icon: Inbox },
] as const

const adminNav = { href: '/admin', label: 'ผู้ดูแลระบบ', Icon: ShieldIcon } as const
const areaNav = { href: '/hospital/village', label: 'หมู่บ้านรับผิดชอบ', Icon: Home } as const

type User = {
  name: string | null
  org: string
  position: string | null
  email: string | null
  role: string
  roleName: string
  super: boolean
  me: Me
}

export function Sidebar({ user }: { user: User | null }) {
  const [open, setOpen] = useState(true)
  const [menu, setMenu] = useState(false)
  const [settings, setSettings] = useState(false)
  const menuBox = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // เมนูลอยต้องปิดเมื่อคลิกที่อื่นหรือกด Esc ไม่งั้นค้างทับเนื้อหา
  useEffect(() => {
    if (!menu) return
    const away = (e: MouseEvent) => {
      if (!menuBox.current?.contains(e.target as Node)) setMenu(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [menu])

  const initial = (user?.name ?? '?').trim().replace(/^(นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.)\s*/, '').charAt(0) || '?'
  const Toggle = open ? PanelLeftClose : PanelLeftOpen

  return (
    <nav
      // sticky + h-dvh: ไม่งั้นแถบยาวตามเนื้อหา บล็อกผู้ใช้ล่างสุดจะไปอยู่ท้ายหน้า ไม่ใช่ท้ายจอ
      className={`${open ? 'w-60' : 'w-16'} sticky top-0 flex h-dvh shrink-0 flex-col
                  border-r border-line bg-surface transition-[width] duration-200 ease-out`}
    >
      {/* แถบหัวสีเขียวทึบ — flat design ใช้บล็อกสีแทนเงา/ไล่สี */}
      <div className={`flex h-14 items-center gap-2.5 bg-brand px-4 text-on-brand
                       ${open ? '' : 'justify-center px-0'}`}>
        <Activity size={20} strokeWidth={2.25} className="shrink-0" aria-hidden />
        {open && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-wide">PLK SRRT</span>
            <span className="block truncate text-[11px] leading-tight opacity-90">Network Operating System</span>
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'ย่อเมนู' : 'ขยายเมนู'}
        title={open ? 'ย่อเมนู' : 'ขยายเมนู'}
        className={`flex h-11 w-full cursor-pointer items-center gap-2 text-fg-muted
                    transition-colors duration-150 hover:bg-surface-2 hover:text-fg
                    ${open ? 'justify-end px-3' : 'justify-center px-0'}`}
      >
        {/* ปุ่มย่อชิดขอบขวาของแถบ ไอคอนอยู่ริมสุด */}
        {open && <span className="text-xs">ย่อเมนู</span>}
        <Toggle size={20} strokeWidth={1.75} className="shrink-0" aria-hidden />
      </button>

      <ul className="flex flex-col gap-0.5 p-2">
        {(user
          ? [...nav,
             ...(user.super || user.role === 'province' ? [adminNav]
               : user.role === 'hospital' ? [areaNav] : [])]
          // ยังไม่ล็อกอิน: /dashboard เป็นหน้าเดียวที่เปิดสาธารณะ เมนูอื่นกดไปก็โดนเด้ง
          : nav.filter((n) => n.href === '/dashboard')
        ).map(({ href, label, Icon }) => {
          const active = pathname === href
          return (
            <li key={href}>
              <Link
                href={href}
                title={open ? undefined : label}   // ย่อแล้วเหลือแต่ไอคอน ต้องมี tooltip
                aria-current={active ? 'page' : undefined}
                className={`flex h-11 cursor-pointer items-center gap-3 rounded-sm border-l-2 px-3
                  text-sm transition-colors duration-150
                  ${open ? '' : 'justify-center px-0'}
                  ${active
                    ? 'border-fg bg-surface-2 font-medium text-fg'
                    : 'border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg'}`}
              >
                <Icon size={20} strokeWidth={active ? 2.25 : 1.75} className="shrink-0" aria-hidden />
                {open && <span className="truncate">{label}</span>}
              </Link>
            </li>
          )
        })}
      </ul>

      {!user ? (
        // ยังไม่ล็อกอิน: ท้ายแถบเป็นทางเข้าระบบ (a ธรรมดา ปลายทางออกนอกโดเมนไป SSO)
        <div className="mt-auto border-t border-line p-2">
          <a
            href="/auth/login?next=%2Fdashboard"
            title={open ? undefined : 'เข้าสู่ระบบ'}
            className={`flex h-11 cursor-pointer items-center gap-2.5 rounded-sm bg-primary px-3 text-sm font-medium text-bg transition-opacity duration-150 hover:opacity-85 ${open ? '' : 'justify-center px-0'}`}
          >
            <LogIn size={18} strokeWidth={2} className="shrink-0" aria-hidden />
            {open && <span>เข้าสู่ระบบ</span>}
          </a>
        </div>
      ) : (
        // ผู้ใช้ที่ล็อกอินอยู่ ดันไว้ล่างสุด — เมนูเปิดขึ้นบนเพราะปุ่มติดขอบล่างจอ
        <div ref={menuBox} className="relative mt-auto border-t border-line p-2">
          {menu && (
            <div
              role="menu"
              className={`absolute bottom-full mb-1 rounded-sm border border-line bg-surface py-1 shadow-lg ${
                open ? 'right-2 left-2' : 'left-2 w-56'
              }`}
            >
              {/* เครื่องมือแสดงผล: ขนาดตัวอักษรตาราง แล้วค่อยธีม */}
              <GridFontToggle />
              <ThemeToggle />

              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenu(false); setSettings(true) }}
                className="flex w-full cursor-pointer items-center gap-2 border-t border-line px-3 py-2 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
              >
                <Settings size={15} strokeWidth={1.75} aria-hidden />ตั้งค่าบัญชี
              </button>

              <a
                href="/auth/logout"
                role="menuitem"
                className="flex items-center gap-2 border-t border-line px-3 py-2 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-warn"
              >
                <LogOut size={15} strokeWidth={1.75} aria-hidden />ออกจากระบบ
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-expanded={menu}
            aria-haspopup="menu"
            title={open ? undefined : (user.name ?? 'บัญชีผู้ใช้')}
            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-2 ${open ? '' : 'justify-center px-0'}`}
          >
            {/* อักษรแรกของชื่อแทนรูป ไม่ต้องมีระบบอัปโหลดรูปโปรไฟล์ */}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand">
              {initial}
            </span>
            {open && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{user.name ?? '—'}</span>
                  <span className="block truncate text-[11px] text-fg-muted">{user.org}</span>
                  <span className="block truncate text-[11px] text-fg-muted">บทบาท {user.roleName}</span>
                </span>
                <ChevronUp
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden
                  className={`shrink-0 text-fg-muted transition-transform duration-150 ${menu ? '' : 'rotate-180'}`}
                />
              </>
            )}
          </button>
        </div>
      )}

      {/* อยู่นอกเมนู: กดแล้วเมนูปิด โมดัลต้องไม่ถูกถอดตามไปด้วย */}
      {user && <ProfileSettingsModal me={user.me} open={settings} onClose={() => setSettings(false)} />}
    </nav>
  )
}
