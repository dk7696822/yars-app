import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPlus, FaSearch, FaExclamationCircle, FaCheckCircle } from "react-icons/fa";
import { plateTypeAPI } from "../services/api";
import PlateTypeList from "../components/plateTypes/PlateTypeList";

const PlateTypes = () => {
  const location = useLocation();
  const [plateTypes, setPlateTypes] = useState([]);
  const [filteredPlateTypes, setFilteredPlateTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Check for success message in location state
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the message after 3 seconds
      const timer = setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  useEffect(() => {
    const fetchPlateTypes = async () => {
      try {
        setLoading(true);
        const response = await plateTypeAPI.getAll();
        setPlateTypes(response.data.data);
        setFilteredPlateTypes(response.data.data);
      } catch (err) {
        console.error("Error fetching plate types:", err);
        setError("Failed to load plate types. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlateTypes();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredPlateTypes(plateTypes);
    } else {
      const filtered = plateTypes.filter((plateType) => plateType.type_name.toLowerCase().includes(searchTerm.toLowerCase()));
      setFilteredPlateTypes(filtered);
    }
  }, [searchTerm, plateTypes]);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this plate type?")) {
      try {
        await plateTypeAPI.delete(id);
        setPlateTypes((prev) => prev.filter((plateType) => plateType.id !== id));
        setSuccessMessage("Plate type deleted successfully");
      } catch (err) {
        console.error("Error deleting plate type:", err);
        setError("Failed to delete plate type. Please try again.");
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <FaExclamationCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
          <FaCheckCircle className="text-green-500 mt-0.5 mr-3 flex-shrink-0" />
          <p className="text-green-700">{successMessage}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Plate Types</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/plate-types/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <FaPlus className="mr-2 h-4 w-4" /> New Plate Type
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ring-1 ring-black ring-opacity-5">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Plate Types</h2>
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <FaSearch className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search plate types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading plate types...</p>
            </div>
          ) : (
            <PlateTypeList plateTypes={filteredPlateTypes} onDelete={handleDelete} />
          )}
        </div>
      </div>
    </div>
  );
};

export default PlateTypes;
