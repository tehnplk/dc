# HOSxP BMS Session API

## Credential

```bash
BMS_URL=http://127.0.0.1:45011      # 127.0.0.1 เท่านั้น port ตามเครื่อง
BMS_TOKEN=44AF5FF3-E93C-4737-90CA-12069773DED4   # ?bms-session-id= จาก URL ของ addon ใน HOSxP
```

## Call

```
POST {BMS_URL}/api/sql
```

### Header

```
Content-Type: application/json
Authorization: Bearer {BMS_TOKEN}
```

### Payload

```json
{
  "sql": "select hn,pname,fname,lname from patient limit 20",
  "app": "portal"
}
```

แบบมีพารามิเตอร์:

```json
{
  "sql": "select code, name from icd101 where code3 = :c limit 50",
  "app": "portal",
  "params": { "c": { "value": "A91", "value_type": "string" } }
}
```

`value_type`: `string` | `text` | `integer` | `float` | `date` | `time` | `datetime`

### Response

```json
{
  "MessageCode": 200,
  "Message": "OK",
  "data": [{ "hn": "000123", "fname": "สมชาย" }],
  "field_name": ["hn", "fname"],
  "record_count": 1,
  "RequestTime": "2026-09-12T10:40:41.546Z"
}
```

| MessageCode | |
|---|---|
| 200 | สำเร็จ |
| 400 | payload เพี้ยน |
| 409 | SQL ผิด / ไม่รองรับ |
| 500 | ฝั่ง DB |
| 501 | token ไม่ผ่าน |

### ตัวอย่างเต็ม

```bash
curl -X POST "$BMS_URL/api/sql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BMS_TOKEN" \
  -d '{"sql":"select hn,pname,fname,lname from patient limit 20","app":"portal"}'
```
