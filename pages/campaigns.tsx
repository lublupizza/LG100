
import React, { useEffect, useState } from 'react';
import { Campaign, UserSegment, CampaignType, TimePeriod } from '../types';
import { hydrateCampaigns, launchCampaign, recalculateGameStats, persistCampaigns } from '../services/campaignService';
import { getCampaignFunnelForPeriod } from '../services/campaignTrackingService';
import { Send, Plus, Calendar, Gamepad2, Play, Clock, Eye, Activity, Flame, ChevronRight } from 'lucide-react';
import { isDateInPeriod } from '../utils/dateHelpers';

type MessageType = 'DEFAULT' | 'CAROUSEL';

type CarouselCard = {
  imageUrl: string;
  title: string;
  description: string;
  link: string;
};

const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [period, setPeriod] = useState<TimePeriod>('7d');

  const [isCreating, setIsCreating] = useState(false);
  const createBlankCarouselCard = (): CarouselCard => ({
    imageUrl: '',
    title: '',
    description: '',
    link: '',
  });

  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: 'DEFAULT' as MessageType,
    campaignType: CampaignType.STANDARD,
    segment: 'ALL',
    message: '',
    imageUrl: '',
    imageData: '',
    imageName: '',
    voiceUrl: '',
    voiceData: '',
    voiceName: '',
    carousel: [] as CarouselCard[],
  });

  useEffect(() => {
    (async () => {
      const hydrated = await hydrateCampaigns();
      setCampaigns([...hydrated]);
    })();
  }, []);

  const uploadCampaignFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data?.url) {
      throw new Error('Upload failed: no url returned');
    }

    return data as { url: string; filename?: string; size?: number };
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as data URL'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('File read error'));
      reader.readAsDataURL(file);
    });
  };

  const validateCarouselImage = async (file: File): Promise<string> => {
    const dataUrl = await readFileAsDataUrl(file);

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const { width, height } = image;
        const minWidth = 221;
        const minHeight = 136;
        const targetRatio = 13 / 8;
        const tolerance = 0.02;
        const ratio = width / height;
        const lowerBound = targetRatio * (1 - tolerance);
        const upperBound = targetRatio * (1 + tolerance);

        if (width < minWidth || height < minHeight) {
          alert('Картинка слишком маленькая. Минимум 221x136 пикселей.');
          reject(new Error('Image resolution too low'));
          return;
        }

        if (ratio < lowerBound || ratio > upperBound) {
          alert('Соотношение сторон должно быть 13:8 (±2%).');
          reject(new Error('Invalid aspect ratio'));
          return;
        }

        resolve(dataUrl);
      };

      image.onerror = () => {
        reject(new Error('Не удалось загрузить изображение для проверки.'));
      };

      image.src = dataUrl;
    });
  };

  const handleImageFile = async (file?: File | null) => {
    if (!file) {
      setNewCampaign(prev => ({
        ...prev,
        imageData: '',
        imageName: '',
        imageUrl: prev.imageUrl
      }));
      return;
    }

    try {
      const uploaded = await uploadCampaignFile(file);
      setNewCampaign(prev => ({
        ...prev,
        imageData: '',
        imageUrl: uploaded.url,
        imageName: file.name,
      }));
    } catch (err) {
      console.error('Image upload failed, fallback to base64', err);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setNewCampaign(prev => ({
          ...prev,
          imageData: dataUrl,
          imageUrl: '',
          imageName: file.name,
        }));
      } catch (readErr) {
        console.error('Failed to read image file', readErr);
        setNewCampaign(prev => ({
          ...prev,
          imageData: '',
          imageUrl: '',
          imageName: ''
        }));
      }
    }
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

  const handleAddCarouselCard = () => {
    setNewCampaign(prev => {
      if (prev.carousel.length >= 3) {
        alert('Карусель может содержать не более 3 карточек.');
        return prev;
      }
      return { ...prev, carousel: [...prev.carousel, createBlankCarouselCard()] };
    });
  };

  const handleRemoveCarouselCard = (index: number) => {
    setNewCampaign(prev => {
      const carousel = prev.carousel.filter((_, idx) => idx !== index);
      return { ...prev, carousel };
    });
  };

  const handleCarouselImageChange = async (index: number, file?: File | null) => {
    if (!file) return;
    try {
      const uploaded = await uploadCampaignFile(file);
      setNewCampaign(prev => {
        const carousel = [...prev.carousel];
        carousel[index] = { ...carousel[index], imageUrl: uploaded.url };
        return { ...prev, carousel };
      });
    } catch (err) {
      console.error('Carousel image upload failed', err);
      alert('Не удалось загрузить картинку. Попробуйте другой файл.');
    }
  };

  const handleCarouselFieldChange = (index: number, field: keyof CarouselCard, value: string) => {
    setNewCampaign(prev => {
      const carousel = [...prev.carousel];
      carousel[index] = { ...carousel[index], [field]: value } as CarouselCard;
      return { ...prev, carousel };
    });
  };

  const handleMessageTypeChange = (value: MessageType) => {
    setNewCampaign(prev => {
      let nextCarousel = prev.carousel;
      if (value === 'CAROUSEL') {
        if (nextCarousel.length === 0) {
          nextCarousel = [createBlankCarouselCard()];
        }
        nextCarousel = nextCarousel.slice(0, 3);
      } else {
        nextCarousel = [];
      }

      return { ...prev, type: value, carousel: nextCarousel };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedImageUrl = newCampaign.imageUrl.trim();
    const imageBase64 = (newCampaign.imageData || '').trim();
    const imageUrl = imageBase64 ? '' : trimmedImageUrl;

    const voiceBase64 = (newCampaign.voiceData || '').trim();
    const voiceUrl = voiceBase64 ? '' : newCampaign.voiceUrl.trim();

    const isCarousel = newCampaign.type === 'CAROUSEL';
    if (isCarousel) {
      if (newCampaign.carousel.length < 1) {
        alert('Добавьте минимум 1 карточку для карусели.');
        return;
      }
      if (newCampaign.carousel.length > 3) {
        alert('Максимум 3 карточки в карусели.');
        return;
      }
      if (newCampaign.carousel.some(card => !card.imageUrl.trim() || !card.title.trim())) {
        alert('Каждая карточка должна содержать изображение и заголовок.');
        return;
      }
    }

    const carouselPayload = isCarousel
      ? newCampaign.carousel.map(card => ({
          imageUrl: card.imageUrl,
          title: card.title,
          description: card.description,
          link: card.link,
        }))
      : [];

    const camp: Campaign = {
        id: `c${Date.now()}`,
        name: newCampaign.name,
        type: newCampaign.campaignType,
        segment_target: newCampaign.segment as UserSegment | 'ALL',
        message: newCampaign.message,
        image_url: isCarousel ? undefined : (imageUrl || undefined),
        image_base64: isCarousel ? undefined : (imageBase64 || undefined),
        image_name: isCarousel ? undefined : (newCampaign.imageName || undefined),
        voice_url: voiceUrl || undefined,
        voice_base64: voiceBase64 || undefined,
        voice_name: newCampaign.voiceName || undefined,
        status: 'SCHEDULED',
        stats: { sent: 0, delivered: 0, clicked: 0 },
        created_at: new Date().toISOString()
    } as Campaign;
    const campWithExtras = {
      ...camp,
      message_type: newCampaign.type,
      carousel: carouselPayload,
    } as Campaign & { message_type: MessageType; carousel?: typeof carouselPayload };
    setCampaigns(prev => {
      const next = [campWithExtras as any, ...prev];
      persistCampaigns(next);
      return next;
    });
    setIsCreating(false);
    setNewCampaign({ name: '', type: 'DEFAULT', campaignType: CampaignType.STANDARD, segment: 'ALL', message: '', imageUrl: '', imageData: '', imageName: '', voiceUrl: '', voiceData: '', voiceName: '', carousel: [] });
  };

  const handleLaunch = async (id: string) => {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;

    if(confirm('Запустить рассылку сейчас?')) {
        const updatedCampaign = await launchCampaign(campaign, {
          segment_target: campaign.segment_target,
        });
        if (updatedCampaign) {
            setCampaigns(prev => {
              const next = prev.map(c => c.id === id ? updatedCampaign : c);
              persistCampaigns(next);
              return next;
            });
        }
        const hydrated = await hydrateCampaigns();
        setCampaigns(prev => {
          const next = hydrated.length ? hydrated : prev;
          persistCampaigns(next);
          return [...next];
        });
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
                  value={newCampaign.campaignType}
                  onChange={e => setNewCampaign({...newCampaign, campaignType: e.target.value as CampaignType})}
                >
                  <option value={CampaignType.STANDARD}>Обычная (Текст/Картинка)</option>
                  <option value={CampaignType.GAME_BATTLESHIP}>Игровая (Морской Бой)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Тип сообщения</label>
                <select
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none transition-all"
                  value={newCampaign.type}
                  onChange={e => handleMessageTypeChange(e.target.value as MessageType)}
                >
                  <option value="DEFAULT">Обычная рассылка</option>
                  <option value="CAROUSEL">Карусель (1–3 карточки)</option>
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
                  {newCampaign.campaignType === CampaignType.GAME_BATTLESHIP ? 'Стартовое сообщение игры' : 'Текст сообщения'}
              </label>
              <textarea
                required
                rows={3}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none transition-all resize-none"
                value={newCampaign.message}
                onChange={e => setNewCampaign({...newCampaign, message: e.target.value})}
                placeholder={newCampaign.campaignType === CampaignType.GAME_BATTLESHIP ? "Капитан, враг на горизонте! Пиши A1 чтобы стрелять..." : "Текст..."}
              />
            </div>

            {newCampaign.campaignType === CampaignType.STANDARD && newCampaign.type === 'DEFAULT' && (
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

            {newCampaign.type === 'CAROUSEL' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700">Карусель сообщений</label>
                    <p className="text-xs text-gray-500">Добавьте 2–3 карточки с обложкой 13:8 (минимум 221x136).</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCarouselCard}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold hover:bg-gray-50"
                    disabled={newCampaign.carousel.length >= 3}
                  >
                    <Plus size={16} /> Добавить карточку
                  </button>
                </div>

                {newCampaign.carousel.length > 0 && (
                  <div className="space-y-4">
                    {newCampaign.carousel.map((card, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-gray-700">Карточка #{idx + 1}</div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCarouselCard(idx)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Удалить
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-600">Загрузить картинку</label>
                            <label className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-semibold cursor-pointer hover:bg-gray-50 w-full md:w-auto">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleCarouselImageChange(idx, e.target.files?.[0])}
                              />
                              Загрузить изображение
                            </label>
                            {card.imageUrl && (
                              <img src={card.imageUrl} alt={`Carousel ${idx + 1}`} className="h-28 w-full md:w-48 object-cover rounded border border-gray-200" />
                            )}
                            <p className="text-[11px] text-gray-500">Картинка загружается на сервер и будет использована в карусели.</p>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Название</label>
                              <input
                                type="text"
                                value={card.title}
                                onChange={(e) => handleCarouselFieldChange(idx, 'title', e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Описание (опционально)</label>
                              <input
                                type="text"
                                value={card.description}
                                onChange={(e) => handleCarouselFieldChange(idx, 'description', e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Ссылка (опционально)</label>
                              <input
                                type="url"
                                value={card.link}
                                onChange={(e) => handleCarouselFieldChange(idx, 'link', e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none"
                                placeholder="https://example.com"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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