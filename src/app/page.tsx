import { redirect } from 'next/navigation'

// หน้าแรกของระบบคือแดชบอร์ด — เปิดดูได้โดยไม่ต้องล็อกอิน
export default function Home() {
  redirect('/dashboard')
}
