import { useLocation } from "react-router-dom";
import { FaSignOutAlt, FaUser } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import "./Header.css";

const Header = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;

    if (path === "/") return "Dashboard";
    if (path.includes("/orders")) return "Orders";
    if (path.includes("/customers")) return "Customers";

    return "Carry Bag Order Tracking";
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        <h1>{getPageTitle()}</h1>

        {user && (
          <div className="user-controls">
            <div className="user-info">
              <FaUser className="user-icon" />
              <span className="username">{user.username}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <FaSignOutAlt /> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
