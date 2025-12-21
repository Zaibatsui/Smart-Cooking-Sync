import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - adds auth token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handles 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data on 401
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Dishes API
export const dishesAPI = {
  // Get all dishes
  getAll: async () => {
    try {
      const response = await api.get('/api/dishes');
      return response.data;
    } catch (error) {
      console.error('Error fetching dishes:', error);
      throw error;
    }
  },

  // Create a new dish
  create: async (dishData) => {
    try {
      const response = await api.post('/api/dishes', dishData);
      return response.data;
    } catch (error) {
      console.error('Error creating dish:', error);
      throw error;
    }
  },

  // Delete a specific dish
  delete: async (dishId) => {
    try {
      const response = await api.delete(`/api/dishes/${dishId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting dish:', error);
      throw error;
    }
  },

  // Update dish cooking time
  updateTime: async (dishId, cookingTime) => {
    try {
      const response = await api.patch(`/api/dishes/${dishId}`, null, {
        params: { cookingTime }
      });
      return response.data;
    } catch (error) {
      console.error('Error updating dish time:', error);
      throw error;
    }
  },

  // Clear all dishes
  clearAll: async () => {
    try {
      const response = await api.delete('/api/dishes');
      return response.data;
    } catch (error) {
      console.error('Error clearing dishes:', error);
      throw error;
    }
  },
};

// Tasks API
export const tasksAPI = {
  // Get all tasks
  getAll: async () => {
    try {
      const response = await api.get('/api/tasks');
      return response.data;
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  },

  // Create a new task
  create: async (taskData) => {
    try {
      const response = await api.post('/api/tasks', taskData);
      return response.data;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },

  // Delete a specific task
  delete: async (taskId) => {
    try {
      const response = await api.delete(`/api/tasks/${taskId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  },

  // Clear all tasks
  clearAll: async () => {
    try {
      const response = await api.delete('/api/tasks');
      return response.data;
    } catch (error) {
      console.error('Error clearing tasks:', error);
      throw error;
    }
  },
};

// Cooking Plan API
export const cookingPlanAPI = {
  // Calculate cooking plan
  calculate: async (userOvenType) => {
    try {
      const response = await api.post('/api/cooking-plan/calculate', {
        user_oven_type: userOvenType,
      });
      return response.data;
    } catch (error) {
      console.error('Error calculating cooking plan:', error);
      throw error;
    }
  },
};

// Auth API
export const authAPI = {
  // Login with Google
  loginWithGoogle: async (credential) => {
    try {
      const response = await api.post('/api/auth/google', { credential });
      return response.data;
    } catch (error) {
      console.error('Error logging in with Google:', error);
      throw error;
    }
  },

  // Get current user
  getCurrentUser: async () => {
    try {
      const response = await api.get('/api/auth/me');
      return response.data;
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  },
};

export default api;
