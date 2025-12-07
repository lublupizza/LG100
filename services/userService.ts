import { User, UserHistoryItem, EventType, UserSegment } from '../types';
import { EVENT_CATEGORIES, EVENT_WEIGHTS } from './ltvEngine';

const adaptUser = (dbUser: any): User => {
  const games = dbUser.games || [];
  return {
    id: dbUser.id,
    vk_id: dbUser.vkId,
    first_name: dbUser.firstName || 'Пользователь',
    last_name: dbUser.lastName || `#${dbUser.vkId}`,
    photo_url: dbUser.photoUrl || 'https://via.placeholder.com/50',
    segment: (dbUser.segment as UserSegment) || UserSegment.COLD,
    ltv: dbUser.ltv || 0,
    ltv_stats: dbUser.ltv_stats || { total: 0, game: 0, reaction: 0, social: 0, trigger: 0 },
    social_stats: dbUser.social_stats || { likes: 0, comments: 0, reposts: 0, is_member: false },
    games_played: games.length,
    last_active: dbUser.updatedAt || dbUser.createdAt || new Date().toISOString(),
    source: dbUser.source || 'bot',
    games,
  };
};

export const fetchUsers = async (limit = 50, offset = 0): Promise<{ users: User[]; total: number }> => {
  const res = await fetch(`/api/users?limit=${limit}&offset=${offset}`);
  if (!res.ok) {
    console.error('Не удалось получить пользователей', res.statusText);
    return { users: [], total: 0 };
  }

  const payload = await res.json();
  const users = (payload.users || payload || []).map(adaptUser);
  const total = payload.total ?? users.length;
  return { users, total };
};

/**
 * Генерирует историю активности на основе реальных игровых сессий пользователя
 */
export const getUserActivityLog = (user: User): UserHistoryItem[] => {
  const history: UserHistoryItem[] = [];

  const addEvent = (type: EventType, date: string, desc?: string, meta?: any) => {
    history.push({
      id: `evt_${Math.random().toString(36).substr(2, 9)}`,
      type,
      category: EVENT_CATEGORIES[type],
      date,
      description: desc || `Событие: ${type}`,
      value_change: EVENT_WEIGHTS[type],
      metadata: meta,
    });
  };

  (user.games || []).forEach((g: any) => {
    const startedAt = g.createdAt || g.started_at;
    if (startedAt) {
      addEvent(EventType.GAME_START, startedAt, `Начал игру: ${g.type || 'BATTLESHIP'}`, { game_id: g.id });
    }
    if (g.status === 'FINISHED' && g.updatedAt) {
      addEvent(EventType.GAME_WIN, g.updatedAt, `Завершил игру: ${g.type || 'BATTLESHIP'}`, { game_id: g.id });
    }
  });

  return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getUserCampaignsHistory = async (_userId: number) => {
  try {
    const res = await fetch(`/api/campaigns?userId=${_userId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Не удалось загрузить историю кампаний', e);
  }
  return [];
};

export const adaptUserFromApi = adaptUser;
