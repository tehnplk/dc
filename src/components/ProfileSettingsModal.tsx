'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CircleAlert, IdCard, Phone, Search, X } from 'lucide-react'
import { getOrgs, saveProfile, type ProfileState } from '@/app/profile/actions'
import { chooseOrg } from '@/app/auth/org/actions'
import { maskCid, validCid } from '@/lib/cid'

export type Me = {
  cid: string | null
  tel: string | null
  org_code: string
  org_name: string
  notify: boolean
}

type Org = { code: string; name: string }

const field = 'block w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-primary focus:border-primary'

type Props = {
  me: Me
  open: boolean
  /** ส่งมาเมื่อฝั่ง server เตรียมไว้แล้ว (ตอน setup ยังไม่มีเซสชัน เรียก action ไม่ได้) */
  orgList?: Org[]
  onClose?: () => void
  /** setup = ตอนล็อกอินครั้งแรก ยังไม่มีบัญชี ปิดไม่ได้จนกว่าจะเลือกหน่วยงาน */
  mode?: 'edit' | 'setup'
  greeting?: string
}

export function ProfileSettingsModal({ me, open, onClose, mode = 'edit', greeting, orgList }: Props) {
  const setup = mode === 'setup'
  const dlg = useRef<HTMLDialogElement>(null)
  const [orgs, setOrgs] = useState<Org[] | null>(orgList ?? null)
  const [q, setQ] = useState('')
  const [code, setCode] = useState(me.org_code)
  const [cid, setCid] = useState(maskCid(me.cid ?? ''))
  const [notify, setNotify] = useState(me.notify)
  // ตอน setup ยังไม่มีแถวใน user ต้องใช้ action ที่สร้างบัญชี ไม่ใช่ update
  const [state, submit, pending] = useActionState<ProfileState, FormData>(setup ? chooseOrg : saveProfile, {})

  useEffect(() => {
    // showModal() บน dialog ที่เปิดอยู่แล้วจะ throw InvalidStateError แล้ว React ถอดทั้ง tree ทิ้ง
    // (เคยทำให้โมดัลเด้งแวบเดียวแล้วหาย ตอนรายชื่อหน่วยงานโหลดเสร็จแล้ว effect วิ่งซ้ำ)
    if (open && !dlg.current?.open) dlg.current?.showModal()
  }, [open])

  useEffect(() => {
    // โหลดตอนเปิดเท่านั้น ไม่ต้องส่งไปกับทุกหน้า
    // ข้ามตอน setup: getOrgs() ต้องมีเซสชัน ยังไม่มีบัญชีจะโดนเด้งไปหน้าล็อกอินทั้งหน้า
    if (open && !orgs && !orgList) getOrgs().then(setOrgs)
  }, [open, orgs, orgList])

  const closed = useRef(onClose)
  closed.current = onClose
  useEffect(() => {
    if (state.ok) dlg.current?.close()
  }, [state.ok])

  const digits = cid.replace(/\D/g, '')
  const okCid = validCid(digits)              // มีเลขบัตรที่ถูกต้องเท่านั้นถึงเปิดแจ้งเตือนได้
  const badCid = digits.length > 0 && !okCid
  const list = useMemo(() => {
    if (!orgs) return []
    const k = q.trim().toLowerCase()
    return k ? orgs.filter((o) => o.name.toLowerCase().includes(k) || o.code.includes(k)) : orgs
  }, [orgs, q])

  if (!open) return null

  return (
    <dialog
      ref={dlg}
      aria-labelledby="profile-title"
      // setup: กด Esc / คลิกนอกกล่องแล้วต้องไม่หลุด ยังไม่มีบัญชีให้กลับไปใช้
      onCancel={(e) => { if (setup) e.preventDefault() }}
      onClose={(e) => { if (e.target === dlg.current) closed.current?.() }}
      onClick={(e) => { if (!setup && e.target === dlg.current) dlg.current?.close() }}
      className="m-auto w-[min(30rem,95vw)] rounded-sm border border-line bg-surface p-0 text-left text-fg backdrop:bg-black/50"
    >
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          {/* มีชื่อผู้ใช้เมื่อไหร่ ชื่อคือตัวหลัก หัวข้อถอยไปเป็นป้ายกำกับเล็ก ๆ */}
          <h2 id="profile-title" className={greeting ? 'text-xs text-fg-muted' : 'text-base font-semibold'}>
            ตั้งค่าบัญชี
          </h2>
          {greeting && <p className="truncate text-base font-semibold">{greeting}</p>}
        </div>
        {!setup && (
          <button
            type="button"
            onClick={() => dlg.current?.close()}
            aria-label="ปิด"
            className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <X size={16} strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </header>

      <form action={submit} className="space-y-3 px-5 py-4">
        <div className="text-xs text-fg-muted">
          หน่วยงานปัจจุบัน *
          <span className="relative mt-1 block">
            <Search size={14} strokeWidth={1.75} aria-hidden
                    className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นชื่อหน่วยงาน หรือรหัส 5 หลัก"
                   className={`${field} pl-8`} />
          </span>
          <select name="org_code" required size={6} value={code} onChange={(e) => setCode(e.target.value)}
                  className={`${field} mt-1.5 py-1`}>
            {orgs === null
              ? <option value={me.org_code}>{me.org_code} · {me.org_name}</option>
              : list.map((o) => <option key={o.code} value={o.code}>{o.code} · {o.name}</option>)}
          </select>
        </div>

        <label className="block text-xs text-fg-muted">
          เบอร์มือถือ
          <span className="relative mt-1 block">
            <Phone size={15} strokeWidth={1.75} aria-hidden
                   className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
            <input name="tel" inputMode="tel" defaultValue={me.tel ?? ''} placeholder="08x-xxx-xxxx"
                   className={`${field} pl-8`} />
          </span>
        </label>

        <label className="block text-xs text-fg-muted">
          เลขบัตรประชาชน
          <span className="relative mt-1 block">
            <IdCard size={15} strokeWidth={1.75} aria-hidden
                    className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
            <input
              name="cid"
              inputMode="numeric"
              autoComplete="off"
              value={cid}
              onChange={(e) => {
                const v = maskCid(e.target.value)
                setCid(v)
                // เลขไม่ผ่านแล้วยังติ๊กค้างไว้ไม่ได้ ปลดให้เลยตอนพิมพ์
                if (!validCid(v.replace(/\D/g, ''))) setNotify(false)
              }}
              placeholder="1-2345-67890-12-3"
              className={`${field} pl-8 font-mono tracking-wide`}
            />
          </span>
          <span className={`mt-1 block ${badCid ? 'text-warn' : ''}`}>
            {badCid ? 'เลขบัตรไม่ถูกต้อง' : 'เพื่อรับการแจ้งเตือนผ่านไลน์หมอพร้อม'}
          </span>
        </label>

        {/* ติ๊กไม่ได้ถ้าไม่มีเลขบัตรที่ถูกต้อง — แจ้งเตือนต้องใช้เลขบัตรผูกกับหมอพร้อม */}
        <label className={`flex items-center gap-2 rounded-sm border border-line px-3 py-2.5 text-sm ${
          okCid ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
        }`}>
          <Bell size={15} strokeWidth={1.75} className="shrink-0 text-fg-muted" aria-hidden />
          <span className="flex-1">รับการแจ้งเตือนจากไลน์หมอพร้อม</span>
          <input
            type="checkbox"
            name="notify"
            checked={notify && okCid}
            disabled={!okCid}
            onChange={(e) => setNotify(e.target.checked)}
            className="size-4 accent-primary"
          />
        </label>

        {state.error && (
          <p className="flex items-start gap-1.5 rounded-sm bg-warn-soft px-3 py-2 text-xs text-warn">
            <CircleAlert size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />{state.error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          {/* setup ไม่มีปุ่มยกเลิก ยกเลิกแล้วจะไปไหนต่อ */}
          {!setup && (
            <button type="button" onClick={() => dlg.current?.close()}
                    className="flex-1 cursor-pointer rounded-sm border border-line px-3 py-2 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
              ยกเลิก
            </button>
          )}
          <button type="submit" disabled={pending || badCid}
                  className="flex-1 cursor-pointer rounded-sm bg-primary px-3 py-2 text-sm font-medium text-bg transition-opacity duration-150 hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? 'กำลังบันทึก…' : setup ? 'เริ่มใช้งาน' : 'บันทึก'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
