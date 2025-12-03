
import React, { useState, useMemo } from 'react';
import { User, UserHistoryItem, LtvCategory } from '../types';
import { X, User as UserIcon, Calendar, Zap, Gamepad2, Heart, MessageSquare, Trophy, Activity, Target } from 'lucide-react';
import { getUserActivityLog } from '../services/userService';

interface UserProfileModalProps {
  user: User;
  onClose: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, onClose }) => {
  const [activeTab, setActiveTab] = useState<'activity' | 'stats'>('activity');
  
  // Генерируем историю при открытии
  const history = useMemo(() => getUserActivityLog(user), [user]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getCategoryIcon = (cat: LtvCategory) => {
      switch(cat) {
          case LtvCategory.GAME: return <Gamepad2 size={16} className="text-purple-500" />;
          case LtvCategory.SOCIAL: return <Heart size={16} className="text-pink-500" />;
          case LtvCategory.REACTION: return <MessageSquare size={16} className="text-blue-500" />;
          case LtvCategory.TRIGGER: return <Target size={16} className="text-green-500" />;
          default: return <Activity size={16} className="text-gray-500" />;
      }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-start">
            <div className="flex gap-4">
                <div className="relative">
                    <img src={user.photo_url} alt="" className="w-16 h-16 rounded-full border-4 border-white shadow-sm" />
                    <div className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold border-2 border-white ${
                        user.segment === 'HOT' ? 'bg-red-500 text-white' : 
                        user.segment === 'WARM' ? 'bg-orange-400 text-white' : 'bg-blue-400 text-white'
                    }`}>
                        {user.segment}
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-gray-900">{user.first_name} {user.last_name}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                        <span className="font-mono">ID: {user.vk_id}</span>
                        <span className="text-gray-300">•</span>
                        {user.social_stats.is_member ? 'Подписчик' : 'Гость'}
                    </p>
                    <div className="mt-2 flex gap-3 text-xs font-medium">
                        <span className="px-2 py-1 bg-white border border-gray-200 rounded text-gray-600 flex items-center gap-1">
                            <Trophy size={12} className="text-yellow-500" /> LTV: {user.ltv_stats.total}
                        </span>
                        <span className="px-2 py-1 bg-white border border-gray-200 rounded text-gray-600 flex items-center gap-1">
                            <Calendar size={12} className="text-gray-400" /> Актив: {new Date(user.last_active).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
            <button 
                onClick={() => setActiveTab('activity')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'activity' ? 'border-pizza-red text-pizza-red' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                Лента активности
            </button>
            <button 
                onClick={() => setActiveTab('stats')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'stats' ? 'border-pizza-red text-pizza-red' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                Детали LTV
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
            
            {activeTab === 'activity' && (
                <div className="space-y-4">
                    {history.length > 0 ? (
                        history.map((item) => (
                            <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex gap-3 items-center">
                                <div className={`p-2 rounded-full bg-gray-50 border border-gray-100`}>
                                    {getCategoryIcon(item.category)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-800">{item.description}</p>
                                    <p className="text-xs text-gray-400">{formatDate(item.date)}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-sm font-bold ${item.value_change > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                        +{item.value_change}
                                    </span>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{item.category}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 text-gray-400">Нет активности</div>
                    )}
                </div>
            )}

            {activeTab === 'stats' && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Структура LTV</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 flex items-center gap-2"><Gamepad2 size={14} className="text-purple-500"/> Игры</span>
                                <span className="font-bold text-gray-900">{user.ltv_stats.game}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 flex items-center gap-2"><Heart size={14} className="text-pink-500"/> Соц. актив</span>
                                <span className="font-bold text-gray-900">{user.ltv_stats.social}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 flex items-center gap-2"><MessageSquare size={14} className="text-blue-500"/> Реакции</span>
                                <span className="font-bold text-gray-900">{user.ltv_stats.reaction}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 flex items-center gap-2"><Target size={14} className="text-green-500"/> Триггеры</span>
                                <span className="font-bold text-gray-900">{user.ltv_stats.trigger}</span>
                            </div>
                            <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                                <span className="font-bold text-gray-900">Всего</span>
                                <span className="font-bold text-pizza-red text-lg">{user.ltv_stats.total}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Статистика</h4>
                        <div className="space-y-2 text-sm">
                            <p>Лайков: <span className="font-bold">{user.social_stats.likes}</span></p>
                            <p>Комментариев: <span className="font-bold">{user.social_stats.comments}</span></p>
                            <p>Репостов: <span className="font-bold">{user.social_stats.reposts}</span></p>
                            <p>Игр сыграно: <span className="font-bold">{user.games_played}</span></p>
                        </div>
                    </div>
                </div>
            )}

        </div>
        
        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-2">
            <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                Написать сообщение
            </button>
            <button className="px-4 py-2 bg-pizza-red hover:bg-pizza-dark text-white rounded-lg text-sm font-bold transition-colors">
                Выдать бонус
            </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;