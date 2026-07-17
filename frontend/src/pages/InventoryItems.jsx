import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPlus, FaSearch, FaCheckCircle, FaBoxOpen, FaEdit, FaTrash, FaTags, FaSlidersH } from "react-icons/fa";
import { inventoryItemAPI, inventoryCategoryAPI, itemAttributesAPI } from "../services/inventoryAPI";
import Pagination from "../components/common/Pagination";
import ConfirmationModal from "../components/common/ConfirmationModal";

const AttributeChips = ({ attributes }) => {
  if (!attributes || attributes.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {attributes.map((attribute) => (
        <span
          key={attribute.value_id}
          title={`${attribute.attribute_name}: ${attribute.value}`}
          className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-emerald-500/10 text-gray-600 dark:text-emerald-300"
        >
          {attribute.value}
        </span>
      ))}
    </div>
  );
};

const inputClasses =
  "min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm text-gray-900 dark:text-emerald-50";

const InventoryItems = () => {
  const location = useLocation();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [categories, setCategories] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [attributeValueId, setAttributeValueId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      window.history.replaceState({}, "");
      const timer = setTimeout(() => setSuccessMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (categoryId) params.category_id = categoryId;
      if (attributeValueId) params.attribute_value_id = attributeValueId;

      const { rows: data, pagination: meta } = await inventoryItemAPI.getAll(params);
      setRows(data);
      setPagination(meta);
      setError("");
    } catch (err) {
      console.error("Error fetching inventory items:", err);
      setError("Failed to load inventory items. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId, attributeValueId]);

  useEffect(() => {
    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryId, attributeValueId]);

  useEffect(() => {
    const load = async () => {
      try {
        const [categoryData, attributeData] = await Promise.all([
          inventoryCategoryAPI.getAll(),
          itemAttributesAPI.getAll(),
        ]);
        setCategories(categoryData);
        setAttributes(attributeData);
      } catch (err) {
        console.error("Error loading filters:", err);
      }
    };
    load();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await inventoryItemAPI.delete(deleteTarget.id);
      setSuccessMessage("Item deleted successfully");
      setTimeout(() => setSuccessMessage(""), 4000);
      fetchItems();
    } catch (err) {
      console.error("Error deleting item:", err);
      // 409s carry the reason ("still has stock on hand", "on an open purchase order").
      setError(err.response?.data?.message || "Failed to delete item.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {successMessage && (
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 p-4 flex items-start gap-3">
          <FaCheckCircle className="text-green-500 mt-0.5 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50">Inventory Items</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Raw material master list</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/inventory-categories"
            className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm font-medium text-gray-700 dark:text-emerald-100"
          >
            <FaTags className="w-3 h-3" /> Categories
          </Link>
          <Link
            to="/item-attributes"
            className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm font-medium text-gray-700 dark:text-emerald-100"
          >
            <FaSlidersH className="w-3 h-3" /> Attributes
          </Link>
          <Link
            to="/inventory-items/new"
            className="flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 active:scale-95 transition-all"
          >
            <FaPlus className="w-3 h-3" /> New
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item or code…"
            className={`w-full pl-11 pr-4 ${inputClasses}`}
          />
        </div>

        <div className="flex gap-3">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`flex-1 ${inputClasses}`}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <select value={attributeValueId} onChange={(e) => setAttributeValueId(e.target.value)} className={`flex-1 ${inputClasses}`}>
            <option value="">All attributes</option>
            {attributes
              .filter((attribute) => attribute.values.length > 0)
              .map((attribute) => (
                <optgroup key={attribute.id} label={attribute.name}>
                  {attribute.values.map((value) => (
                    <option key={value.id} value={value.id}>{value.value}</option>
                  ))}
                </optgroup>
              ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">Loading items…</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center">
          <FaBoxOpen className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">No items found</p>
          <Link to="/inventory-items/new" className="inline-block mt-3 text-primary dark:text-emerald-400 font-medium">
            Add an inventory item
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-emerald-50 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.category?.name}
                      {item.item_code ? ` · ${item.item_code}` : ""} · {item.unit}
                    </p>
                    <AttributeChips attributes={item.attributes} />
                    {parseFloat(item.reorder_level) > 0 && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Reorder at {parseFloat(item.reorder_level)} {item.unit}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      to={`/inventory-items/edit/${item.id}`}
                      className="flex items-center justify-center w-11 h-11 rounded-xl border border-gray-200 dark:border-emerald-900/40 text-gray-600 dark:text-emerald-100"
                      aria-label="Edit item"
                    >
                      <FaEdit className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="flex items-center justify-center w-11 h-11 rounded-xl border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400"
                      aria-label="Delete item"
                    >
                      <FaTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200/60 dark:border-emerald-900/30">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#0f1a16]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Unit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Reorder level</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-900/20 bg-white dark:bg-[#161d1a]">
                {rows.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-emerald-500/5">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-emerald-50">{item.name}</p>
                      {item.item_code && <p className="text-xs text-gray-500 dark:text-gray-400">{item.item_code}</p>}
                      <AttributeChips attributes={item.attributes} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.category?.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.unit}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                      {parseFloat(item.reorder_level) > 0 ? `${parseFloat(item.reorder_level)} ${item.unit}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/inventory-items/edit/${item.id}`}
                          className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-emerald-900/40 text-gray-600 dark:text-emerald-100 hover:bg-gray-50 dark:hover:bg-emerald-500/10"
                          aria-label="Edit item"
                        >
                          <FaEdit className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="flex items-center justify-center w-9 h-9 rounded-lg border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                          aria-label="Delete item"
                        >
                          <FaTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete inventory item"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
};

export default InventoryItems;
