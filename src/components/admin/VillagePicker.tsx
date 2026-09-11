'use client'

import { useState } from 'react'
export type Choice = {
  code: string; moo: number; name: string
  tmbCode: string; tmb: string; amp: string
  owner: string | null
}

/**
 * ตารางติ๊กเลือกหมู่บ้านในโมดัล "เพิ่มหมู่บ้านรับผิดชอบ"
 * กรองตำบลด้วยการซ่อนแถว ไม่ได้ถอดออกจาก DOM ที่ติ๊กไว้แล้วจะได้ไม่หาย
 */
export function VillagePicker({ choices, amp }: { choices: Choice[]; amp: string | null }) {
  const [tmb, setTmb] = useState('')
  const tmbs = [...new Map(choices.map((c) => [c.tmbCode, c.tmb])).entries()]
  const shown = tmb ? choices.filter((c) => c.tmbCode === tmb).length : choices.length

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-fg-muted">
          เลือกได้เฉพาะหมู่บ้านที่ยังไม่มีหน่วยงานรับผิดชอบ · อ.{amp ?? '—'}
        </p>
        <select
          value={tmb}
          onChange={(e) => setTmb(e.target.value)}
          className="ml-auto w-40 shrink-0 rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-primary focus:border-primary"
        >
          <option value="">ตำบล</option>
          {tmbs.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </div>

      <div className="max-h-[50vh] overflow-auto rounded-sm border border-line">
        <table data-grid className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-brand text-on-brand">
            <tr>
              <th className="w-8 px-2 py-1.5" />
              <th className="px-2 py-1.5 text-left font-medium whitespace-nowrap">รหัส</th>
              <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">หมู่ที่</th>
              <th className="px-2 py-1.5 text-left font-medium whitespace-nowrap">หมู่บ้าน/ชุมชน</th>
              <th className="px-2 py-1.5 text-left font-medium whitespace-nowrap">ตำบล</th>
              <th className="px-2 py-1.5 text-left font-medium whitespace-nowrap">อำเภอ</th>
              <th className="px-2 py-1.5 text-left font-medium whitespace-nowrap">หน่วยงานรับผิดชอบ</th>
            </tr>
          </thead>
          <tbody>
            {shown === 0 && (
              <tr><td colSpan={7} className="px-2 py-6 text-center text-fg-muted">ไม่มีหมู่บ้านให้เลือก</td></tr>
            )}
            {choices.map((c) => (
              <tr key={c.code}
                  hidden={!!tmb && c.tmbCode !== tmb}
                  className={`border-b border-line last:border-0 odd:bg-surface-2/50 ${c.owner ? 'opacity-50' : 'hover:bg-primary-soft'}`}>
                <td className="px-2 py-1.5 text-center">
                  <input type="checkbox" name="area_code" value={c.code} disabled={!!c.owner}
                         aria-label={`เลือก ${c.name}`}
                         className="size-4 accent-primary disabled:cursor-not-allowed" />
                </td>
                <td className="px-2 py-1.5 font-mono">{c.code}</td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">{c.moo || '—'}</td>
                <td className="px-2 py-1.5">{c.name}</td>
                <td className="px-2 py-1.5 text-fg-muted">{c.tmb}</td>
                <td className="px-2 py-1.5 text-fg-muted">{c.amp}</td>
                <td className="px-2 py-1.5 text-fg-muted">{c.owner ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
