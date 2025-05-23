import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { expenseAPI, expenseCategoryAPI } from '../services/api';
import ExpenseForm from '../components/expenses/ExpenseForm';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';

const EditExpense = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch expense and categories in parallel
        const [expenseRes, categoriesRes] = await Promise.all([
          expenseAPI.getById(id),
          expenseCategoryAPI.getAll()
        ]);
        
        setExpense(expenseRes.data.data);
        setCategories(categoriesRes.data.data);
      } catch (err) {
        console.error('Error fetching expense data:', err);
        setError('Failed to load expense data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);
  
  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await expenseAPI.update(id, formData);
      navigate('/expenses', { state: { message: 'Expense updated successfully' } });
    } catch (err) {
      console.error('Error updating expense:', err);
      setError(err.response?.data?.message || 'Failed to update expense. Please try again.');
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
  
  if (!expense) {
    return (
      <div className="not-found-container">
        <Alert type="danger" message="Expense not found or has been deleted." />
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/expenses')}
          style={{ marginTop: '1rem' }}
        >
          Back to Expenses
        </button>
      </div>
    );
  }
  
  return (
    <div className="edit-expense-page">
      <Card title="Edit Expense">
        {error && <Alert type="danger" message={error} />}
        
        <ExpenseForm 
          initialData={expense}
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
        />
      </Card>
    </div>
  );
};

export default EditExpense;
