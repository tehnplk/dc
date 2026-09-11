WITH ev AS (
  SELECT
    c.id AS case_id,
    0 AS rank,
    NULL :: bigint AS activity_id,
    c.date_report AS date_act,
    c.time_report AS time_act,
    'REPORT' :: text AS activity_code,
    'แจ้งเคสเข้าระบบ' :: text AS activity_name,
    COALESCE(c.reporter_name, o.name) AS performer,
    c.report_org_code AS performer_org,
    NULL :: text AS note
  FROM
    (
      case_report c
      LEFT JOIN c_org o ON ((o.code = c.report_org_code))
    )
  WHERE
    (c.deleted_at IS NULL)
  UNION
  ALL
  SELECT
    a.case_id,
    1,
    NULL :: bigint AS int8,
    a.date_accept,
    a.time_accept,
    'ACCEPT' :: text,
    'พื้นที่รับเคส' :: text,
    COALESCE(u.full_name, o.name) AS "coalesce",
    a.org_code,
    a.note
  FROM
    (
      (
        (
          SELECT
            DISTINCT ON (case_acceptance.case_id) case_acceptance.id,
            case_acceptance.case_id,
            case_acceptance.org_code,
            case_acceptance.date_accept,
            case_acceptance.time_accept,
            case_acceptance.accepted_by,
            case_acceptance.status,
            case_acceptance.released_at,
            case_acceptance.released_by,
            case_acceptance.note,
            case_acceptance.transferred_from
          FROM
            case_acceptance
          ORDER BY
            case_acceptance.case_id,
            case_acceptance.date_accept,
            case_acceptance.time_accept,
            case_acceptance.id
        ) a
        LEFT JOIN c_org o ON ((o.code = a.org_code))
      )
      LEFT JOIN "user" u ON ((u.id = a.accepted_by))
    )
  UNION
  ALL
  SELECT
    x.case_id,
    2,
    x.id,
    x.date_act,
    x.time_act,
    x.activity_code,
    COALESCE(x.activity_name, t.name) AS "coalesce",
    x.performer,
    x.performer_org,
    x.note
  FROM
    (
      case_activity x
      LEFT JOIN c_activity_type t ON ((t.code = x.activity_code))
    )
)
SELECT
  ev.case_id,
  (
    row_number() OVER (
      PARTITION BY ev.case_id
      ORDER BY
        ev.rank,
        ev.date_act,
        ev.time_act NULLS FIRST,
        ev.activity_id
    )
  ) :: integer AS seq,
  ev.activity_id,
  ev.date_act,
  ev.time_act,
  to_char((ev.time_act) :: INTERVAL, 'HH24:MI' :: text) AS time_act_txt,
  th_ts(ev.date_act, ev.time_act) AS activity_at,
  ev.activity_code,
  ev.activity_name,
  COALESCE(f.docs, '[]' :: jsonb) AS documents,
  COALESCE(f.photos, '[]' :: jsonb) AS photos,
  ev.performer,
  ev.performer_org,
  ev.note
FROM
  (
    ev
    LEFT JOIN LATERAL (
      SELECT
        jsonb_agg(
          jsonb_build_object(
            'id',
            x.id,
            'name',
            x.file_name,
            'path',
            x.file_path
          )
          ORDER BY
            x.id
        ) FILTER (
          WHERE
            (x.mime_type = 'application/pdf' :: text)
        ) AS docs,
        jsonb_agg(
          jsonb_build_object(
            'id',
            x.id,
            'name',
            x.file_name,
            'path',
            x.file_path
          )
          ORDER BY
            x.id
        ) FILTER (
          WHERE
            (x.mime_type ~~ 'image/%' :: text)
        ) AS photos
      FROM
        case_document x
      WHERE
        (x.activity_id = ev.activity_id)
    ) f ON ((ev.activity_id IS NOT NULL))
  );