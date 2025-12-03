
import { CampaignSend, Campaign, EventType, CampaignReactionStats, TimePeriod, CampaignFunnelStats, UserSegment } from '../types';
import { mockCampaigns, mockUsers } from './mockData';
import { isDateInPeriod } from '../utils/dateHelpers';

// Мок-база отправок (в реале - таблица SQL campaign_sends)
export const mockCampaignSends: CampaignSend[] = [];

/**
 * 1. Создание записи об отправке
 */
export const recordCampaignSend = (
    campaignId: string,
    opts: { userId?: number; vkId?: number; segment?: UserSegment | 'ALL'; vkMessageId?: number } = {}
) => {
    const { userId, vkId, segment, vkMessageId } = opts;

    // Проверяем, не отправляли ли уже (для идемпотентности моков)
    const exists = mockCampaignSends.some(
        (s) => s.campaign_id === campaignId && (s.user_id === userId || (vkId && s.user_vk_id === vkId))
    );
    if (exists) return;

    mockCampaignSends.push({
        id: `send_${Date.now()}_${userId ?? vkId}_${Math.random()}`,
        campaign_id: campaignId,
        user_id: userId,
        user_vk_id: vkId,
        segment,
        vk_message_id: vkMessageId,
        sent_at: new Date().toISOString(),
    });
};

/**
 * 2. Регистрация реакции пользователя (View / Action)
 * Вызывается из registerEvent или VK Handler
 */
export const trackCampaignReaction = (
    userId: number,
    actionType: EventType | string,
    campaignId?: string,
    postId?: number
) => {
    let sendRecord: CampaignSend | undefined;

    // Сценарий А: Явно передан campaign_id (через payload кнопки/игры)
    if (campaignId) {
        sendRecord = mockCampaignSends.find(
            (s) => s.campaign_id === campaignId && (s.user_id === userId || s.user_vk_id === userId)
        );
    }
    // Сценарий Б: Реакция на пост (ищем активную кампанию по этому посту)
    else if (postId) {
        // Находим кампанию, которая продвигает этот пост
        const campaign = mockCampaigns.find(c => c.target_post_id === postId && c.status === 'SENT');
        if (campaign) {
             // Ищем отправку этому юзеру по этой кампании
             // Важно: проверяем, что отправка была недавно (например, в последние 14 дней)
             sendRecord = mockCampaignSends.find(
                (s) => s.campaign_id === campaign.id && (s.user_id === userId || s.user_vk_id === userId)
             );
             
             // Доп. проверка: если отправка была слишком давно ( > 14 дней), не считаем это реакцией на кампанию
             if (sendRecord && new Date(sendRecord.sent_at).getTime() < Date.now() - 14 * 24 * 60 * 60 * 1000) {
                 sendRecord = undefined;
             }
        }
    }

    if (!sendRecord) return; // Не нашли связь с кампанией

    const now = new Date().toISOString();

    // 2.1 Фиксируем Просмотр (любое первое касание/активность после пуша)
    if (!sendRecord.viewed_at) {
        sendRecord.viewed_at = now;
        console.log(`[Campaign Tracker] User ${userId} VIEWED campaign ${sendRecord.campaign_id}`);
    }

    // 2.2 Фиксируем Целевое Действие (первое значимое)
    if (!sendRecord.first_action_at) {
        sendRecord.first_action_at = now;
        sendRecord.first_action_type = actionType;
        console.log(`[Campaign Tracker] User ${userId} ACTION in campaign ${sendRecord.campaign_id} via ${actionType}`);
    }
};

/**
 * 3. Аналитика (для Админки)
 * Возвращает статистику реакции по кампании, с учетом фильтра по периоду (когда было действие)
 */
export const getCampaignReactionStats = (campaignId: string, period: TimePeriod = 'ALL'): CampaignReactionStats => {
    const funnel = getCampaignFunnel(campaignId, period);
    return {
        recipients_total: funnel.recipients_total,
        views: funnel.views,
        view_conversion: funnel.view_conversion,
        actions_total: funnel.actions_total,
        action_conversion: funnel.action_conversion,
        avg_delay_seconds: funnel.avg_delay_seconds,
        actions_by_type: funnel.actions_by_type
    };
};

/**
 * 4. ПОЛНАЯ ВОРОНКА (FUNNEL)
 * Sent -> Viewed -> Acted -> Warm/Hot Users
 */
export const getCampaignFunnel = (campaignId: string, period: TimePeriod = 'ALL'): CampaignFunnelStats => {
    // 1. Выбираем отправки конкретной кампании
    const sends = mockCampaignSends.filter((s) => {
        if (s.campaign_id !== campaignId) return false;
        if (period === 'ALL') return true;
        return isDateInPeriod(s.sent_at, period);
    });
    const total = sends.length;

    if (total === 0) {
        return { 
            recipients_total: 0, views: 0, view_conversion: 0, 
            actions_total: 0, action_conversion: 0, avg_delay_seconds: 0, actions_by_type: {},
            warm_hot_count: 0, warm_hot_rate: 0, warm_hot_from_acted: 0
        };
    }

    // 2. Фильтрация "Увидели" и "Действовали" по периоду
    // Если пользователь посмотрел пуш в рамках выбранного периода
    const viewedSends = sends.filter(s => s.viewed_at && isDateInPeriod(s.viewed_at, period));
    
    // Если действие было в рамках периода
    const actedSends = sends.filter(s => s.first_action_at && isDateInPeriod(s.first_action_at, period));

    // 3. Подсчет LTV сегментов (Warm/Hot)
    // Смотрим текущее состояние пользователей, которые получили пуш и совершили действие
    let warmHotCount = 0;
    
    // Для более точной воронки считаем Warm/Hot среди тех, кто совершил действие (или среди всех получивших - зависит от задачи)
    // Здесь считаем среди тех, кто СОВЕРШИЛ ДЕЙСТВИЕ, сколько из них сейчас Warm/Hot
    actedSends.forEach(s => {
        const user = mockUsers.find(u => u.id === s.user_id);
        const segment = s.segment ?? user?.segment;
        if (segment === UserSegment.WARM || segment === UserSegment.HOT) {
            warmHotCount++;
        }
    });

    // 4. Мета-статистика
    const actionsByType: Record<string, number> = {};
    let totalDelay = 0;

    actedSends.forEach(s => {
        if (s.first_action_type) {
            actionsByType[s.first_action_type] = (actionsByType[s.first_action_type] || 0) + 1;
        }
        if (s.first_action_at && s.sent_at) {
            const delay = new Date(s.first_action_at).getTime() - new Date(s.sent_at).getTime();
            totalDelay += delay;
        }
    });

    return {
        recipients_total: total,
        
        views: viewedSends.length,
        view_conversion: Math.round((viewedSends.length / total) * 100),
        
        actions_total: actedSends.length,
        action_conversion: Math.round((actedSends.length / total) * 100),
        
        avg_delay_seconds: actedSends.length > 0 ? Math.round((totalDelay / actedSends.length) / 1000) : 0,
        actions_by_type: actionsByType,

        warm_hot_count: warmHotCount,
        // Конверсия в Warm/Hot от общего числа
        warm_hot_rate: Math.round((warmHotCount / total) * 100),
        // Конверсия в Warm/Hot от тех, кто действовал
        warm_hot_from_acted: actedSends.length > 0 ? Math.round((warmHotCount / actedSends.length) * 100) : 0
    };
};

/**
 * 5. Воронка по всем кампаниям за период
 * Используется в админке как сводка "успешных рассылок" без привязки к конкретной кампании
 */
export const getCampaignFunnelForPeriod = (period: TimePeriod = 'ALL'): CampaignFunnelStats => {
    const sends = mockCampaignSends.filter((s) => period === 'ALL' || isDateInPeriod(s.sent_at, period));
    const total = sends.length;

    if (total === 0) {
        return {
            recipients_total: 0,
            views: 0,
            view_conversion: 0,
            actions_total: 0,
            action_conversion: 0,
            avg_delay_seconds: 0,
            actions_by_type: {},
            warm_hot_count: 0,
            warm_hot_rate: 0,
            warm_hot_from_acted: 0,
        };
    }

    const viewedSends = sends.filter((s) => s.viewed_at && isDateInPeriod(s.viewed_at, period));
    const actedSends = sends.filter((s) => s.first_action_at && isDateInPeriod(s.first_action_at, period));

    let warmHotCount = 0;
    actedSends.forEach((s) => {
        const user = mockUsers.find((u) => u.id === s.user_id || u.vk_id === s.user_vk_id);
        const segment = s.segment ?? user?.segment;
        if (segment === UserSegment.WARM || segment === UserSegment.HOT) {
            warmHotCount++;
        }
    });

    const actionsByType: Record<string, number> = {};
    let totalDelay = 0;

    actedSends.forEach((s) => {
        if (s.first_action_type) {
            actionsByType[s.first_action_type] = (actionsByType[s.first_action_type] || 0) + 1;
        }
        if (s.first_action_at && s.sent_at) {
            totalDelay += new Date(s.first_action_at).getTime() - new Date(s.sent_at).getTime();
        }
    });

    return {
        recipients_total: total,
        views: viewedSends.length,
        view_conversion: Math.round((viewedSends.length / total) * 100),
        actions_total: actedSends.length,
        action_conversion: Math.round((actedSends.length / total) * 100),
        avg_delay_seconds: actedSends.length > 0 ? Math.round(totalDelay / actedSends.length / 1000) : 0,
        actions_by_type: actionsByType,
        warm_hot_count: warmHotCount,
        warm_hot_rate: Math.round((warmHotCount / total) * 100),
        warm_hot_from_acted: actedSends.length > 0 ? Math.round((warmHotCount / actedSends.length) * 100) : 0,
    };
};