import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerAPI, productSizeAPI, plateTypeAPI, orderAPI } from '../services/api';
import OrderForm from '../components/orders/OrderForm';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';

const CreateOrder = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [productSizes, setProductSizes] = useState([]);
  const [plateTypes, setPlateTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch all required data in parallel
        const [customersRes, productSizesRes, plateTypesRes] = await Promise.all([
          customerAPI.getAll(),
          productSizeAPI.getAll(),
          plateTypeAPI.getAll()
        ]);
        
        setCustomers(customersRes.data.data);
        setProductSizes(productSizesRes.data.data);
        setPlateTypes(plateTypesRes.data.data);
        
      } catch (err) {
        console.error('Error fetching form data:', err);
        setError('Failed to load form data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await orderAPI.create(formData);
      navigate('/orders', { state: { message: 'Order created successfully' } });
    } catch (err) {
      console.error('Error creating order:', err);
      setError('Failed to create order. Please try again.');
      setSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    navigate('/orders');
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner size="large" />
        <p>Loading form data...</p>
      </div>
    );
  }
  
  return (
    <div className="create-order-page">
      <Card title="Create New Order">
        {error && <Alert type="danger" message={error} />}
        
        <OrderForm
          customers={customers}
          productSizes={productSizes}
          plateTypes={plateTypes}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
        />
      </Card>
    </div>
  );
};

export default CreateOrder;
