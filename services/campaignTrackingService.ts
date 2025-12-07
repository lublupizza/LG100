import { EventType, CampaignReactionStats, TimePeriod, CampaignFunnelStats, UserSegment } from '../types';

const defaultFunnel: CampaignFunnelStats = {
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

export const recordCampaignSend = async (
  campaignId: string,
  opts: { userId?: number; vkId?: number; segment?: UserSegment | 'ALL'; vkMessageId?: number } = {}
) => {
  try {
    await fetch('/api/campaigns/track-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, ...opts }),
    });
  } catch (e) {
    console.warn('Не удалось зафиксировать отправку кампании', e);
  }
};

export const trackCampaignReaction = async (
  userId: number,
  actionType: EventType | string,
  campaignId?: string,
  postId?: number
) => {
  try {
    await fetch('/api/campaigns/track-reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, actionType, campaignId, postId }),
    });
  } catch (e) {
    console.warn('Не удалось зафиксировать реакцию кампании', e);
  }
};

export const getCampaignReactionStats = async (campaignId: string, period: TimePeriod = 'ALL'): Promise<CampaignReactionStats> => {
  const funnel = await getCampaignFunnel(campaignId, period);
  return {
    recipients_total: funnel.recipients_total,
    views: funnel.views,
    view_conversion: funnel.view_conversion,
    actions_total: funnel.actions_total,
    action_conversion: funnel.action_conversion,
    avg_delay_seconds: funnel.avg_delay_seconds,
    actions_by_type: funnel.actions_by_type,
  };
};

export const getCampaignFunnel = async (campaignId: string, period: TimePeriod = 'ALL'): Promise<CampaignFunnelStats> => {
  try {
    const res = await fetch(`/api/campaigns/${campaignId}/funnel?period=${period}`);
    if (!res.ok) return defaultFunnel;
    return await res.json();
  } catch (e) {
    console.warn('Не удалось получить воронку кампании', e);
    return defaultFunnel;
  }
};

export const getCampaignFunnelForPeriod = async (period: TimePeriod = 'ALL'): Promise<CampaignReactionStats> => {
  try {
    const res = await fetch(`/api/campaigns/funnel?period=${period}`);
    if (!res.ok) return defaultFunnel;
    return await res.json();
  } catch (e) {
    console.warn('Не удалось получить общую воронку кампаний', e);
    return defaultFunnel;
  }
};
