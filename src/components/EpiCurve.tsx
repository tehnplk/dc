'use client'

import { useCallback } from 'react'
import { toBE } from '@/lib/epi'
import type { TooltipItem } from 'chart.js'
import { Chart } from './Chart'

/** หนึ่งเส้นต่อหนึ่งปีระบาด · cases ยาว 52 ช่อง · null = ยังไม่ถึงสัปดาห์นั้น (ปีปัจจุบัน) */
export type EpiYear = { year: number; cases: (number | null)[] }

export function EpiCurve({ years }: { years: EpiYear[] }) {
  const labels = years[0]?.cases.map((_, i) => String(i + 1)) ?? []

  const config = useCallback(
    (c: { primary: string; line: string; muted: string; warn: string }) => {
      // ปีล่าสุดเป็นพระเอก เส้นหนาทึบมีพื้นใต้เส้น · ปีก่อน ๆ เป็นเส้นประบาง ๆ ไว้เทียบ
      const style = [
        { color: c.primary, width: 2.5, dash: [] as number[], fill: true },
        { color: c.warn, width: 1.5, dash: [5, 3], fill: false },
        { color: c.muted, width: 1.5, dash: [2, 3], fill: false },
      ]
      return {
        type: 'line' as const,
        data: {
          labels,
          datasets: years.map((y, i) => {
            const s = style[i] ?? style[style.length - 1]
            return {
              label: `ปี ${toBE(y.year)}`,
              data: y.cases,
              borderColor: s.color,
              backgroundColor: s.color + '26',
              borderDash: s.dash,
              fill: s.fill,
              borderWidth: s.width,
              tension: 0.3,
              pointRadius: 0,            // 52 จุด × 3 เส้น ถ้าโชว์จุดหมดจะเละ
              pointHoverRadius: 4,
              pointBackgroundColor: s.color,
              spanGaps: false,           // ปีปัจจุบันต้องหยุดที่สัปดาห์ล่าสุด ไม่ลากข้ามช่องว่าง
            }
          }),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index' as const, intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top' as const,
              align: 'end' as const,
              labels: { color: c.muted, boxWidth: 18, boxHeight: 2, font: { size: 11 } },
            },
            tooltip: {
              callbacks: {
                title: (items: TooltipItem<'line'>[]) => `สัปดาห์ที่ ${items[0].label}`,
                label: (i: TooltipItem<'line'>) => ` ${i.dataset.label} — ${i.parsed.y} ราย`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                color: c.muted, font: { size: 10 },
                // 52 ป้ายซ้อนกันแน่ โชว์ทุก 4 สัปดาห์ประมาณเดือนละครั้ง
                callback: (_v: unknown, i: number) => (i % 4 === 0 ? labels[i] : ''),
                autoSkip: false,
              },
            },
            y: { beginAtZero: true, grid: { color: c.line }, ticks: { color: c.muted, precision: 0 } },
          },
        },
      }
    },
    [years, labels],
  )

  return <Chart config={config} height={240} />
}
