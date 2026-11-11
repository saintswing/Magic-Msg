import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Sender } from './pages/Sender';
import { Receiver } from './pages/Receiver';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Sender />} />
          <Route path="receiver" element={<Receiver />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
