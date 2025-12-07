import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CRM from './pages/CRM';
import Campaigns from './pages/Campaigns';
import Games from './pages/Games';
import Settings from './pages/Settings';
import { fetchUsers } from './services/userService';
import { User } from './types';

const PAGE_SIZE = 50;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    loadUsers(0);
  }, []);

  const loadUsers = async (pageIndex: number) => {
    const offset = pageIndex * PAGE_SIZE;
    const { users: apiUsers } = await fetchUsers(PAGE_SIZE, offset);
    setUsers(apiUsers);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard users={users} />;
      case 'crm': return <CRM users={users} />;
      case 'campaigns': return <Campaigns />;
      case 'games': return <Games users={users} reloadUsers={() => loadUsers(0)} />;
      case 'settings': return <Settings />;
      default: return <Dashboard users={users} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

export default App;
