import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { plateTypeAPI } from "../services/api";
import PlateTypeForm from "../components/plateTypes/PlateTypeForm";
import Card from "../components/common/Card";
import Spinner from "../components/common/Spinner";
import Alert from "../components/common/Alert";

const EditPlateType = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [plateType, setPlateType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPlateType = async () => {
      try {
        setLoading(true);
        const response = await plateTypeAPI.getById(id);
        setPlateType(response.data.data);
      } catch (err) {
        console.error("Error fetching plate type:", err);
        setError("Failed to load plate type. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlateType();
  }, [id]);

  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await plateTypeAPI.update(id, formData);
      navigate("/plate-types", { state: { message: "Plate type updated successfully" } });
    } catch (err) {
      console.error("Error updating plate type:", err);
      setError("Failed to update plate type. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/plate-types");
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Spinner size="large" />
        <p>Loading plate type...</p>
      </div>
    );
  }

  return (
    <div className="edit-plate-type-page">
      <Card title={`Edit Plate Type - ${plateType?.type_name || "Loading..."}`}>
        {error && <Alert type="danger" message={error} />}

        <PlateTypeForm initialValues={plateType} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={submitting} error={error} />
      </Card>
    </div>
  );
};

export default EditPlateType;
