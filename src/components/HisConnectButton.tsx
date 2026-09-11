'use client'

import { useEffect, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, DatabaseZap } from 'lucide-react'

const AGENT_URL = 'http://localhost:5050'

export function HisConnectButton() {
  const dlg = useRef<HTMLDialogElement>(null)
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    // กัน InvalidStateError กรณี state สลับ ok<->fail ทั้งที่กล่องยังเปิดอยู่
    if ((state === 'ok' || state === 'fail') && !dlg.current?.open) dlg.current?.showModal()
  }, [state])

  const check = async () => {
    setState('checking')
    try {
      // no-cors: ตัว agent รันที่เครื่องผู้ใช้ ไม่มี CORS header ก็ปกติ
      // แบบนี้อ่าน body ไม่ได้ แต่บอกได้ว่า "ต่อติดหรือไม่" ซึ่งคือสิ่งที่ต้องรู้ตรงนี้
      await fetch(AGENT_URL, { mode: 'no-cors', signal: AbortSignal.timeout(3000) })
      setState('ok')
    } catch {
      setState('fail')
    }
  }

  const fail = state === 'fail'

  return (
    <>
      <button
        type="button"
        onClick={check}
        disabled={state === 'checking'}
        className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-line px-3 text-sm text-fg transition-colors duration-150 hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-60"
      >
        <DatabaseZap size={15} strokeWidth={1.75} aria-hidden />
        {state === 'checking' ? 'กำลังเชื่อมต่อ…' : 'เชื่อมต่อ HIS'}
      </button>

      {(state === 'ok' || state === 'fail') && (
        <dialog
          ref={dlg}
          aria-labelledby="his-title"
          onClose={(e) => { if (e.target === dlg.current) setState('idle') }}
          onClick={(e) => { if (e.target === dlg.current) dlg.current?.close() }}
          className="m-auto w-[min(28rem,92vw)] rounded-md border border-line bg-surface p-0 text-left text-fg backdrop:bg-black/50"
        >
          <div className="px-6 pt-7 pb-5 text-center">
            <div className={`mx-auto mb-4 flex size-16 items-center justify-center rounded-full ${fail ? 'bg-warn-soft text-warn' : 'bg-primary-soft text-primary'}`}>
              {fail
                ? <CircleAlert size={30} strokeWidth={1.5} aria-hidden />
                : <CircleCheck size={30} strokeWidth={1.5} aria-hidden />}
            </div>
            <h2 id="his-title" className="text-lg font-semibold">
              {fail ? 'เชื่อมต่อ HIS ไม่ได้' : 'เชื่อมต่อ SRRT Agent แล้ว'}
            </h2>
            <p className="mt-2 text-sm text-fg-muted">
              {fail ? 'กรุณาเปิดโปรแกรม SRRT Agent ที่เครื่องคอมพิวเตอร์เครื่องนี้' : 'พร้อมดึงข้อมูลจาก HIS'}
            </p>
            <p className="mt-1 font-mono text-xs text-fg-muted">{AGENT_URL}</p>
          </div>

          <div className="flex gap-2 border-t border-line px-6 py-4">
            {fail && (
              <button
                type="button"
                onClick={() => { dlg.current?.close(); check() }}
                className="flex-1 cursor-pointer rounded-sm border border-line px-3 py-2 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
              >
                ลองใหม่
              </button>
            )}
            <button
              type="button"
              onClick={() => dlg.current?.close()}
              className="flex-1 cursor-pointer rounded-sm bg-primary px-3 py-2 text-sm font-medium text-bg transition-opacity duration-150 hover:opacity-85"
            >
              ปิด
            </button>
          </div>
        </dialog>
      )}
    </>
  )
}
