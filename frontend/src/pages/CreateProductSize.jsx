import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productSizeAPI } from '../services/api';
import ProductSizeForm from '../components/productSizes/ProductSizeForm';
import Card from '../components/common/Card';
import Alert from '../components/common/Alert';

const CreateProductSize = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await productSizeAPI.create(formData);
      navigate('/product-sizes', { state: { message: 'Product size created successfully' } });
    } catch (err) {
      console.error('Error creating product size:', err);
      setError('Failed to create product size. Please try again.');
      setSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    navigate('/product-sizes');
  };
  
  return (
    <div className="create-product-size-page">
      <Card title="Create New Product Size">
        {error && <Alert type="danger" message={error} />}
        
        <ProductSizeForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
          error={error}
        />
      </Card>
    </div>
  );
};

export default CreateProductSize;
