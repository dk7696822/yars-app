import { parseNumber } from "../../utils/numberInput";
import { cleanName } from "../../ui/nameList";
import { QTY_DP } from "./labels";

const qtyOpts = { dp: QTY_DP, allowZero: true };
const numText = (v) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));

export const emptyItem = () => ({ name: "", item_code: "", category_id: "", unit: "KG", reorder_level: "", reorder_target: "", notes: "", selections: {} });

export const formFromItem = (item) => ({
  name: item.name || "",
  item_code: item.item_code || "",
  category_id: item.category_id || "",
  unit: item.unit || "KG",
  reorder_level: numText(item.reorder_level),
  reorder_target: numText(item.reorder_target),
  notes: item.notes || "",
  selections: Object.fromEntries((item.attributes || []).map((a) => [a.attribute_id, a.value_id])),
});

export const validateItem = (f) => {
  const e = {};
  if (!cleanName(f.name)) e.name = "Enter the item name";
  if (!f.category_id) e.category_id = "Choose a category";
  const level = parseNumber(f.reorder_level, qtyOpts);
  if (level.error) e.reorder_level = level.error;
  const target = parseNumber(f.reorder_target, qtyOpts);
  if (target.error) e.reorder_target = target.error;
  return e;
};

export const toItemPayload = (f) => ({
  name: cleanName(f.name),
  item_code: f.item_code.trim() || null,
  category_id: f.category_id,
  unit: f.unit,
  reorder_level: parseNumber(f.reorder_level, qtyOpts).value ?? 0,
  reorder_target: parseNumber(f.reorder_target, qtyOpts).value,
  notes: f.notes.trim() || null,
  attribute_value_ids: Object.values(f.selections).filter(Boolean),
});
