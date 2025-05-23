import { useState, useEffect } from "react";
import { FaFilter, FaTimes, FaSearch } from "react-icons/fa";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Select from "../ui/Select";
import Dropdown from "../ui/Dropdown";

const ExpenseFilter = ({ categories, onFilter }) => {
  const [filters, setFilters] = useState({
    category_id: "",
    from_date: null,
    to_date: null,
    payment_status: "",
    vendor: "",
    search: "",
  });
  const [isExpanded, setIsExpanded] = useState(false);

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
      category_id: "",
      from_date: null,
      to_date: null,
      payment_status: "",
      vendor: "",
      search: "",
    });

    onFilter({});
  };

  // Apply filters when search term changes
  useEffect(() => {
    if (filters.search) {
      const timer = setTimeout(() => {
        handleSubmit({ preventDefault: () => {} });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [filters.search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-auto flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
          <input
            type="text"
            name="search"
            value={filters.search}
            onChange={handleChange}
            placeholder="Search expenses..."
            className="pl-10 w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 whitespace-nowrap"
        >
          <FaFilter className="mr-2 h-4 w-4" />
          {isExpanded ? "Hide Filters" : "Show Filters"}
        </button>
      </div>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-gray-50 dark:bg-gray-800 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <Dropdown
                id="category_id"
                name="category_id"
                value={filters.category_id}
                onChange={handleChange}
                placeholder="All Categories"
                options={[
                  { value: "", label: "All Categories" },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
              <DatePicker
                selected={filters.from_date}
                onChange={(date) => handleDateChange(date, "from_date")}
                dateFormat="yyyy-MM-dd"
                className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                isClearable
                placeholderText="From date"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To Date</label>
              <DatePicker
                selected={filters.to_date}
                onChange={(date) => handleDateChange(date, "to_date")}
                dateFormat="yyyy-MM-dd"
                className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                isClearable
                placeholderText="To date"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Status</label>
              <Dropdown
                id="payment_status"
                name="payment_status"
                value={filters.payment_status}
                onChange={handleChange}
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
                name="vendor"
                value={filters.vendor}
                onChange={handleChange}
                placeholder="Vendor name"
                className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <FaTimes className="mr-2 h-4 w-4" /> Reset
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <FaFilter className="mr-2 h-4 w-4" /> Apply Filters
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ExpenseFilter;
