import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { FaArrowLeft, FaEdit, FaPhone, FaEnvelope, FaFileInvoice } from "react-icons/fa";
import { supplierAPI } from "../services/inventoryAPI";
import { formatDate } from "../utils/formatters";

const STATUS_BADGES = {
  PENDING: "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300",
  PARTIALLY_RECEIVED: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  RECEIVED: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  CANCELLED: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300",
};

const SupplierDetail = () => {
  const { id } = useParams();

  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setSupplier(await supplierAPI.getById(id));
        setError("");
      } catch (err) {
        console.error("Error loading supplier:", err);
        setError(err.response?.data?.message || "Failed to load supplier.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return <div className="p-6 py-16 text-center text-gray-500 dark:text-gray-400">Loading supplier…</div>;
  }

  if (error || !supplier) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Link to="/suppliers" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]">
          <FaArrowLeft className="w-3 h-3" /> Back to Suppliers
        </Link>
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error || "Supplier not found."}
        </div>
      </div>
    );
  }

  const purchaseOrders = supplier.purchaseOrders || [];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <Link to="/suppliers" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]">
        <FaArrowLeft className="w-3 h-3" /> Back to Suppliers
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50 truncate">{supplier.name}</h1>
          {supplier.gst_number && (
            <p className="text-sm text-gray-500 dark:text-gray-400">GST {supplier.gst_number}</p>
          )}
        </div>
        <Link
          to={`/suppliers/edit/${supplier.id}`}
          className="flex shrink-0 items-center gap-2 min-h-[44px] px-4 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm font-medium text-gray-700 dark:text-emerald-100"
        >
          <FaEdit className="w-3 h-3" /> Edit
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4 space-y-2">
        {supplier.phone ? (
          <a href={`tel:${supplier.phone}`} className="flex items-center gap-3 min-h-[44px] text-sm text-gray-700 dark:text-gray-300">
            <FaPhone className="w-3.5 h-3.5 text-gray-400" /> {supplier.phone}
          </a>
        ) : (
          <p className="flex items-center gap-3 min-h-[44px] text-sm text-gray-400">
            <FaPhone className="w-3.5 h-3.5" /> No phone
          </p>
        )}
        {supplier.email ? (
          <a href={`mailto:${supplier.email}`} className="flex items-center gap-3 min-h-[44px] text-sm text-gray-700 dark:text-gray-300">
            <FaEnvelope className="w-3.5 h-3.5 text-gray-400" /> {supplier.email}
          </a>
        ) : (
          <p className="flex items-center gap-3 min-h-[44px] text-sm text-gray-400">
            <FaEnvelope className="w-3.5 h-3.5" /> No email
          </p>
        )}
        {supplier.address && (
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap pt-1">{supplier.address}</p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-emerald-50">Purchase orders</h2>

        {purchaseOrders.length === 0 ? (
          <div className="py-10 text-center rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a]">
            <FaFileInvoice className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No purchase orders yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {purchaseOrders.map((po) => (
              <Link
                key={po.id}
                to={`/purchase-orders/${po.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-emerald-50">{po.po_number}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(po.order_date)}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${STATUS_BADGES[po.status] || STATUS_BADGES.PENDING}`}>
                  {po.status.replace(/_/g, " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierDetail;
