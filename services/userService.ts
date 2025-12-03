import { User, UserHistoryItem, EventType, LtvCategory } from '../types';
import { EVENT_CATEGORIES, EVENT_WEIGHTS } from './ltvEngine';
import { mockCampaigns, mockGames } from './mockData';

/**
 * Генерирует мок-историю событий на основе агрегированных данных пользователя
 */
export const getUserActivityLog = (user: User): UserHistoryItem[] => {
  const history: UserHistoryItem[] = [];

  const addEvent = (type: EventType, dateOffsetDays: number, desc?: string, meta?: any) => {
    const date = new Date();
    date.setDate(date.getDate() - dateOffsetDays);
    // Добавляем случайное время
    date.setHours(Math.floor(Math.random() * 23), Math.floor(Math.random() * 59));

    history.push({
      id: `evt_${Math.random().toString(36).substr(2, 9)}`,
      type,
      category: EVENT_CATEGORIES[type],
      date: date.toISOString(),
      description: desc || `Событие: ${type}`,
      value_change: EVENT_WEIGHTS[type],
      metadata: meta
    });
  };

  // 1. Генерируем игровые события
  // Ищем реальные сессии из mockGames
  const userGames = mockGames.filter(g => g.user_id === user.id);
  userGames.forEach(g => {
      // День старта игры (парсим дату из игры)
      const gameDate = new Date(g.started_at);
      const daysAgo = Math.floor((new Date().getTime() - gameDate.getTime()) / (1000 * 3600 * 24));
      
      addEvent(EventType.GAME_START, daysAgo, `Начал игру: ${g.type}`, { game_id: g.id });
      if (g.status === 'FINISHED') {
          addEvent(EventType.GAME_WIN, daysAgo, `Завершил игру: ${g.type}`);
      }
  });

  // Если игр в статистике больше, чем в мок-базе, добиваем рандомными
  const extraGames = user.games_played - userGames.length;
  for (let i = 0; i < extraGames; i++) {
      addEvent(EventType.GAME_START, Math.floor(Math.random() * 60), 'Начал игру (Архив)');
  }

  // 2. Генерируем соц. активность
  for (let i = 0; i < user.social_stats.likes; i++) {
      addEvent(EventType.LIKE_POST, Math.floor(Math.random() * 30), 'Лайкнул пост');
  }
  for (let i = 0; i < user.social_stats.comments; i++) {
      addEvent(EventType.COMMENT_POST, Math.floor(Math.random() * 30), 'Оставил комментарий');
  }
  if (user.social_stats.is_member) {
      addEvent(EventType.GROUP_JOIN, Math.floor(Math.random() * 90) + 10, 'Вступил в группу');
  }

  // 3. Триггеры (Intent)
  // Примерно оцениваем кол-во триггеров по баллам LTV
  const triggerPoints = user.ltv_stats.trigger;
  const estimatedLeads = Math.floor(triggerPoints / 10);
  for (let i = 0; i < estimatedLeads; i++) {
      addEvent(EventType.LEAD, Math.floor(Math.random() * 14), 'Нажал "Хочу Пиццу"');
  }

  // Сортировка: новые сверху
  return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getUserCampaignsHistory = (userId: number) => {
    // В реальном проекте тут запрос к campaign_sends
    // Эмулируем, что пользователь участвовал в случайных кампаниях
    return mockCampaigns.filter(() => Math.random() > 0.5); 
};