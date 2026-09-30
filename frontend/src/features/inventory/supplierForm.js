import { mobileDigits, mobileStatus } from "../../utils/phone";
import { cleanName } from "../../ui/nameList";

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const emptySupplier = () => ({ name: "", phone: "", email: "", gst_number: "", address: "" });
export const formFromSupplier = (s) => ({ name: s.name || "", phone: s.phone || "", email: s.email || "", gst_number: s.gst_number || "", address: s.address || "" });

export const validateSupplier = (f, saved = {}) => {
  const e = {};
  if (!cleanName(f.name)) e.name = "Enter the supplier name";
  if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "That email doesn't look right";
  const gst = f.gst_number.trim().toUpperCase();
  if (gst && gst !== (saved.gst_number || "").toUpperCase() && !GSTIN.test(gst)) e.gst_number = "GSTIN should be 15 characters, like 29ABCDE1234F1Z5";
  return e;
};

export const toSupplierPayload = (f) => ({
  name: cleanName(f.name),
  phone: mobileStatus(f.phone) === "valid" ? mobileDigits(f.phone) : f.phone.trim() || null,
  email: f.email.trim() || null,
  gst_number: f.gst_number.trim().toUpperCase() || null,
  address: f.address.trim() || null,
});
