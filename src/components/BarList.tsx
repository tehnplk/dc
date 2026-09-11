'use client'

import { useCallback } from 'react'
import type { TooltipItem } from 'chart.js'
import { Chart } from './Chart'

type Row = { label: string; value: number; extra: number | null }

export function BarList({ title, rows, unit, note }: {
  title: string; rows: Row[]; unit: string; note?: string
}) {
  const config = useCallback(
    (c: { primary: string; line: string; muted: string }) => ({
      type: 'bar' as const,
      data: {
        labels: rows.map((r) => r.label),
        datasets: [{ label: unit, data: rows.map((r) => r.value), backgroundColor: c.primary, borderRadius: 2 }],
      },
      options: {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              // อัตราต่อแสนไม่มีที่ลงในกราฟแท่ง เอามาไว้ใน tooltip แทน
              label: (i: TooltipItem<'bar'>) => {
                const e = rows[i.dataIndex].extra
                return ` ${i.parsed.x} ${unit}${e !== null ? ` · ${e} ต่อแสน ปชก.` : ''}`
              },
            },
          },
        },
        scales: {
          x: { beginAtZero: true, grid: { color: c.line }, ticks: { color: c.muted, precision: 0 } },
          y: { grid: { display: false }, ticks: { color: c.muted, font: { size: 11 } } },
        },
      },
    }),
    [rows, unit],
  )

  return (
    <section className="rounded-sm border border-line bg-surface p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && <span className="ml-auto text-[11px] text-fg-muted">{note}</span>}
      </div>

      {rows.length === 0
        ? <p className="py-6 text-center text-xs text-fg-muted">ไม่มีข้อมูล</p>
        : <Chart config={config} height={Math.max(140, rows.length * 26 + 30)} />}
    </section>
  )
}
