import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaPlus, FaSearch } from 'react-icons/fa';
import { expenseCategoryAPI } from '../services/api';
import ExpenseCategoryList from '../components/expenses/ExpenseCategoryList';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';

const ExpenseCategories = () => {
  const location = useLocation();
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Check for success message in location state
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the message after 3 seconds
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await expenseCategoryAPI.getAll();
        setCategories(response.data.data);
        setFilteredCategories(response.data.data);
      } catch (err) {
        console.error('Error fetching expense categories:', err);
        setError('Failed to load expense categories. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredCategories(categories);
    } else {
      const filtered = categories.filter(category => 
        category.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCategories(filtered);
    }
  }, [searchTerm, categories]);

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      await expenseCategoryAPI.delete(id);
      
      // Remove the deleted category from the state
      setCategories(categories.filter(category => category.id !== id));
      
      setSuccessMessage('Category deleted successfully');
      
      // Clear the success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error deleting category:', err);
      setError(err.response?.data?.message || 'Failed to delete category. Please try again later.');
    }
  };

  return (
    <div className="expense-categories-page">
      {error && <Alert type="danger" message={error} />}
      {successMessage && <Alert type="success" message={successMessage} />}
      
      <div className="page-header">
        <div className="search-container">
          <div className="search-input-container">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        
        <Link to="/expense-categories/new" className="btn">
          <FaPlus /> New Category
        </Link>
      </div>
      
      <Card title="Expense Categories">
        {loading ? (
          <div className="loading-container">
            <Spinner />
            <p>Loading categories...</p>
          </div>
        ) : (
          <ExpenseCategoryList 
            categories={filteredCategories} 
            onDelete={handleDeleteCategory} 
          />
        )}
      </Card>
      
      <div className="back-link" style={{ marginTop: '1rem' }}>
        <Link to="/expenses">← Back to Expenses</Link>
      </div>
    </div>
  );
};

export default ExpenseCategories;
