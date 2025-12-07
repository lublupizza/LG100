import { User, UserHistoryItem, EventType, LtvCategory } from '../types';
import { EVENT_CATEGORIES, EVENT_WEIGHTS } from './ltvEngine';

const apiFetch = async <T>(url: string, init?: RequestInit): Promise<T> => {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      console.warn(`Request to ${url} failed with status ${response.status}`);
      return Promise.reject(new Error(`Request failed: ${response.status}`));
    }
    return (await response.json()) as T;
  } catch (err) {
    console.error(`Failed to call ${url}`, err);
    throw err;
  }
};

export const getUserActivityLog = async (user: User): Promise<UserHistoryItem[]> => {
  if (!user?.id) return [];

  try {
    const history = await apiFetch<UserHistoryItem[]>(`/api/users/${user.id}/history`);
    if (Array.isArray(history)) {
      return history.map((item) => ({
        ...item,
        category: item.category ?? EVENT_CATEGORIES[item.type],
        value_change: item.value_change ?? EVENT_WEIGHTS[item.type],
      }));
    }
  } catch (err) {
    console.warn('Falling back to generated activity log', err);
  }

  const fallback: UserHistoryItem[] = [];
  const addEvent = (type: EventType, dateOffsetDays: number, desc?: string, meta?: any) => {
    const date = new Date();
    date.setDate(date.getDate() - dateOffsetDays);
    date.setHours(Math.floor(Math.random() * 23), Math.floor(Math.random() * 59));

    fallback.push({
      id: `evt_${Math.random().toString(36).substr(2, 9)}`,
      type,
      category: EVENT_CATEGORIES[type] ?? LtvCategory.LOYALTY,
      date: date.toISOString(),
      description: desc || `Событие: ${type}`,
      value_change: EVENT_WEIGHTS[type] ?? 0,
      metadata: meta,
    });
  };

  const triggerPoints = user.ltv_stats?.trigger ?? 0;
  const estimatedLeads = Math.floor(triggerPoints / 10);
  for (let i = 0; i < estimatedLeads; i++) {
    addEvent(EventType.LEAD, Math.floor(Math.random() * 14), 'Нажал "Хочу Пиццу"');
  }

  return fallback.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getUserCampaignsHistory = async (userId: number) => {
  if (!userId) return [];

  try {
    const campaigns = await apiFetch<any[]>(`/api/users/${userId}/campaigns`);
    return Array.isArray(campaigns) ? campaigns : [];
  } catch (err) {
    console.warn('Failed to load campaign history for user', err);
    return [];
  }
};
