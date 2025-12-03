
import { User, UserSegment, EventType, LtvCategory, LtvBreakdown, EventMetadata, LtvFilters } from '../types';
import { trackCampaignReaction } from './campaignTrackingService';
import { isDateInPeriod } from '../utils/dateHelpers';

// 1. Конфигурация весов событий
export const EVENT_WEIGHTS: Record<EventType, number> = {
  // Игровая активность
  [EventType.GAME_START]: 1,
  [EventType.GAME_PLAY]: 1,
  [EventType.GAME_WIN]: 3,

  // Реакции на рассылки
  [EventType.PUSH_OPEN]: 1,
  [EventType.PUSH_REPLY]: 2,
  [EventType.PUSH_CLICK]: 3,

  // Социальная активность
  [EventType.LIKE_POST]: 1,
  [EventType.COMMENT_POST]: 2,
  [EventType.REPOST_POST]: 4,
  [EventType.GROUP_JOIN]: 5,
  [EventType.GROUP_LEAVE]: 0,

  // Триггеры / Намерения (Intent)
  [EventType.LEAD]: 10,
  [EventType.MENU_CLICK]: 5,
  [EventType.DELIVERY_CLICK]: 5,
  [EventType.SITE_CLICK]: 3,

  // Зарезервировано
  [EventType.SALE]: 20,
};

// Маппинг события к категории
export const EVENT_CATEGORIES: Record<EventType, LtvCategory> = {
  [EventType.GAME_START]: LtvCategory.GAME,
  [EventType.GAME_PLAY]: LtvCategory.GAME,
  [EventType.GAME_WIN]: LtvCategory.GAME,
  
  [EventType.PUSH_OPEN]: LtvCategory.REACTION,
  [EventType.PUSH_REPLY]: LtvCategory.REACTION,
  [EventType.PUSH_CLICK]: LtvCategory.REACTION,
  
  [EventType.LIKE_POST]: LtvCategory.SOCIAL,
  [EventType.COMMENT_POST]: LtvCategory.SOCIAL,
  [EventType.REPOST_POST]: LtvCategory.SOCIAL,
  [EventType.GROUP_JOIN]: LtvCategory.SOCIAL,
  [EventType.GROUP_LEAVE]: LtvCategory.SOCIAL,
  
  [EventType.LEAD]: LtvCategory.TRIGGER,
  [EventType.MENU_CLICK]: LtvCategory.TRIGGER,
  [EventType.DELIVERY_CLICK]: LtvCategory.TRIGGER,
  [EventType.SITE_CLICK]: LtvCategory.TRIGGER,
  [EventType.SALE]: LtvCategory.TRIGGER,
};

// 2. Логика расчета сегмента
export const calculateSegment = (ltvStats: LtvBreakdown): UserSegment => {
  const score = ltvStats.total;
  if (ltvStats.trigger >= 15) return UserSegment.HOT;
  if (score >= 40) return UserSegment.HOT;
  if (score >= 10) return UserSegment.WARM;
  return UserSegment.COLD;
};

export const update_user_segment = (user: User): User => {
    const newSegment = calculateSegment(user.ltv_stats);
    if (newSegment !== user.segment) {
        return { ...user, segment: newSegment };
    }
    return user;
};

// 3. Функция регистрации события
export const registerEvent = (user: User, eventType: EventType, metadata?: EventMetadata): User => {
  const weight = EVENT_WEIGHTS[eventType];
  const category = EVENT_CATEGORIES[eventType];

  // === NEW: Tracking Logic ===
  // Пытаемся связать событие с кампанией
  trackCampaignReaction(user.vk_id, eventType, metadata?.campaign_id, metadata?.post_id);

  // Клонируем пользователя
  let updatedUser = { 
      ...user, 
      ltv_stats: { ...user.ltv_stats },
      social_stats: { ...user.social_stats },
      last_active: new Date().toISOString() // Обновляем дату активности
  };

  // Обновляем общую сумму баллов
  updatedUser.ltv_stats.total += weight;
  updatedUser.ltv = updatedUser.ltv_stats.total;

  // Обновляем категорию баллов
  switch (category) {
    case LtvCategory.GAME:
      updatedUser.ltv_stats.game += weight;
      break;
    case LtvCategory.REACTION:
      updatedUser.ltv_stats.reaction += weight;
      break;
    case LtvCategory.SOCIAL:
      updatedUser.ltv_stats.social += weight;
      break;
    case LtvCategory.TRIGGER:
      updatedUser.ltv_stats.trigger += weight;
      break;
  }

  // Обновляем счетчики социальной активности
  if (eventType === EventType.LIKE_POST) {
      updatedUser.social_stats.likes += 1;
  } else if (eventType === EventType.COMMENT_POST) {
      updatedUser.social_stats.comments += 1;
  } else if (eventType === EventType.REPOST_POST) {
      updatedUser.social_stats.reposts += 1;
  } else if (eventType === EventType.GROUP_JOIN) {
      updatedUser.social_stats.is_member = true;
  } else if (eventType === EventType.GROUP_LEAVE) {
      updatedUser.social_stats.is_member = false;
  }
  
  // Обновляем счетчики игр
  if (eventType === EventType.GAME_START) {
      updatedUser.games_played += 1;
  }

  // Пересчитываем сегмент
  updatedUser = update_user_segment(updatedUser);

  return updatedUser;
};

export const filterUsersByLtv = (users: User[], filters: LtvFilters): User[] => {
  return users.filter(user => {
    const stats = user.ltv_stats;
    const social = user.social_stats;

    // --- 1. Период Активности ---
    if (filters.period && filters.period !== 'ALL') {
       if (!isDateInPeriod(user.last_active, filters.period)) return false;
    }

    // --- 2. Игровая активность ---
    if (filters.has_played !== undefined) {
        const played = user.games_played > 0;
        if (filters.has_played && !played) return false;
        if (!filters.has_played && played) return false;
    }

    // --- 3. Социальная активность (Counters) ---
    if (filters.is_member !== undefined && social.is_member !== filters.is_member) return false;
    if (filters.min_likes !== undefined && social.likes < filters.min_likes) return false;
    if (filters.min_comments !== undefined && social.comments < filters.min_comments) return false;
    if (filters.min_reposts !== undefined && social.reposts < filters.min_reposts) return false;

    // --- 4. LTV Ranges ---
    if (filters.ltv_total_min !== undefined && stats.total < filters.ltv_total_min) return false;
    if (filters.ltv_total_max !== undefined && stats.total > filters.ltv_total_max) return false;
    
    if (filters.ltv_game_min !== undefined && stats.game < filters.ltv_game_min) return false;
    if (filters.ltv_game_max !== undefined && stats.game > filters.ltv_game_max) return false;

    if (filters.ltv_reaction_min !== undefined && stats.reaction < filters.ltv_reaction_min) return false;
    if (filters.ltv_reaction_max !== undefined && stats.reaction > filters.ltv_reaction_max) return false;

    if (filters.ltv_social_min !== undefined && stats.social < filters.ltv_social_min) return false;
    if (filters.ltv_social_max !== undefined && stats.social > filters.ltv_social_max) return false;

    if (filters.ltv_trigger_min !== undefined && stats.trigger < filters.ltv_trigger_min) return false;
    if (filters.ltv_trigger_max !== undefined && stats.trigger > filters.ltv_trigger_max) return false;

    return true;
  });
};