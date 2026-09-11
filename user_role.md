# บทบาทผู้ใช้ (user_role)

บทบาทเก็บเป็นตาราง `user_role` ไม่ใช่ CHECK ในคอลัมน์ เพื่อให้ชื่อไทยที่แสดงบนจอมาจากที่เดียว

```sql
CREATE TABLE user_role (
  code       text PRIMARY KEY,
  name       text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
```

| code | name | ใครใช้ |
|---|---|---|
| `province` | จังหวัด | สสจ. |
| `district` | อำเภอ | สสอ. |
| `hospital` | หน่วยบริการ | รพศ./รพช./รพ.สต. |

`users.role` เป็น FK ชี้มาที่ตารางนี้ → ใส่บทบาทนอกเหนือจาก 3 ตัวนี้ไม่ได้ตั้งแต่ระดับฐานข้อมูล

## สิทธิ์

| | province | district | hospital |
|---|---|---|---|
| แจ้งเคส | ✅ | ❌ | ✅ |
| รับเคส | ✅ | ❌ | ✅ |
| คืนเคส | ✅ เคสที่หน่วยตัวเองถือ | — | ✅ เคสที่หน่วยตัวเองถือ |
| **เพิ่ม** กิจกรรม | ✅ ทุกเคส | ✅ ทุกเคสในอำเภอตัวเอง | ✅ เฉพาะเคสที่ตัวเองรับไว้ |
| **แก้ไข/ลบ** กิจกรรม | ❌ | ❌ | ✅ เฉพาะเคสที่ตัวเองรับไว้ |
| จัดการผู้ใช้ / หน่วยงาน | ✅ | ❌ | ❌ |
| จัดการหมู่บ้าน | ✅ ทั้งจังหวัด + กำหนด/ย้ายหน่วยรับผิดชอบ | ❌ | ✅ เฉพาะเขตตัวเอง |
| เห็นรายการเคส | ทั้งจังหวัด | ทั้งจังหวัด | ทั้งจังหวัด |
| เมนูเฉพาะ | ผู้ดูแลระบบ → `/admin` | — | หมู่บ้านรับผิดชอบ → `/hospital/village` |

หมายเหตุ

- **การรับเคสไม่ดูที่อยู่ผู้ป่วย** ว่าตรงกับหมู่บ้านรับผิดชอบหรือไม่ — เคสข้ามเขต/ย้ายที่อยู่มีจริง
  หน่วยที่กดรับคือหน่วยที่รับผิดชอบต่อ ส่วน `hos_village` ใช้จัดรายการ "รอรับ n เคส" ในหน้าทะเบียนรับเท่านั้น
- 1 เคส มีเจ้าของที่ active ได้หน่วยเดียว (partial unique index) หน่วยอื่นจะกดรับได้ต่อเมื่อเจ้าของคืนเคสก่อน
- ลำดับ 1 (แจ้งเคสเข้าระบบ) และ 2 (พื้นที่รับเคส) ใน timeline กิจกรรม เป็นเหตุการณ์ที่ view สร้างจากวันแจ้ง/วันรับ
  ไม่ใช่แถวจริงใน `case_activity` จึงแก้หรือลบไม่ได้ทุกบทบาท

## บัญชีสำรอง (SUPER_USER)

บัญชีที่ตั้งใน `.env` (`SUPER_USER` / `SUPER_USER_PASSWORD`) ล็อกอินที่ `/auth/admin` ไม่ผ่าน SSO
มีไว้กู้ระบบตอน SSO ล่มหรือยังไม่มีใครเป็นผู้ดูแล — **ไม่ใช่บทบาท** แต่เป็นแฟล็กแยกต่างหาก

- จัดการระบบได้เต็ม (`canManage`)
- ข้อมูลผู้ป่วย **ดูได้อย่างเดียว** (`readonly`) — แจ้งเคส/รับเคส/บันทึกกิจกรรมไม่ได้เลย
- แถวใน `users` ถูกสร้าง/อัปเดตให้อัตโนมัติตอนล็อกอิน โดยตั้ง role เป็น `province`

## จุดที่บังคับกติกาจริง

ทุกกติกาตรวจที่ server action เสมอ ปุ่มที่ซ่อนบนหน้าจอเป็นแค่ชั้นกันเผลอ
เรื่องรับเคสกับบทบาทมีด่านที่ฐานข้อมูลซ้ำอีกชั้น

| ที่ | ทำอะไร |
|---|---|
| `src/lib/session.ts` | `canManage = super \|\| province` · `canCase = !super && (province \|\| hospital)` · `amp` = อำเภอของหน่วยงานที่สังกัด |
| `src/lib/scope.ts` | ขอบเขตหมู่บ้าน: province = ทั้งจังหวัด · district = prefix อำเภอ · hospital = รายการใน `hos_village` |
| `src/app/(app)/report/actions.ts` | `createCase` — ต้อง `canCase` |
| `src/app/(app)/patients/actions.ts` | `acceptCase` — ต้อง `canCase` |
| `src/app/(app)/accept/actions.ts` | `cannotAdd()` = กติกาเพิ่มกิจกรรม · `ownedActivity()` = กติกาแก้/ลบ (hospital ที่ถือเคสเท่านั้น) |
| `src/app/(app)/admin/actions.ts` | `admin()` = ต้อง `canManage` · `areaEditor()` = `canManage` หรือ hospital |
| `src/app/(app)/hospital/village/actions.ts` | `hospital()` = ต้องเป็น hospital |
| trigger `case_acceptance_sync` | `accepted_by` ต้องมีบทบาท province/hospital · sync `case_report.status` |
| index `case_accept_one_active` | กันสองหน่วยกดรับเคสเดียวกัน |

## เพิ่มบทบาทใหม่

1. `INSERT INTO user_role` (แก้ `db/schema.sql` ส่วน seed ด้วย)
2. ทบทวน `canManage` / `canCase` ใน `src/lib/session.ts` และ `areaScope()` ใน `src/lib/scope.ts`
3. ถ้าบทบาทใหม่รับเคสได้ ต้องเพิ่มใน trigger `case_acceptance_sync` ด้วย

dropdown เลือกบทบาทที่หน้า `/admin` อ่านจากตารางโดยตรง (เรียงตาม `sort_order`) จึงไม่ต้องแก้หน้าจอ
