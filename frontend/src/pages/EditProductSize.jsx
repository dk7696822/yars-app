import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productSizeAPI } from '../services/api';
import ProductSizeForm from '../components/productSizes/ProductSizeForm';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';

const EditProductSize = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [productSize, setProductSize] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchProductSize = async () => {
      try {
        setLoading(true);
        const response = await productSizeAPI.getById(id);
        setProductSize(response.data.data);
      } catch (err) {
        console.error('Error fetching product size:', err);
        setError('Failed to load product size. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProductSize();
  }, [id]);
  
  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await productSizeAPI.update(id, formData);
      navigate('/product-sizes', { state: { message: 'Product size updated successfully' } });
    } catch (err) {
      console.error('Error updating product size:', err);
      setError('Failed to update product size. Please try again.');
      setSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    navigate('/product-sizes');
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner size="large" />
        <p>Loading product size...</p>
      </div>
    );
  }
  
  return (
    <div className="edit-product-size-page">
      <Card title={`Edit Product Size - ${productSize?.size_label || 'Loading...'}`}>
        {error && <Alert type="danger" message={error} />}
        
        <ProductSizeForm
          initialValues={productSize}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
          error={error}
        />
      </Card>
    </div>
  );
};

export default EditProductSize;
