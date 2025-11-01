import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CookingSync from './pages/CookingSync';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CookingSync />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;