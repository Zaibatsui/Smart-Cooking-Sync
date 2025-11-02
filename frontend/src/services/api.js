import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export default api;
