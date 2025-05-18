import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaPlus, FaSearch } from 'react-icons/fa';
import { productSizeAPI } from '../services/api';
import ProductSizeList from '../components/productSizes/ProductSizeList';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import './ProductSizes.css';

const ProductSizes = () => {
  const location = useLocation();
  const [productSizes, setProductSizes] = useState([]);
  const [filteredProductSizes, setFilteredProductSizes] = useState([]);
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
    const fetchProductSizes = async () => {
      try {
        setLoading(true);
        const response = await productSizeAPI.getAll();
        setProductSizes(response.data.data);
        setFilteredProductSizes(response.data.data);
      } catch (err) {
        console.error('Error fetching product sizes:', err);
        setError('Failed to load product sizes. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProductSizes();
  }, []);
  
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProductSizes(productSizes);
    } else {
      const filtered = productSizes.filter(productSize => 
        productSize.size_label.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProductSizes(filtered);
    }
  }, [searchTerm, productSizes]);
  
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product size?')) {
      try {
        await productSizeAPI.delete(id);
        setProductSizes(prev => prev.filter(productSize => productSize.id !== id));
        setSuccessMessage('Product size deleted successfully');
      } catch (err) {
        console.error('Error deleting product size:', err);
        setError('Failed to delete product size. Please try again.');
      }
    }
  };
  
  return (
    <div className="product-sizes-page">
      {error && <Alert type="danger" message={error} />}
      {successMessage && <Alert type="success" message={successMessage} />}
      
      <div className="page-header">
        <div className="search-container">
          <div className="search-input-container">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search product sizes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        
        <Link to="/product-sizes/new" className="btn">
          <FaPlus /> New Product Size
        </Link>
      </div>
      
      <Card title="Product Sizes">
        {loading ? (
          <div className="loading-container">
            <Spinner size="large" />
            <p>Loading product sizes...</p>
          </div>
        ) : (
          <ProductSizeList productSizes={filteredProductSizes} onDelete={handleDelete} />
        )}
      </Card>
    </div>
  );
};

export default ProductSizes;
