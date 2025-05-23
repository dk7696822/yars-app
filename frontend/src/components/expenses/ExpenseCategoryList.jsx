import { Link } from 'react-router-dom';
import { FaEdit } from 'react-icons/fa';
import { formatDate } from '../../utils/formatters';
import DeleteIcon from '../common/DeleteIcon';

const ExpenseCategoryList = ({ categories, onDelete }) => {
  if (!categories || categories.length === 0) {
    return <p className="no-data">No expense categories found. Create your first category to get started.</p>;
  }

  return (
    <div className="expense-category-list">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id}>
              <td>{category.name}</td>
              <td>{formatDate(category.created_at)}</td>
              <td>
                <div className="action-buttons">
                  <Link to={`/expense-categories/edit/${category.id}`} className="btn-icon" title="Edit">
                    <FaEdit />
                  </Link>
                  <button 
                    style={{
                      backgroundColor: "white",
                      border: "none",
                      padding: "8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }} 
                    onClick={() => onDelete(category.id)} 
                    title="Delete"
                  >
                    <DeleteIcon color="red" size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ExpenseCategoryList;
