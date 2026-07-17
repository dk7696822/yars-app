import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { FaSearch, FaDownload, FaExclamationTriangle, FaBoxOpen, FaRupeeSign, FaArrowDown, FaArrowUp } from "react-icons/fa";
import { stockAPI, inventoryCategoryAPI, itemAttributesAPI, inventoryExportAPI } from "../services/inventoryAPI";
import { formatCurrency } from "../utils/formatters";
import Pagination from "../components/common/Pagination";

const StatTile = ({ icon, label, value, tone = "default" }) => {
  // Local uppercase alias so it can be rendered as a component; the destructured
  // param itself trips this config's no-unused-vars (no eslint-plugin-react).
  const Icon = icon;
  const tones = {
    default: "bg-white dark:bg-[#161d1a] border-gray-200/60 dark:border-emerald-900/30",
    warning: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-500 dark:text-emerald-400" />
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-emerald-50 break-all">{value}</p>
    </div>
  );
};

/** The item's chosen attribute values, as compact chips: "W Cut", "60". */
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

const Stock = () => {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [attributeValueId, setAttributeValueId] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  const fetchStock = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (categoryId) params.category_id = categoryId;
      if (attributeValueId) params.attribute_value_id = attributeValueId;
      if (lowStockOnly) params.low_stock_only = "true";

      const { rows: data, pagination: meta } = await stockAPI.getStock(params);
      setRows(data);
      setPagination(meta);
      setError("");
    } catch (err) {
      console.error("Error fetching stock:", err);
      setError("Failed to load stock. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId, attributeValueId, lowStockOnly]);

  useEffect(() => {
    // Debounce so typing in the search box does not fire a request per keystroke.
    const timer = setTimeout(fetchStock, 300);
    return () => clearTimeout(timer);
  }, [fetchStock]);

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryData, categoryData, attributeData] = await Promise.all([
          stockAPI.getSummary(),
          inventoryCategoryAPI.getAll(),
          itemAttributesAPI.getAll(),
        ]);
        setSummary(summaryData);
        setCategories(categoryData);
        setAttributes(attributeData);
      } catch (err) {
        console.error("Error loading stock summary:", err);
      }
    };
    load();
  }, []);

  // Any filter change resets to page 1 — otherwise you can land on an empty page 5.
  useEffect(() => {
    setPage(1);
  }, [search, categoryId, attributeValueId, lowStockOnly]);

  const handleExport = async () => {
    try {
      const response = await inventoryExportAPI.download();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "inventory.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting inventory:", err);
      setError("Failed to export inventory.");
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50">Stock</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Raw material on hand</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm font-medium text-gray-700 dark:text-emerald-100"
        >
          <FaDownload className="w-4 h-4" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={FaRupeeSign} label="Stock value" value={formatCurrency(summary.total_stock_value)} />
          <StatTile
            icon={FaExclamationTriangle}
            label="Low stock items"
            value={summary.low_stock_count}
            tone={summary.low_stock_count > 0 ? "warning" : "default"}
          />
          <StatTile icon={FaArrowDown} label="Received this month" value={formatCurrency(summary.received_value_this_month)} />
          <StatTile icon={FaArrowUp} label="Consumed this month" value={formatCurrency(summary.consumed_value_this_month)} />
        </div>
      )}

      <div className="space-y-3">
        <div className="relative">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item or code…"
            className="w-full min-h-[44px] pl-11 pr-4 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-900 dark:text-emerald-50 placeholder:text-gray-400"
          />
        </div>

        <div className="flex gap-3">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex-1 min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-900 dark:text-emerald-50"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <select
            value={attributeValueId}
            onChange={(e) => setAttributeValueId(e.target.value)}
            className="flex-1 min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-900 dark:text-emerald-50"
          >
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

          <button
            type="button"
            onClick={() => setLowStockOnly((value) => !value)}
            className={`min-h-[44px] px-4 rounded-xl border text-sm font-medium transition-colors ${
              lowStockOnly
                ? "bg-amber-500 border-amber-500 text-white"
                : "bg-white dark:bg-[#161d1a] border-gray-200 dark:border-emerald-900/40 text-gray-700 dark:text-emerald-100"
            }`}
          >
            Low stock
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">Loading stock…</div>
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
            {rows.map((row) => (
              <Link
                key={row.id}
                to={`/stock/${row.id}`}
                className="block rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-emerald-50 truncate">{row.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{row.category.name}</p>
                    <AttributeChips attributes={row.attributes} />
                  </div>
                  {row.is_low_stock && (
                    <span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      LOW
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">In stock</p>
                    <p className="font-semibold text-gray-900 dark:text-emerald-50">
                      {row.in_stock} {row.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">On order</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      {row.on_order} {row.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Value</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(row.stock_value)}</p>
                  </div>
                </div>

                {row.is_low_stock && row.suggested_quantity > 0 && (
                  <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                    Suggested purchase: {row.suggested_quantity} {row.unit}
                  </p>
                )}
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200/60 dark:border-emerald-900/30">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#0f1a16]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">In stock</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">On order</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-900/20 bg-white dark:bg-[#161d1a]">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-emerald-500/5">
                    <td className="px-4 py-3">
                      <Link to={`/stock/${row.id}`} className="font-medium text-gray-900 dark:text-emerald-50 hover:text-primary">
                        {row.name}
                      </Link>
                      {row.item_code && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{row.item_code}</p>
                      )}
                      <AttributeChips attributes={row.attributes} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{row.category.name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-emerald-50">
                      {row.in_stock} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                      {row.on_order} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                      {formatCurrency(row.stock_value)}
                    </td>
                    <td className="px-4 py-3">
                      {row.is_low_stock ? (
                        <div>
                          <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            LOW
                          </span>
                          {row.suggested_quantity > 0 && (
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                              Buy {row.suggested_quantity} {row.unit}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default Stock;
