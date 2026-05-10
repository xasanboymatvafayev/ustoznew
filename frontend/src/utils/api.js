import axios from 'axios';

// Development da localhost, production da o'sha saytning /api si
const baseURL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? window.location.origin + '/api'
    : 'http://localhost:5000/api');

const API = axios.create({ baseURL });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;
