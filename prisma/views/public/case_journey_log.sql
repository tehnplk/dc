WITH ev AS (
  SELECT
    c.id AS case_id,
    th_ts(c.date_report, c.time_report) AS at,
    0 AS rank,
    'REPORT' :: text AS event,
    c.report_org_code AS org_code,
    c.created_by AS user_id,
    NULL :: text AS note
  FROM
    case_report c
  UNION
  ALL
  SELECT
    c.id,
    c.deleted_at,
    3,
    'DISCHARGE' :: text,
    u_1.org_code,
    c.deleted_by,
    c.delete_reason
  FROM
    (
      case_report c
      LEFT JOIN users u_1 ON ((u_1.id = c.deleted_by))
    )
  WHERE
    (c.deleted_at IS NOT NULL)
  UNION
  ALL
  SELECT
    a.case_id,
    th_ts(a.date_accept, a.time_accept) AS th_ts,
    1,
    CASE
      WHEN (a.transferred_from IS NOT NULL) THEN 'TRANSFER_IN' :: text
      ELSE 'ACCEPT' :: text
    END AS "case",
    a.org_code,
    a.accepted_by,
    NULL :: text
  FROM
    case_acceptance a
  UNION
  ALL
  SELECT
    a.case_id,
    a.released_at,
    2,
    CASE
      a.status
      WHEN 'released' :: text THEN 'RELEASE' :: text
      ELSE 'TRANSFER_OUT' :: text
    END AS "case",
    a.org_code,
    a.released_by,
    a.note
  FROM
    case_acceptance a
  WHERE
    (a.released_at IS NOT NULL)
)
SELECT
  ev.case_id,
  (
    row_number() OVER (
      PARTITION BY ev.case_id
      ORDER BY
        ev.at,
        ev.rank
    )
  ) :: integer AS seq,
  ev.at,
  ev.event,
  CASE
    ev.event
    WHEN 'REPORT' :: text THEN 'แจ้งเคสเข้าระบบ' :: text
    WHEN 'ACCEPT' :: text THEN 'พื้นที่รับเคส' :: text
    WHEN 'RELEASE' :: text THEN 'คืนเคส' :: text
    WHEN 'TRANSFER_IN' :: text THEN 'รับเคสที่โยกมา' :: text
    WHEN 'TRANSFER_OUT' :: text THEN 'โยกเคสให้หน่วยอื่น' :: text
    WHEN 'DISCHARGE' :: text THEN 'จำหน่ายออกจากระบบ' :: text
    ELSE NULL :: text
  END AS event_name,
  ev.org_code,
  o.name AS org_name,
  ev.user_id,
  u.full_name AS user_name,
  ev.note
FROM
  (
    (
      ev
      LEFT JOIN c_org o ON ((o.code = ev.org_code))
    )
    LEFT JOIN users u ON ((u.id = ev.user_id))
  );