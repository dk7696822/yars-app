import { useState } from "react";
import PropTypes from "prop-types";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaSearch, FaCalendarAlt, FaTimes, FaFilter } from "react-icons/fa";
import Select from "../ui/Select";
import Dropdown from "../ui/Dropdown";

const OrderFilter = ({ onFilter }) => {
  const [customerName, setCustomerName] = useState("");
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [filterMode, setFilterMode] = useState("range"); // 'range', 'single', 'multi'
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDates, setSelectedDates] = useState([]);
  const [status, setStatus] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    let dateParams = {};

    if (filterMode === "range" && dateFrom && dateTo) {
      dateParams = { dateFrom, dateTo };
    } else if (filterMode === "single" && selectedDate) {
      dateParams = { date: selectedDate };
    } else if (filterMode === "multi" && selectedDates.length > 0) {
      // For multi-date, we'll just use the API's date range with the min and max dates
      const sortedDates = [...selectedDates].sort((a, b) => a - b);
      dateParams = {
        dateFrom: sortedDates[0],
        dateTo: sortedDates[sortedDates.length - 1],
        // In a real app, we might want to pass the actual array of dates to the backend
      };
    }

    onFilter({
      customerName: customerName.trim() || undefined,
      status: status || undefined,
      ...dateParams,
    });
  };

  const clearFilters = () => {
    setCustomerName("");
    setDateFrom(null);
    setDateTo(null);
    setSelectedDate(null);
    setSelectedDates([]);
    setStatus("");

    onFilter({});
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="customerName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Customer Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500">
                <FaSearch className="h-4 w-4" />
              </div>
              <input
                type="text"
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Search by customer name"
                className="pl-10 w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="status" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Order Status
            </label>
            <Dropdown
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="All Statuses"
              options={[
                { value: "", label: "All Statuses" },
                { value: "PENDING", label: "Pending" },
                { value: "IN_PROGRESS", label: "In Progress" },
                { value: "COMPLETED", label: "Completed" },
                { value: "DELIVERED", label: "Delivered" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Date Filter Type</label>
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              className={`relative inline-flex items-center px-4 py-2 text-sm font-medium border ${
                filterMode === "range"
                  ? "bg-primary text-white border-primary z-10"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              } rounded-l-md focus:z-10 focus:outline-none focus:ring-2 focus:ring-primary`}
              onClick={() => setFilterMode("range")}
            >
              Date Range
            </button>
            <button
              type="button"
              className={`relative inline-flex items-center px-4 py-2 text-sm font-medium border-t border-b ${
                filterMode === "single"
                  ? "bg-primary text-white border-primary z-10"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              } focus:z-10 focus:outline-none focus:ring-2 focus:ring-primary`}
              onClick={() => setFilterMode("single")}
            >
              Single Date
            </button>
            <button
              type="button"
              className={`relative inline-flex items-center px-4 py-2 text-sm font-medium border ${
                filterMode === "multi"
                  ? "bg-primary text-white border-primary z-10"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              } rounded-r-md focus:z-10 focus:outline-none focus:ring-2 focus:ring-primary`}
              onClick={() => setFilterMode("multi")}
            >
              Multiple Dates
            </button>
          </div>
        </div>

        <div className="mt-6">
          {filterMode === "range" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="dateFrom" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  From Date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500">
                    <FaCalendarAlt className="h-4 w-4" />
                  </div>
                  <DatePicker
                    id="dateFrom"
                    selected={dateFrom}
                    onChange={(date) => setDateFrom(date)}
                    selectsStart
                    startDate={dateFrom}
                    endDate={dateTo}
                    placeholderText="Select start date"
                    dateFormat="dd/MM/yyyy"
                    className="pl-10 w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="dateTo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  To Date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500">
                    <FaCalendarAlt className="h-4 w-4" />
                  </div>
                  <DatePicker
                    id="dateTo"
                    selected={dateTo}
                    onChange={(date) => setDateTo(date)}
                    selectsEnd
                    startDate={dateFrom}
                    endDate={dateTo}
                    minDate={dateFrom}
                    placeholderText="Select end date"
                    dateFormat="dd/MM/yyyy"
                    className="pl-10 w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {filterMode === "single" && (
            <div className="space-y-2 max-w-md">
              <label htmlFor="singleDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500">
                  <FaCalendarAlt className="h-4 w-4" />
                </div>
                <DatePicker
                  id="singleDate"
                  selected={selectedDate}
                  onChange={(date) => setSelectedDate(date)}
                  placeholderText="Select a date"
                  dateFormat="dd/MM/yyyy"
                  className="pl-10 w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          )}

          {filterMode === "multi" && (
            <div className="space-y-2">
              <label htmlFor="multiDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Multiple Dates
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500">
                  <FaCalendarAlt className="h-4 w-4" />
                </div>
                <DatePicker
                  id="multiDate"
                  selected={null}
                  onChange={(date) => {
                    setSelectedDates((prev) => {
                      // Toggle date selection
                      const dateExists = prev.some((d) => d.getTime() === date.getTime());
                      if (dateExists) {
                        return prev.filter((d) => d.getTime() !== date.getTime());
                      } else {
                        return [...prev, date];
                      }
                    });
                  }}
                  placeholderText={`${selectedDates.length} dates selected`}
                  dateFormat="dd/MM/yyyy"
                  className="pl-10 w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  highlightDates={selectedDates}
                />
              </div>
              {selectedDates.length > 0 && (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Selected dates: {selectedDates.length}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <FaTimes className="mr-2 h-4 w-4" /> Clear Filters
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <FaFilter className="mr-2 h-4 w-4" /> Apply Filters
          </button>
        </div>
      </form>
    </div>
  );
};

OrderFilter.propTypes = {
  onFilter: PropTypes.func.isRequired,
};

export default OrderFilter;
