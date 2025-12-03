
import { Campaign, CampaignType, UserSegment, EventType, CampaignStats, TimePeriod } from '../types';
import { mockCampaigns, mockUsers, mockGames } from './mockData';
import { SeaBattleSessionManager } from './seaBattleEngine';
import { registerEvent } from './ltvEngine';
import { recordCampaignSend } from './campaignTrackingService';
import { isDateInPeriod } from '../utils/dateHelpers';

export const launchCampaign = (campaignId: string): boolean => {
  const campaign = mockCampaigns.find(c => c.id === campaignId);
  if (!campaign) return false;

  // 1. Отбор аудитории
  const targetUsers = mockUsers.filter(u => {
    if (campaign.segment_target === 'ALL') return true;
    return u.segment === campaign.segment_target;
  });

  if (targetUsers.length === 0) return false;

  // 2. Рассылка / Активация
  let sentCount = 0;
  
  targetUsers.forEach(user => {
    sentCount++;
    
    // === NEW: Фиксируем отправку в системе трекинга ===
    recordCampaignSend(campaignId, user.id);

    // LTV: Если пользователь открыл пуш (эмуляция: считаем, что 30% открыли сразу)
    // В реальной системе это событие пришло бы от Callback API "messages_read" или "payload"
    if (Math.random() > 0.7) {
        // Передаем campaign_id чтобы трекер засчитал просмотр
        registerEvent(user, EventType.PUSH_OPEN, { campaign_id: campaignId });
    }

    // СПЕЦИФИКА ДЛЯ МОРСКОГО БОЯ
    if (campaign.type === CampaignType.GAME_BATTLESHIP) {
      SeaBattleSessionManager.startSession(user.id, campaign.id);
    }
  });

  // 3. Обновление статистики кампании
  campaign.status = 'SENT';
  campaign.stats.sent = sentCount;
  campaign.stats.delivered = Math.floor(sentCount * 0.98); // 98% доставка
  
  if (campaign.type === CampaignType.GAME_BATTLESHIP) {
      campaign.stats.games_started = sentCount; 
      campaign.stats.players_active = 0; 
      campaign.stats.avg_moves = 0;
  }

  return true;
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