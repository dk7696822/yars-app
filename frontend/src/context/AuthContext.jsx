import { createContext, useState, useContext, useEffect } from 'react';
import Cookies from 'js-cookie';

// Create the auth context
const AuthContext = createContext();

// Hardcoded credentials (in a real app, these would be in environment variables)
const ADMIN_USERNAME = 'rahul13nh@gmail.com';
const ADMIN_PASSWORD = 'Rahul@102938';
const AUTH_TOKEN_NAME = 'yars_auth_token';

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get(AUTH_TOKEN_NAME);
      
      if (token) {
        setIsAuthenticated(true);
        setUser({ username: 'admin' });
      }
      
      setLoading(false);
    };
    
    checkAuth();
  }, []);
  
  const login = async (username, password) => {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = btoa(`${username}:${Date.now()}`);
      
      Cookies.set(AUTH_TOKEN_NAME, token, { expires: 1 });
      
      setIsAuthenticated(true);
      setUser({ username });
      
      return true;
    }
    
    return false;
  };
  
  const logout = () => {
    Cookies.remove(AUTH_TOKEN_NAME);
    
    setIsAuthenticated(false);
    setUser(null);
  };
  
  const value = {
    isAuthenticated,
    user,
    loading,
    login,
    logout
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};
