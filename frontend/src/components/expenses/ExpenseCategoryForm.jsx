import { useState } from 'react';
import { FaSave, FaTimes } from 'react-icons/fa';
import Alert from '../common/Alert';
import Spinner from '../common/Spinner';

const ExpenseCategoryForm = ({ initialData, onSubmit, onCancel, isLoading }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Category name is required');
      return;
    }
    
    onSubmit({ name });
  };

  return (
    <div className="expense-category-form">
      {error && <Alert type="danger" message={error} />}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Category Name *</label>
          <input 
            type="text" 
            id="name" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            required 
            className="form-control" 
            placeholder="Enter category name" 
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            <FaTimes /> Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner size="small" color="white" /> Saving...
              </>
            ) : (
              <>
                <FaSave /> Save Category
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseCategoryForm;
