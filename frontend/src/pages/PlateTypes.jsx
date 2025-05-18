import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPlus, FaSearch } from "react-icons/fa";
import { plateTypeAPI } from "../services/api";
import PlateTypeList from "../components/plateTypes/PlateTypeList";
import Card from "../components/common/Card";
import Spinner from "../components/common/Spinner";
import Alert from "../components/common/Alert";
import "./PlateTypes.css";

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
    <div className="plate-types-page">
      {error && <Alert type="danger" message={error} />}
      {successMessage && <Alert type="success" message={successMessage} />}

      <div className="page-header">
        <div className="search-container">
          <div className="search-input-container">
            <FaSearch className="search-icon" />
            <input type="text" placeholder="Search plate types..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
          </div>
        </div>

        <Link to="/plate-types/new" className="btn">
          <FaPlus /> New Plate Type
        </Link>
      </div>

      <Card title="Plate Types">
        {loading ? (
          <div className="loading-container">
            <Spinner size="large" />
            <p>Loading plate types...</p>
          </div>
        ) : (
          <PlateTypeList plateTypes={filteredPlateTypes} onDelete={handleDelete} />
        )}
      </Card>
    </div>
  );
};

export default PlateTypes;
