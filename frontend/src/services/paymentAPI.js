import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAuthToken } from '../utils/auth';

const API_URL = `${API_BASE_URL}/payments`;

// Create axios instance with auth headers
const getAxiosInstance = () => {
  const token = getAuthToken();
  return axios.create({
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
};

// Create a new payment
export const create = async (paymentData) => {
  const instance = getAxiosInstance();
  return await instance.post(API_URL, paymentData);
};

// Get all payments with optional filters
export const getAll = async (params = {}) => {
  const instance = getAxiosInstance();
  return await instance.get(API_URL, { params });
};

// Get payment by ID
export const getById = async (id) => {
  const instance = getAxiosInstance();
  return await instance.get(`${API_URL}/${id}`);
};

// Update payment
export const update = async (id, paymentData) => {
  const instance = getAxiosInstance();
  return await instance.put(`${API_URL}/${id}`, paymentData);
};

// Delete payment
export const remove = async (id) => {
  const instance = getAxiosInstance();
  return await instance.delete(`${API_URL}/${id}`);
};

const paymentAPI = {
  create,
  getAll,
  getById,
  update,
  remove
};

export default paymentAPI;
