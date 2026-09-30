/** Stored numbers are never changed; links are built from a normalised copy. */
export const toIndianMobile = (raw) => {
  if (!raw) return null;
  // "08482-234567" is a landline (0 + STD code + number); after dropping the 0
  // it would look like a mobile, so treat that written form as not-a-mobile.
  if (/^\s*0\d{2,4}[-\s]\d/.test(String(raw))) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
};
export const telHref = (raw) => {
  const m = toIndianMobile(raw);
  return m ? `tel:+91${m}` : null;
};
export const whatsappHref = (raw, text) => {
  const m = toIndianMobile(raw);
  return m ? `https://wa.me/91${m}?text=${encodeURIComponent(text)}` : null;
};

/** What was typed in the +91 box → just the 10 digits (drops +91 / leading 0 / spaces). */
export const mobileDigits = (typed) => {
  let d = String(typed || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
};
export const mobileStatus = (typed) => {
  const d = mobileDigits(typed);
  if (!d) return "empty";
  return /^[6-9]\d{9}$/.test(d) ? "valid" : "invalid";
};
export const formatMobile = (d) => (d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d);
