---
area: catalog
summary: Sizes and plate types with their rates, piece prices and weights
keywords: size, sizes, plate, plates, rate, weight
tables: product_sizes, plate_types
---
# Sizes and plate types

## Plate types ([Plate types](/plate-types))
The printing plate used on an order; each has a **Charge** added once per order (an order can set a custom charge). **New** → **Name** and **Charge** (₹0 allowed) → **Save plate type**. Tap a row to edit. Orders without a custom charge use the plate type's *current* charge, so changing it changes those orders' totals. **Delete plate type** asks first (soft delete).

## Sizes ([Sizes](/product-sizes))
A bag size like "14 x 18". Each row shows how it is priced, e.g. "₹180/kg · ₹375 per 1,000 pcs", or "Rate set on each order" when nothing is saved. **New** → **Size**, then any of **Rate per kg** (empty or 0 = set on each order), **Piece price** "N pcs cost ₹X", **Weight** "N pcs weigh W kg" (only estimates kg for pieces orders). Needs a rate or a piece price. Prices are copied onto order lines when an order is saved; changing a size affects new orders only. Saving a weight also fills earlier pieces lines of that size that had none. **Delete size** asks first.

## Tables
`plate_types`: `id`, `type_name`, `charge` DECIMAL, `is_archived`.
`product_sizes`: `id`, `size_label`, `rate_per_kg` (NULL or 0 = none saved), `piece_price_amount` + `piece_price_count` ("N pieces cost ₹X"), `weight_kg` + `weight_pieces_count`, `is_archived`.
