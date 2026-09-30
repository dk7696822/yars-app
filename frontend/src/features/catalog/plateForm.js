import { parseNumber } from "../../utils/numberInput";

export const emptyPlate = () => ({ type_name: "", charge: "" });

export const formFromPlate = (p) => ({ type_name: p.type_name || "", charge: p.charge === null || p.charge === undefined ? "" : String(Number(p.charge)) });

/** ₹0 is a valid plate charge. */
export const validatePlate = (f) => {
  const e = {};
  if (!f.type_name.trim()) e.type_name = "Enter the plate type name";
  const charge = parseNumber(f.charge, { allowZero: true });
  if (charge.error || charge.value === null) e.charge = charge.error || "Enter the charge";
  return e;
};

export const toPlatePayload = (f) => ({ type_name: f.type_name.trim(), charge: parseNumber(f.charge, { allowZero: true }).value });
