'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export type MapCase = {
  id: string; case_no: string | null; name: string | null
  disease: string; disease_code: string
  onset: string | null; amp: string | null; tmb: string | null
  accepted: boolean
  lat: number; lon: number
}

// สีต่อโรค — ใช้ค่าคงที่ ไม่ผูกกับธีม เพราะต้องอ่านออกบนพื้นแผนที่ทั้ง light/dark
const COLOR: Record<string, string> = {
  '26': '#e11d48', '27': '#9f1239', '66': '#f59e0b', '87': '#8b5cf6', '84': '#0ea5e9',
}
const FALLBACK = '#0e7a66'

export function CaseMap({ cases }: { cases: MapCase[] }) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!box.current) return
    let map: import('leaflet').Map | undefined
    let dead = false

    // leaflet แตะ window ตั้งแต่ตอน import ถ้า import บนสุดไฟล์ SSR จะพังทันที
    // โหลดในนี้แทน ตอน effect ทำงานมี DOM แน่นอนแล้ว
    void (async () => {
      const L = (await import('leaflet')).default
      if (dead || !box.current) return

      map = L.map(box.current, { scrollWheelZoom: true }).setView([16.82, 100.26], 10)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        // OSM requires a Referer; send only the origin, never case URLs or query strings.
        referrerPolicy: 'strict-origin',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      // CircleMarker ไม่ต้องใช้ไฟล์ไอคอน เลยไม่เจอปัญหา marker รูปแตกของ leaflet ใน bundler
      const layer = L.layerGroup().addTo(map)
      for (const c of cases) {
        L.circleMarker([c.lat, c.lon], {
          radius: 5,
          color: COLOR[c.disease_code] ?? FALLBACK,
          weight: 1.5,
          fillOpacity: c.accepted ? 0.85 : 0.25,   // ยังไม่มีหน่วยรับ = วงกลวง เห็นได้ทันที
        })
          .bindPopup(
            `<b>${c.name ?? '—'}</b><br>${c.disease}<br>` +
              `${[c.tmb, c.amp].filter(Boolean).join(' · ')}<br>` +
              `<span style="opacity:.7">${c.case_no ?? ''} · เริ่มป่วย ${c.onset ?? '—'}` +
              `${c.accepted ? '' : ' · <b>รอรับเคส</b>'}</span>`,
          )
          .addTo(layer)
      }

      if (cases.length) {
        map.fitBounds(L.latLngBounds(cases.map((c) => [c.lat, c.lon])), { padding: [30, 30] })
      }
    })()

    return () => { dead = true; map?.remove() }
  }, [cases])

  return <div ref={box} className="h-[70vh] w-full rounded-sm border border-line" />
}
