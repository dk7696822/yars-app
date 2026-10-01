---
area: money_sql
summary: SQL rules and the tested query for order totals, received and pending dues
keywords: owed, owes, outstanding, balance, pending, dues
tables: orders, order_product_sizes, payments, plate_types
---
# Money in SQL

Prefer the dues and customer_summary tools; use SQL only when they can't answer.
- Live rows: `is_archived = false`; cancelled orders (`status = 'CANCELLED'`) are never owed. DECIMALs come back as text.
- Line amount: PIECES lines `ROUND(quantity_pieces * price_amount / price_pieces_count, 2)`, KG lines `quantity_kg * COALESCE(ops.rate_per_kg, ps.rate_per_kg)`. Total = lines + `COALESCE(custom_plate_charge, plate_types.charge)` − `round_off_amount`.
- Advance: the sum of ADVANCE payments when any exist, else the legacy `orders.advance_received` — never both. Refunds subtract from received.
- Extra paid on one order is not taken off other orders.

For any pending / due / balance question use exactly this query (change only the final SELECT's grouping or filter):

<!-- canonical:pending -->
  WITH order_calc AS (
    SELECT o.customer_id,
      COALESCE((SELECT SUM(CASE WHEN ops.unit = 'PIECES'
                                THEN ROUND(ops.quantity_pieces * ops.price_amount / ops.price_pieces_count, 2)
                                ELSE ops.quantity_kg * COALESCE(ops.rate_per_kg, ps.rate_per_kg) END)
                FROM order_product_sizes ops JOIN product_sizes ps ON ps.id = ops.product_size_id
                WHERE ops.order_id = o.id), 0)
      + COALESCE(o.custom_plate_charge, pt.charge, 0)
      - COALESCE(o.round_off_amount, 0)
      - COALESCE((SELECT SUM(CASE WHEN p.payment_type = 'REFUND' THEN -p.amount ELSE p.amount END) FROM payments p
                  WHERE p.order_id = o.id AND p.payment_type <> 'ADVANCE'), 0)
      - CASE WHEN COALESCE((SELECT SUM(p.amount) FROM payments p
                            WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE'), 0) > 0
             THEN (SELECT SUM(p.amount) FROM payments p
                   WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE')
             ELSE COALESCE(o.advance_received, 0) END AS balance
    FROM orders o
    LEFT JOIN plate_types pt ON pt.id = o.plate_type_id
    WHERE o.is_archived = false AND o.status <> 'CANCELLED'
  )
  SELECT c.name, ROUND(SUM(GREATEST(oc.balance, 0)), 2) AS pending
  FROM order_calc oc JOIN customers c ON c.id = oc.customer_id
  GROUP BY c.name HAVING SUM(GREATEST(oc.balance, 0)) > 0 ORDER BY pending DESC
<!-- /canonical:pending -->
