
import { Campaign, CampaignType, UserSegment, EventType, CampaignStats, TimePeriod } from '../types';
import { mockCampaigns, mockUsers, mockGames } from './mockData';
import { SeaBattleSessionManager } from './seaBattleEngine';
import { registerEvent } from './ltvEngine';
import { recordCampaignSend } from './campaignTrackingService';
import { isDateInPeriod } from '../utils/dateHelpers';

type CampaignFilter = {
  segment_target?: UserSegment | 'ALL';
  min_games?: number;
  is_member?: boolean;
};

const persistCampaigns = () => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('campaigns', JSON.stringify(mockCampaigns));
  } catch (e) {
    console.warn('Failed to persist campaigns', e);
  }
};

export const hydrateCampaigns = (): Campaign[] => {
  if (typeof localStorage === 'undefined') return mockCampaigns;

  const stored = localStorage.getItem('campaigns');
  if (!stored) return mockCampaigns;

  try {
    const parsed = JSON.parse(stored) as Campaign[];
    if (Array.isArray(parsed)) {
      const normalized = parsed.map((c: any) => ({
        ...c,
        image_url: c.image_url || c.imageUrl,
      }));
      mockCampaigns.splice(0, mockCampaigns.length, ...normalized);
    }
  } catch (e) {
    console.warn('Failed to hydrate campaigns from storage', e);
  }

  return mockCampaigns;
};

export const launchCampaign = async (
  campaign: Campaign,
  filters: CampaignFilter = {}
): Promise<Campaign | null> => {
  // Если кампании нет, смысла продолжать нет
  if (!campaign) return null;

  // 1. Отбор аудитории
  const filteredMockUsers = mockUsers.filter(u => {
    if (filters.segment_target && filters.segment_target !== 'ALL') {
      if (u.segment !== filters.segment_target) return false;
    } else if (campaign.segment_target !== 'ALL' && u.segment !== campaign.segment_target) {
      return false;
    }

    if (typeof filters.min_games === 'number' && u.games_played < filters.min_games) return false;
    if (typeof filters.is_member === 'boolean' && u.social_stats?.is_member !== filters.is_member) return false;

    return true;
  });

  // 2. Рассылка / Активация
  let sentCount = 0;
  let recipientsFromApi: { userId?: number; vkId?: number; segment?: UserSegment | 'ALL' }[] = [];

  // 2a. Отправка реальным пользователям через бэкенд
  try {
    const response = await fetch('/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          message: campaign.message,
          type: campaign.type,
          segment: campaign.segment_target,
          imageUrl: (campaign as any).imageUrl || campaign.image_url,
          filters,
        }),
      });

    if (response.ok) {
      const data = await response.json();
      sentCount = data.sent ?? filteredMockUsers.length;
      recipientsFromApi = (data.recipients || []).map((r: any) => ({
        userId: r.id ?? r.user_id,
        vkId: r.vkId ?? r.vk_id ?? r.user_vk_id,
        segment: r.segment ?? (campaign.segment_target ?? 'ALL'),
      }));
    } else {
      sentCount = filteredMockUsers.length;
    }
  } catch (e) {
    // Если API недоступен, fallback на моковую отправку
    sentCount = filteredMockUsers.length;
  }

  const recipients = recipientsFromApi.length
    ? recipientsFromApi
    : filteredMockUsers.map((u) => ({ userId: u.id, vkId: u.vk_id, segment: u.segment }));

  if (recipients.length === 0) return null;

  if (sentCount === 0) {
    sentCount = recipients.length;
  }

  // 2b. Трекинг и игровые сессии для аналитики
  recipients.forEach(recipient => {
    recordCampaignSend(campaign.id, {
      userId: recipient.userId,
      vkId: recipient.vkId,
      segment: recipient.segment,
    });

    // Для моковых пользователей сохраняем старую симуляцию открытий
    const mockUser = filteredMockUsers.find((u) => u.id === recipient.userId);
    if (mockUser && Math.random() > 0.7) {
        registerEvent(mockUser, EventType.PUSH_OPEN, { campaign_id: campaign.id });
    }

    if (campaign.type === CampaignType.GAME_BATTLESHIP && mockUser) {
      SeaBattleSessionManager.startSession(mockUser.id, campaign.id);
    }
  });

  // 3. Обновление статистики кампании
  const baseStats: CampaignStats = {
    ...campaign.stats,
    sent: sentCount,
    delivered: Math.floor(sentCount * 0.98), // 98% доставка
    clicked: campaign.stats.clicked || 0
  };

  const updatedStats = campaign.type === CampaignType.GAME_BATTLESHIP
    ? {
        ...baseStats,
        games_started: sentCount,
        players_active: 0,
        games_finished: campaign.stats.games_finished ?? 0,
        avg_moves: 0
      }
    : baseStats;

  const updatedCampaign: Campaign = {
    ...campaign,
    status: 'SENT',
    stats: updatedStats
  };

  const mockIndex = mockCampaigns.findIndex(c => c.id === campaign.id);
  if (mockIndex >= 0) {
    mockCampaigns[mockIndex] = updatedCampaign;
  } else {
    mockCampaigns.unshift(updatedCampaign);
  }

  persistCampaigns();

  return updatedCampaign;
};

// Функция расчета статистики на лету для игровой кампании с учетом периода
export const recalculateGameStats = (campaign: Campaign, period: TimePeriod = 'ALL'): CampaignStats => {
    if (campaign.type !== CampaignType.GAME_BATTLESHIP) return campaign.stats;

    // Ищем игры, привязанные к этой кампании
    let relatedGames = mockGames.filter(g => g.campaign_id === campaign.id);

    // Фильтруем по времени обновления игры (активность)
    if (period !== 'ALL') {
        relatedGames = relatedGames.filter(g => isDateInPeriod(g.updated_at, period));
    }

    const started = relatedGames.length;
    const finished = relatedGames.filter(g => g.status === 'FINISHED').length;
    // Активные: те, кто сделал > 2 ходов
    const active = relatedGames.filter(g => g.moves_count > 2).length;
    
    const totalMoves = relatedGames.reduce((acc, g) => acc + g.moves_count, 0);
    const avgMoves = started > 0 ? Math.round(totalMoves / started) : 0;

    return {
        ...campaign.stats,
        games_started: started,
        games_finished: finished,
        players_active: active,
        avg_moves: avgMoves
    };
};