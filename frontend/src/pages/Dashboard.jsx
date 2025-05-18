import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaPlus, FaBoxes, FaUsers, FaMoneyBillWave } from 'react-icons/fa';
import { orderAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import Card from '../components/common/Card';
import OrderList from '../components/orders/OrderList';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import './Dashboard.css';

const Dashboard = () => {
  const [recentOrders, setRecentOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalCustomers: 0,
    totalReceivable: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch recent orders
        const ordersResponse = await orderAPI.getAll({ limit: 5 });
        setRecentOrders(ordersResponse.data.data);
        
        // Calculate stats
        const allOrders = ordersResponse.data.data;
        const uniqueCustomers = new Set(allOrders.map(order => order.customer_id));
        const totalReceivable = allOrders.reduce((sum, order) => sum + order.totalReceivable, 0);
        
        setStats({
          totalOrders: allOrders.length,
          totalCustomers: uniqueCustomers.size,
          totalReceivable
        });
        
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);
  
  const handleDeleteOrder = async (orderId) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        await orderAPI.delete(orderId);
        setRecentOrders(prev => prev.filter(order => order.id !== orderId));
      } catch (err) {
        console.error('Error deleting order:', err);
        setError('Failed to delete order. Please try again.');
      }
    }
  };
  
  if (loading) {
    return (
      <div className="dashboard-loading">
        <Spinner size="large" />
        <p>Loading dashboard data...</p>
      </div>
    );
  }
  
  return (
    <div className="dashboard">
      {error && <Alert type="danger" message={error} />}
      
      <div className="dashboard-actions">
        <Link to="/orders/new" className="btn">
          <FaPlus /> New Order
        </Link>
        <Link to="/customers/new" className="btn btn-secondary">
          <FaPlus /> New Customer
        </Link>
      </div>
      
      <div className="stats-cards">
        <Card className="stat-card">
          <div className="stat-content">
            <div className="stat-icon orders">
              <FaBoxes />
            </div>
            <div className="stat-details">
              <h3>Total Orders</h3>
              <p className="stat-value">{stats.totalOrders}</p>
            </div>
          </div>
        </Card>
        
        <Card className="stat-card">
          <div className="stat-content">
            <div className="stat-icon customers">
              <FaUsers />
            </div>
            <div className="stat-details">
              <h3>Total Customers</h3>
              <p className="stat-value">{stats.totalCustomers}</p>
            </div>
          </div>
        </Card>
        
        <Card className="stat-card">
          <div className="stat-content">
            <div className="stat-icon receivable">
              <FaMoneyBillWave />
            </div>
            <div className="stat-details">
              <h3>Total Receivable</h3>
              <p className="stat-value">{formatCurrency(stats.totalReceivable)}</p>
            </div>
          </div>
        </Card>
      </div>
      
      <Card title="Recent Orders">
        {recentOrders.length > 0 ? (
          <>
            <OrderList orders={recentOrders} onDelete={handleDeleteOrder} />
            <div className="view-all-link">
              <Link to="/orders">View All Orders</Link>
            </div>
          </>
        ) : (
          <p className="no-data">No orders found. Create your first order to get started.</p>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
