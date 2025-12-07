import React, { useEffect, useState } from 'react';
import { Campaign, UserSegment, CampaignType, TimePeriod } from '../types';
import { fetchCampaigns, launchCampaign, createCampaign } from '../services/campaignService';
import { getCampaignFunnelForPeriod } from '../services/campaignTrackingService';
import { Send, Plus, Calendar, Gamepad2, Play, Eye, Activity } from 'lucide-react';
import { isDateInPeriod } from '../utils/dateHelpers';

const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
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
    loadCampaigns();
  }, []);

  useEffect(() => {
    loadFunnel(period);
  }, [period]);

  const loadCampaigns = async () => {
    const apiCampaigns = await fetchCampaigns();
    setCampaigns(apiCampaigns);
  };

  const loadFunnel = async (p: TimePeriod) => {
    const stats = await getCampaignFunnelForPeriod(p);
    setFunnel(stats);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedImage = newCampaign.imageUrl.trim();
    const normalizedImage = (newCampaign.imageData && newCampaign.imageData.trim()) || trimmedImage || undefined;
    const voiceSource = (newCampaign.voiceData || newCampaign.voiceUrl).trim();
    const normalizedVoice = voiceSource || undefined;
    const payload: Partial<Campaign> = {
      name: newCampaign.name,
      id: `c${Date.now()}`,
      type: newCampaign.type,
      segment_target: newCampaign.segment as UserSegment | 'ALL',
      message: newCampaign.message,
      image_url: newCampaign.imageData ? undefined : normalizedImage,
      image_base64: newCampaign.imageData || undefined,
      image_name: newCampaign.imageName || undefined,
      voice_url: normalizedVoice,
      voice_base64: newCampaign.voiceData || undefined,
      voice_name: newCampaign.voiceName || undefined,
      status: 'SCHEDULED',
      stats: { sent: 0, delivered: 0, clicked: 0 },
      created_at: new Date().toISOString(),
    };

    const created = await createCampaign(payload);
    if (created) {
      setCampaigns((prev) => [created, ...prev]);
      setIsCreating(false);
      setNewCampaign({ name: '', type: CampaignType.STANDARD, segment: 'ALL', message: '', imageUrl: '', imageData: '', imageName: '', voiceUrl: '', voiceData: '', voiceName: '' });
    }
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
            await loadCampaigns();
        }
        await loadFunnel(period);
    }
  };

  const filteredCampaigns = campaigns.filter(c => isDateInPeriod(c.created_at, period));

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
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 bg-gray-100 rounded text-sm font-semibold">Отмена</button>
              <button type="submit" className="px-4 py-2 bg-pizza-red text-white rounded text-sm font-semibold">Создать</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Campaigns;
