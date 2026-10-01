---
area: history
summary: The History screen — who changed what, and when
keywords: history, changed, edited, deleted
tables: audit_logs
---
# History

[History](/history) is a timeline of changes to money and stock: payments recorded, edited or deleted; orders created, moved to a new status or deleted; purchase orders, material received, stock issued, wastage and adjustments. Entries are grouped by India date, newest first, one sentence each ("Payment ₹5,000 recorded", "Order status Pending → Delivered"). Chips **All · Payments · Orders · Stock** and **Any time · This month · Last month**. A payment entry also shows the order's Received and Due just before and after it ("at that time"). Changes confirmed on an assistant card are marked "via" the assistant. Tap an entry to open its order, invoice or purchase order.

## Table `audit_logs`
`id`, `entity_type` PAYMENT|ORDER|PURCHASE_ORDER|GOODS_RECEIPT|STOCK_ISSUE, `entity_id`, `action` CREATE|UPDATE|DELETE, `old_values`, `new_values`, `changed_fields`, `metadata` JSONB (customer_name, before/after metrics; `source` is `app` for a screen or `assistant` for a confirmed card, with `assistant_action_id`), `created_at` only.
