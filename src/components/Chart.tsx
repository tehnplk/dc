'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BarController, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend,
  LineController, LineElement, LinearScale, PointElement, Tooltip,
  type ChartConfiguration,
} from 'chart.js'

// ลงทะเบียนเฉพาะที่ใช้ (tree-shaking ของ chart.js) ไม่เอา Chart.register(...registerables)
ChartJS.register(
  BarController, BarElement, LineController, LineElement, PointElement,
  CategoryScale, LinearScale, Filler, Tooltip, Legend,
)

/** อ่านสีจาก CSS variable ของธีม กราฟจะได้เปลี่ยนตาม dark/light ไม่ต้องฮาร์ดโค้ดสี */
function themeColors() {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string) => s.getPropertyValue(name).trim()
  return { primary: v('--primary'), line: v('--line'), muted: v('--fg-muted') }
}

type Props = { config: (c: ReturnType<typeof themeColors>) => ChartConfiguration; height: number }

export function Chart({ config, height }: Props) {
  const el = useRef<HTMLCanvasElement>(null)
  // นับรอบ re-render ตอนสลับธีม: chart.js วาดลง canvas สีจึงไม่อัปเดตเองเหมือน CSS
  const [themeTick, setThemeTick] = useState(0)

  useEffect(() => {
    const ob = new MutationObserver(() => setThemeTick((n) => n + 1))
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onMq = () => setThemeTick((n) => n + 1)
    mq.addEventListener('change', onMq)
    return () => { ob.disconnect(); mq.removeEventListener('change', onMq) }
  }, [])

  useEffect(() => {
    if (!el.current) return
    const chart = new ChartJS(el.current, config(themeColors()))
    return () => chart.destroy()
  }, [config, themeTick])

  return <div style={{ height }}><canvas ref={el} /></div>
}
