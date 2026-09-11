-- ข้อมูลเคสสังเคราะห์สำหรับดูแดชบอร์ด (ไม่ใช่ข้อมูลจริง)
-- npm run db:seed:cases   —  ล้างทิ้งด้วย npm run db:test แล้ว seed ใหม่
-- ไม่ใช้ random() เลย ทุกอย่างผูกกับลำดับ จะได้ seed ซ้ำแล้วได้ภาพเดิม

WITH curve(wk_back, cnt) AS (
  -- จำนวนเคสต่อสัปดาห์ย้อนหลัง ให้เป็นรูประบาดจริง: ไต่ขึ้น พีค แล้วลดลง
  VALUES (15,3),(14,5),(13,8),(12,13),(11,19),(10,26),(9,33),(8,30),
         (7,24),(6,18),(5,13),(4,9),(3,7),(2,5),(1,4),(0,3)
),
seq AS (
  SELECT row_number() OVER (ORDER BY c.wk_back DESC, i)::int AS n,
         (date_trunc('week', current_date)
            - c.wk_back * interval '1 week'
            + ((i % 7) || ' day')::interval)::date AS onset
  FROM curve c, generate_series(1, c.cnt) i
)
-- พิกัดกลางอำเภอแบบคร่าว ๆ ใช้โปรยจุดบนแผนที่ (ข้อมูลจริงต้องได้พิกัดบ้านจากผู้แจ้ง)
-- c_area ที่ import มาไม่มี geom จึงต้องมีตารางนี้ชั่วคราวสำหรับ demo
, amp_pos(amp, lat, lon) AS (
  VALUES ('6501',16.8200,100.2600),('6502',17.1000,100.8300),('6503',17.3000,100.6200),
         ('6504',16.7500,100.1100),('6505',16.6000,100.3300),('6506',17.0200,100.2000),
         ('6507',17.0300,100.3600),('6508',16.8200,100.4500),('6509',16.6000,100.7000)
)
INSERT INTO case_report (
  disease_code, case_class, pname, fname, lname, gender, age_y,
  area_code, addr_no, moo, geom, date_onset, date_visit, date_dx, time_dx,
  date_report, time_report, patient_type, report_org_code, created_by, status
)
SELECT
  -- สัดส่วนโรคแบบคร่าว ๆ: ไข้เลือดออกเป็นหลัก แล้วไข้เดงกี ชิคุนกุนยา ซิกา
  CASE WHEN s.n % 10 < 6 THEN '26' WHEN s.n % 10 < 8 THEN '66'
       WHEN s.n % 10 = 8 THEN '87' ELSE '84' END,
  'suspected',
  CASE WHEN s.n % 2 = 0 THEN 'นาย' ELSE 'นางสาว' END,
  'ผู้ป่วย', 'ตัวอย่าง ' || s.n,
  CASE WHEN s.n % 2 = 0 THEN 'M' ELSE 'F' END,
  1 + (s.n * 104729) % 78,
  a.code,
  s.n || '/' || (1 + s.n % 40),
  nullif(ltrim(right(a.code, 2), '0'), ''),
  -- กระจายรอบจุดกลางอำเภอ ±0.05° (~5 กม.) แบบคงที่ ไม่ใช้ random()
  ST_SetSRID(ST_MakePoint(
    p.lon + ((s.n * 37 % 100) - 50) / 1000.0,
    p.lat + ((s.n * 53 % 100) - 50) / 1000.0), 4326),
  s.onset,
  s.onset + 2, s.onset + 2, time '09:00' + (s.n % 8) * interval '47 minute',
  s.onset + 2, time '10:30' + (s.n % 6) * interval '31 minute',
  CASE WHEN s.n % 9 = 0 THEN 'IPD' ELSE 'OPD' END,
  '10676', 1,
  -- ของเก่าปิดเคสไปแล้ว ของใหม่ยังค้างอยู่ในสาย
  CASE WHEN s.onset < current_date - 60 THEN 'closed'
       WHEN s.onset < current_date - 30 THEN 'controlled'
       ELSE 'reported' END
FROM seq s
CROSS JOIN LATERAL (
  SELECT code FROM c_area
  WHERE level = 4
    -- 2 ใน 3 ตกอำเภอเมือง ที่เหลือกระจายอำเภออื่น
    AND (s.n % 3 > 0) = (code LIKE '6501%')
  ORDER BY md5(code || s.n::text) LIMIT 1
) a
JOIN amp_pos p ON p.amp = left(a.code, 4);

-- ให้ 2 ใน 3 ถูกรับแล้ว จะได้เห็นตัวเลข "รอรับ / รับแล้ว" ขยับ
INSERT INTO case_acceptance (case_id, org_code, accepted_by, date_accept, time_accept)
SELECT c.id, oa.org_code, 2, c.date_report + 1, time '08:20'
FROM case_report c
JOIN LATERAL (
  SELECT org_code FROM c_org_area WHERE area_code = c.area_code ORDER BY org_code LIMIT 1
) oa ON true
WHERE c.id % 3 <> 0
  AND NOT EXISTS (SELECT 1 FROM case_acceptance a WHERE a.case_id = c.id AND a.status = 'active');

-- กิจกรรมสอบสวน: ส่วนใหญ่ทันเวลา 1 ใน 7 ช้าเกิน SLA ตัวชี้วัดจะได้ไม่ใช่ 100%
INSERT INTO case_activity (case_id, date_act, time_act, activity_name, performer, performer_org, created_by)
SELECT c.id,
       c.date_report + (CASE WHEN c.id % 7 = 0 THEN 3 ELSE 0 END),
       CASE WHEN c.id % 7 = 0 THEN time '15:00' ELSE time '13:00' END,
       'สำรวจและกำจัดลูกน้ำยุงลาย', 'ทีม SRRT พื้นที่', a.org_code, 2
FROM case_report c
JOIN case_acceptance a ON a.case_id = c.id AND a.status = 'active';

REFRESH MATERIALIZED VIEW mv_case_daily;
