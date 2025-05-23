import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { expenseCategoryAPI } from '../services/api';
import ExpenseCategoryForm from '../components/expenses/ExpenseCategoryForm';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';

const EditExpenseCategory = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchCategory = async () => {
      try {
        setLoading(true);
        const response = await expenseCategoryAPI.getById(id);
        setCategory(response.data.data);
      } catch (err) {
        console.error('Error fetching expense category:', err);
        setError('Failed to load category data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCategory();
  }, [id]);
  
  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await expenseCategoryAPI.update(id, formData);
      navigate('/expense-categories', { state: { message: 'Category updated successfully' } });
    } catch (err) {
      console.error('Error updating expense category:', err);
      setError(err.response?.data?.message || 'Failed to update category. Please try again.');
      setSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    navigate('/expense-categories');
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner />
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!category) {
    return (
      <div className="not-found-container">
        <Alert type="danger" message="Category not found or has been deleted." />
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/expense-categories')}
          style={{ marginTop: '1rem' }}
        >
          Back to Categories
        </button>
      </div>
    );
  }
  
  return (
    <div className="edit-expense-category-page">
      <Card title="Edit Expense Category">
        {error && <Alert type="danger" message={error} />}
        
        <ExpenseCategoryForm 
          initialData={category}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
        />
      </Card>
    </div>
  );
};

export default EditExpenseCategory;
