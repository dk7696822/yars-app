import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaCalendarAlt } from "react-icons/fa";
import Dropdown from "../ui/Dropdown";
import FilterBar from "../common/FilterBar";
import { formatDate } from "../../utils/formatters";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

const statusLabel = (value) => STATUS_OPTIONS.find((option) => option.value === value)?.label || value;

const dateInputClasses =
  "pl-10 w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] px-3 py-2 text-sm text-gray-900 dark:text-emerald-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:focus:border-emerald-500/50 transition-all";

const OrderFilter = ({ onFilter }) => {
  const [customerName, setCustomerName] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const skipFirstRun = useRef(true);

  // Everything applies automatically — text debounced, the rest immediate
  // (the debounce window is short enough to feel instant for clicks).
  useEffect(() => {
    if (skipFirstRun.current) {
      skipFirstRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      onFilter({
        customerName: customerName.trim() || undefined,
        status: status || undefined,
        ...(dateFrom || dateTo ? { dateFrom: dateFrom || dateTo, dateTo: dateTo || dateFrom } : {}),
      });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerName, status, dateFrom, dateTo]);

  const chips = [
    status && { key: "status", label: statusLabel(status), onRemove: () => setStatus("") },
    dateFrom && { key: "from", label: `From ${formatDate(dateFrom)}`, onRemove: () => setDateFrom(null) },
    dateTo && { key: "to", label: `To ${formatDate(dateTo)}`, onRemove: () => setDateTo(null) },
  ].filter(Boolean);

  const clearAll = () => {
    setStatus("");
    setDateFrom(null);
    setDateTo(null);
  };

  return (
    <FilterBar
      search={customerName}
      onSearchChange={setCustomerName}
      searchPlaceholder="Search by customer name…"
      activeCount={chips.length}
      chips={chips}
      onClearAll={clearAll}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            From Date
          </label>
          <div className="relative">
            <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
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
        </div>

        <div className="space-y-2">
          <label htmlFor="dateTo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            To Date
          </label>
          <div className="relative">
            <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
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
      </div>
    </FilterBar>
  );
};

OrderFilter.propTypes = {
  onFilter: PropTypes.func.isRequired,
};

export default OrderFilter;
