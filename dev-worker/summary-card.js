// /getknowgraphsummaries?fields=card — the lean page a graph portfolio needs: id, title, updated
// time and the card picture, nothing else (2026-11-16).
//
// Why it exists: the full summary row reads every node of every graph on the page eight times
// (types, type counts, labels, four picture scans, published domains) and parses the graph JSON
// for each of ~30 columns. The Knowledge Editor lists ALL graphs (2096 = 9 pages) and only shows
// id, title, updatedAt and thumbnail; at full weight D1 refused pages with "overloaded — too many
// resources consumed within a 10 second window". Measured on the heaviest page (250 graphs,
// 17.6 MB): see the measurements below.
//
// The picture columns find the same picture as the full row (index.js summaryQueryFor), so
// pickSummaryThumbnail() gives the identical thumbnail, but each scan STOPS at its first match:
// json_each walks the nodes in array order, so "first match, LIMIT 1" equals the full row's
// "ORDER BY key LIMIT 1" without reading every node and sorting. The graph JSON is parsed ONCE
// per row (jsonb) instead of once per column. metadata_meta_area is kept because the host's
// allowed-meta-area filter reads it.
//
// Measured on D1, median of 4 runs per variant: heaviest page (17.6 MB) full 1718 ms -> card
// 518 ms; first page full 735 ms -> card 320 ms. Rows identical to the full row's scans on
// pages 0, 750 and 1750 (hash-compared).

/**
 * SQL for one page of card rows. `where` and the bindings are the caller's (same filter as the
 * full summaries); the last two bindings are LIMIT and OFFSET, as in summaryQueryFor.
 */
export function cardSummaryQuery(where, orderSql) {
  return `
    WITH page AS (
      SELECT id, title, created_date, updated_at,
             CASE WHEN json_valid(data) THEN jsonb(data) ELSE jsonb('{}') END AS d
      FROM knowledge_graphs
      WHERE id IN (SELECT id FROM knowledge_graphs ${where} ${orderSql} LIMIT ? OFFSET ?)
    ),
    card AS (
      SELECT id, title, created_date, updated_at, d,
             COALESCE(jsonb_extract(d, '$.nodes'), jsonb('[]')) AS ns
      FROM page
    )
    SELECT
      id,
      title,
      created_date,
      updated_at,
      COALESCE(json_extract(d, '$.metadata.title'), title) AS metadata_title,
      COALESCE(json_extract(d, '$.metadata.metaArea'), '') AS metadata_meta_area,
      json_extract(d, '$.metadata.seoOgImage') AS metadata_seo_og_image,
      (
        SELECT json_extract(value, '$.path')
        FROM json_each(ns)
        WHERE json_extract(value, '$.type') = 'portfolio-image'
          AND json_extract(value, '$.path') IS NOT NULL
        LIMIT 1
      ) AS portfolio_image_path,
      (
        SELECT json_extract(value, '$.path')
        FROM json_each(ns)
        WHERE json_extract(value, '$.type') = 'image'
          AND COALESCE(json_extract(value, '$.path'), '') <> ''
        LIMIT 1
      ) AS image_node_path,
      (
        SELECT substr(info, max(1, min(
          CASE WHEN instr(info, '[IMAGEQUOTE') > 0 THEN instr(info, '[IMAGEQUOTE') ELSE 1000000000 END,
          CASE WHEN instr(info, '![') > 0 THEN instr(info, '![') ELSE 1000000000 END,
          CASE WHEN instr(info, '<img') > 0 THEN instr(info, '<img') ELSE 1000000000 END
        ) - 1), 4000)
        FROM (
          SELECT json_extract(value, '$.info') AS info
          FROM json_each(ns)
          WHERE json_type(value, '$.info') = 'text'
        )
        WHERE instr(info, '[IMAGEQUOTE') > 0 OR instr(info, '![') > 0 OR instr(info, '<img') > 0
        LIMIT 1
      ) AS image_info_snippet,
      (
        SELECT json_extract(value, '$.path')
        FROM json_each(ns)
        WHERE lower(COALESCE(json_extract(value, '$.path'), '')) LIKE '%.jpg'
           OR lower(COALESCE(json_extract(value, '$.path'), '')) LIKE '%.jpeg'
           OR lower(COALESCE(json_extract(value, '$.path'), '')) LIKE '%.png'
           OR lower(COALESCE(json_extract(value, '$.path'), '')) LIKE '%.gif'
           OR lower(COALESCE(json_extract(value, '$.path'), '')) LIKE '%.webp'
           OR lower(COALESCE(json_extract(value, '$.path'), '')) LIKE '%.svg'
           OR lower(COALESCE(json_extract(value, '$.path'), '')) LIKE '%picsum.photos%'
        LIMIT 1
      ) AS any_image_path
    FROM card
    ${orderSql}
  `
}
