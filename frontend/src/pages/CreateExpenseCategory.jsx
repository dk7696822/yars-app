import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { expenseCategoryAPI } from '../services/api';
import ExpenseCategoryForm from '../components/expenses/ExpenseCategoryForm';
import Card from '../components/common/Card';
import Alert from '../components/common/Alert';

const CreateExpenseCategory = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await expenseCategoryAPI.create(formData);
      navigate('/expense-categories', { state: { message: 'Category created successfully' } });
    } catch (err) {
      console.error('Error creating expense category:', err);
      setError(err.response?.data?.message || 'Failed to create category. Please try again.');
      setSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    navigate('/expense-categories');
  };
  
  return (
    <div className="create-expense-category-page">
      <Card title="Create New Expense Category">
        {error && <Alert type="danger" message={error} />}
        
        <ExpenseCategoryForm 
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
        />
      </Card>
    </div>
  );
};

export default CreateExpenseCategory;
