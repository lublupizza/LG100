import { Campaign, UserSegment, CampaignStats } from '../types';

export const fetchCampaigns = async (): Promise<Campaign[]> => {
  try {
    const res = await fetch('/api/campaigns');
    if (!res.ok) return [];
    const payload = await res.json();
    return payload.campaigns || payload || [];
  } catch (e) {
    console.warn('Не удалось загрузить кампании', e);
    return [];
  }
};

export const createCampaign = async (campaign: Partial<Campaign>): Promise<Campaign | null> => {
  try {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('Не удалось создать кампанию', e);
    return null;
  }
};

export type CampaignFilter = {
  segment_target?: UserSegment | 'ALL';
  min_games?: number;
  is_member?: boolean;
};

export const launchCampaign = async (
  campaign: Campaign,
  filters: CampaignFilter = {}
): Promise<Campaign | null> => {
  if (!campaign) return null;

  const imageBase64 = (campaign as any).image_base64;
  const imageUrl = !imageBase64 ? (((campaign as any).imageUrl || campaign.image_url || '').trim()) : '';
  const voiceBase64 = (campaign as any).voice_base64;
  const voiceUrl = !voiceBase64 ? (((campaign as any).voice_url || (campaign as any).voiceUrl || '').trim()) : '';

  const payload = {
    campaignId: campaign.id,
    name: campaign.name,
    message: campaign.message,
    type: campaign.type,
    segment: campaign.segment_target,
    imageUrl,
    image_url: imageUrl,
    image_base64: imageBase64,
    imageName: (campaign as any).image_name,
    voiceUrl,
    voice_url: voiceUrl,
    voiceBase64,
    voiceName: (campaign as any).voice_name,
    filters,
  };

  try {
    const response = await fetch('/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return {
      ...campaign,
      status: 'SENT',
      stats: {
        sent: data.sent ?? campaign.stats.sent,
        delivered: data.delivered ?? campaign.stats.delivered,
        clicked: campaign.stats.clicked,
        games_started: data.games_started ?? campaign.stats.games_started,
        players_active: data.players_active ?? campaign.stats.players_active,
        games_finished: data.games_finished ?? campaign.stats.games_finished,
        avg_moves: data.avg_moves ?? campaign.stats.avg_moves,
      },
      image_url: imageBase64 ? undefined : imageUrl || undefined,
      image_base64: imageBase64 || undefined,
      voice_url: voiceUrl || undefined,
      voice_base64: voiceBase64 || undefined,
    } as Campaign;
  } catch (e) {
    console.warn('Не удалось запустить кампанию', e);
    return null;
  }
};

export const recalculateGameStats = (campaign: Campaign): CampaignStats => campaign.stats;
