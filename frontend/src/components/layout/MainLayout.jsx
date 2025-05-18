import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import './MainLayout.css';

const MainLayout = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
