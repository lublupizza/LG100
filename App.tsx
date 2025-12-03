import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CRM from './pages/CRM';
import Campaigns from './pages/Campaigns';
import Games from './pages/Games';
import Settings from './pages/Settings';
import { mockUsers } from './services/mockData';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard users={mockUsers} />;
      case 'crm':
        return <CRM users={mockUsers} />;
      case 'campaigns':
        return <Campaigns />;
      case 'games':
        return <Games />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard users={mockUsers} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

export default App;