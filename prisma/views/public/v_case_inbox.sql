SELECT
  oa.org_code,
  c.id,
  c.case_no,
  c.disease_code,
  c.status,
  c.pname,
  c.fname,
  c.lname,
  c.gender,
  c.age_y,
  c.area_code,
  c.addr_no,
  c.moo,
  st_y(c.geom) AS lat,
  st_x(c.geom) AS lon,
  c.date_onset,
  c.date_visit,
  c.date_report,
  c.time_report,
  c.report_org_code,
  (
    th_ts(c.date_report, c.time_report) + make_interval(hours = > d.investigate_within_hours)
  ) AS investigate_due_at
FROM
  (
    (
      case_report c
      JOIN c_disease d ON ((d.code = c.disease_code))
    )
    JOIN hos_village oa ON ((oa.area_code = c.area_code))
  )
WHERE
  (
    (c.deleted_at IS NULL)
    AND (
      NOT (
        EXISTS (
          SELECT
            1
          FROM
            case_acceptance a
          WHERE
            (
              (a.case_id = c.id)
              AND (a.status = 'active' :: text)
            )
        )
      )
    )
  );