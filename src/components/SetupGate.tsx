'use client'

import { ProfileSettingsModal } from './ProfileSettingsModal'

/**
 * ตัวเปิดโมดัลตั้งค่าบัญชีตอนล็อกอินครั้งแรก
 * แยกไฟล์เพราะหน้า /auth/org เป็น server component ส่ง prop `open` ค้างไว้ตลอดไม่ได้ถ้าไม่มี client boundary
 */
export function SetupGate({ greeting, org_code, org_name, orgs }: {
  greeting: string
  org_code: string
  org_name: string
  orgs: { code: string; name: string }[]
}) {
  return (
    <ProfileSettingsModal
      mode="setup"
      open
      greeting={greeting}
      orgList={orgs}
      me={{ cid: null, tel: null, org_code, org_name, notify: true }}
    />
  )
}
