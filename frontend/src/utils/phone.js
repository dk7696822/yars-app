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
