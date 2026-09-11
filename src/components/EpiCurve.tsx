'use client'

import { useCallback } from 'react'
import { fmtDate } from '@/lib/datetime'
import type { TooltipItem } from 'chart.js'
import { Chart } from './Chart'

export function EpiCurve({ data }: { data: { wk: string; cases: number }[] }) {
  const labels = data.map((d) => {
    const t = new Date(d.wk)
    return `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}`
  })

  const config = useCallback(
    (c: { primary: string; line: string; muted: string }) => ({
      type: 'line' as const,
      data: {
        labels,
        datasets: [{
          label: 'ผู้ป่วย',
          data: data.map((d) => d.cases),
          borderColor: c.primary,
          // พื้นใต้เส้นจาง ๆ ช่วยให้เห็นลูกระบาด ไม่ใช่แค่เส้นลอย
          backgroundColor: c.primary + '26',
          fill: true,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: c.primary,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index' as const, intersect: false },   // ชี้ตรงไหนก็จับจุดที่ใกล้ที่สุดในคอลัมน์นั้น
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              // หัว tooltip เป็นวันที่เต็ม ป้ายแกนย่อเหลือ วว/ดด ไม่งั้นซ้อนกัน
              title: (items: TooltipItem<'line'>[]) =>
                `สัปดาห์ ${fmtDate(new Date(data[items[0].dataIndex].wk))}`,
              label: (i: TooltipItem<'line'>) => ` ${i.parsed.y} ราย`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.muted, font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: c.line }, ticks: { color: c.muted, precision: 0 } },
        },
      },
    }),
    [data, labels],
  )

  return <Chart config={config} height={224} />
}
