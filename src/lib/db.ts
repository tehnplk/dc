import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  // ถ้า session ไม่ใช่ UTC driver จะทิ้ง offset ของ timestamptz แล้วอ่าน wall-clock เป็น UTC
  // ทำให้เวลาเพี้ยนไป +7 ชม. — บังคับไว้ตรงนี้ กันหลุดเวลาแก้ DATABASE_URL
  options: '-c timezone=UTC',
})

// next dev รีโหลดโมดูลบ่อย ถ้าไม่ cache ไว้จะเปิด pool ใหม่ทุกครั้งจนคอนเนกชันเต็ม
const g = globalThis as unknown as { prisma?: PrismaClient }
export const prisma = g.prisma ?? new PrismaClient({ adapter })
if (process.env.NODE_ENV !== 'production') g.prisma = prisma
