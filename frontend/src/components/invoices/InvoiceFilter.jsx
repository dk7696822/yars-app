import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FaSearch, FaFilter, FaTimes } from "react-icons/fa";
import DatePicker from "react-datepicker";
import Dropdown from "../ui/Dropdown";
import { Button } from "../ui/Button";
import "react-datepicker/dist/react-datepicker.css";

const InvoiceFilter = ({ customers, onFilter }) => {
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [search, setSearch] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    // Apply filters when component mounts
    handleFilter();
  }, []);

  const handleFilter = () => {
    onFilter({
      customer_id: customerId,
      status,
      dateFrom,
      dateTo,
      search: search.trim(),
    });
  };

  const handleReset = () => {
    setCustomerId("");
    setStatus("");
    setDateFrom(null);
    setDateTo(null);
    setSearch("");
    
    onFilter({});
  };

  const toggleFilter = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  return (
    <div className="invoice-filter mb-6">
      <div className="flex flex-col gap-4 mb-4">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <FaSearch className="text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            className="block w-full h-12 pl-11 pr-4 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-blue-500/30 focus:border-primary dark:focus:border-blue-500/50 transition-all"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFilter()}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={toggleFilter} variant="outline" className="flex items-center justify-center gap-2 min-h-[48px] w-full sm:w-auto">
            <FaFilter /> {isFilterOpen ? "Hide Filters" : "Show Filters"}
          </Button>

          <Button onClick={handleFilter} variant="default" className="flex items-center justify-center gap-2 min-h-[48px] w-full sm:w-auto">
            <FaSearch /> Apply Filters
          </Button>

          <Button onClick={handleReset} variant="ghost" className="flex items-center justify-center gap-2 min-h-[48px] w-full sm:w-auto">
            <FaTimes /> Reset
          </Button>
        </div>
      </div>

      {isFilterOpen && (
        <div className="filter-options bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 p-4 sm:p-5 rounded-xl mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label htmlFor="customer" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Customer
            </label>
            <Dropdown
              id="customer"
              name="customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="All Customers"
              options={[
                { value: "", label: "All Customers" },
                ...customers.map((customer) => ({
                  value: customer.id,
                  label: customer.name,
                })),
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
              onChange={(e) => setStatus(e.target.value)}
              placeholder="All Statuses"
              options={[
                { value: "", label: "All Statuses" },
                { value: "PENDING", label: "Pending" },
                { value: "PAID", label: "Paid" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
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
              className="block w-full h-12 px-4 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-blue-500/30 focus:border-primary dark:focus:border-blue-500/50 transition-all"
              placeholderText="Select start date"
              dateFormat="dd/MM/yyyy"
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
              className="block w-full h-12 px-4 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-blue-500/30 focus:border-primary dark:focus:border-blue-500/50 transition-all"
              placeholderText="Select end date"
              dateFormat="dd/MM/yyyy"
              wrapperClassName="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

InvoiceFilter.propTypes = {
  customers: PropTypes.array.isRequired,
  onFilter: PropTypes.func.isRequired,
};

export default InvoiceFilter;
