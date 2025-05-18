import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customerAPI } from '../services/api';
import CustomerForm from '../components/customers/CustomerForm';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';

const EditCustomer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        setLoading(true);
        const response = await customerAPI.getById(id);
        setCustomer(response.data.data);
      } catch (err) {
        console.error('Error fetching customer:', err);
        setError('Failed to load customer. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCustomer();
  }, [id]);
  
  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await customerAPI.update(id, formData);
      navigate('/customers', { state: { message: 'Customer updated successfully' } });
    } catch (err) {
      console.error('Error updating customer:', err);
      setError('Failed to update customer. Please try again.');
      setSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    navigate('/customers');
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner size="large" />
        <p>Loading customer...</p>
      </div>
    );
  }
  
  return (
    <div className="edit-customer-page">
      <Card title={`Edit Customer - ${customer?.name || 'Loading...'}`}>
        {error && <Alert type="danger" message={error} />}
        
        <CustomerForm
          initialValues={customer}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
          error={error}
        />
      </Card>
    </div>
  );
};

export default EditCustomer;
