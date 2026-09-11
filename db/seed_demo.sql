-- ข้อมูลตัวอย่างสำหรับ dev: 3 เคส 1 เคสถูกรับแล้วพร้อมกิจกรรม/เอกสาร
-- smoke_test.sql \i ไฟล์นี้แล้ว rollback / db:seed รันแล้ว commit
-- identity ไม่ถูก rollback จึงต้อง restart ให้ id คงที่ทุกครั้งที่รัน
ALTER TABLE "user"        ALTER COLUMN id RESTART WITH 1;
ALTER TABLE c_form_template   ALTER COLUMN id RESTART WITH 1;
ALTER TABLE case_report     ALTER COLUMN id RESTART WITH 1;
ALTER TABLE case_acceptance ALTER COLUMN id RESTART WITH 1;
ALTER TABLE case_activity   ALTER COLUMN id RESTART WITH 1;
ALTER TABLE case_document   ALTER COLUMN id RESTART WITH 1;

INSERT INTO c_area (code,level,name,parent_code,population) VALUES
 ('65',1,'พิษณุโลก',NULL,NULL),
 ('6501',2,'เมืองพิษณุโลก','65',293444),
 ('650101',3,'ในเมือง','6501',40000),
 ('65010101',4,'ชุมชนวัดจันทร์ตะวันตก','650101',1651),
 ('65010102',4,'ชุมชนไชยานุภาพ','650101',720),
 ('65010103',4,'ชุมชนประชาอุทิศ','650101',830)
  ON CONFLICT (code) DO NOTHING;
UPDATE c_area SET geom = ST_SetSRID(ST_MakePoint(100.2600,16.8200),4326) WHERE code='65010101';
UPDATE c_area SET geom = ST_SetSRID(ST_MakePoint(100.2605,16.8205),4326) WHERE code='65010102';

INSERT INTO c_org (code,name,org_type,area_code) VALUES
 ('00051','สสจ.พิษณุโลก','สสจ.','650101'),
 ('10676','รพ.พุทธชินราช','รพศ.','650101'),
 ('07476','รพ.สต.ในเมือง','รพ.สต.','650101'),
 ('07477','รพ.สต.ท่าทอง','รพ.สต.','650101')
  ON CONFLICT (code) DO NOTHING;
-- รพ.สต. สองแห่งรับผิดชอบคนละหมู่ ใช้ทดสอบว่าใครกดรับเคสไหนได้
INSERT INTO hos_village (area_code, org_code) VALUES ('65010101','07476'), ('65010102','07476'), ('65010103','07477')
  ON CONFLICT (area_code) DO NOTHING;

-- full_name = ชื่อ-นามสกุลจริงของคน ตำแหน่งแยกไว้ที่ position
INSERT INTO "user" (username,password_hash,full_name,position,org_code,role) VALUES
 ('hos01','$argon2id$dummy','สมพงษ์ เวชกิจ','พยาบาลวิชาชีพชำนาญการ','10676','hospital'),
 ('pcu01','$argon2id$dummy','มาลี สุขใจ','นักวิชาการสาธารณสุขชำนาญการ','07476','hospital'),
 ('pcu02','$argon2id$dummy','ประยุทธ ทองดี','เจ้าพนักงานสาธารณสุขชำนาญงาน','07477','hospital'),
 ('adm01','$argon2id$dummy','วิไลวรรณ ระบาดวิทยา','นักระบาดวิทยาชำนาญการพิเศษ','00051','province');

INSERT INTO c_form_template (code,name,disease_code,schema) VALUES
 ('DHF-IV',E'แบบสอบสวนโรคไข้เลือดออกเฉพาะราย','26','{"fields":[{"k":"travel_14d","t":"bool"},{"k":"hi","t":"number"}]}');

-- แจ้งเคส 2 ราย บ้านห่างกัน ~70 ม. โรคเดียวกัน -> ต้องเจอกันในรัศมี 100 ม.
INSERT INTO case_report (case_no,disease_code,cid,pname,fname,lname,gender,age_y,age_m,area_code,addr_no,moo,
                         geom,date_onset,date_visit,date_dx,time_dx,date_report,time_report,report_org_code,created_by)
VALUES
 ('65-2026-000001','26','1650100000001','ด.ช.','สมชาย','ใจดี','M',12,4,'65010101','1/1','1',
  ST_SetSRID(ST_MakePoint(100.26000,16.82000),4326),
  '2026-09-01','2026-09-03','2026-09-03','14:35','2026-09-03','16:20','10676',1),
 ('65-2026-000002','26','1650100000002','น.ส.','สมหญิง','ใจงาม','F',35,10,'65010102','2/2','2',
  ST_SetSRID(ST_MakePoint(100.26050,16.82045),4326),
  '2026-09-04','2026-09-05','2026-09-05','09:20','2026-09-05','10:05','10676',1),
 -- คนละโรค พิกัดเดียวกัน -> ต้องไม่ถูกนับเป็น cluster
 ('65-2026-000003','66','1650100000003','นาง','สมศรี','ใจเย็น','F',60,2,'65010102','3/3','2',
  ST_SetSRID(ST_MakePoint(100.26050,16.82045),4326),
  '2026-09-04','2026-09-05','2026-09-06','07:55','2026-09-06','08:40','10676',1);

-- เดินเลขทะเบียนต่อจากเคสตัวอย่าง ไม่งั้นเคสแรกที่แจ้งผ่านหน้าเว็บจะได้เลขซ้ำ
SELECT setval('case_no_seq', (SELECT max(split_part(case_no,'-',3)::int) FROM case_report));

-- รับเคส: รพ.สต. เห็นเคสใน inbox (พื้นที่ตัวเอง) แล้วกดรับเอง ไม่มีการมอบหมาย
INSERT INTO case_acceptance (case_id,org_code,accepted_by,date_accept,time_accept)
  SELECT id, '07476', 2, '2026-09-03', '17:10' FROM v_case_inbox WHERE org_code='07476' AND case_no='65-2026-000001';
-- case_report.status ไม่ต้อง set เอง trigger t_case_acceptance sync ให้

-- กิจกรรมควบคุมโรค: ลำดับ | วันเวลา | กิจกรรม | หมายเหตุ
INSERT INTO case_activity (case_id,date_act,time_act,activity_code,performer,performer_org,note,created_by) VALUES
 (1,'2026-09-03','09:00','SURVEY','รพ.สต.ในเมือง ร่วมกับ อสม. หมู่ 1','07476','ยืนยันการเกิดโรค ไม่พบลูกน้ำยุงลาย',2),
 (1,'2026-09-03','15:30','SPRAY' ,'ทีมพ่นเคมี เทศบาลนครพิษณุโลก',NULL,'พ่นครั้งที่ 1 (45 หลังคาเรือน)',2),
 (1,'2026-09-06','15:00','SPRAY' ,'ทีมพ่นเคมี เทศบาลนครพิษณุโลก',NULL,'พ่นครั้งที่ 2 ห่างจากครั้งแรก 3 วัน',2),
 (1,'2026-09-10','15:00','SPRAY' ,'ทีมพ่นเคมี เทศบาลนครพิษณุโลก',NULL,'พ่นครั้งที่ 3 ห่างจากครั้งแรก 7 วัน',2);

-- เอกสารระดับเคส: แบบสอบสวนโรค 1 ฉบับ (ไม่ผูกกิจกรรม)
INSERT INTO case_document (case_id,form_template_id,data,status,submitted_at,created_by)
 VALUES (1,1,'{"travel_14d":false,"hi":12.5}','submitted',now(),2);
-- เอกสาร + ภาพ ของกิจกรรมพ่นครั้งที่ 1 (activity_id = 2)
INSERT INTO case_document (case_id,activity_id,file_path,file_name,mime_type,file_size,created_by) VALUES
 (1,2,'/uploads/2026/09/spray1-a.png','ภาพพ่นเคมี จุดที่ 1.png','image/png',204800,2),
 (1,2,'/uploads/2026/09/spray1-b.png','ภาพพ่นเคมี จุดที่ 2.png','image/png',198000,2),
 (1,2,'/uploads/2026/09/spray1.pdf'  ,'บันทึกขอสนับสนุนพ่นเคมี.pdf','application/pdf',51200,2);

INSERT INTO case_view_log (case_id,user_id,ip) VALUES (1,2,'10.0.0.5');

REFRESH MATERIALIZED VIEW mv_case_daily;

