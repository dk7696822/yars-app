import { useState, useCallback } from 'react';

/**
 * Custom hook for making API calls
 * @param {Function} apiFunction - API function to call
 * @returns {Object} - loading, error, data, and execute function
 */
const useApi = (apiFunction) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiFunction(...args);
      setData(response.data);
      
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunction]);

  return { loading, error, data, execute };
};

export default useApi;
