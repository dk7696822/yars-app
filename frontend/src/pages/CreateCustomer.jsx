import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../services/api';
import CustomerForm from '../components/customers/CustomerForm';
import Card from '../components/common/Card';
import Alert from '../components/common/Alert';

const CreateCustomer = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await customerAPI.create(formData);
      navigate('/customers', { state: { message: 'Customer created successfully' } });
    } catch (err) {
      console.error('Error creating customer:', err);
      setError('Failed to create customer. Please try again.');
      setSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    navigate('/customers');
  };
  
  return (
    <div className="create-customer-page">
      <Card title="Create New Customer">
        {error && <Alert type="danger" message={error} />}
        
        <CustomerForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
          error={error}
        />
      </Card>
    </div>
  );
};

export default CreateCustomer;
