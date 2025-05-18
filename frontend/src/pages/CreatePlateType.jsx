import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { plateTypeAPI } from "../services/api";
import PlateTypeForm from "../components/plateTypes/PlateTypeForm";
import Card from "../components/common/Card";
import Alert from "../components/common/Alert";

const CreatePlateType = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await plateTypeAPI.create(formData);
      navigate("/plate-types", { state: { message: "Plate type created successfully" } });
    } catch (err) {
      console.error("Error creating plate type:", err);
      setError("Failed to create plate type. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/plate-types");
  };

  return (
    <div className="create-plate-type-page">
      <Card title="Create New Plate Type">
        {error && <Alert type="danger" message={error} />}

        <PlateTypeForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={submitting} error={error} />
      </Card>
    </div>
  );
};

export default CreatePlateType;
