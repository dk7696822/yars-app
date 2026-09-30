import { invoiceAPI } from "../../services/api";

/** Phone share sheet (WhatsApp, etc.) when the browser can share files; otherwise a download. */
export const sharePdf = async (invoice) => {
  const file = await invoiceAPI.fetchPdf(invoice);
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Invoice ${invoice.invoice_number}` });
      return "shared";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return "downloaded";
};
