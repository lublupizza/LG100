
import React, { useState } from 'react';
import { Campaign, UserSegment, CampaignType, TimePeriod } from '../types';
import { mockCampaigns } from '../services/mockData';
import { launchCampaign, recalculateGameStats } from '../services/campaignService';
import { getCampaignFunnel } from '../services/campaignTrackingService';
import { Send, Plus, Calendar, Gamepad2, Play, Clock, Eye, Activity, Flame, ChevronRight } from 'lucide-react';
import { isDateInPeriod } from '../utils/dateHelpers';

const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns);
  const [period, setPeriod] = useState<TimePeriod>('7d'); 
  
  const [isCreating, setIsCreating] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: CampaignType.STANDARD,
    segment: 'ALL',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const camp: Campaign = {
        id: `c${Date.now()}`,
        name: newCampaign.name,
        type: newCampaign.type,
        segment_target: newCampaign.segment as UserSegment | 'ALL',
        message: newCampaign.message,
        status: 'SCHEDULED',
        stats: { sent: 0, delivered: 0, clicked: 0 },
        created_at: new Date().toISOString().split('T')[0]
    };
    setCampaigns([camp, ...campaigns]);
    setIsCreating(false);
    setNewCampaign({ name: '', type: CampaignType.STANDARD, segment: 'ALL', message: '' });
  };

  const handleLaunch = async (id: string) => {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;

    if(confirm('Запустить рассылку сейчас?')) {
        const updatedCampaign = await launchCampaign(campaign, {
          segment_target: campaign.segment_target,
        });
        if (updatedCampaign) {
            setCampaigns(prev => prev.map(c => c.id === id ? updatedCampaign : c));
        }
    }
  };

  const filteredCampaigns = campaigns.filter(c => isDateInPeriod(c.created_at, period));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h3 className="text-xl font-bold text-gray-900">Рассылки и Пуши</h3>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex-1 md:flex-none">
                 <Clock size={16} className="text-gray-400" />
                 <select 
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as TimePeriod)}
                    className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer w-full"
                 >
                     <option value="1d">За 24 часа</option>
                     <option value="7d">За 7 дней</option>
                     <option value="14d">За 14 дней</option>
                     <option value="1m">За 30 дней</option>
                     <option value="3m">За 3 месяца</option>
                     <option value="ALL">За всё время</option>
                 </select>
             </div>

            <button 
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 bg-pizza-red hover:bg-pizza-dark text-white px-5 py-2 rounded-lg font-semibold transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus size={18} /> <span className="hidden sm:inline">Создать</span>
            </button>
        </div>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
          <h4 className="text-lg font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2">Новая рассылка</h4>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Название</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none transition-all"
                  value={newCampaign.name}
                  onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
                  placeholder="Например: Битва за скидку"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Тип кампании</label>
                <select 
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none transition-all"
                  value={newCampaign.type}
                  onChange={e => setNewCampaign({...newCampaign, type: e.target.value as CampaignType})}
                >
                  <option value={CampaignType.STANDARD}>Обычная (Текст/Картинка)</option>
                  <option value={CampaignType.GAME_BATTLESHIP}>Игровая (Морской Бой)</option>
                </select>
              </div>
            </div>
            
            <div>
               <label className="block text-sm font-semibold text-gray-700 mb-1.5">Сегмент получателей</label>
               <select 
                 className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none transition-all"
                 value={newCampaign.segment}
                 onChange={e => setNewCampaign({...newCampaign, segment: e.target.value})}
               >
                 <option value="ALL">Все пользователи</option>
                 <option value={UserSegment.COLD}>Только холодные</option>
                 <option value={UserSegment.WARM}>Только тёплые</option>
                 <option value={UserSegment.HOT}>Только горячие</option>
               </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {newCampaign.type === CampaignType.GAME_BATTLESHIP ? 'Стартовое сообщение игры' : 'Текст сообщения'}
              </label>
              <textarea 
                required
                rows={3}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none transition-all resize-none"
                value={newCampaign.message}
                onChange={e => setNewCampaign({...newCampaign, message: e.target.value})}
                placeholder={newCampaign.type === CampaignType.GAME_BATTLESHIP ? "Капитан, враг на горизонте! Пиши A1 чтобы стрелять..." : "Текст..."}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => setIsCreating(false)}
                className="px-5 py-2.5 text-gray-600 hover:text-gray-900 font-medium"
              >
                Отмена
              </button>
              <button 
                type="submit" 
                className="bg-pizza-red hover:bg-pizza-dark text-white px-6 py-2.5 rounded-lg font-semibold shadow-sm transition-colors"
              >
                Создать
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filteredCampaigns.length > 0 ? filteredCampaigns.map(camp => {
            // Рассчитываем полную воронку
            const funnel = getCampaignFunnel(camp.id, period);
            
            return (
              <div key={camp.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4 hover:border-red-200 transition-colors">
                
                {/* Header Row */}
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-bold text-lg text-gray-900">{camp.name}</h4>
                      {camp.type === CampaignType.GAME_BATTLESHIP && (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-purple-200 text-purple-700 bg-purple-50 font-bold tracking-wide">
                              <Gamepad2 size={10} /> МОРСКОЙ БОЙ
                          </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold tracking-wide ${
                          camp.status === 'SENT' ? 'border-green-200 text-green-700 bg-green-50' : 
                          'border-gray-200 text-gray-500 bg-gray-50'
                      }`}>
                          {camp.status === 'SENT' ? 'АКТИВНА' : 'ЧЕРНОВИК'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 truncate max-w-xl">{camp.message}</p>
                    <div className="flex gap-4 text-xs text-gray-500 font-medium">
                      <span className="flex items-center gap-1"><Calendar size={14} /> {camp.created_at}</span>
                      <span>Сегмент: <span className="text-gray-700">{camp.segment_target === 'ALL' ? 'Все' : camp.segment_target}</span></span>
                    </div>
                  </div>

                  <div className="pl-6">
                    {camp.status === 'SCHEDULED' ? (
                         <button 
                            onClick={() => handleLaunch(camp.id)}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
                         >
                            <Play size={16} /> Старт
                         </button>
                     ) : (
                         <button className="p-2.5 bg-gray-50 rounded-lg text-gray-400 cursor-default">
                           <Send size={20} />
                         </button>
                     )}
                  </div>
                </div>

                {/* Funnel Block */}
                {camp.status === 'SENT' && (
                  <div className="border-t border-gray-100 pt-4">
                    <h5 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                        Воронка прогрева ({period === 'ALL' ? 'За все время' : period})
                    </h5>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        
                        {/* 1. Отправлено (Нейтральный серый #E0E0E0 style) */}
                        <div className="bg-gray-100 rounded-lg p-3 relative overflow-hidden group border border-gray-300">
                             <div className="absolute right-0 top-0 h-full w-1.5 bg-gray-400"></div>
                             <div className="text-2xl font-bold text-gray-800">{funnel.recipients_total}</div>
                             <div className="text-[10px] text-gray-600 font-bold uppercase flex items-center gap-1 mt-1">
                                 <Send size={10}/> Отправлено
                             </div>
                        </div>

                        {/* 2. Увидели (Мягкий желтый #FFF3CD style) */}
                        <div className="bg-yellow-50 rounded-lg p-3 relative overflow-hidden group border border-yellow-200">
                             <div className="absolute right-0 top-0 h-full w-1.5 bg-yellow-400"></div>
                             <div className="text-2xl font-bold text-gray-900">
                                 {funnel.views}
                                 <span className="text-sm text-yellow-700 font-medium ml-1">({funnel.view_conversion}%)</span>
                             </div>
                             <div className="text-[10px] text-yellow-700 font-bold uppercase flex items-center gap-1 mt-1">
                                 <Eye size={10}/> Просмотрено
                             </div>
                        </div>

                        {/* 3. Действие (Оранжевый #FFC107 style) */}
                        <div className="bg-orange-100 rounded-lg p-3 relative overflow-hidden group border border-orange-300">
                             <div className="absolute right-0 top-0 h-full w-1.5 bg-orange-500"></div>
                             <div className="text-2xl font-bold text-gray-900">
                                 {funnel.actions_total}
                                 <span className="text-sm text-orange-800 font-medium ml-1">({funnel.action_conversion}%)</span>
                             </div>
                             <div className="text-[10px] text-orange-800 font-bold uppercase flex items-center gap-1 mt-1">
                                 <Activity size={10}/> Действие
                             </div>
                        </div>

                        {/* 4. Warm/Hot (Брендовый красный) */}
                        <div className="bg-red-50 rounded-lg p-3 relative overflow-hidden group border border-red-200">
                             <div className="absolute right-0 top-0 h-full w-1.5 bg-pizza-red"></div>
                             <div className="text-2xl font-bold text-gray-900">
                                 {funnel.warm_hot_count}
                                 <span className="text-sm text-pizza-red font-bold ml-1">({funnel.warm_hot_from_acted}%)</span>
                             </div>
                             <div className="text-[10px] text-pizza-red font-bold uppercase flex items-center gap-1 mt-1">
                                 <Flame size={10}/> Warm / Hot
                             </div>
                        </div>

                    </div>
                    
                    {/* Action Breakdown Table */}
                    <div className="mt-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Детализация действий</span>
                            <span className="text-[10px] text-gray-400">Ср. время реакции: {funnel.avg_delay_seconds} сек.</span>
                         </div>
                         <div className="flex flex-wrap gap-2">
                             {Object.entries(funnel.actions_by_type).length > 0 ? (
                                 Object.entries(funnel.actions_by_type).map(([type, count]) => (
                                     <span key={type} className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-gray-200 text-xs font-medium text-gray-700 shadow-sm">
                                         {type === 'game_start' && <Gamepad2 size={12} className="text-purple-500"/>}
                                         {type === 'push_open' && <Eye size={12} className="text-blue-500"/>}
                                         <span>{type}:</span>
                                         <span className="font-bold text-pizza-red">{count}</span>
                                     </span>
                                 ))
                             ) : (
                                 <span className="text-xs text-gray-400 italic">Действий пока нет</span>
                             )}
                         </div>
                    </div>
                  </div>
                )}
              </div>
            );
        }) : (
             <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-200 border-dashed text-gray-400">
                 Нет кампаний за выбранный период
             </div>
        )}
      </div>
    </div>
  );
};

export default Campaigns;