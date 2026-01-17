import { useState } from "react";
import { FaFilter, FaTimes } from "react-icons/fa";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Dropdown from "../ui/Dropdown";

const HistoryFilter = ({ onFilter }) => {
  const [filters, setFilters] = useState({
    entity_type: "",
    action: "",
    from_date: null,
    to_date: null,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date, field) => {
    setFilters((prev) => ({ ...prev, [field]: date }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Format dates for API
    const formattedFilters = {
      ...filters,
      from_date: filters.from_date ? filters.from_date.toISOString().split("T")[0] : null,
      to_date: filters.to_date ? filters.to_date.toISOString().split("T")[0] : null,
    };

    // Remove null/empty values
    Object.keys(formattedFilters).forEach((key) => {
      if (formattedFilters[key] === null || formattedFilters[key] === "") {
        delete formattedFilters[key];
      }
    });

    onFilter(formattedFilters);
  };

  const handleReset = () => {
    setFilters({
      entity_type: "",
      action: "",
      from_date: null,
      to_date: null,
    });

    onFilter({});
  };

  return (
    <div style={{ overflow: 'visible' }}>
      <form onSubmit={handleSubmit} className="space-y-5" style={{ overflow: 'visible' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5" style={{ overflow: 'visible' }}>
          <div className="history-filter-field space-y-2 relative z-40">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
            <Dropdown
              id="entity_type"
              name="entity_type"
              value={filters.entity_type}
              onChange={handleChange}
              placeholder="All Types"
              options={[
                { value: "", label: "All Types" },
                { value: "PAYMENT", label: "Payment" },
                { value: "ORDER", label: "Order" },
              ]}
            />
          </div>

          <div className="history-filter-field space-y-2 relative z-30">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Action</label>
            <Dropdown
              id="action"
              name="action"
              value={filters.action}
              onChange={handleChange}
              placeholder="All Actions"
              options={[
                { value: "", label: "All Actions" },
                { value: "CREATE", label: "Created" },
                { value: "UPDATE", label: "Updated" },
                { value: "DELETE", label: "Deleted" },
              ]}
            />
          </div>

          <div className="history-filter-field space-y-2 relative z-20">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
            <DatePicker
              selected={filters.from_date}
              onChange={(date) => handleDateChange(date, "from_date")}
              dateFormat="yyyy-MM-dd"
              className="w-full h-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-emerald-500/30 focus:border-primary dark:focus:border-emerald-500/50 transition-all"
              isClearable
              placeholderText="From date"
            />
          </div>

          <div className="history-filter-field space-y-2 relative z-10">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To Date</label>
            <DatePicker
              selected={filters.to_date}
              onChange={(date) => handleDateChange(date, "to_date")}
              dateFormat="yyyy-MM-dd"
              className="w-full h-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-emerald-500/30 focus:border-primary dark:focus:border-emerald-500/50 transition-all"
              isClearable
              placeholderText="To date"
            />
          </div>
        </div>

        <div className="history-filter-actions flex flex-col sm:flex-row justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="history-btn inline-flex items-center justify-center h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            <FaTimes className="mr-2 h-4 w-4" /> Reset
          </button>
          <button
            type="submit"
            className="history-btn history-btn-primary inline-flex items-center justify-center h-11 rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary-600 shadow-lg shadow-primary/25 dark:shadow-emerald-500/20 transition-all"
          >
            <FaFilter className="mr-2 h-4 w-4" /> Apply Filters
          </button>
        </div>
      </form>
    </div>
  );
};

export default HistoryFilter;
