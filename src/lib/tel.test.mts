// npx tsx --test src/lib/tel.test.mts
import assert from 'node:assert/strict'
import test from 'node:test'
import { maskTel } from './tel'

test('ใส่ขีดตามชนิดเบอร์', () => {
  assert.equal(maskTel('0812345678'), '081-234-5678', 'มือถือ 10 หลัก')
  assert.equal(maskTel('021234567'), '02-123-4567', 'กรุงเทพฯ รหัสพื้นที่ 2 หลัก')
  assert.equal(maskTel('055123456'), '055-123-456', 'ต่างจังหวัด 9 หลัก')
})

test('กรองอักขระอื่นทิ้ง และตัดที่ 10 หลัก', () => {
  assert.equal(maskTel('081-234-5678'), '081-234-5678', 'พิมพ์ทับของเดิมแล้วไม่เพี้ยน')
  assert.equal(maskTel('08 1234 5678 999'), '081-234-5678')
  assert.equal(maskTel('abc'), '')
})

test('พิมพ์ทีละตัวไม่มีขีดค้างท้าย', () => {
  assert.equal(maskTel('0'), '0')
  assert.equal(maskTel('081'), '081')
  assert.equal(maskTel('0812'), '081-2')
  assert.equal(maskTel('081234'), '081-234')
  assert.equal(maskTel('0812345'), '081-234-5')
})
