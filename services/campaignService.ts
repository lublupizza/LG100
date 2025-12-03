
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

export const launchCampaign = async (
  campaign: Campaign,
  filters: CampaignFilter = {}
): Promise<Campaign | null> => {
  // Если кампании нет, смысла продолжать нет
  if (!campaign) return null;

  // 1. Отбор аудитории
  const targetUsers = mockUsers.filter(u => {
    if (filters.segment_target && filters.segment_target !== 'ALL') {
      if (u.segment !== filters.segment_target) return false;
    } else if (campaign.segment_target !== 'ALL' && u.segment !== campaign.segment_target) {
      return false;
    }

    if (typeof filters.min_games === 'number' && u.games_played < filters.min_games) return false;
    if (typeof filters.is_member === 'boolean' && u.social_stats?.is_member !== filters.is_member) return false;

    return true;
  });

  if (targetUsers.length === 0) return null;

  // 2. Рассылка / Активация
  let sentCount = 0;

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
        filters,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      sentCount = data.sent ?? targetUsers.length;
    } else {
      sentCount = targetUsers.length;
    }
  } catch (e) {
    // Если API недоступен, fallback на моковую отправку
    sentCount = targetUsers.length;
  }

  // 2b. Трекинг и игровые сессии для аналитики
  targetUsers.forEach(user => {
    // === NEW: Фиксируем отправку в системе трекинга ===
    recordCampaignSend(campaign.id, user.id);

    // LTV: Если пользователь открыл пуш (эмуляция: считаем, что 30% открыли сразу)
    // В реальной системе это событие пришло бы от Callback API "messages_read" или "payload"
    if (Math.random() > 0.7) {
        // Передаем campaign_id чтобы трекер засчитал просмотр
        registerEvent(user, EventType.PUSH_OPEN, { campaign_id: campaign.id });
    }

    // СПЕЦИФИКА ДЛЯ МОРСКОГО БОЯ
    if (campaign.type === CampaignType.GAME_BATTLESHIP) {
      SeaBattleSessionManager.startSession(user.id, campaign.id);
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