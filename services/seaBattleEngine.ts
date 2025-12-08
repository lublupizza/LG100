import { CellState } from '../types';

export interface GameStatusResponse {
  id?: string | number;
  userId?: number;
  status?: string;
  moves?: number;
  createdAt?: string;
  updatedAt?: string;
  board?: CellState[][] | string;
}

const parseBoard = (board: unknown): CellState[][] | undefined => {
  if (Array.isArray(board)) return board as CellState[][];
  if (typeof board === 'string') {
    try {
      const parsed = JSON.parse(board);
      return Array.isArray(parsed) ? (parsed as CellState[][]) : undefined;
    } catch (err) {
      console.warn('Failed to parse board JSON', err);
      return undefined;
    }
  }
  return undefined;
};

/**
 * Получить активную игру пользователя.
 */
export async function getGameStatus(vkId: number): Promise<(GameStatusResponse & { board?: CellState[][] }) | null> {
  const response = await fetch(`/api/games/active/${vkId}`);

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Failed to load game status: ${response.statusText}`);
  }

  const data: GameStatusResponse = await response.json();
  const parsedBoard = parseBoard(data.board);

  return {
    ...data,
    board: parsedBoard,
  };
}

/**
 * Отправить ход игрока. Предполагается, что серверная логика обрабатывает выстрел и возвращает обновленное поле.
 */
export async function sendMove(vkId: number, coords: { x: number; y: number }): Promise<(GameStatusResponse & { board?: CellState[][] }) | null> {
  const response = await fetch('/api/games/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vkId, x: coords.x, y: coords.y }),
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Failed to send move: ${response.statusText}`);
  }

  const data: GameStatusResponse = await response.json();
  const parsedBoard = parseBoard(data.board);

  return {
    ...data,
    board: parsedBoard,
  };
}

type SessionState = {
  userId: number;
  campaignId?: number;
  active: boolean;
};

/**
 * Простая in-memory реализация менеджера игровых сессий для обработчиков событий.
 * Позволяет создавать сессии и отвечать на сообщения, не падая с ошибкой импорта.
 */
export const SeaBattleSessionManager = {
  sessions: new Map<number, SessionState>(),

  startSession(userId: number, campaignId?: number) {
    this.sessions.set(userId, { userId, campaignId, active: true });
  },

  handleUserMessage(userId: number, text: string): string | null {
    const session = this.sessions.get(userId);
    if (!session || !session.active) return null;

    const normalized = text.trim().toLowerCase();
    if (!normalized) return 'Введите координаты хода, например "А5"';

    if (['стоп', 'stop', 'выход', 'exit'].includes(normalized)) {
      this.sessions.delete(userId);
      return 'Игра завершена. Спасибо за участие!';
    }

    // Пока нет полноценной обработки ходов, просто подтверждаем прием сообщения.
    return 'Ход принят! Ожидайте результата.';
  },
};
