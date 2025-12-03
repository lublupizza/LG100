import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  AreaChart, Area, Cell, PieChart, Pie 
} from 'recharts';
import { Users, Activity, Zap, Trophy, Clock, Heart, MessageSquare, UserPlus, Loader2 } from 'lucide-react';
import { isDateInPeriod, getPeriodLabel, getDaysForPeriod } from '../utils/dateHelpers';

const Dashboard = ({ users }) => {
  const [period, setPeriod] = useState('7d');
  const [stats, setStats] = useState(null);

  // Функция пересчета данных (теперь работает на клиенте с реальными users)
  useEffect(() => {
    // 1. KPI
    const activeUsersCount = users.length; // Пока считаем всех, кто есть в базе
    const totalUsers = users.length;
    
    // 2. Графики (Считаем РЕАЛЬНУЮ активность по дате регистрации)
    const activityData = [];
    const days = getDaysForPeriod(period);
    const now = new Date();

    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(now.getDate() - (days - 1 - i));
        const dateStr = date.toISOString().split('T')[0]; // "2025-12-03"
        const label = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

        // Считаем, сколько юзеров пришло в этот день
        const count = users.filter(u => u.last_active && u.last_active.startsWith(dateStr)).length;
        
        activityData.push({
          date: label,
          activeUsers: count, 
          likes: 0 // Лайки пока по нулям, т.к. нет базы событий
        });
    }

    const ltvCategoriesData = [
        { name: 'Игры', value: users.reduce((acc, u) => acc + (u.games_played * 10), 0), color: '#8B5CF6' },
        { name: 'Реакции', value: 0, color: '#3B82F6' },
    ];

    setStats({
        kpi: {
            totalSubscribers: totalUsers,
            newSubscribers: 0,
            activeUsers: activeUsersCount,
            avgLTV: 0,
            hotUsers: 0
        },
        charts: { activity: activityData, ltvStructure: ltvCategoriesData },
        lists: { topUsers: users.slice(0, 5), socialStats: { likes: 0, comments: 0, newMembers: 0 } }
    });

  }, [period, users]); // Пересчитываем, когда приходят новые юзеры

  if (!stats) return <div className="p-10 text-center">Загрузка...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Шапка */}
      <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Обзор показателей</h2>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-white border p-2 rounded">
             <option value="7d">7 дней</option>
             <option value="30d">30 дней</option>
          </select>
      </div>

      {/* Карточки KPI */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <p className="text-gray-500">Всего пользователей</p>
          <h3 className="text-3xl font-bold">{stats.kpi.totalSubscribers}</h3>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <p className="text-gray-500">Активные ({getPeriodLabel(period)})</p>
          <h3 className="text-3xl font-bold">{stats.kpi.activeUsers}</h3>
        </div>
         <div className="bg-white p-6 rounded-xl border shadow-sm">
          <p className="text-gray-500">Сыграно игр</p>
          <h3 className="text-3xl font-bold text-purple-600">
            {users.reduce((acc, u) => acc + u.games_played, 0)}
          </h3>
        </div>
      </div>

      {/* График Активности */}
      <div className="bg-white p-6 rounded-xl border shadow-sm h-80">
        <h4 className="font-bold mb-4">Динамика регистраций</h4>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stats.charts.activity}>
            <defs>
              <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#DC2626" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#DC2626" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" />
            <YAxis />
            <RechartsTooltip />
            <Area type="monotone" dataKey="activeUsers" stroke="#DC2626" fill="url(#colorActive)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Таблица */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
         <h4 className="font-bold mb-4">Последние пользователи</h4>
         {users.length === 0 ? <p>Нет данных</p> : (
             <table className="w-full text-left">
               <thead><tr className="text-gray-500 border-b"><th>ID</th><th>Имя</th><th>Игр</th></tr></thead>
               <tbody>
                 {users.slice(0, 10).map(u => (
                   <tr key={u.id} className="border-b">
                     <td className="py-2">{u.vk_id}</td>
                     <td>{u.first_name} {u.last_name}</td>
                     <td>{u.games_played}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
         )}
      </div>
    </div>
  );
};

export default Dashboard;
