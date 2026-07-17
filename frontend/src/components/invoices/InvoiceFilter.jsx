import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Dropdown from "../ui/Dropdown";
import FilterBar from "../common/FilterBar";
import { formatDate } from "../../utils/formatters";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

const dateInputClasses =
  "w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] px-4 py-2 text-sm text-gray-900 dark:text-emerald-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:focus:border-emerald-500/50 transition-all";

const InvoiceFilter = ({ customers, onFilter }) => {
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const skipFirstRun = useRef(true);

  useEffect(() => {
    if (skipFirstRun.current) {
      skipFirstRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      onFilter({
        customer_id: customerId,
        status,
        dateFrom,
        dateTo,
        search: search.trim(),
      });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, customerId, status, dateFrom, dateTo]);

  const customerName = (id) => customers.find((customer) => customer.id === id)?.name || "Customer";
  const statusLabel = (value) => STATUS_OPTIONS.find((option) => option.value === value)?.label || value;

  const chips = [
    customerId && { key: "customer", label: customerName(customerId), onRemove: () => setCustomerId("") },
    status && { key: "status", label: statusLabel(status), onRemove: () => setStatus("") },
    dateFrom && { key: "from", label: `From ${formatDate(dateFrom)}`, onRemove: () => setDateFrom(null) },
    dateTo && { key: "to", label: `To ${formatDate(dateTo)}`, onRemove: () => setDateTo(null) },
  ].filter(Boolean);

  const clearAll = () => {
    setCustomerId("");
    setStatus("");
    setDateFrom(null);
    setDateTo(null);
  };

  return (
    <FilterBar
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search invoices…"
      activeCount={chips.length}
      chips={chips}
      onClearAll={clearAll}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label htmlFor="customer" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Customer
          </label>
          <Dropdown
            id="customer"
            name="customer"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            placeholder="All Customers"
            options={[
              { value: "", label: "All Customers" },
              ...customers.map((customer) => ({ value: customer.id, label: customer.name })),
            ]}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="status" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Status
          </label>
          <Dropdown
            id="status"
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="All Statuses"
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="dateFrom" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Date From
          </label>
          <DatePicker
            id="dateFrom"
            selected={dateFrom}
            onChange={setDateFrom}
            selectsStart
            startDate={dateFrom}
            endDate={dateTo}
            isClearable
            placeholderText="Any date"
            dateFormat="dd/MM/yyyy"
            className={dateInputClasses}
            wrapperClassName="w-full"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="dateTo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Date To
          </label>
          <DatePicker
            id="dateTo"
            selected={dateTo}
            onChange={setDateTo}
            selectsEnd
            startDate={dateFrom}
            endDate={dateTo}
            minDate={dateFrom}
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

InvoiceFilter.propTypes = {
  customers: PropTypes.array.isRequired,
  onFilter: PropTypes.func.isRequired,
};

export default InvoiceFilter;
