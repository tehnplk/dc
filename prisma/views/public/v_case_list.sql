SELECT
  c.id,
  c.case_no,
  c.report_org_code,
  ro.name AS report_org_name,
  c.date_dx,
  c.time_dx,
  to_char((c.time_dx) :: INTERVAL, 'HH24:MI' :: text) AS time_dx_txt,
  c.date_visit,
  c.date_onset,
  c.date_report,
  c.time_report,
  to_char((c.time_report) :: INTERVAL, 'HH24:MI' :: text) AS time_report_txt,
  NULLIF(
    btrim(concat_ws(' ' :: text, c.pname, c.fname, c.lname)),
    '' :: text
  ) AS patient_name,
  NULLIF(
    concat_ws(
      ' ' :: text,
      CASE
        c.gender
        WHEN 'M' :: text THEN 'ชาย' :: text
        WHEN 'F' :: text THEN 'หญิง' :: text
        ELSE NULL :: text
      END,
      CASE
        WHEN (c.age_y IS NOT NULL) THEN (c.age_y || ' ปี' :: text)
        ELSE NULL :: text
      END,
      CASE
        WHEN (c.age_m IS NOT NULL) THEN (c.age_m || ' ด' :: text)
        ELSE NULL :: text
      END
    ),
    '' :: text
  ) AS patient_sub,
  c.gender,
  c.age_y,
  c.age_m,
  amp.code AS amp_code,
  amp.name AS amp_name,
  tmb.code AS tmb_code,
  tmb.name AS tmb_name,
  c.moo,
  c.addr_no,
  c.disease_code,
  d.name_th AS disease_name,
  a.date_accept,
  a.time_accept,
  to_char((a.time_accept) :: INTERVAL, 'HH24:MI' :: text) AS time_accept_txt,
  a.org_code AS accepted_org_code,
  ao.name AS accepted_org_name,
  au.full_name AS accepted_by_name,
  c.status,
  c.area_code
FROM
  (
    (
      (
        (
          (
            (
              (
                case_report c
                JOIN c_disease d ON ((d.code = c.disease_code))
              )
              LEFT JOIN c_org ro ON ((ro.code = c.report_org_code))
            )
            LEFT JOIN c_area tmb ON ((tmb.code = "left"(c.area_code, 6)))
          )
          LEFT JOIN c_area amp ON ((amp.code = "left"(c.area_code, 4)))
        )
        LEFT JOIN case_acceptance a ON (
          (
            (a.case_id = c.id)
            AND (a.status = 'active' :: text)
          )
        )
      )
      LEFT JOIN c_org ao ON ((ao.code = a.org_code))
    )
    LEFT JOIN "user" au ON ((au.id = a.accepted_by))
  )
WHERE
  (c.deleted_at IS NULL);