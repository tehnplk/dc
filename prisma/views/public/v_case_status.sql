SELECT
  c.id,
  c.case_no,
  c.disease_code,
  c.status,
  c.date_onset,
  c.date_report,
  c.time_report,
  c.area_code,
  c.report_org_code,
  a.org_code AS owner_org_code,
  a.date_accept,
  a.time_accept,
  (
    SELECT
      min(th_ts(x.date_act, x.time_act)) AS min
    FROM
      case_activity x
    WHERE
      (x.case_id = c.id)
  ) AS first_activity_at,
  (
    SELECT
      count(*) AS count
    FROM
      case_activity x
    WHERE
      (x.case_id = c.id)
  ) AS activity_count,
  (
    SELECT
      count(*) AS count
    FROM
      case_document x
    WHERE
      (
        (x.case_id = c.id)
        AND (x.form_template_id IS NOT NULL)
        AND (x.status <> 'draft' :: text)
      )
  ) AS form_count,
  (
    (
      SELECT
        min(th_ts(x.date_act, x.time_act)) AS min
      FROM
        case_activity x
      WHERE
        (x.case_id = c.id)
    ) <= (
      th_ts(c.date_report, c.time_report) + make_interval(hours = > d.investigate_within_hours)
    )
  ) AS investigated_in_time
FROM
  (
    (
      case_report c
      JOIN c_disease d ON ((d.code = c.disease_code))
    )
    LEFT JOIN case_acceptance a ON (
      (
        (a.case_id = c.id)
        AND (a.status = 'active' :: text)
      )
    )
  )
WHERE
  (c.deleted_at IS NULL);