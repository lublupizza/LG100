
import React from 'react';
import { LayoutDashboard, Users, Gamepad2, Send, Settings, Menu, Pizza } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Дашборд', icon: <LayoutDashboard size={20} /> },
    { id: 'crm', label: 'CRM / Клиенты', icon: <Users size={20} /> },
    { id: 'games', label: 'Игры', icon: <Gamepad2 size={20} /> },
    { id: 'campaigns', label: 'Рассылки', icon: <Send size={20} /> },
    { id: 'settings', label: 'Настройки', icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-pizza-bg text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-gray-200 bg-white shadow-sm">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-pizza-red font-bold text-xl tracking-tight">
            <Pizza size={24} />
            <span>Люблю Pizza</span>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors font-medium ${
                    activeTab === item.id 
                      ? 'bg-red-50 text-pizza-red' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pizza-red text-white flex items-center justify-center font-bold shadow-sm">
              A
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Администратор</p>
              <p className="text-xs text-gray-500">Super User</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-pizza-bg">
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800">
            {menuItems.find(i => i.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-green-600 flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full border border-green-100">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Бот активен
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
