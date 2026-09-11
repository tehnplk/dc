// npx tsx --test src/lib/ratelimit.test.mts
import assert from 'node:assert/strict'
import test from 'node:test'
import { fail, pass, reset, retryAfter } from './ratelimit'

test('ผิดไม่เกิน 3 ครั้งยังไม่หน่วง แล้วค่อยหน่วงเพิ่มขึ้น', () => {
  reset()
  const t = 1_000_000
  assert.equal(fail('ip1', t), 0)
  assert.equal(fail('ip1', t), 0)
  assert.equal(fail('ip1', t), 0)
  assert.equal(fail('ip1', t), 5)
  assert.equal(fail('ip1', t), 15)
  assert.equal(fail('ip1', t), 60)
  assert.equal(fail('ip1', t), 300)
  assert.equal(fail('ip1', t), 300, 'เกินตารางแล้วใช้ค่าสูงสุดซ้ำ')
})

test('retryAfter นับถอยหลังแล้วหมดอายุเอง', () => {
  reset()
  const t = 2_000_000
  for (let i = 0; i < 4; i++) fail('ip2', t)     // ครั้งที่ 4 = หน่วง 5 วิ
  assert.equal(retryAfter('ip2', t), 5)
  assert.equal(retryAfter('ip2', t + 2_000), 3)
  assert.equal(retryAfter('ip2', t + 5_000), 0, 'ครบเวลาแล้วต้องลองได้')
})

test('คนละไอพีไม่กวนกัน และล็อกอินผ่านแล้วล้างประวัติ', () => {
  reset()
  const t = 3_000_000
  for (let i = 0; i < 5; i++) fail('ip3', t)
  assert.ok(retryAfter('ip3', t) > 0)
  assert.equal(retryAfter('ip4', t), 0, 'ไอพีอื่นต้องไม่โดนหางเลข')

  pass('ip3')
  assert.equal(retryAfter('ip3', t), 0)
  assert.equal(fail('ip3', t), 0, 'เริ่มนับใหม่จากศูนย์')
})
