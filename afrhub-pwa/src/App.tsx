import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAppStore from './store/appStore';
import syncService from './services/sync';

// Layout
import MainLayout from './components/MainLayout';

// Pages
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Clients from './pages/Clients';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import ChatReports from './pages/ChatReports';
import Settings from './pages/Settings';
import Login from './pages/Login';

function App() {
  const { isAuthenticated, isOnline, setPendingSyncCount } = useAppStore();

  useEffect(() => {
    // Start auto-sync when app loads
    syncService.startAutoSync(30000);

    // Update pending sync count periodically
    const interval = setInterval(async () => {
      const pending = await import('./services/database').then(m => m.db.syncQueue.where('status').equals('pending').count());
      setPendingSyncCount(pending);
    }, 5000);

    return () => clearInterval(interval);
  }, [setPendingSyncCount]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/" element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="sales" element={<Sales />} />
          <Route path="clients" element={<Clients />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="reports" element={<Reports />} />
          <Route path="chat" element={<ChatReports />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      
      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <span className="text-lg">📴</span>
          <span>You're offline - Changes will sync when online</span>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;
