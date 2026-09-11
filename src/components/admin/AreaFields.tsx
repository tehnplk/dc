import { field } from '@/lib/ui'

type Org = { code: string; name: string }

/**
 * ฟอร์มหมู่บ้าน ใช้ทั้งตอนเพิ่มและแก้ไข ทั้ง /admin และ /hospital/village
 * ส่ง orgs มา = ให้เลือกหน่วยบริการที่รับผิดชอบได้ด้วย (เฉพาะ สสจ.)
 */
export function AreaFields({ area, orgs, owner }: {
  area?: { code: string; name: string; population: number | null }
  orgs?: Org[]
  owner?: string | null
}) {
  return (
    <>
      <label className="block text-xs text-fg-muted">
        รหัสหมู่บ้าน (8 หลัก) *
        {/* รหัสคือคีย์ แก้ไม่ได้หลังสร้าง ไม่งั้นเคสเดิมที่อ้างถึงจะหลุด */}
        <input name="code" required inputMode="numeric" maxLength={8} defaultValue={area?.code ?? ''}
               readOnly={!!area} placeholder="6 หลักแรกคือรหัสตำบล 2 หลักท้ายคือหมู่ที่"
               className={`${field} mt-1 font-mono ${area ? 'opacity-60' : ''}`} />
      </label>
      <NameAndPopulation area={area} />
      {orgs && (
        <label className="block text-xs text-fg-muted">
          หน่วยบริการที่รับผิดชอบ
          {/* 1 หมู่บ้าน = 1 หน่วยบริการ เลือกหน่วยใหม่ = ย้ายความรับผิดชอบ */}
          <select name="org_code" defaultValue={owner ?? ''} className={`${field} mt-1`}>
            <option value="">— ยังไม่กำหนด —</option>
            {orgs.map((o) => <option key={o.code} value={o.code}>{o.code} · {o.name}</option>)}
          </select>
        </label>
      )}
    </>
  )
}

export function NameAndPopulation({ area }: { area?: { name: string; population: number | null } }) {
  return (
    <>
      <label className="block text-xs text-fg-muted">
        ชื่อหมู่บ้าน/ชุมชน *
        <input name="name" required defaultValue={area?.name ?? ''} className={`${field} mt-1`} />
      </label>
      <label className="block text-xs text-fg-muted">
        ประชากร
        <input name="population" inputMode="numeric" defaultValue={area?.population ?? ''} className={`${field} mt-1`} />
      </label>
    </>
  )
}
