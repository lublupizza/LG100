import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CRM from './pages/CRM';
import Campaigns from './pages/campaigns';
import Games from './pages/Games';
import Settings from './pages/Settings';

const adaptUser = (dbUser) => {
  return {
    id: dbUser.id,
    vk_id: dbUser.vkId,
    first_name: dbUser.firstName || 'Пользователь',
    last_name: dbUser.lastName || '#' + dbUser.vkId,
    photo_url: 'https://via.placeholder.com/50',
    segment: 'COLD',
    ltv_stats: { total: 0, game: 0, reaction: 0, social: 0, trigger: 0 },
    social_stats: { likes: 0, comments: 0, reposts: 0, is_member: dbUser.isSubscribed !== false },
    games_played: dbUser.games ? dbUser.games.length : 0,
    last_active: dbUser.createdAt,
    source: 'bot',
    games: dbUser.games, // <--- Прокидываем игры дальше
    is_subscribed: dbUser.isSubscribed !== false,
    unsubscribed_at: dbUser.unsubscribedAt || null,
  };
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        const realUsers = data.map(adaptUser);
        setUsers(realUsers);
      })
      .catch(err => console.error("Ошибка API:", err));
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard users={users} />;
      case 'crm': return <CRM users={users} />;
      case 'campaigns': return <Campaigns />;
      case 'games': return <Games users={users} />; // <--- ПЕРЕДАЕМ ДАННЫЕ СЮДА
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
