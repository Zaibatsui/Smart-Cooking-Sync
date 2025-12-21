import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);

  // Verify token and get user data on mount
  const verifyToken = useCallback(async () => {
    const storedToken = localStorage.getItem('auth_token');
    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      // Set token in api headers
      api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      
      // Verify token by calling /auth/me
      const response = await api.get('/api/auth/me');
      setUser(response.data);
      setToken(storedToken);
    } catch (error) {
      console.error('Token verification failed:', error);
      // Token is invalid, clear it
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      delete api.defaults.headers.common['Authorization'];
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  // Login with Google ID token
  const loginWithGoogle = async (googleCredential) => {
    try {
      const response = await api.post('/api/auth/google', {
        credential: googleCredential
      });

      const { access_token, user: userData } = response.data;

      // Store token and user
      localStorage.setItem('auth_token', access_token);
      localStorage.setItem('auth_user', JSON.stringify(userData));
      
      // Set token in api headers
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      setToken(access_token);
      setUser(userData);

      return { success: true, user: userData };
    } catch (error) {
      console.error('Google login failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  }, []);

  // Check if user is authenticated
  const isAuthenticated = !!token && !!user;

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    loginWithGoogle,
    logout,
    verifyToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
