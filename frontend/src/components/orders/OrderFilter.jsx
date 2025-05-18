import { useState } from "react";
import PropTypes from "prop-types";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaSearch, FaCalendarAlt, FaTimes } from "react-icons/fa";
import "./OrderFilter.css";

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
    <div className="order-filter card">
      <form onSubmit={handleSubmit}>
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="customerName">Customer Name</label>
            <div className="input-with-icon">
              <FaSearch className="input-icon" />
              <input type="text" id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Search by customer name" />
            </div>
          </div>

          <div className="filter-group">
            <label htmlFor="status">Order Status</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className="form-control">
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label>Date Filter Type</label>
            <div className="filter-type-buttons">
              <button type="button" className={filterMode === "range" ? "active" : ""} onClick={() => setFilterMode("range")}>
                Date Range
              </button>
              <button type="button" className={filterMode === "single" ? "active" : ""} onClick={() => setFilterMode("single")}>
                Single Date
              </button>
              <button type="button" className={filterMode === "multi" ? "active" : ""} onClick={() => setFilterMode("multi")}>
                Multiple Dates
              </button>
            </div>
          </div>
        </div>

        <div className="filter-row">
          {filterMode === "range" && (
            <>
              <div className="filter-group">
                <label htmlFor="dateFrom">From Date</label>
                <div className="input-with-icon">
                  <FaCalendarAlt className="input-icon" />
                  <DatePicker
                    id="dateFrom"
                    selected={dateFrom}
                    onChange={(date) => setDateFrom(date)}
                    selectsStart
                    startDate={dateFrom}
                    endDate={dateTo}
                    placeholderText="Select start date"
                    dateFormat="dd/MM/yyyy"
                    className="date-picker"
                  />
                </div>
              </div>

              <div className="filter-group">
                <label htmlFor="dateTo">To Date</label>
                <div className="input-with-icon">
                  <FaCalendarAlt className="input-icon" />
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
                    className="date-picker"
                  />
                </div>
              </div>
            </>
          )}

          {filterMode === "single" && (
            <div className="filter-group">
              <label htmlFor="singleDate">Select Date</label>
              <div className="input-with-icon">
                <FaCalendarAlt className="input-icon" />
                <DatePicker id="singleDate" selected={selectedDate} onChange={(date) => setSelectedDate(date)} placeholderText="Select a date" dateFormat="dd/MM/yyyy" className="date-picker" />
              </div>
            </div>
          )}

          {filterMode === "multi" && (
            <div className="filter-group full-width">
              <label htmlFor="multiDate">Select Multiple Dates</label>
              <div className="input-with-icon">
                <FaCalendarAlt className="input-icon" />
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
                  className="date-picker"
                  highlightDates={selectedDates}
                />
              </div>
              {selectedDates.length > 0 && (
                <div className="selected-dates">
                  <p>Selected dates: {selectedDates.length}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="filter-actions">
          <button type="button" onClick={clearFilters} className="btn-secondary">
            <FaTimes /> Clear Filters
          </button>
          <button type="submit" className="btn-primary">
            <FaSearch /> Apply Filters
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
