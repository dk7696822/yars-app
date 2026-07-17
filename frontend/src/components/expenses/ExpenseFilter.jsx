import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Dropdown from "../ui/Dropdown";
import FilterBar from "../common/FilterBar";
import { formatDate, formatDateForAPI } from "../../utils/formatters";

const dateInputClasses =
  "w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] px-4 py-2 text-sm text-gray-900 dark:text-emerald-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:focus:border-emerald-500/50 transition-all";

const ExpenseFilter = ({ categories, onFilter }) => {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [vendor, setVendor] = useState("");
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const skipFirstRun = useRef(true);

  useEffect(() => {
    if (skipFirstRun.current) {
      skipFirstRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const filters = {
        search: search.trim() || undefined,
        category_id: categoryId || undefined,
        payment_status: paymentStatus || undefined,
        vendor: vendor.trim() || undefined,
        from_date: fromDate ? formatDateForAPI(fromDate) : undefined,
        to_date: toDate ? formatDateForAPI(toDate) : undefined,
      };
      Object.keys(filters).forEach((key) => filters[key] === undefined && delete filters[key]);
      onFilter(filters);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, paymentStatus, vendor, fromDate, toDate]);

  const categoryName = (id) => categories.find((category) => category.id === id)?.name || "Category";

  const chips = [
    categoryId && { key: "category", label: categoryName(categoryId), onRemove: () => setCategoryId("") },
    paymentStatus && {
      key: "status",
      label: paymentStatus === "PAID" ? "Paid" : "Unpaid",
      onRemove: () => setPaymentStatus(""),
    },
    vendor.trim() && { key: "vendor", label: `Vendor: ${vendor.trim()}`, onRemove: () => setVendor("") },
    fromDate && { key: "from", label: `From ${formatDate(fromDate)}`, onRemove: () => setFromDate(null) },
    toDate && { key: "to", label: `To ${formatDate(toDate)}`, onRemove: () => setToDate(null) },
  ].filter(Boolean);

  const clearAll = () => {
    setCategoryId("");
    setPaymentStatus("");
    setVendor("");
    setFromDate(null);
    setToDate(null);
  };

  return (
    <FilterBar
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search expenses…"
      activeCount={chips.length}
      chips={chips}
      onClearAll={clearAll}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
          <Dropdown
            id="category_id"
            name="category_id"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            placeholder="All Categories"
            options={[
              { value: "", label: "All Categories" },
              ...categories.map((category) => ({ value: category.id, label: category.name })),
            ]}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Status</label>
          <Dropdown
            id="payment_status"
            name="payment_status"
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value)}
            placeholder="All Statuses"
            options={[
              { value: "", label: "All Statuses" },
              { value: "PAID", label: "Paid" },
              { value: "UNPAID", label: "Unpaid" },
            ]}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Vendor</label>
          <input
            type="text"
            value={vendor}
            onChange={(event) => setVendor(event.target.value)}
            placeholder="Vendor name"
            className={dateInputClasses}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
          <DatePicker
            selected={fromDate}
            onChange={setFromDate}
            selectsStart
            startDate={fromDate}
            endDate={toDate}
            isClearable
            placeholderText="Any date"
            dateFormat="dd/MM/yyyy"
            className={dateInputClasses}
            wrapperClassName="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To Date</label>
          <DatePicker
            selected={toDate}
            onChange={setToDate}
            selectsEnd
            startDate={fromDate}
            endDate={toDate}
            minDate={fromDate}
            isClearable
            placeholderText="Any date"
            dateFormat="dd/MM/yyyy"
            className={dateInputClasses}
            wrapperClassName="w-full"
          />
        </div>
      </div>
    </FilterBar>
  );
};

ExpenseFilter.propTypes = {
  categories: PropTypes.array.isRequired,
  onFilter: PropTypes.func.isRequired,
};

export default ExpenseFilter;
