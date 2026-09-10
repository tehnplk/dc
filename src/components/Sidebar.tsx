'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Activity,
  ClipboardPlus,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from 'lucide-react'

const nav = [
  { href: '/patients', label: 'ผู้ป่วยทั้งหมด', Icon: Users },
  { href: '/report', label: 'ทะเบียนแจ้ง', Icon: ClipboardPlus },
  { href: '/accept', label: 'ทะเบียนรับ', Icon: Inbox },
] as const

export function Sidebar() {
  const [open, setOpen] = useState(true)
  const pathname = usePathname()
  const Toggle = open ? PanelLeftClose : PanelLeftOpen

  return (
    <nav
      className={`${open ? 'w-60' : 'w-16'} flex shrink-0 flex-col border-r border-line
                  bg-surface transition-[width] duration-200 ease-out`}
    >
      {/* แถบหัวสีเขียวทึบ — flat design ใช้บล็อกสีแทนเงา/ไล่สี */}
      <div className={`flex h-14 items-center gap-2.5 bg-brand px-4 text-on-brand
                       ${open ? '' : 'justify-center px-0'}`}>
        <Activity size={20} strokeWidth={2.25} className="shrink-0" aria-hidden />
        {open && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-wide">PLK SRRT</span>
            <span className="block truncate text-[11px] leading-tight opacity-90">เฝ้าระวังทางระบาดวิทยา</span>
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'ย่อเมนู' : 'ขยายเมนู'}
        className={`flex h-11 cursor-pointer items-center gap-3 px-3 text-fg-muted
                    transition-colors duration-150 hover:bg-surface-2 hover:text-fg
                    ${open ? '' : 'justify-center px-0'}`}
      >
        <Toggle size={20} strokeWidth={1.75} className="shrink-0" aria-hidden />
        {open && <span className="text-xs">ย่อเมนู</span>}
      </button>

      <ul className="flex flex-col gap-0.5 p-2">
        {nav.map(({ href, label, Icon }) => {
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
    </nav>
  )
}
