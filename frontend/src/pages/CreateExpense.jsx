import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { expenseAPI, expenseCategoryAPI } from '../services/api';
import ExpenseForm from '../components/expenses/ExpenseForm';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';

const CreateExpense = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await expenseCategoryAPI.getAll();
        setCategories(response.data.data);
      } catch (err) {
        console.error('Error fetching expense categories:', err);
        setError('Failed to load expense categories. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCategories();
  }, []);
  
  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await expenseAPI.create(formData);
      navigate('/expenses', { state: { message: 'Expense created successfully' } });
    } catch (err) {
      console.error('Error creating expense:', err);
      setError(err.response?.data?.message || 'Failed to create expense. Please try again.');
      setSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    navigate('/expenses');
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner />
        <p>Loading...</p>
      </div>
    );
  }
  
  return (
    <div className="create-expense-page">
      <Card title="Create New Expense">
        {error && <Alert type="danger" message={error} />}
        
        {categories.length === 0 ? (
          <div className="no-categories-message">
            <Alert type="warning" message="You need to create at least one expense category before adding expenses." />
            <button 
              className="btn btn-primary" 
              onClick={() => navigate('/expense-categories/new')}
              style={{ marginTop: '1rem' }}
            >
              Create Category
            </button>
          </div>
        ) : (
          <ExpenseForm 
            categories={categories}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={submitting}
          />
        )}
      </Card>
    </div>
  );
};

export default CreateExpense;
