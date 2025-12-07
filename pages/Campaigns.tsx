
import React, { useEffect, useState } from 'react';
import { Campaign, UserSegment, CampaignType, TimePeriod } from '../types';
import { mockCampaigns } from '../services/mockData';
import { hydrateCampaigns, launchCampaign, recalculateGameStats } from '../services/campaignService';
import { getCampaignFunnelForPeriod } from '../services/campaignTrackingService';
import { Send, Plus, Calendar, Gamepad2, Play, Clock, Eye, Activity, Flame, ChevronRight } from 'lucide-react';
import { isDateInPeriod } from '../utils/dateHelpers';

const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns);
  const [period, setPeriod] = useState<TimePeriod>('7d');
  
  const [isCreating, setIsCreating] = useState(false);
  const [funnel, setFunnel] = useState<any>({ recipients_total: 0, views: 0, actions_total: 0, warm_hot_count: 0, warm_hot_rate: 0 });
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: CampaignType.STANDARD,
    segment: 'ALL',
    message: '',
    imageUrl: '',
    imageData: '',
    imageName: '',
    voiceUrl: '',
    voiceData: '',
    voiceName: '',
  });

  useEffect(() => {
    const hydrated = hydrateCampaigns();
    setCampaigns([...hydrated]);
  }, []);

  const handleImageFile = (file?: File | null) => {
    if (!file) {
      setNewCampaign({ ...newCampaign, imageData: '', imageName: '', imageUrl: newCampaign.imageUrl });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setNewCampaign({
        ...newCampaign,
        imageData: typeof reader.result === 'string' ? reader.result : '',
        imageUrl: '',
        imageName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleVoiceFile = (file?: File | null) => {
    if (!file) {
      setNewCampaign({ ...newCampaign, voiceData: '', voiceName: '', voiceUrl: newCampaign.voiceUrl });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setNewCampaign({
        ...newCampaign,
        voiceData: typeof reader.result === 'string' ? reader.result : '',
        voiceUrl: '',
        voiceName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedImage = newCampaign.imageUrl.trim();
    const normalizedImage = (newCampaign.imageData && newCampaign.imageData.trim()) || trimmedImage || undefined;
    const voiceSource = (newCampaign.voiceData || newCampaign.voiceUrl).trim();
    const normalizedVoice = voiceSource || undefined;
    const camp: Campaign = {
        id: `c${Date.now()}`,
        name: newCampaign.name,
        type: newCampaign.type,
        segment_target: newCampaign.segment as UserSegment | 'ALL',
        message: newCampaign.message,
        image_url: newCampaign.imageData ? undefined : (normalizedImage || undefined),
        image_base64: newCampaign.imageData || undefined,
        image_name: newCampaign.imageName || undefined,
        // Дублируем для обратной совместимости с разными полями
        ...(normalizedImage ? { imageUrl: normalizedImage } : { imageUrl: undefined } as any),
        voice_url: normalizedVoice,
        voice_base64: newCampaign.voiceData || undefined,
        voice_name: newCampaign.voiceName || undefined,
        status: 'SCHEDULED',
        stats: { sent: 0, delivered: 0, clicked: 0 },
        created_at: new Date().toISOString()
    };
    mockCampaigns.unshift(camp);
    localStorage.setItem('campaigns', JSON.stringify(mockCampaigns));
    setCampaigns([camp, ...campaigns]);
    setIsCreating(false);
    setNewCampaign({ name: '', type: CampaignType.STANDARD, segment: 'ALL', message: '', imageUrl: '', imageData: '', imageName: '', voiceUrl: '', voiceData: '', voiceName: '' });
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
        // Всегда синхронизируем с локальным хранилищем после запуска, чтобы статусы не зависали в "АКТИВНА"
        const hydrated = hydrateCampaigns();
        setCampaigns([...hydrated]);
        localStorage.setItem('campaigns', JSON.stringify(mockCampaigns));
    }
  };

  const filteredCampaigns = campaigns.filter(c => isDateInPeriod(c.created_at, period));
  const globalFunnel = getCampaignFunnelForPeriod(period);

  const statusView = (status: Campaign['status']) => {
    if (status === 'SENT') {
      return {
        label: 'ОТПРАВЛЕНА',
        styles: 'border-green-200 text-green-700 bg-green-50',
      };
    }

    if (status === 'SCHEDULED') {
      return {
        label: 'АКТИВНА',
        styles: 'border-blue-200 text-blue-700 bg-blue-50',
      };
    }

    return {
      label: 'ЧЕРНОВИК',
      styles: 'border-gray-200 text-gray-500 bg-gray-50',
    };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900">
            <Send className="text-pizza-red" />
            Рассылки
          </h3>
          <p className="text-xs text-gray-500">Всего кампаний: {filteredCampaigns.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value as TimePeriod)} className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
            <option value="1d">24 часа</option>
            <option value="7d">Неделя</option>
            <option value="1m">Месяц</option>
            <option value="ALL">Все</option>
          </select>
          <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 bg-pizza-red text-white px-4 py-2 rounded-lg shadow hover:bg-red-600 transition">
            <Plus size={16} /> Новая кампания
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-green-500" />
            <div>
              <p className="text-xs text-gray-500">Успешные рассылки за период</p>
              <p className="text-lg font-bold text-gray-900">{funnel.recipients_total || 0} доставлено</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
            <div className="p-3 bg-gray-50 rounded-lg border">
              <p className="text-gray-500">Просмотры</p>
              <p className="text-lg font-semibold text-gray-900">{funnel.views || 0}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border">
              <p className="text-gray-500">Действия</p>
              <p className="text-lg font-semibold text-gray-900">{funnel.actions_total || 0}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border">
              <p className="text-gray-500">Warm/Hot</p>
              <p className="text-lg font-semibold text-gray-900">{funnel.warm_hot_count || 0}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border">
              <p className="text-gray-500">Конверсия</p>
              <p className="text-lg font-semibold text-gray-900">{funnel.warm_hot_rate || 0}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm col-span-1 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Gamepad2 className="text-purple-500" />
            <div>
              <p className="text-xs text-gray-500">Игровые кампании</p>
              <p className="text-lg font-bold text-gray-900">{filteredCampaigns.filter(c => c.type === CampaignType.GAME_BATTLESHIP).length}</p>
            </div>
          </div>
          <div className="space-y-2">
            {filteredCampaigns.map((c) => (
              <div key={c.id} className="border border-gray-200 rounded-lg p-3 flex justify-between items-start hover:border-pizza-red transition cursor-pointer">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-1 rounded font-bold ${c.status === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {c.status === 'SENT' ? 'ОТПРАВЛЕНА' : 'АКТИВНА'}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar size={12} /> {new Date(c.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{c.message}</p>
                  {c.image_url && <img src={c.image_url} alt="preview" className="h-12 rounded" />}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button onClick={() => handleLaunch(c.id)} className="flex items-center gap-1 text-pizza-red text-sm font-semibold hover:underline">
                    <Play size={14} /> Запустить
                  </button>
                  <div className="text-[11px] text-gray-500 flex items-center gap-1">
                    <Eye size={12} /> {c.stats.sent || 0} отправлено
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 w-full max-w-2xl space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-bold">Новая кампания</h4>
              <button type="button" onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col text-sm font-semibold text-gray-700">
                Название
                <input value={newCampaign.name} onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })} className="mt-1 p-2 border rounded" required />
              </label>
              <label className="flex flex-col text-sm font-semibold text-gray-700">
                Тип
                <select value={newCampaign.type} onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value as CampaignType })} className="mt-1 p-2 border rounded">
                  <option value={CampaignType.STANDARD}>Стандартная</option>
                  <option value={CampaignType.GAME_BATTLESHIP}>Морской бой</option>
                </select>
              </label>
              <label className="flex flex-col text-sm font-semibold text-gray-700">
                Сегмент
                <select value={newCampaign.segment} onChange={(e) => setNewCampaign({ ...newCampaign, segment: e.target.value })} className="mt-1 p-2 border rounded">
                  <option value="ALL">Все</option>
                  <option value={UserSegment.COLD}>Cold</option>
                  <option value={UserSegment.WARM}>Warm</option>
                  <option value={UserSegment.HOT}>Hot</option>
                </select>
              </label>
              <label className="flex flex-col text-sm font-semibold text-gray-700">
                Сообщение
                <textarea value={newCampaign.message} onChange={(e) => setNewCampaign({ ...newCampaign, message: e.target.value })} className="mt-1 p-2 border rounded h-24" required />
              </label>
              <label className="flex flex-col text-sm font-semibold text-gray-700">
                Картинка (URL)
                <input value={newCampaign.imageUrl} onChange={(e) => setNewCampaign({ ...newCampaign, imageUrl: e.target.value, imageData: '' })} className="mt-1 p-2 border rounded" placeholder="https://..." />
              </label>
              <label className="flex flex-col text-sm font-semibold text-gray-700">
                Картинка (файл)
                <input type="file" accept="image/*" onChange={(e) => handleImageFile(e.target.files?.[0])} className="mt-1" />
                {newCampaign.imageData && <span className="text-xs text-gray-500 mt-1">{newCampaign.imageName}</span>}
              </label>
              <label className="flex flex-col text-sm font-semibold text-gray-700">
                Голосовое (URL)
                <input value={newCampaign.voiceUrl} onChange={(e) => setNewCampaign({ ...newCampaign, voiceUrl: e.target.value, voiceData: '' })} className="mt-1 p-2 border rounded" placeholder="https://..." />
              </label>
              <label className="flex flex-col text-sm font-semibold text-gray-700">
                Голосовое (файл)
                <input type="file" accept="audio/*" onChange={(e) => handleVoiceFile(e.target.files?.[0])} className="mt-1" />
                {newCampaign.voiceData && <span className="text-xs text-gray-500 mt-1">{newCampaign.voiceName}</span>}
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

            {newCampaign.type === CampaignType.STANDARD && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div className="md:col-span-2 space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Картинка (опционально)</label>
                    <div className="space-y-2">
                      <input
                        type="url"
                        placeholder="https://...jpg"
                        value={newCampaign.imageUrl}
                        onChange={(e) => setNewCampaign({ ...newCampaign, imageUrl: e.target.value, imageData: '', imageName: '' })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none transition-all"
                      />
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-semibold cursor-pointer hover:bg-gray-50">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageFile(e.target.files?.[0])}
                          />
                          Загрузить файл
                        </label>
                        {newCampaign.imageName && (
                          <span className="text-xs text-gray-600">{newCampaign.imageName}</span>
                        )}
                        {(newCampaign.imageData || newCampaign.imageUrl) && (
                          <button
                            type="button"
                            onClick={() => setNewCampaign({ ...newCampaign, imageUrl: '', imageData: '', imageName: '' })}
                            className="text-xs text-gray-500 hover:text-gray-800"
                          >
                            Очистить
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">Вставьте ссылку или загрузите файл, чтобы отправить пуш с картинкой.</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-semibold text-gray-700">Голосовое сообщение (mp3, опционально)</label>
                      {newCampaign.voiceData || newCampaign.voiceUrl ? (
                        <button
                          type="button"
                          onClick={() => setNewCampaign({ ...newCampaign, voiceData: '', voiceUrl: '', voiceName: '' })}
                          className="text-xs text-gray-500 hover:text-gray-800"
                        >
                          Очистить
                        </button>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-3">
                      <input
                        type="url"
                        placeholder="https://.../voice.mp3"
                        value={newCampaign.voiceUrl}
                        onChange={(e) => setNewCampaign({ ...newCampaign, voiceUrl: e.target.value, voiceData: '', voiceName: '' })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none transition-all"
                      />
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-semibold cursor-pointer hover:bg-gray-50">
                          <input
                            type="file"
                            accept="audio/mpeg,audio/mp3,audio/*"
                            className="hidden"
                            onChange={(e) => handleVoiceFile(e.target.files?.[0])}
                          />
                          Загрузить mp3
                        </label>
                        {newCampaign.voiceName && (
                          <span className="text-xs text-gray-600">{newCampaign.voiceName}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">Можно вставить ссылку или загрузить mp3-файл; он пойдет в рассылку как голосовое сообщение.</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg h-full min-h-[120px] flex flex-col items-center justify-center px-3 py-2 text-xs text-gray-500 space-y-2">
                  {newCampaign.imageData || newCampaign.imageUrl ? (
                    <img src={newCampaign.imageData || newCampaign.imageUrl} alt="Превью" className="max-h-28 rounded" />
                  ) : (
                    <span className="text-center">Превью появится, когда добавите ссылку</span>
                  )}
                  {(newCampaign.voiceData || newCampaign.voiceUrl) && (
                    <audio
                      controls
                      src={newCampaign.voiceData || newCampaign.voiceUrl}
                      className="w-full"
                    />
                  )}
                </div>
              </div>
            )}

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

      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-700 uppercase">Успешные рассылки ({period === 'ALL' ? 'за все время' : period})</h4>
          <span className="text-xs text-gray-400">Сводка по всем отправленным пушам</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-gray-100 rounded-lg p-3 relative overflow-hidden group border border-gray-300">
            <div className="absolute right-0 top-0 h-full w-1.5 bg-gray-400" />
            <div className="text-2xl font-bold text-gray-800">{globalFunnel.recipients_total}</div>
            <div className="text-[10px] text-gray-600 font-bold uppercase flex items-center gap-1 mt-1">
              <Send size={10}/> Отправлено
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-3 relative overflow-hidden group border border-yellow-200">
            <div className="absolute right-0 top-0 h-full w-1.5 bg-yellow-400" />
            <div className="text-2xl font-bold text-gray-900">
              {globalFunnel.views}
              <span className="text-sm text-yellow-700 font-medium ml-1">({globalFunnel.view_conversion}%)</span>
            </div>
            <div className="text-[10px] text-yellow-700 font-bold uppercase flex items-center gap-1 mt-1">
              <Eye size={10}/> Просмотрено
            </div>
          </div>

          <div className="bg-orange-100 rounded-lg p-3 relative overflow-hidden group border border-orange-300">
            <div className="absolute right-0 top-0 h-full w-1.5 bg-orange-500" />
            <div className="text-2xl font-bold text-gray-900">
              {globalFunnel.actions_total}
              <span className="text-sm text-orange-800 font-medium ml-1">({globalFunnel.action_conversion}%)</span>
            </div>
            <div className="text-[10px] text-orange-800 font-bold uppercase flex items-center gap-1 mt-1">
              <Activity size={10}/> Действие
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-3 relative overflow-hidden group border border-red-200">
            <div className="absolute right-0 top-0 h-full w-1.5 bg-pizza-red" />
            <div className="text-2xl font-bold text-gray-900">
              {globalFunnel.warm_hot_count}
              <span className="text-sm text-pizza-red font-bold ml-1">({globalFunnel.warm_hot_from_acted}%)</span>
            </div>
            <div className="text-[10px] text-pizza-red font-bold uppercase flex items-center gap-1 mt-1">
              <Flame size={10}/> Warm / Hot
            </div>
          </div>
        </div>

        <div className="mt-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Детализация действий</span>
            <span className="text-[10px] text-gray-400">Ср. время реакции: {globalFunnel.avg_delay_seconds} сек.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(globalFunnel.actions_by_type).length > 0 ? (
              Object.entries(globalFunnel.actions_by_type).map(([type, count]) => (
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

      <div className="grid grid-cols-1 gap-4">
        {filteredCampaigns.length > 0 ? filteredCampaigns.map(camp => {
            const preview = ((camp as any).image_base64 || (camp as any).imageUrl || camp.image_url || '').trim();
            const voicePreview = ((camp as any).voice_url || (camp as any).voiceUrl || camp.voice_base64 || '').trim();
            const badge = statusView(camp.status);
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
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold tracking-wide ${badge.styles}`}>
                          {badge.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 truncate max-w-xl">{camp.message}</p>
                    <div className="flex gap-4 text-xs text-gray-500 font-medium">
                      <span className="flex items-center gap-1"><Calendar size={14} /> {camp.created_at}</span>
                      <span>Сегмент: <span className="text-gray-700">{camp.segment_target === 'ALL' ? 'Все' : camp.segment_target}</span></span>
                    </div>
                  </div>

                  <div className="pl-6 flex flex-col items-end gap-3">
                    {preview && (
                      <img src={preview} alt={camp.name} className="w-28 h-20 object-cover rounded border border-gray-200 shadow-sm" />
                    )}
                    {voicePreview && (
                      <audio controls src={camp.voice_base64 ? camp.voice_base64 : voicePreview} className="w-36" />
                    )}
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
