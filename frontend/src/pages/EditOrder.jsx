import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customerAPI, productSizeAPI, plateTypeAPI, orderAPI } from '../services/api';
import OrderForm from '../components/orders/OrderForm';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';

const EditOrder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState(null);
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
        const [orderRes, customersRes, productSizesRes, plateTypesRes] = await Promise.all([
          orderAPI.getById(id),
          customerAPI.getAll(),
          productSizeAPI.getAll(),
          plateTypeAPI.getAll()
        ]);
        
        setOrder(orderRes.data.data);
        setCustomers(customersRes.data.data);
        setProductSizes(productSizesRes.data.data);
        setPlateTypes(plateTypesRes.data.data);
        
      } catch (err) {
        console.error('Error fetching order data:', err);
        setError('Failed to load order data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);
  
  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await orderAPI.update(id, formData);
      navigate('/orders', { state: { message: 'Order updated successfully' } });
    } catch (err) {
      console.error('Error updating order:', err);
      setError('Failed to update order. Please try again.');
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
        <p>Loading order data...</p>
      </div>
    );
  }
  
  return (
    <div className="edit-order-page">
      <Card title={`Edit Order - ${order?.customer?.name || 'Loading...'}`}>
        {error && <Alert type="danger" message={error} />}
        
        <OrderForm
          initialValues={order}
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

export default EditOrder;
