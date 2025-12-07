
import React, { useState } from 'react';
import { User, UserSegment, LtvCategory, TimePeriod } from '../types';
import { filterUsersByLtv } from '../services/ltvEngine';
import { exportUsersToCsv } from '../utils/csvExporter';
import { Search, MoreHorizontal, MessageCircle, TrendingUp, Gamepad2, Heart, Zap, Download, ThumbsUp, Users, MessageSquare, Share2, Clock, Filter, Eye } from 'lucide-react';
import UserProfileModal from '../components/UserProfileModal';

interface CRMProps {
  users: User[];
}

const CRM: React.FC<CRMProps> = ({ users }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // --- Filters State ---
  const [filterSegment, setFilterSegment] = useState<UserSegment | 'ALL'>('ALL');
  const [filterPeriod, setFilterPeriod] = useState<TimePeriod>('ALL');
  
  // LTV Numeric Filters
  const [ltvFilterType, setLtvFilterType] = useState<LtvCategory | 'TOTAL' | 'SOCIAL_LIKES' | 'SOCIAL_REPOSTS'>('TOTAL');
  const [ltvMin, setLtvMin] = useState<string>('');
  
  // Booleans
  const [filterIsMember, setFilterIsMember] = useState<boolean | 'ALL'>('ALL');
  const [filterHasPlayed, setFilterHasPlayed] = useState<boolean | 'ALL'>('ALL');

  const formatUnsubscribed = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (err) {
        return '';
    }
  };

  // --- Filter Application Logic ---
  const applyFilters = () => {
    // 1. Basic Text & Segment
    let filtered = users.filter(user => {
      const matchesSearch = 
        user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.last_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSegment = filterSegment === 'ALL' || user.segment === filterSegment;
      return matchesSearch && matchesSegment;
    });

    // 2. Advanced LTV & Activity Filters
    const ltvFilters = {
      period: filterPeriod,
      
      // Numeric mapping based on dropdown
      ltv_total_min: ltvFilterType === 'TOTAL' && ltvMin ? parseInt(ltvMin) : undefined,
      ltv_game_min: ltvFilterType === LtvCategory.GAME && ltvMin ? parseInt(ltvMin) : undefined,
      ltv_social_min: ltvFilterType === LtvCategory.SOCIAL && ltvMin ? parseInt(ltvMin) : undefined,
      
      // Social Specific
      min_likes: ltvFilterType === 'SOCIAL_LIKES' && ltvMin ? parseInt(ltvMin) : undefined,
      min_reposts: ltvFilterType === 'SOCIAL_REPOSTS' && ltvMin ? parseInt(ltvMin) : undefined,
      
      // Booleans
      is_member: filterIsMember === 'ALL' ? undefined : filterIsMember,
      has_played: filterHasPlayed === 'ALL' ? undefined : filterHasPlayed
    };

    return filterUsersByLtv(filtered, ltvFilters);
  };

  const finalUsers = applyFilters();

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `pizza_audience_${filterSegment}_${filterPeriod}_${dateStr}.csv`;
    exportUsersToCsv(finalUsers, filename);
  };

  const getSegmentBadge = (segment: UserSegment) => {
    switch (segment) {
      case UserSegment.COLD: return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">Холодный</span>;
      case UserSegment.WARM: return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100">Тёплый</span>;
      case UserSegment.HOT: return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">Горячий</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
        
        {/* Row 1: Search & Main Buttons */}
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center border-b border-gray-100 pb-4">
           <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Поиск по имени..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-pizza-red text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex gap-2">
                <button onClick={() => setFilterSegment('ALL')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterSegment === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Все</button>
                <button onClick={() => setFilterSegment(UserSegment.COLD)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterSegment === UserSegment.COLD ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-600 hover:bg-blue-50'}`}>Холодные</button>
                <button onClick={() => setFilterSegment(UserSegment.WARM)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterSegment === UserSegment.WARM ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-600 hover:bg-orange-50'}`}>Тёплые</button>
                <button onClick={() => setFilterSegment(UserSegment.HOT)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterSegment === UserSegment.HOT ? 'bg-red-100 text-red-700' : 'bg-gray-50 text-gray-600 hover:bg-red-50'}`}>Горячие</button>
            </div>
        </div>

        {/* Row 2: Advanced Filters */}
        <div className="flex flex-wrap gap-3 items-center">
            
            {/* Period Filter */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 h-[42px]">
                 <Clock size={16} className="text-gray-400" />
                 <select 
                    value={filterPeriod}
                    onChange={(e) => setFilterPeriod(e.target.value as TimePeriod)}
                    className="bg-transparent text-sm text-gray-700 focus:outline-none cursor-pointer"
                 >
                     <option value="ALL">За всё время</option>
                     <option value="7d">Активны: 7 дней</option>
                     <option value="30d">Активны: 30 дней</option>
                 </select>
            </div>

            {/* Numeric Thresholds */}
            <div className="flex items-center gap-0 bg-gray-50 border border-gray-200 rounded-lg shadow-sm h-[42px] overflow-hidden">
                <div className="px-3 bg-gray-100 border-r border-gray-200 h-full flex items-center text-gray-500">
                    <Filter size={16} />
                </div>
                <input 
                    type="number" 
                    placeholder="0"
                    className="w-16 bg-transparent py-2 pl-3 text-sm focus:outline-none text-gray-900 font-medium"
                    value={ltvMin}
                    onChange={(e) => setLtvMin(e.target.value)}
                />
                <select 
                    className="bg-transparent border-l border-gray-200 px-3 py-2 text-sm focus:outline-none text-gray-700 cursor-pointer h-full"
                    value={ltvFilterType}
                    onChange={(e) => setLtvFilterType(e.target.value as any)}
                >
                    <option value="TOTAL">Мин. LTV (Общий)</option>
                    <option value={LtvCategory.GAME}>Мин. LTV (Игры)</option>
                    <option value={LtvCategory.SOCIAL}>Мин. LTV (Соц)</option>
                    <option value="SOCIAL_LIKES">Мин. Лайков</option>
                    <option value="SOCIAL_REPOSTS">Мин. Репостов</option>
                </select>
            </div>

            {/* Booleans: Membership & Games */}
            <select
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-gray-700 shadow-sm cursor-pointer h-[42px]"
                value={filterIsMember === 'ALL' ? 'ALL' : filterIsMember ? 'YES' : 'NO'}
                onChange={(e) => setFilterIsMember(e.target.value === 'ALL' ? 'ALL' : e.target.value === 'YES')}
            >
                <option value="ALL">Подписка: Любая</option>
                <option value="YES">Подписан</option>
                <option value="NO">Не подписан</option>
            </select>

            <select
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-gray-700 shadow-sm cursor-pointer h-[42px]"
                value={filterHasPlayed === 'ALL' ? 'ALL' : filterHasPlayed ? 'YES' : 'NO'}
                onChange={(e) => setFilterHasPlayed(e.target.value === 'ALL' ? 'ALL' : e.target.value === 'YES')}
            >
                <option value="ALL">Играл: Не важно</option>
                <option value="YES">Играл в игры</option>
                <option value="NO">Не играл</option>
            </select>

            <div className="flex-1"></div>

            <button 
                onClick={handleExport}
                className="flex items-center gap-2 bg-pizza-red hover:bg-pizza-dark text-white border border-transparent px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95"
            >
                <Download size={18} />
                <span>Скачать CSV</span>
            </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Клиент</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Сегмент / Статус</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">LTV Баллы</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Активность (Соц/Игры)</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {finalUsers.map((user) => (
                <tr 
                    key={user.id} 
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedUser(user)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                          <img src={user.photo_url} alt="" className="w-10 h-10 rounded-full bg-gray-200 object-cover" />
                          {user.social_stats.is_member && (
                              <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full">
                                  <div className="bg-blue-500 p-[2px] rounded-full" title="Подписан на группу">
                                      <Users size={8} className="text-white" />
                                  </div>
                              </div>
                          )}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 group-hover:text-pizza-red transition-colors">{user.first_name} {user.last_name}</div>
                        <div className="text-xs text-gray-500">ID: {user.vk_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                        {getSegmentBadge(user.segment)}
                        {user.is_subscribed ? (
                            <span className="text-[10px] text-gray-500 flex items-center gap-1"><Users size={10}/> Подписан</span>
                        ) : (
                            <span className="text-[10px] text-red-500 flex items-center gap-1" title={formatUnsubscribed(user.unsubscribed_at)}>
                                <Users size={10}/> Отписан{user.unsubscribed_at ? ` · ${formatUnsubscribed(user.unsubscribed_at)}` : ''}
                            </span>
                        )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 font-bold text-gray-800 text-lg leading-none">
                            {user.ltv_stats.total} 
                            {user.ltv_stats.total >= 50 && <TrendingUp size={16} className="text-pizza-red" />}
                        </div>
                        <div className="text-[10px] text-gray-400">
                           Intent: <span className="text-gray-600 font-bold">{user.ltv_stats.trigger}</span>
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-3 text-xs text-gray-600 font-medium">
                            <span className="flex items-center gap-1" title="Лайки"><ThumbsUp size={14} className="text-blue-500" /> {user.social_stats.likes}</span>
                            <span className="flex items-center gap-1" title="Репосты"><Share2 size={14} className="text-purple-500" /> {user.social_stats.reposts}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Gamepad2 size={14} className={user.games_played > 0 ? "text-green-600" : "text-gray-300"} />
                            <span>Игр: {user.games_played}</span>
                        </div>
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedUser(user); }}
                          className="p-2 text-gray-400 hover:text-pizza-red hover:bg-red-50 rounded-lg transition-colors" 
                          title="Профиль"
                      >
                         <Eye size={18} />
                      </button>
                      <button 
                          onClick={(e) => e.stopPropagation()} 
                          className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" 
                          title="Управление"
                      >
                         <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {finalUsers.length === 0 && (
              <div className="p-12 text-center flex flex-col items-center gap-2 text-gray-400">
                  <Filter size={32} className="opacity-20" />
                  <p>Клиенты не найдены под выбранные фильтры</p>
              </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 text-sm text-gray-500 flex justify-between bg-gray-50">
            <span>Показано {finalUsers.length} из {users.length} клиентов</span>
        </div>
      </div>

      {/* MODAL */}
      {selectedUser && (
          <UserProfileModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
};

export default CRM;