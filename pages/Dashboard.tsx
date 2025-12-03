
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  AreaChart, Area, Cell, PieChart, Pie 
} from 'recharts';
import { Users, Activity, Zap, Trophy, Clock, Heart, MessageSquare, UserPlus, Loader2 } from 'lucide-react';
import { User, UserSegment, TimePeriod } from '../types';
import { mockCampaigns } from '../services/mockData';
import { isDateInPeriod, getPeriodLabel, getDaysForPeriod } from '../utils/dateHelpers';

interface DashboardProps {
  users: User[];
}

// 1. Определяем контракт данных, которые мы ждем от Бэкенда
interface DashboardData {
  kpi: {
    totalSubscribers: number;
    newSubscribers: number;
    activeUsers: number;
    avgLTV: number;
    hotUsers: number;
  };
  charts: {
    activity: any[];
    ltvStructure: any[];
  };
  lists: {
    topUsers: User[];
    socialStats: {
        likes: number;
        comments: number;
        newMembers: number;
    }
  };
}

const Dashboard: React.FC<DashboardProps> = ({ users }) => {
  const [period, setPeriod] = useState<TimePeriod>('7d');
  
  // 2. Состояние для данных и загрузки
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 3. Эмуляция запроса к API (Backend Logic)
  // В будущем замените это на: const response = await fetch(`/api/dashboard?period=${period}`);
  const fakeApiFetch = (selectedPeriod: TimePeriod): Promise<DashboardData> => {
    return new Promise((resolve) => {
      // Имитация задержки сети
      setTimeout(() => {
        // --- ЛОГИКА БЭКЕНДА НАЧАЛО ---
        
        // 1. KPI
        const activeUsersCount = users.filter(u => isDateInPeriod(u.last_active, selectedPeriod)).length;
        const totalLTV = users.reduce((acc, user) => acc + user.ltv_stats.total, 0);
        const totalUsers = users.length;
        const avgLTV = totalUsers > 0 ? Math.round(totalLTV / totalUsers) : 0;
        const hotUsers = users.filter(u => u.segment === UserSegment.HOT).length;
        const totalSubscribers = users.filter(u => u.social_stats.is_member).length;
        
        // 2. Графики (Activity)
        const activityData = [];
        const days = getDaysForPeriod(selectedPeriod);
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (days - 1 - i));
            let label = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            if (selectedPeriod === '1d') label = `${date.getHours()}:00`; 
            
            activityData.push({
            date: label,
            activeUsers: Math.floor(Math.random() * 50) + 20,
            likes: Math.floor(Math.random() * 30) + 5
            });
        }

        // 3. Графики (LTV Structure)
        const ltvCategoriesData = [
            { name: 'Игры', value: users.reduce((acc, u) => acc + u.ltv_stats.game, 0), color: '#8B5CF6' },
            { name: 'Реакции', value: users.reduce((acc, u) => acc + u.ltv_stats.reaction, 0), color: '#3B82F6' },
            { name: 'Триггеры', value: users.reduce((acc, u) => acc + u.ltv_stats.trigger, 0), color: '#10B981' },
            { name: 'Соц.Актив', value: users.reduce((acc, u) => acc + u.ltv_stats.social, 0), color: '#EC4899' },
        ];

        // 4. Списки
        const topUsers = [...users].sort((a, b) => b.ltv_stats.total - a.ltv_stats.total).slice(0, 5);
        
        // Соц статистика (эмуляция за период)
        const totalLikes = users.reduce((acc, u) => acc + u.social_stats.likes, 0);
        const factor = (getDaysForPeriod(selectedPeriod) / 365) * 5; // Простая формула для демо
        const estimatedLikes = Math.floor(totalLikes * factor);

        const response: DashboardData = {
            kpi: {
                totalSubscribers,
                newSubscribers: Math.floor(totalSubscribers * 0.05),
                activeUsers: activeUsersCount,
                avgLTV,
                hotUsers
            },
            charts: {
                activity: activityData,
                ltvStructure: ltvCategoriesData
            },
            lists: {
                topUsers,
                socialStats: {
                    likes: estimatedLikes,
                    comments: Math.floor(estimatedLikes / 4),
                    newMembers: Math.floor(estimatedLikes / 10)
                }
            }
        };
        // --- ЛОГИКА БЭКЕНДА КОНЕЦ ---

        resolve(response);
      }, 600); // Задержка 600мс
    });
  };

  // 4. Эффект для загрузки данных при смене периода
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fakeApiFetch(period).then(data => {
        if (isMounted) {
            setStats(data);
            setIsLoading(false);
        }
    });

    return () => { isMounted = false; };
  }, [period, users]);

  // UI Загрузки
  if (isLoading || !stats) {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
              <Loader2 size={40} className="animate-spin text-pizza-red mb-4" />
              <p>Загрузка аналитики...</p>
          </div>
      );
  }

  // UI Дашборда (Отрисовка)
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Обзор показателей</h2>
            <p className="text-sm text-gray-500">Аналитика активности и вовлеченности</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
             <Clock size={16} className="text-gray-400 ml-2" />
             <select 
                value={period}
                onChange={(e) => setPeriod(e.target.value as TimePeriod)}
                className="bg-transparent text-sm font-medium text-gray-700 py-1.5 pr-8 pl-2 focus:outline-none cursor-pointer"
             >
                 <option value="1d">За 24 часа</option>
                 <option value="7d">За 7 дней</option>
                 <option value="14d">За 14 дней</option>
                 <option value="1m">За 30 дней</option>
                 <option value="3m">За 3 месяца</option>
                 <option value="ALL">За всё время</option>
             </select>
          </div>
      </div>

      {/* 1. Верхний ряд: KPI Карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Карточка 1: Всего подписчиков */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Подписчики группы</p>
              <h3 className="text-3xl font-bold mt-2 text-gray-900">{stats.kpi.totalSubscribers}</h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Users size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs font-medium text-green-600 bg-green-50 w-fit px-2 py-1 rounded">
            <UserPlus size={14} className="mr-1" /> {stats.kpi.newSubscribers} новых
          </div>
        </div>

        {/* Карточка 2: Активные (Live) */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Активные ({getPeriodLabel(period)})</p>
              <h3 className="text-3xl font-bold mt-2 text-gray-900">{stats.kpi.activeUsers}</h3>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Activity size={24} />
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-400">
            Совершали действия в этот период
          </div>
        </div>

        {/* Карточка 3: Средний LTV */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Средний LTV</p>
              <h3 className="text-3xl font-bold mt-2 text-gray-900">{stats.kpi.avgLTV} <span className="text-base font-normal text-gray-400">баллов</span></h3>
            </div>
            <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600">
              <Zap size={24} />
            </div>
          </div>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5">
             <div className="bg-yellow-500 h-1.5 rounded-full" style={{width: '70%'}}></div>
          </div>
        </div>

        {/* Карточка 4: Горячий сегмент */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Горячий сегмент</p>
              <h3 className="text-3xl font-bold mt-2 text-pizza-red">{stats.kpi.hotUsers}</h3>
            </div>
            <div className="p-2 bg-red-50 rounded-lg text-pizza-red">
              <Trophy size={24} />
            </div>
          </div>
           <div className="mt-4 text-xs text-gray-400">
            Самая ценная аудитория
          </div>
        </div>
      </div>

      {/* 2. Средний ряд: Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* График 1: Активность (Area Chart) - занимает 2/3 */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <h4 className="text-lg font-bold text-gray-900">Динамика активности</h4>
             <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded text-gray-500">
                 {getPeriodLabel(period)}
             </span>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.charts.activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="date" stroke="#9CA3AF" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="#9CA3AF" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Area type="monotone" dataKey="activeUsers" stroke="#DC2626" strokeWidth={2} fillOpacity={1} fill="url(#colorActive)" name="Активные" />
                <Area type="monotone" dataKey="likes" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorLikes)" name="Лайки" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* График 2: Структура LTV (Bar Chart) - занимает 1/3 */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col">
          <h4 className="text-lg font-bold text-gray-900 mb-2">Источники ценности</h4>
          <p className="text-xs text-gray-500 mb-4">Суммарный LTV по всем пользователям</p>
          <div className="flex-1 min-h-0">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.charts.ltvStructure} layout="vertical" margin={{ left: -20 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                   <RechartsTooltip cursor={{fill: 'transparent'}} />
                   <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                      {stats.charts.ltvStructure.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                   </Bar>
                </BarChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Нижний ряд: Таблицы и списки */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Блок: Топ Пользователи */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
           <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
               <Trophy size={20} className="text-yellow-500" />
               Топ-5 Пользователей по LTV
           </h4>
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                 <tr>
                   <th className="px-3 py-2 rounded-l-lg">Имя</th>
                   <th className="px-3 py-2">Сегмент</th>
                   <th className="px-3 py-2 text-right rounded-r-lg">LTV Total</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {stats.lists.topUsers.map((user, idx) => (
                   <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                     <td className="px-3 py-3 font-medium text-gray-900 flex items-center gap-2">
                        <span className="text-gray-400 w-4">{idx + 1}.</span>
                        <img src={user.photo_url} className="w-6 h-6 rounded-full" alt=""/>
                        {user.first_name} {user.last_name}
                     </td>
                     <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            user.segment === UserSegment.HOT ? 'bg-red-100 text-red-700' :
                            user.segment === UserSegment.WARM ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                            {user.segment}
                        </span>
                     </td>
                     <td className="px-3 py-3 text-right font-bold text-pizza-red">
                        {user.ltv_stats.total}
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>

        {/* Блок: Социальная активность */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
               <Heart size={20} className="text-pink-500" />
               Социальная активность ({getPeriodLabel(period)})
           </h4>
           <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-pink-50 rounded-xl text-center">
                  <Heart className="mx-auto text-pink-500 mb-2" size={24} />
                  <div className="text-2xl font-bold text-gray-900">{stats.lists.socialStats.likes}</div>
                  <div className="text-xs text-gray-500 font-medium">Лайков</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl text-center">
                  <MessageSquare className="mx-auto text-blue-500 mb-2" size={24} />
                  <div className="text-2xl font-bold text-gray-900">{stats.lists.socialStats.comments}</div>
                  <div className="text-xs text-gray-500 font-medium">Комментов</div>
              </div>
              <div className="p-4 bg-green-50 rounded-xl text-center">
                  <UserPlus className="mx-auto text-green-500 mb-2" size={24} />
                  <div className="text-2xl font-bold text-gray-900">{stats.lists.socialStats.newMembers}</div>
                  <div className="text-xs text-gray-500 font-medium">Новых подписчиков</div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
