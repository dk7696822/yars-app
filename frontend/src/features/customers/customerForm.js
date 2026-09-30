import { mobileDigits, mobileStatus } from "../../utils/phone";

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/; // same rule as the server

export const emptyCustomer = () => ({ name: "", phone: "", city: "", email: "", address: "", gstin: "" });

export const formFromCustomer = (c) => {
  const m = c.metadata || {};
  return { name: c.name || "", phone: m.phone || "", city: m.city || "", email: m.email || "", address: m.address || "", gstin: m.gstin || "" };
};

export const validateCustomer = (f) => {
  const e = {};
  if (!f.name.trim()) e.name = "Enter the shop or customer name";
  if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "That email doesn't look right";
  if (f.gstin.trim() && !GSTIN.test(f.gstin.trim().toUpperCase())) e.gstin = "GSTIN should be 15 characters, like 29ABCDE1234F1Z5";
  return e;
};

/** Empty strings clear a saved field. A valid mobile is stored as its 10 digits; anything else as typed. */
export const toCustomerPayload = (f) => ({
  name: f.name.trim(),
  phone: mobileStatus(f.phone) === "valid" ? mobileDigits(f.phone) : f.phone.trim(),
  city: f.city.trim(),
  email: f.email.trim(),
  address: f.address.trim(),
  gstin: f.gstin.trim().toUpperCase(),
});
