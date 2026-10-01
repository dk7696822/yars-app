"use strict";

/**
 * Write endpoints Sage does not cover, each with the reason. A new write
 * endpoint fails the contract test until it is either given an action or
 * listed here — so a new feature is never silently missing from Sage.
 */
const NEVER = "Sage never deletes; it links to the screen";
const P2 = (what) => `Phase 2: ${what}`;
const P3 = (what) => `Phase 3: ${what}`;

const SCREEN_ONLY = {
  "POST /auth/login": "Signing in",
  "PUT /customers/:id": P2("edit a customer"),
  "DELETE /customers/:id": NEVER,
  "POST /product-sizes": P3("catalog"),
  "PUT /product-sizes/:id": P3("catalog"),
  "DELETE /product-sizes/:id": NEVER,
  "POST /plate-types": P3("catalog"),
  "PUT /plate-types/:id": P3("catalog"),
  "DELETE /plate-types/:id": NEVER,
  "DELETE /orders/:id": NEVER,
  "POST /expense-categories": P3("expense categories"),
  "PUT /expense-categories/:id": P3("expense categories"),
  "DELETE /expense-categories/:id": NEVER,
  "POST /expenses": P2("expenses"),
  "PUT /expenses/:id": P2("expenses"),
  "DELETE /expenses/:id": NEVER,
  "POST /invoices/generate": P2("invoices"),
  "PATCH /invoices/:id/status": P2("invoices"),
  "DELETE /invoices/:id": NEVER,
  "PUT /payments/:id": P2("edit a payment"),
  "DELETE /payments/:id": NEVER,
  "POST /inventory-categories": P3("item categories"),
  "PUT /inventory-categories/:id": P3("item categories"),
  "DELETE /inventory-categories/:id": NEVER,
  "PUT /item-attributes/values/:valueId": P3("item details"),
  "DELETE /item-attributes/values/:valueId": NEVER,
  "POST /item-attributes/:id/values": P3("item details"),
  "POST /item-attributes": P3("item details"),
  "PUT /item-attributes/:id": P3("item details"),
  "DELETE /item-attributes/:id": NEVER,
  "POST /suppliers": P3("suppliers"),
  "PUT /suppliers/:id": P3("suppliers"),
  "DELETE /suppliers/:id": NEVER,
  "POST /inventory-items": P3("items"),
  "PUT /inventory-items/:id": P3("items"),
  "DELETE /inventory-items/:id": NEVER,
  "POST /purchase-orders": P3("purchase orders"),
  "PUT /purchase-orders/:id": P3("purchase orders"),
  "DELETE /purchase-orders/:id": NEVER,
  "POST /purchase-orders/:id/cancel": P3("purchase orders"),
  "POST /purchase-orders/:id/receive": P2("receiving material"),
  "POST /goods-receipts": P2("receiving material"),
  "POST /stock-issues": P2("stock issues"),
  "POST /assistant/conversations": "The chat itself",
  "DELETE /assistant/conversations/:id": "The chat itself",
  "POST /assistant/conversations/:id/messages": "The chat itself",
  "POST /assistant/actions/:id/confirm": "The card's own buttons",
  "POST /assistant/actions/:id/cancel": "The card's own buttons",
  "POST /assistant/actions/:id/completed-in-form": "The card's own buttons",
};

module.exports = { SCREEN_ONLY };
