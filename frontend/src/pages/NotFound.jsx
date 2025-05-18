import { Link } from 'react-router-dom';
import { FaHome } from 'react-icons/fa';
import './NotFound.css';

const NotFound = () => {
  return (
    <div className="not-found">
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you are looking for does not exist or has been moved.</p>
      <Link to="/" className="btn">
        <FaHome /> Go to Dashboard
      </Link>
    </div>
  );
};

export default NotFound;
