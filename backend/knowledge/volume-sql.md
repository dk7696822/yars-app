---
area: volume_sql
summary: SQL for kg and pieces sold, with the tested query
keywords: volume, sold, tonnes
tables: order_product_sizes, orders
---
# Kg and pieces sold in SQL

Prefer period_summary for a period's kg sold. A line is EITHER kg (`unit = 'KG'`, `quantity_kg`) OR pieces (`unit = 'PIECES'`, `quantity_pieces`); never add both for one line. Pieces become kg only through their weight (`quantity_pieces * weight_kg / weight_pieces_count`); pieces with no weight have unknown kg — always say how many pieces are unweighted.

For any kg / pieces / volume question use exactly this query (add filters on `o`, e.g. dates or `o.status <> 'CANCELLED'`):

<!-- canonical:volume -->
  SELECT
    ROUND(COALESCE(SUM(ops.quantity_kg) FILTER (WHERE ops.unit = 'KG'), 0), 3) AS kg_from_kg_lines,
    ROUND(COALESCE(SUM(ops.quantity_pieces * ops.weight_kg / ops.weight_pieces_count)
          FILTER (WHERE ops.unit = 'PIECES' AND ops.weight_kg IS NOT NULL), 0), 3) AS kg_from_pieces,
    ROUND(COALESCE(SUM(ops.quantity_kg) FILTER (WHERE ops.unit = 'KG'), 0)
          + COALESCE(SUM(ops.quantity_pieces * ops.weight_kg / ops.weight_pieces_count)
            FILTER (WHERE ops.unit = 'PIECES' AND ops.weight_kg IS NOT NULL), 0), 3) AS kg_sold,
    COALESCE(SUM(ops.quantity_pieces) FILTER (WHERE ops.unit = 'PIECES'), 0) AS pieces_total,
    COALESCE(SUM(ops.quantity_pieces) FILTER (WHERE ops.unit = 'PIECES' AND ops.weight_kg IS NULL), 0) AS pieces_without_weight
  FROM order_product_sizes ops
  JOIN orders o ON o.id = ops.order_id
  WHERE o.is_archived = false
<!-- /canonical:volume -->
