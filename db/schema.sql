-- ระบบเฝ้าระวังทางระบาดวิทยา (รง.506/507) — PostGIS
-- รองรับโรคที่ต้องรายงานทุกโรค: ส่วนที่ต่างกันรายโรคเก็บใน jsonb + ตั้งค่าใน c_disease

CREATE EXTENSION IF NOT EXISTS postgis;

-- วัน/เวลาแยกคอลัมน์ (date_*, time_*) เก็บเป็นเวลาไทย ฟังก์ชันนี้รวมกลับเป็น instant
-- ให้ view คำนวณช่วงเวลา/SLA ได้ เวลาว่าง = ต้นวัน
CREATE FUNCTION th_ts(d date, t time) RETURNS timestamptz
LANGUAGE sql STABLE AS $fn$
  SELECT (d + coalesce(t, '00:00'::time)) AT TIME ZONE 'Asia/Bangkok'
$fn$;

-- ========== 1. Master ==========

-- พื้นที่ปกครอง ระดับเดียวกันหมด รหัสเป็น prefix ซ้อนกัน (65 > 6501 > 650101 > 65010101)
-- geom: polygon สำหรับ จว./อำเภอ/ตำบล, point สำหรับหมู่บ้าน จึงใช้ Geometry แบบรวม
CREATE TABLE c_area (
  code        text PRIMARY KEY,
  level       smallint NOT NULL CHECK (level BETWEEN 1 AND 4),  -- 1 จว. 2 อำเภอ 3 ตำบล 4 หมู่บ้าน/ชุมชน
  name        text NOT NULL,
  parent_code text REFERENCES c_area(code),
  population  integer,
  geom        geometry(Geometry, 4326),
  deleted_at  timestamptz                -- soft delete: ซ่อนจากตัวเลือก แต่เคสเก่ายังอ้างชื่อได้
);
CREATE INDEX c_area_parent_idx ON c_area (parent_code);
CREATE INDEX c_area_geom_idx     ON c_area USING gist (geom);

-- หน่วยงาน: สสจ. / สสอ. / รพ. / รพ.สต. / คลินิก — ผู้ใช้ทุกคนต้องสังกัดที่นี่
CREATE TABLE c_org (
  code      text PRIMARY KEY,              -- hoscode 5 หลัก
  name      text NOT NULL,
  org_type  text,                          -- สสจ./สสอ./รพศ./รพช./รพ.สต./เอกชน
  area_code text REFERENCES c_area,
  parent_code text REFERENCES c_org(code),   -- รพ.สต. -> สสอ. -> สสจ.
  is_active boolean NOT NULL DEFAULT true,
  geom      geometry(Point, 4326),
  deleted_at timestamptz                 -- soft delete: ซ่อนจากตัวเลือก แต่เคสเก่ายังอ้างชื่อได้
);
CREATE INDEX org_area_code_idx ON c_org (area_code);
CREATE INDEX org_parent_idx    ON c_org (parent_code);

-- พื้นที่รับผิดชอบ ใช้ routing เคสเข้าหน่วยที่ต้องลงควบคุมโรคอัตโนมัติ
-- หมู่บ้านที่แต่ละหน่วยบริการรับผิดชอบ (มาจาก cpcumoo ของระบบเดิม: pcucode + moo)
-- หน่วยบริการ 1 แห่ง ดูแลได้หลายหมู่บ้าน แต่หมู่บ้าน 1 แห่งมีหน่วยบริการเดียว
-- area_code จึงเป็น PK ไม่ใช่คู่ (org_code, area_code) — ระบบเดิมซ้ำได้ ทำให้เคสเดียวเข้า inbox หลายหน่วย
CREATE TABLE hos_village (
  area_code text PRIMARY KEY REFERENCES c_area,
  org_code  text NOT NULL REFERENCES c_org ON DELETE CASCADE
);
CREATE INDEX hos_village_org_idx ON hos_village (org_code);

CREATE TABLE c_occupation (
  code text PRIMARY KEY,
  name text NOT NULL
);

-- ตัวโรค + "ปุ่มปรับ" เชิงระบาดวิทยาที่ทำให้ระบบใช้ได้กับทุกโรคโดยไม่ต้องแก้โค้ด
CREATE TABLE c_disease (
  code                     text PRIMARY KEY,   -- รหัส 506
  name_th                  text NOT NULL,
  name_en                  text,
  icd10                    text[],
  disease_group            text,              -- ไข้เลือดออก/อาหารและน้ำ/ทางเดินหายใจ/สัตว์สู่คน...
  transmission             text,              -- vector|foodborne|airborne|contact|zoonotic|bloodborne
  investigate_within_hours int,               -- SLA สอบสวน (SRRT = 24)
  control_radius_m         int,               -- รัศมีควบคุมโรครอบบ้านผู้ป่วย (DHF = 100)
  incubation_min_days      int,
  incubation_max_days      int,
  is_active                boolean NOT NULL DEFAULT true
);

-- กิจกรรมควบคุมโรค: transmission = NULL คือใช้ได้ทุกโรค
CREATE TABLE c_activity_type (
  code         text PRIMARY KEY,
  name         text NOT NULL,
  transmission text,
  sort_order   int
);

-- แบบฟอร์ม (แบบสอบสวนโรค) เก็บเป็น JSON Schema — เพิ่มโรคใหม่ = insert แถวเดียว
CREATE TABLE c_form_template (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code         text NOT NULL,
  version      int  NOT NULL DEFAULT 1,
  name         text NOT NULL,
  disease_code text REFERENCES c_disease,      -- NULL = ใช้ได้ทุกโรค
  schema       jsonb NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  UNIQUE (code, version)
);

-- ========== 2. ผู้ใช้ (ต้องสังกัดหน่วยงานเสมอ) ==========

-- บทบาทของผู้ใช้ เป็นตารางไม่ใช่ CHECK จะได้เอาชื่อไทยไปแสดงบนจอได้ตรงกันทุกที่
CREATE TABLE user_role (
  code       text PRIMARY KEY,
  name       text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

-- จังหวัด   = สสจ. ทำได้ทุกอย่างทั้งจังหวัด (รับข้ามพื้นที่ โยกเคส จัดการระบบ)
-- อำเภอ     = สสอ. บันทึกกิจกรรมของเคสในอำเภอตัวเองได้
-- หน่วยบริการ = รับ/ทำงานเฉพาะหมู่บ้านที่ตัวเองรับผิดชอบ
INSERT INTO user_role (code,name,sort_order) VALUES
 ('province','จังหวัด',1),
 ('district','อำเภอ',2),
 ('hospital','หน่วยบริการ',3);

CREATE TABLE users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      text UNIQUE NOT NULL,
  sso_sub       text UNIQUE,                -- subject จาก PLKHealth SSO (ผู้ใช้ที่ล็อกอินด้วย SSO)
  cid           text UNIQUE CHECK (cid ~ '^[0-9]{13}$'),   -- เลขบัตรผู้ใช้ กรอกเองตอนตั้งค่าบัญชีครั้งแรก
  password_hash text,                       -- argon2id/bcrypt เท่านั้น — NULL = เข้าได้ทาง SSO อย่างเดียว
  full_name     text,
  position      text,
  email         text,
  tel           text,
  org_code      text NOT NULL REFERENCES c_org,   -- สังกัด บังคับ
  role          text NOT NULL REFERENCES user_role,
  scope_area    text REFERENCES c_area,   -- ขอบเขตข้อมูลที่เห็น (NULL = อนุมานจาก c_org)
  notify        boolean NOT NULL DEFAULT true,   -- รับแจ้งเตือนการส่งเคสผ่านไลน์หมอพร้อม
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  login_count   int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,             -- soft delete: ประวัติการแจ้ง/รับเคสยังชี้มาที่แถวนี้ได้

  -- ต้องเข้าได้ทางใดทางหนึ่ง ไม่มีทั้งคู่ = บัญชีที่ล็อกอินไม่ได้เลย
  CHECK (num_nonnulls(sso_sub, password_hash) >= 1)
);
CREATE INDEX users_org_idx ON users (org_code);

-- ========== 3. แจ้งเคส ==========

-- เลขทะเบียนเคส ให้ DB เดินเลขเอง จะได้ไม่ชนกันตอนหลายหน่วยกดแจ้งพร้อมกัน
-- ponytail: เลขไม่รีเซ็ตต้นปี ถ้าต้องรีเซ็ตค่อยเปลี่ยนเป็นตารางนับรายปี
CREATE SEQUENCE case_no_seq;

CREATE TABLE case_report (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_no      text UNIQUE                              -- 65-2026-000123
               DEFAULT '65-' || to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYYY')
                       || '-' || lpad(nextval('case_no_seq')::text, 6, '0'),
  disease_code text NOT NULL REFERENCES c_disease,
  -- reported = ยังไม่มีหน่วยไหนกดรับ (คืนเคสแล้วก็กลับมาสถานะนี้)
  status       text NOT NULL DEFAULT 'reported'
               CHECK (status IN ('reported','accepted','investigating','controlled','closed')),
  case_class   text CHECK (case_class IN ('suspected','probable','confirmed','discarded')),

  -- ผู้ป่วย
  cid             text,
  passport        text,
  hn              text,
  pname text, fname text, lname text,
  gender          text CHECK (gender IN ('M','F','U')),
  birth_date      date,
  age_y smallint, age_m smallint,
  nationality     text,
  occupation_code text REFERENCES c_occupation,

  -- ที่อยู่ขณะป่วย
  area_code  text REFERENCES c_area,      -- ระดับหมู่บ้าน/ชุมชน (8 หลัก)
  addr_no    text,
  moo        text,
  street     text,
  place_name text,
  tel        text,
  geom       geometry(Point, 4326),         -- พิกัดบ้าน ใช้หาเคสในรัศมีควบคุมโรค

  -- ไทม์ไลน์
  date_onset     date NOT NULL,             -- วันเริ่มป่วย
  date_visit     date,
  date_dx        date,                      -- วันที่พบเคส (สถานพยาบาลวินิจฉัย/พบผู้ป่วย)
  time_dx        time,                      -- เวลาที่พบเคส (เวลาท้องถิ่น ไม่มี timezone)
  date_admit     date,
  date_discharge date,
  discharge_type text CHECK (discharge_type IN ('recovered','referred','died','absconded','unknown')),
  date_death     date,

  -- คลินิก
  patient_type text CHECK (patient_type IN ('OPD','IPD')),
  symptom      text,
  lab_result   jsonb NOT NULL DEFAULT '{}'::jsonb,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- ฟิลด์เฉพาะโรค ตาม c_disease.code

  -- ผู้แจ้ง (หน่วยงานที่แจ้ง บังคับ)
  report_org_code   text NOT NULL REFERENCES c_org,
  reporter_name     text,
  reporter_position text,
  reporter_tel      text,
  date_report       date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date,  -- วันที่รายงาน
  time_report       time          DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::time,  -- เวลาที่รายงาน

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by bigint REFERENCES users,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by bigint REFERENCES users,
  deleted_at timestamptz,
  deleted_by bigint REFERENCES users,
  delete_reason text,

  CHECK (date_onset <= coalesce(date_visit, date_onset))
);
CREATE INDEX case_disease_onset_idx ON case_report (disease_code, date_onset) WHERE deleted_at IS NULL;
CREATE INDEX case_area_idx          ON case_report (area_code)                WHERE deleted_at IS NULL;
CREATE INDEX case_cid_idx           ON case_report (cid)                      WHERE cid IS NOT NULL;
CREATE INDEX case_report_org_idx    ON case_report (report_org_code);
CREATE INDEX case_status_idx        ON case_report (status)                   WHERE deleted_at IS NULL;
CREATE INDEX case_geom_idx          ON case_report USING gist (geom);
CREATE INDEX case_detail_idx        ON case_report USING gin (detail);

-- ========== 4. รับเคส ==========
-- ไม่มีการมอบหมาย: หน่วยงานเห็นเคสที่ตกในพื้นที่รับผิดชอบตัวเอง (hos_village) แล้วกดรับเอง
-- หนึ่งแถวต่อการรับหนึ่งครั้ง ประวัติจึงอยู่ครบ สถานะของแถว:
--   active      = เจ้าของเคสปัจจุบัน (มีได้ทีละแถวเดียวต่อเคส)
--   released    = ผู้ใช้กดยกเลิกรับเคสเอง -> เคสกลับเข้า inbox ให้คนอื่นมากดรับ
--   transferred = admin/สสจ. โยกเคสให้คนอื่น (แถวใหม่จะมี transferred_from ชี้กลับมา)

CREATE TABLE case_acceptance (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id     bigint NOT NULL REFERENCES case_report ON DELETE CASCADE,
  org_code    text   NOT NULL REFERENCES c_org,          -- หน่วยงานที่กดรับ
  date_accept date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date,  -- วันที่รับเคส
  time_accept time          DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::time,  -- เวลาที่รับเคส
  accepted_by bigint NOT NULL REFERENCES users,     -- ผู้กดรับ
  status      text   NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','released','transferred')),
  released_at timestamptz,
  released_by bigint REFERENCES users,              -- ผู้กดยกเลิก / admin ที่โยกเคส
  note        text   CHECK (length(note) <= 255),          -- เหตุผลตอนคืน/โยกเคส
  transferred_from bigint REFERENCES case_acceptance(id),  -- แถวเดิมที่ถูกโยกมา (NULL = กดรับเอง)

  CHECK ((status <> 'active') = (released_at IS NOT NULL))
);
CREATE INDEX case_accept_case_idx ON case_acceptance (case_id);
CREATE INDEX case_accept_org_idx  ON case_acceptance (org_code, status);
-- เจ้าของเคสที่ active ได้ทีละหน่วยเดียว = กันสองหน่วยกดรับพร้อมกัน
CREATE UNIQUE INDEX case_accept_one_active ON case_acceptance (case_id) WHERE status = 'active';

-- 1) รับเคสได้เฉพาะบทบาท province/hospital (อำเภอมีหน้าที่บันทึกกิจกรรม ไม่ใช่ถือเคส)
--    ไม่ดูที่อยู่ผู้ป่วยว่าตรงกับหมู่บ้านรับผิดชอบไหม — เคสข้ามเขต/ย้ายที่อยู่มีจริง
--    หน่วยที่กดรับคือหน่วยที่รับผิดชอบต่อ (hos_village ใช้จัดลำดับ inbox เท่านั้น)
-- 2) sync case_report.status ให้เอง ทุก action จึงเขียนตารางเดียว ไม่มีทางลืมอัปเดตสถานะ
CREATE FUNCTION case_acceptance_sync() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.status = 'active' AND NEW.transferred_from IS NULL AND NOT EXISTS (
       SELECT 1 FROM users u
        WHERE u.id = NEW.accepted_by AND u.role IN ('province','hospital')
  ) THEN
    RAISE EXCEPTION 'บทบาทของผู้ใช้ % รับเคสไม่ได้', NEW.accepted_by
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE case_report c
     SET status = CASE WHEN EXISTS (SELECT 1 FROM case_acceptance a
                                     WHERE a.case_id = NEW.case_id AND a.status = 'active')
                       THEN 'accepted' ELSE 'reported' END
   WHERE c.id = NEW.case_id
     AND c.status IN ('reported','accepted');   -- ไม่ไปแตะเคสที่เดินหน้าไปแล้ว
  RETURN NULL;
END $fn$;

CREATE TRIGGER t_case_acceptance AFTER INSERT OR UPDATE ON case_acceptance
  FOR EACH ROW EXECUTE FUNCTION case_acceptance_sync();

-- admin/สสจ. โยกเคสให้ผู้ใช้อีกคน: ปิดแถวเดิม + เปิดแถวใหม่ ในทรานแซกชันเดียว
-- ทำเป็นฟังก์ชันเพราะ unique index ห้ามมี active สองแถว ลำดับจึงพลาดไม่ได้
CREATE FUNCTION case_transfer(p_case_id bigint, p_by bigint, p_to_user bigint, p_note text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql AS $fn$
DECLARE v_from bigint; v_to_org text; v_new bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_by AND role = 'province') THEN
    RAISE EXCEPTION 'โยกเคสได้เฉพาะ admin/สสจ.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT org_code INTO v_to_org FROM users WHERE id = p_to_user AND is_active;
  IF v_to_org IS NULL THEN
    RAISE EXCEPTION 'ไม่พบผู้ใช้ปลายทาง %', p_to_user USING ERRCODE = 'foreign_key_violation';
  END IF;

  UPDATE case_acceptance SET status = 'transferred', released_at = now(), released_by = p_by
   WHERE case_id = p_case_id AND status = 'active'
   RETURNING id INTO v_from;   -- NULL ได้ = เคสว่างอยู่ ก็แค่มอบให้เลย

  INSERT INTO case_acceptance (case_id, org_code, accepted_by, note, transferred_from)
  VALUES (p_case_id, v_to_org, p_to_user, p_note, v_from)
  RETURNING id INTO v_new;
  RETURN v_new;
END $fn$;

-- ========== 5. กิจกรรมควบคุมโรคของเคส ==========
-- ลำดับ | วัน-เวลา | กิจกรรมที่ดำเนินการ | เอกสาร | ภาพกิจกรรม | ผู้ดำเนินการ | หมายเหตุ
--
-- ตารางนี้เก็บเฉพาะกิจกรรมที่ "คนบันทึกเอง" ตั้งแต่ลำดับ 3 ขึ้นไป
-- ลำดับ 1 (แจ้งเคสเข้าระบบ) และ 2 (พื้นที่รับเคส) v_case_activity สร้างจาก
-- date_report/time_report และ date_accept/time_accept ให้อัตโนมัติ
-- จึงถูกต้องเสมอโดยไม่ต้องพึ่ง trigger และลบ/แก้ให้เพี้ยนไม่ได้

CREATE TABLE case_activity (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id       bigint   NOT NULL REFERENCES case_report ON DELETE CASCADE,
  date_act      date     NOT NULL,                        -- วันที่ดำเนินการ
  time_act      time,                                     -- เวลาที่ดำเนินการ
  -- กิจกรรมที่ดำเนินการ: เลือกจากรหัส (ของเดิม/นำเข้า) หรือพิมพ์เองเป็นข้อความ อย่างใดอย่างหนึ่ง
  activity_code text     REFERENCES c_activity_type,
  activity_name text     CHECK (length(activity_name) <= 255),
  performer     text,                                    -- ผู้ดำเนินการ (คน/ทีม/อสม./หน่วยงาน)
  performer_org text REFERENCES c_org,                     -- หน่วยงานผู้ดำเนินการ ถ้าระบุได้
  note          text     CHECK (length(note) <= 1000),   -- รายละเอียด
  created_at timestamptz NOT NULL DEFAULT now(),         -- ใครบันทึกคือ created_by (คนละคนกับผู้ดำเนินการได้)
  created_by bigint REFERENCES users,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by bigint REFERENCES users,

  -- สองรหัสนี้เป็นของลำดับ 1/2 ที่ระบบสร้างเอง ห้ามบันทึกซ้ำเข้ามา
  CHECK (activity_code NOT IN ('REPORT','ACCEPT')),
  CHECK (num_nonnulls(activity_code, activity_name) = 1)
);
CREATE INDEX act_case_idx ON case_activity (case_id, date_act, time_act);
CREATE INDEX act_type_idx ON case_activity (activity_code, date_act);

-- ========== 6. เอกสารของเคส / แบบรายงานการสอบสวนโรค ==========
-- ทั้งแบบสอบสวน (form_template_id + data) และไฟล์แนบ/รูป (file_path) อยู่ตารางเดียว
-- activity_id ไม่ว่าง = เอกสารนั้นผูกกับกิจกรรมควบคุมโรคครั้งนั้น

CREATE TABLE case_document (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id          bigint NOT NULL REFERENCES case_report ON DELETE CASCADE,
  activity_id      bigint REFERENCES case_activity ON DELETE CASCADE,
  form_template_id bigint REFERENCES c_form_template,
  data             jsonb,                                -- คำตอบตาม c_form_template.schema
  file_path        text,
  file_name        text,
  mime_type        text,
  file_size        bigint,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','submitted','approved','rejected')),
  submitted_at     timestamptz,
  approved_at      timestamptz,
  approved_by      bigint REFERENCES users,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by bigint REFERENCES users,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by bigint REFERENCES users,

  CHECK ((form_template_id IS NOT NULL) <> (file_path IS NOT NULL)),  -- เป็นฟอร์ม หรือ ไฟล์ อย่างใดอย่างหนึ่ง
  -- ไฟล์แนบรับแค่ 2 อย่าง: ภาพกิจกรรม กับเอกสาร pdf
  -- บังคับที่นี่ที่เดียว ไม่ว่าจะเข้ามาทางหน้าเว็บ import หรือ psql ก็หลุดไม่ได้
  CHECK (file_path IS NULL OR mime_type LIKE 'image/%' OR mime_type = 'application/pdf')
);
CREATE INDEX doc_case_idx ON case_document (case_id);
CREATE INDEX doc_act_idx  ON case_document (activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX doc_data_idx ON case_document USING gin (data);

-- ========== 7. Audit การเปิดดูข้อมูลผู้ป่วย (PDPA) ==========

CREATE TABLE case_view_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id    bigint NOT NULL,
  user_id    bigint NOT NULL REFERENCES users,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  ip         inet,
  user_agent text
);
CREATE INDEX viewlog_case_idx ON case_view_log (case_id);
CREATE INDEX viewlog_user_idx ON case_view_log (user_id, viewed_at);
-- ponytail: ตารางเดียวไม่ partition, แตกเป็น partition รายปีเมื่อเกิน ~10 ล้านแถว

-- ========== 8. updated_at ==========

CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END $fn$;

CREATE TRIGGER t_case_report   BEFORE UPDATE ON case_report   FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER t_case_activity BEFORE UPDATE ON case_activity FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER t_case_document BEFORE UPDATE ON case_document FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ========== 9. Dashboard ==========
-- รหัสพื้นที่เป็น prefix ซ้อนกัน จึง rollup จังหวัด/อำเภอ/ตำบล ได้โดยไม่ต้อง join หรือ denormalize

CREATE MATERIALIZED VIEW mv_case_daily AS
SELECT
  c.disease_code,
  c.date_onset,
  left(c.area_code, 2) AS prov_code,
  left(c.area_code, 4) AS amp_code,
  left(c.area_code, 6) AS tmb_code,
  c.area_code          AS moo_code,
  count(*)                                                    AS cases,
  count(*) FILTER (WHERE c.discharge_type = 'died')           AS deaths,
  count(*) FILTER (WHERE c.status IN ('controlled','closed')) AS controlled,
  count(*) FILTER (WHERE c.age_y < 15)                        AS cases_child
FROM case_report c
WHERE c.deleted_at IS NULL AND c.area_code IS NOT NULL
GROUP BY 1,2,3,4,5,6;
CREATE UNIQUE INDEX mv_case_daily_pk ON mv_case_daily (disease_code, date_onset, moo_code);
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_case_daily;  -- cron ทุก 10 นาที

-- สถานะปัจจุบันของเคส + SLA สอบสวนทันเวลา ใช้เป็นหน้า worklist และตัวชี้วัด
CREATE VIEW v_case_status AS
SELECT
  c.id, c.case_no, c.disease_code, c.status, c.date_onset, c.date_report, c.time_report, c.area_code,
  c.report_org_code,
  a.org_code    AS owner_org_code,
  a.date_accept, a.time_accept,
  (SELECT min(th_ts(x.date_act, x.time_act)) FROM case_activity x WHERE x.case_id = c.id) AS first_activity_at,
  (SELECT count(*)         FROM case_activity x WHERE x.case_id = c.id) AS activity_count,
  (SELECT count(*) FROM case_document x
     WHERE x.case_id = c.id AND x.form_template_id IS NOT NULL AND x.status <> 'draft') AS form_count,
  ((SELECT min(th_ts(x.date_act, x.time_act)) FROM case_activity x WHERE x.case_id = c.id)
     <= th_ts(c.date_report, c.time_report)
        + make_interval(hours => d.investigate_within_hours)) AS investigated_in_time
FROM case_report c
JOIN c_disease d ON d.code = c.disease_code
LEFT JOIN case_acceptance a ON a.case_id = c.id AND a.status = 'active'
WHERE c.deleted_at IS NULL;

-- ตารางกิจกรรมของเคส ตรงตามหน้าจอ:
-- ลำดับ | วันเวลา | กิจกรรมที่ดำเนินการ | เอกสาร | ภาพกิจกรรม | ผู้ดำเนินการ | หมายเหตุ
--   ลำดับ 1 = แจ้งเคสเข้าระบบ เสมอ (จาก date_report/time_report)
--   ลำดับ 2 = พื้นที่รับเคส เสมอ (จากการกดรับครั้งแรก) — ยังไม่มีใครรับก็ยังไม่มีแถวนี้
--   ลำดับ 3+ = case_activity เรียงตามวัน-เวลา
-- เอกสาร/ภาพ มาจาก case_document ที่ activity_id ชี้มา แยกด้วย mime_type ไม่ต้องมีคอลัมน์เพิ่ม
CREATE VIEW v_case_activity AS
WITH ev AS (
  -- ลำดับ 1
  SELECT c.id AS case_id, 0 AS rank, NULL::bigint AS activity_id,
         c.date_report AS date_act, c.time_report AS time_act,
         'REPORT' AS activity_code, 'แจ้งเคสเข้าระบบ' AS activity_name,
         coalesce(c.reporter_name, o.name) AS performer, c.report_org_code AS performer_org,
         NULL::text AS note
  FROM case_report c
  LEFT JOIN c_org o ON o.code = c.report_org_code
  WHERE c.deleted_at IS NULL

  UNION ALL
  -- ลำดับ 2 (การกดรับครั้งแรกของเคส)
  SELECT a.case_id, 1, NULL::bigint,
         a.date_accept, a.time_accept,
         'ACCEPT', 'พื้นที่รับเคส',
         coalesce(u.full_name, o.name) , a.org_code,
         a.note
  FROM (SELECT DISTINCT ON (case_id) * FROM case_acceptance ORDER BY case_id, date_accept, time_accept, id) a
  LEFT JOIN c_org      o ON o.code = a.org_code
  LEFT JOIN users u ON u.id   = a.accepted_by

  UNION ALL
  -- ลำดับ 3+
  SELECT x.case_id, 2, x.id, x.date_act, x.time_act, x.activity_code,
         coalesce(x.activity_name, t.name),          -- พิมพ์เองมาก่อน ไม่มีค่อยใช้ชื่อจากรหัส
         x.performer, x.performer_org, x.note
  FROM case_activity x
  LEFT JOIN c_activity_type t ON t.code = x.activity_code
)
SELECT
  ev.case_id,
  row_number() OVER (PARTITION BY ev.case_id
                     ORDER BY ev.rank, ev.date_act, ev.time_act NULLS FIRST,
                              ev.activity_id)::int AS seq,          -- ลำดับ
  ev.activity_id,
  ev.date_act,                                    -- วันที่
  ev.time_act,
  to_char(ev.time_act, 'HH24:MI') AS time_act_txt,-- เวลา พร้อมแสดงผล
  th_ts(ev.date_act, ev.time_act) AS activity_at, -- instant รวม เผื่อคำนวณช่วงเวลา
  ev.activity_code,
  ev.activity_name,                               -- กิจกรรมที่ดำเนินการ
  coalesce(f.docs,   '[]'::jsonb) AS documents,   -- เอกสาร
  coalesce(f.photos, '[]'::jsonb) AS photos,      -- ภาพกิจกรรม
  ev.performer,                                   -- ผู้ดำเนินการ
  ev.performer_org,
  ev.note                                         -- หมายเหตุ
FROM ev
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(jsonb_build_object(
      'id', x.id, 'name', x.file_name, 'path', x.file_path) ORDER BY x.id)
      FILTER (WHERE x.mime_type = 'application/pdf') AS docs,
    jsonb_agg(jsonb_build_object(
      'id', x.id, 'name', x.file_name, 'path', x.file_path) ORDER BY x.id)
      FILTER (WHERE x.mime_type LIKE 'image/%') AS photos
  FROM case_document x
  WHERE x.activity_id = ev.activity_id
) f ON ev.activity_id IS NOT NULL;

-- หน้าแรก: รายการเคสที่ถูกรายงานเข้าระบบ (เรียงลำดับล่าสุดก่อน)
-- ลำดับ | โรงพยาบาล | วันเวลาพบ | วันเวลารายงาน | ชื่อ-สกุล | อำเภอ | ตำบล | หมู่ที่ | วินิจฉัย | วันเวลารับเคส | รับเคสโดย
-- อำเภอ/ตำบล ตัดจาก prefix ของ area_code ไม่ต้องไล่ parent ทีละชั้น
CREATE VIEW v_case_list AS
SELECT
  c.id,
  c.case_no,
  c.report_org_code,
  ro.name AS report_org_name,                                  -- โรงพยาบาล
  c.date_dx,                                                   -- วันที่พบเคส
  c.time_dx,
  to_char(c.time_dx, 'HH24:MI') AS time_dx_txt,                -- เวลาพบเคส พร้อมแสดงผล
  c.date_visit,
  c.date_onset,
  c.date_report,                                               -- วันที่รายงาน
  c.time_report,
  to_char(c.time_report, 'HH24:MI') AS time_report_txt,        -- เวลารายงาน พร้อมแสดงผล
  nullif(btrim(concat_ws(' ', c.pname, c.fname, c.lname)), '') AS patient_name,  -- ชื่อ-สกุล
  -- บรรทัดรองใต้ชื่อ: "ชาย 36 ปี 10 ด"
  nullif(concat_ws(' ',
    CASE c.gender WHEN 'M' THEN 'ชาย' WHEN 'F' THEN 'หญิง' END,
    CASE WHEN c.age_y IS NOT NULL THEN c.age_y || ' ปี' END,
    CASE WHEN c.age_m IS NOT NULL THEN c.age_m || ' ด' END), '') AS patient_sub,
  c.gender, c.age_y, c.age_m,
  amp.code AS amp_code,                                        -- ใช้กรองรายอำเภอ
  amp.name AS amp_name,                                        -- อำเภอ
  tmb.code AS tmb_code,
  tmb.name AS tmb_name,                                        -- ตำบล
  c.moo,                                                       -- หมู่ที่
  c.addr_no,                                                   -- บ้านเลขที่
  c.disease_code,
  d.name_th AS disease_name,                                   -- วินิจฉัย
  a.date_accept,                                               -- วันที่รับเคส
  a.time_accept,
  to_char(a.time_accept, 'HH24:MI') AS time_accept_txt,        -- เวลารับเคส พร้อมแสดงผล
  a.org_code    AS accepted_org_code,                          -- ใช้กรองรายหน่วยรับ
  ao.name       AS accepted_org_name,                          -- รับเคสโดย (หน่วยงาน)
  au.full_name  AS accepted_by_name,                           -- รับเคสโดย (ผู้กดรับ)
  c.status,
  c.area_code
FROM case_report c
JOIN c_disease d ON d.code = c.disease_code
LEFT JOIN c_org      ro  ON ro.code  = c.report_org_code
LEFT JOIN c_area tmb ON tmb.code = left(c.area_code, 6)
LEFT JOIN c_area amp ON amp.code = left(c.area_code, 4)
LEFT JOIN case_acceptance a ON a.case_id = c.id AND a.status = 'active'
LEFT JOIN c_org      ao  ON ao.code  = a.org_code
LEFT JOIN users au  ON au.id    = a.accepted_by
WHERE c.deleted_at IS NULL;

-- หน้า "เคสรอรับ": เคสที่ตกในพื้นที่รับผิดชอบของหน่วยงาน และยังไม่มีใครรับ
-- แอปกรอง WHERE org_code = <c_org ของผู้ใช้ที่ล็อกอิน>
CREATE VIEW v_case_inbox AS
SELECT
  oa.org_code,
  c.id, c.case_no, c.disease_code, c.status,
  c.pname, c.fname, c.lname, c.gender, c.age_y,
  c.area_code, c.addr_no, c.moo,
  ST_Y(c.geom) AS lat, ST_X(c.geom) AS lon,   -- prisma อ่าน geometry ดิบไม่ได้ (panic) ส่งเป็นตัวเลขแทน
  c.date_onset, c.date_visit, c.date_report, c.time_report, c.report_org_code,
  (th_ts(c.date_report, c.time_report)
     + make_interval(hours => d.investigate_within_hours)) AS investigate_due_at
FROM case_report c
JOIN c_disease  d  ON d.code = c.disease_code
JOIN hos_village oa ON oa.area_code = c.area_code           -- "อยู่พื้นที่ตัวเอง"
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM case_acceptance a WHERE a.case_id = c.id AND a.status = 'active');

-- เคสอื่นในรัศมีควบคุมโรค (ใช้ control_radius_m ของโรคนั้น) — หา cluster/การระบาด
CREATE FUNCTION cases_nearby(p_case_id bigint)
RETURNS TABLE (id bigint, case_no text, date_onset date, distance_m double precision)
LANGUAGE sql STABLE AS $fn$
  SELECT n.id, n.case_no, n.date_onset,
         ST_Distance(c.geom::geography, n.geom::geography)
  FROM case_report c
  JOIN c_disease d ON d.code = c.disease_code
  JOIN case_report n
    ON n.id <> c.id
   AND n.disease_code = c.disease_code
   AND n.deleted_at IS NULL
   AND ST_DWithin(c.geom::geography, n.geom::geography, coalesce(d.control_radius_m, 100))
   AND n.date_onset BETWEEN c.date_onset - coalesce(d.incubation_max_days, 28)
                        AND c.date_onset + coalesce(d.incubation_max_days, 28)
  WHERE c.id = p_case_id
  ORDER BY 4;
$fn$;

-- ========== 10. Seed ==========

INSERT INTO c_disease (code,name_th,name_en,icd10,disease_group,transmission,investigate_within_hours,control_radius_m,incubation_min_days,incubation_max_days) VALUES
 ('66','ไข้เดงกี','Dengue fever','{A90}','ไข้เลือดออก','vector',24,100,3,14),
 ('26','ไข้เลือดออก','Dengue hemorrhagic fever','{A91}','ไข้เลือดออก','vector',24,100,3,14),
 ('27','ไข้เลือดออกช็อก','Dengue shock syndrome','{A91}','ไข้เลือดออก','vector',24,100,3,14),
 ('87','ชิคุนกุนยา','Chikungunya','{A92.0}','ไข้เลือดออก','vector',24,100,3,12),
 ('84','ไวรัสซิกา','Zika virus','{A92.5}','ไข้เลือดออก','vector',24,100,3,14)
ON CONFLICT DO NOTHING;

-- REPORT/ACCEPT เป็นลำดับ 1/2 ที่ v_case_activity สร้างเอง มีไว้ให้รหัสครบเท่านั้น
-- (case_activity มี CHECK ห้ามบันทึกสองรหัสนี้)
INSERT INTO c_activity_type (code,name,transmission,sort_order) VALUES
 ('REPORT','แจ้งเคสเข้าระบบ',NULL,-2),
 ('ACCEPT','พื้นที่รับเคส',NULL,-1),
 ('SURVEY','สำรวจ/ยืนยันการเกิดโรคในพื้นที่',NULL,1),
 ('LARVA','สำรวจและกำจัดลูกน้ำยุงลาย','vector',2),
 ('SPRAY','พ่นสารเคมีกำจัดยุงตัวเต็มวัย','vector',3),
 ('HEALTH_ED','ให้สุขศึกษา/ประชาสัมพันธ์',NULL,4),
 ('CONTACT','ติดตามผู้สัมผัส',NULL,5),
 ('ENV','ปรับปรุงสุขาภิบาลสิ่งแวดล้อม',NULL,6),
 ('SPECIMEN','เก็บตัวอย่างส่งตรวจ',NULL,7)
ON CONFLICT DO NOTHING;

INSERT INTO c_occupation (code,name) VALUES
 ('01','เกษตร'),('02','ข้าราชการ'),('03','รับจ้าง,กรรมกร'),('04','ค้าขาย'),('05','งานบ้าน'),
 ('06','นักเรียน'),('07','ทหาร,ตำรวจ'),('08','ประมง'),('09','ครู'),('10','อื่นๆ'),
 ('11','ไม่ทราบอาชีพ/ในปกครอง'),('12','เลี้ยงสัตว์'),('13','นักบวช'),('14','อาชีพพิเศษ'),('15','บุคลากรสาธารณสุข')
ON CONFLICT DO NOTHING;
