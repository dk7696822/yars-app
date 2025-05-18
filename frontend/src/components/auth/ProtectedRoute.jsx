import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../common/Spinner';

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  
  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="loading-container" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        height: '100vh' 
      }}>
        <Spinner size="large" />
        <p style={{ marginTop: '1rem' }}>Loading...</p>
      </div>
    );
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // Render the child routes if authenticated
  return <Outlet />;
};

export default ProtectedRoute;
