-- ตรวจว่า schema ทำงานจริง: รันแล้วต้องไม่ ERROR และไม่มี assert ตัวไหน fail
-- npm run db:test
BEGIN;

\i /db/seed_demo.sql

-- ===== assertions =====
DO $t$
DECLARE n int; b boolean;
BEGIN
  -- cluster: เคส 1 ต้องเจอเคส 2 (โรคเดียวกัน ในรัศมี) และไม่เจอเคส 3 (คนละโรค)
  SELECT count(*) INTO n FROM cases_nearby(1);
  ASSERT n = 1, 'cases_nearby ควรได้ 1 ราย ได้ ' || n;
  SELECT count(*) INTO n FROM cases_nearby(1) WHERE case_no = '65-2026-000002';
  ASSERT n = 1, 'cases_nearby ต้องเจอเคสที่ 2';

  -- dashboard rollup ตาม prefix
  SELECT sum(cases) INTO n FROM mv_case_daily WHERE amp_code = '6501';
  ASSERT n = 3, 'mv_case_daily อำเภอ 6501 ควรได้ 3 ได้ ' || n;
  SELECT sum(cases) INTO n FROM mv_case_daily WHERE disease_code = '26';
  ASSERT n = 2, 'mv_case_daily โรค 26 ควรได้ 2 ได้ ' || n;

  -- worklist / SLA
  SELECT activity_count INTO n FROM v_case_status WHERE id = 1;
  ASSERT n = 4, 'activity_count ควรได้ 4 ได้ ' || n;
  SELECT form_count INTO n FROM v_case_status WHERE id = 1;
  ASSERT n = 1, 'form_count ควรได้ 1 (นับเฉพาะฟอร์ม ไม่นับไฟล์แนบ) ได้ ' || n;
  SELECT investigated_in_time INTO b FROM v_case_status WHERE id = 1;
  ASSERT b, 'สอบสวนภายใน 24 ชม. ควรเป็น true';
  SELECT count(*) INTO n FROM v_case_status WHERE owner_org_code = '07476';
  ASSERT n = 1, 'owner_org_code ควรมี 1 เคส ได้ ' || n;

  -- inbox: เคส 1 ถูกรับไปแล้ว จึงเหลือเคส 2,3 รอรับใน รพ.สต.07476
  SELECT count(*) INTO n FROM v_case_inbox WHERE org_code = '07476';
  ASSERT n = 2, 'v_case_inbox ควรเหลือ 2 เคสรอรับ ได้ ' || n;

  -- ตารางกิจกรรม: ลำดับ/วันเวลา/กิจกรรม/เอกสาร/ภาพ/ผู้ดำเนินการ/หมายเหตุ
  SELECT count(*) INTO n FROM v_case_activity WHERE case_id = 1;
  ASSERT n = 6, 'v_case_activity ควรได้ 6 แถว (แจ้ง+รับ+4 กิจกรรม) ได้ ' || n;

  -- ลำดับ 1 ต้องเป็น "แจ้งเคสเข้าระบบ" เสมอ, ลำดับ 2 ต้องเป็น "พื้นที่รับเคส" เสมอ
  ASSERT (SELECT activity_code FROM v_case_activity WHERE case_id=1 AND seq=1) = 'REPORT',
         'ลำดับ 1 ต้องเป็นแจ้งเคสเข้าระบบ';
  ASSERT (SELECT activity_code FROM v_case_activity WHERE case_id=1 AND seq=2) = 'ACCEPT',
         'ลำดับ 2 ต้องเป็นพื้นที่รับเคส';
  -- เคสที่ยังไม่มีใครรับ ต้องมีแค่ลำดับ 1
  SELECT count(*) INTO n FROM v_case_activity WHERE case_id = 2;
  ASSERT n = 1, 'เคสที่ยังไม่ถูกรับ ควรมีแค่ลำดับ 1 ได้ ' || n;
  ASSERT (SELECT activity_code FROM v_case_activity WHERE case_id=2 AND seq=1) = 'REPORT',
         'เคสที่ยังไม่ถูกรับ ลำดับ 1 ต้องเป็นแจ้งเคสเข้าระบบ';
  -- ห้ามบันทึก REPORT/ACCEPT เข้ามาเองซ้ำลำดับ 1/2
  BEGIN
    INSERT INTO case_activity (case_id,date_act,activity_code) VALUES (1,current_date,'REPORT');
    ASSERT false, 'ควร reject การบันทึกกิจกรรมรหัส REPORT เอง';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- เอกสาร/ภาพ ของกิจกรรมพ่นครั้งที่ 1 (activity_id = 2 -> ลำดับ 4)
  SELECT jsonb_array_length(photos) INTO n FROM v_case_activity WHERE activity_id = 2;
  ASSERT n = 2, 'ภาพกิจกรรมของ activity 2 ควรได้ 2 ได้ ' || n;
  SELECT jsonb_array_length(documents) INTO n FROM v_case_activity WHERE activity_id = 2;
  ASSERT n = 1, 'เอกสารของ activity 2 ควรได้ 1 (pdf) ได้ ' || n;
  ASSERT (SELECT seq FROM v_case_activity WHERE activity_id = 2) = 4,
         'กิจกรรมแรกที่บันทึกเองต้องเริ่มที่ลำดับ 3 ขึ้นไป';
  SELECT jsonb_array_length(photos) + jsonb_array_length(documents) INTO n
    FROM v_case_activity WHERE activity_id = 1;
  ASSERT n = 0, 'activity 1 ไม่มีไฟล์แนบ ควรได้ [] ไม่ใช่ NULL';
  SELECT jsonb_array_length(photos) + jsonb_array_length(documents) INTO n
    FROM v_case_activity WHERE case_id = 1 AND seq = 1;
  ASSERT n = 0, 'ลำดับ 1 ไม่มีไฟล์แนบ ควรได้ [] ไม่ใช่ NULL';

  -- เจ้าของเคสที่ active ได้หน่วยเดียว (กันสองหน่วยกดรับพร้อมกัน)
  BEGIN
    INSERT INTO case_acceptance (case_id,org_code,accepted_by) VALUES (1,'10676',1);
    ASSERT false, 'ควร reject การกดรับซ้ำขณะยังมีเจ้าของ active';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- trigger sync สถานะเคสให้เอง ไม่ต้องอัปเดต case_report แยก
  ASSERT (SELECT status FROM case_report WHERE id=1) = 'accepted', 'รับเคสแล้ว status ต้องเป็น accepted';

  -- รับเคสนอกหมู่บ้านรับผิดชอบได้ (รพ.พุทธชินราช ไม่มีแถวใน hos_village เลย)
  INSERT INTO case_acceptance (case_id,org_code,accepted_by) VALUES (2,'10676',1);
  ASSERT (SELECT status FROM case_report WHERE id=2) = 'accepted',
    'รับเคสนอกพื้นที่รับผิดชอบต้องทำได้';
  UPDATE case_acceptance SET status='released', released_at=now(), released_by=1
   WHERE case_id=2 AND status='active';

  -- บทบาทอำเภอรับเคสไม่ได้
  BEGIN
    UPDATE "user" SET role='district' WHERE id=1;
    INSERT INTO case_acceptance (case_id,org_code,accepted_by) VALUES (2,'10676',1);
    ASSERT false, 'ควร reject การรับเคสของบทบาทอำเภอ';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE "user" SET role='hospital' WHERE id=1;

  -- user กดยกเลิกรับเคสเอง -> เคสกลับเข้า inbox และ status กลับเป็น reported
  UPDATE case_acceptance SET status='released', released_at=now(), released_by=2,
         note='ที่อยู่จริงอยู่นอกเขตรับผิดชอบ' WHERE case_id=1 AND status='active';
  ASSERT (SELECT status FROM case_report WHERE id=1) = 'reported', 'ยกเลิกรับแล้ว status ต้องกลับเป็น reported';
  SELECT count(*) INTO n FROM v_case_inbox WHERE org_code='07476' AND id=1;
  ASSERT n = 1, 'ยกเลิกรับแล้วต้องกลับเข้า inbox';

  -- เหตุผลตอนคืนเคสยาวได้ไม่เกิน 255
  BEGIN
    UPDATE case_acceptance SET note = repeat('ก',256) WHERE case_id=1 AND status='released';
    ASSERT false, 'ควร reject เหตุผลเกิน 255 ตัว';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- คนอื่นมากดรับเคสที่ว่างได้
  INSERT INTO case_acceptance (case_id,org_code,accepted_by) VALUES (1,'07476',2);
  SELECT count(*) INTO n FROM case_acceptance WHERE case_id=1;
  ASSERT n = 2, 'ประวัติการรับ/ยกเลิกต้องเก็บครบ ได้ ' || n;

  -- admin โยกเคสให้ผู้ใช้อีกคน (ข้ามข้อจำกัดพื้นที่ได้)
  n := case_transfer(1, 4, 3, 'โยกให้ รพ.สต.ท่าทอง ดูแลแทน');
  ASSERT (SELECT org_code FROM case_acceptance WHERE case_id=1 AND status='active') = '07477',
         'โยกแล้วเจ้าของใหม่ต้องเป็น 07477';
  ASSERT (SELECT count(*) FROM case_acceptance WHERE case_id=1 AND status='transferred') = 1,
         'แถวเดิมต้องถูกปิดเป็น transferred';
  ASSERT (SELECT transferred_from FROM case_acceptance WHERE id=n) IS NOT NULL,
         'แถวใหม่ต้องชี้กลับไปแถวที่ถูกโยกมา';
  ASSERT (SELECT status FROM case_report WHERE id=1) = 'accepted', 'โยกแล้วเคสยังต้อง accepted';
  SELECT count(*) INTO n FROM v_case_inbox WHERE id=1;
  ASSERT n = 0, 'เคสที่มีเจ้าของต้องไม่อยู่ใน inbox';

  -- คนที่ไม่ใช่ admin โยกเคสไม่ได้
  BEGIN
    PERFORM case_transfer(1, 2, 3, 'ไม่ควรผ่าน');
    ASSERT false, 'ควร reject การโยกเคสโดยหน่วยบริการ';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- รับใหม่แล้ว ลำดับ 2 ยังชี้การรับครั้งแรกเสมอ
  ASSERT (SELECT activity_code FROM v_case_activity WHERE case_id=1 AND seq=2) = 'ACCEPT',
         'หลังคืนเคสและรับใหม่ ลำดับ 2 ต้องยังเป็นพื้นที่รับเคส';

  -- กิจกรรมพิมพ์เองได้ ไม่ต้องมีรหัส แต่ต้องมีอย่างใดอย่างหนึ่ง ไม่ใช่ทั้งคู่/ไม่มีเลย
  INSERT INTO case_activity (case_id,date_act,activity_name,note)
    VALUES (1,'2026-09-11','ล้างภาชนะน้ำใช้รอบบ้าน','เจ้าของบ้านร่วมดำเนินการ');
  ASSERT (SELECT activity_name FROM v_case_activity WHERE case_id=1 ORDER BY seq DESC LIMIT 1)
         = 'ล้างภาชนะน้ำใช้รอบบ้าน', 'กิจกรรมพิมพ์เองต้องขึ้นในไทม์ไลน์';
  BEGIN
    INSERT INTO case_activity (case_id,date_act,activity_code,activity_name)
      VALUES (1,'2026-09-11','SPRAY','พ่นเอง');
    ASSERT false, 'ควร reject การใส่ทั้งรหัสและข้อความ';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO case_activity (case_id,date_act) VALUES (1,'2026-09-11');
    ASSERT false, 'ควร reject กิจกรรมที่ไม่มีทั้งรหัสและข้อความ';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO case_activity (case_id,date_act,activity_name)
      VALUES (1,'2026-09-11',repeat('ก',256));
    ASSERT false, 'ควร reject ชื่อกิจกรรมเกิน 255 ตัว';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO case_activity (case_id,date_act,activity_name,note)
      VALUES (1,'2026-09-11','ทดสอบ',repeat('ก',1001));
    ASSERT false, 'ควร reject รายละเอียดเกิน 1000 ตัว';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- หมู่บ้านหนึ่งมีหน่วยบริการรับผิดชอบได้หน่วยเดียว
  BEGIN
    INSERT INTO hos_village (area_code, org_code) VALUES ('65010101','07477');
    ASSERT false, 'ควร reject หมู่บ้านที่มีหน่วยรับผิดชอบอยู่แล้ว';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- ไฟล์แนบรับแค่ภาพกับ pdf
  BEGIN
    INSERT INTO case_document (case_id,file_path,file_name,mime_type)
      VALUES (1,'/uploads/x.docx','x.docx','application/msword');
    ASSERT false, 'ควร reject ไฟล์แนบที่ไม่ใช่ภาพหรือ pdf';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- เอกสารต้องเป็นฟอร์ม หรือ ไฟล์ อย่างใดอย่างหนึ่ง
  BEGIN
    INSERT INTO case_document (case_id,form_template_id,file_path) VALUES (1,1,'/x.jpg');
    ASSERT false, 'ควร reject เอกสารที่เป็นทั้งฟอร์มและไฟล์';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- บัญชีต้องเข้าได้ทางใดทางหนึ่ง (รหัสผ่าน หรือ SSO)
  BEGIN
    INSERT INTO "user" (username,org_code,role) VALUES ('nologin','10676','hospital');
    ASSERT false, 'ควร reject บัญชีที่ไม่มีทั้งรหัสผ่านและ SSO';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO "user" (username,sso_sub,org_code,role) VALUES ('sso1','sub-abc','10676','hospital');
  ASSERT (SELECT password_hash FROM "user" WHERE username='sso1') IS NULL,
         'ผู้ใช้ SSO ไม่ต้องมีรหัสผ่าน';

  -- เลขบัตรผู้ใช้ต้องเป็นตัวเลข 13 หลักและห้ามซ้ำ
  BEGIN
    INSERT INTO "user" (username,sso_sub,cid,org_code,role) VALUES ('badcid','s-bad','12345','10676','hospital');
    ASSERT false, 'ควร reject เลขบัตรที่ไม่ใช่ 13 หลัก';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO "user" (username,sso_sub,cid,org_code,role) VALUES ('cid1','s-c1','1650100000001','10676','hospital');
  BEGIN
    INSERT INTO "user" (username,sso_sub,cid,org_code,role) VALUES ('cid2','s-c2','1650100000001','10676','hospital');
    ASSERT false, 'ควร reject เลขบัตรซ้ำ';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- ผู้ใช้ต้องสังกัดหน่วยงาน
  BEGIN
    INSERT INTO "user" (username,password_hash,org_code,role) VALUES ('x','h',NULL,'hospital');
    ASSERT false, 'ควร reject ผู้ใช้ที่ไม่มีสังกัด';
  EXCEPTION WHEN not_null_violation THEN NULL; END;

  RAISE NOTICE 'smoke test: PASS';
END $t$;

ROLLBACK;
