import { GameSession } from '../types';

export const fetchGames = async (): Promise<GameSession[]> => {
  try {
    const res = await fetch('/api/games');
    if (!res.ok) return [];
    const payload = await res.json();
    return payload.games || payload || [];
  } catch (e) {
    console.warn('Не удалось загрузить игры', e);
    return [];
  }
};

export const fetchGameByUser = async (userId: number): Promise<GameSession | null> => {
  try {
    const res = await fetch(`/api/games/${userId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('Не удалось загрузить игру пользователя', e);
    return null;
  }
};
