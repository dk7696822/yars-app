import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Dropdown from "../ui/Dropdown";
import FilterBar from "../common/FilterBar";
import { formatDate, formatDateForAPI } from "../../utils/formatters";

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "PAYMENT", label: "Payment" },
  { value: "ORDER", label: "Order" },
  { value: "PURCHASE_ORDER", label: "Purchase Order" },
  { value: "GOODS_RECEIPT", label: "Goods Receipt" },
  { value: "STOCK_ISSUE", label: "Stock Issue" },
];

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "CREATE", label: "Created" },
  { value: "UPDATE", label: "Updated" },
  { value: "DELETE", label: "Deleted" },
];

const dateInputClasses =
  "w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] px-4 py-2 text-sm text-gray-900 dark:text-emerald-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:focus:border-emerald-500/50 transition-all";

const optionLabel = (options, value) => options.find((option) => option.value === value)?.label || value;

const HistoryFilter = ({ onFilter }) => {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
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
        entity_type: entityType || undefined,
        action: action || undefined,
        from_date: fromDate ? formatDateForAPI(fromDate) : undefined,
        to_date: toDate ? formatDateForAPI(toDate) : undefined,
      };
      Object.keys(filters).forEach((key) => filters[key] === undefined && delete filters[key]);
      onFilter(filters);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, action, fromDate, toDate]);

  const chips = [
    entityType && {
      key: "type",
      label: optionLabel(TYPE_OPTIONS, entityType),
      onRemove: () => setEntityType(""),
    },
    action && { key: "action", label: optionLabel(ACTION_OPTIONS, action), onRemove: () => setAction("") },
    fromDate && { key: "from", label: `From ${formatDate(fromDate)}`, onRemove: () => setFromDate(null) },
    toDate && { key: "to", label: `To ${formatDate(toDate)}`, onRemove: () => setToDate(null) },
  ].filter(Boolean);

  const clearAll = () => {
    setEntityType("");
    setAction("");
    setFromDate(null);
    setToDate(null);
  };

  return (
    <FilterBar activeCount={chips.length} chips={chips} onClearAll={clearAll}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
          <Dropdown
            id="entity_type"
            name="entity_type"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            placeholder="All Types"
            options={TYPE_OPTIONS}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Action</label>
          <Dropdown
            id="action"
            name="action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="All Actions"
            options={ACTION_OPTIONS}
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

HistoryFilter.propTypes = {
  onFilter: PropTypes.func.isRequired,
};

export default HistoryFilter;
