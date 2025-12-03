
import { CellState, GameSession, GameType, GameChannel, GameStatus, EventType, User } from '../types';
import { registerEvent } from './ltvEngine';
import { mockGames, mockUsers } from './mockData';

// === 1. ЯДРО ИГРЫ (Logic) ===

export class SeaBattleGame {
  // Генерация пустого поля 10x10
  static createEmptyBoard(): CellState[][] {
    return Array(10).fill(null).map(() => Array(10).fill(CellState.EMPTY));
  }

  // Генерация поля с кораблями (упрощенная рандомизация для демо)
  static generateBoard(): CellState[][] {
    const board = this.createEmptyBoard();
    
    // Простая логика размещения: ставим несколько кораблей случайно
    // В реальном проде нужен алгоритм с проверкой границ и наложений
    const ships = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]; // Размеры кораблей
    
    ships.forEach(size => {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 100) {
        const isHorizontal = Math.random() > 0.5;
        const x = Math.floor(Math.random() * 10);
        const y = Math.floor(Math.random() * 10);
        
        // Упрощенная проверка границ
        if (isHorizontal && x + size <= 10) {
           // Проверка наложения (очень простая)
           let clear = true;
           for(let k=0; k<size; k++) if(board[y][x+k] !== CellState.EMPTY) clear = false;
           
           if(clear) {
             for(let k=0; k<size; k++) board[y][x+k] = CellState.SHIP;
             placed = true;
           }
        } else if (!isHorizontal && y + size <= 10) {
           let clear = true;
           for(let k=0; k<size; k++) if(board[y+k][x] !== CellState.EMPTY) clear = false;
           
           if(clear) {
             for(let k=0; k<size; k++) board[y+k][x] = CellState.SHIP;
             placed = true;
           }
        }
        attempts++;
      }
    });

    return board;
  }

  // Обработка выстрела
  static processShot(board: CellState[][], x: number, y: number): { result: string, newState: CellState, isWin: boolean } {
    const cell = board[y][x];
    
    if (cell === CellState.MISS || cell === CellState.HIT || cell === CellState.KILLED) {
      return { result: 'Сюда уже стреляли!', newState: cell, isWin: false };
    }

    if (cell === CellState.EMPTY) {
      board[y][x] = CellState.MISS;
      return { result: 'Мимо!', newState: CellState.MISS, isWin: false };
    }

    if (cell === CellState.SHIP) {
      board[y][x] = CellState.HIT;
      // Проверка на победу (есть ли еще корабли)
      const hasShips = board.some(row => row.includes(CellState.SHIP));
      
      // В реальной игре нужно проверять "Убил" (весь корабль потоплен)
      // Здесь для упрощения считаем HIT
      return { result: hasShips ? 'Попал!' : 'ПОБЕДА! Флот уничтожен.', newState: CellState.HIT, isWin: !hasShips };
    }

    return { result: 'Ошибка', newState: CellState.EMPTY, isWin: false };
  }
}

// === 2. МЕНЕДЖЕР СЕССИЙ (Session Manager) ===

export class SeaBattleSessionManager {
  
  // Создание новой сессии (например, при старте кампании)
  static startSession(userId: number, campaignId?: string): GameSession {
    const user = mockUsers.find(u => u.id === userId);
    
    const newSession: GameSession = {
      id: `game_${Date.now()}_${userId}`,
      user_id: userId,
      user_name: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
      type: GameType.BATTLESHIP,
      channel: GameChannel.DM,
      status: GameStatus.ACTIVE,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      moves_count: 0,
      state_summary: 'Игра началась. Ждем первый ход.',
      campaign_id: campaignId,
      board: SeaBattleGame.generateBoard()
    };

    // Сохраняем в мок-базу
    mockGames.unshift(newSession);

    // LTV Event: Game Start
    if (user) {
      registerEvent(user, EventType.GAME_START);
    }

    return newSession;
  }

  // Обработка хода (симуляция входящего сообщения A1..J10)
  static handleMove(sessionId: string, coord: string) {
    const session = mockGames.find(g => g.id === sessionId);
    if (!session || !session.board || session.status !== GameStatus.ACTIVE) return;

    // Парсинг координаты (A1 -> x=0, y=0)
    // Упрощенно: x, y приходят числами от UI для теста
    // В реальном боте здесь парсер текста
  }

  // Метод для вызова из UI админки (клик по клетке)
  // Эмулирует ход пользователя
  static adminForceMove(sessionId: string, x: number, y: number) {
    const session = mockGames.find(g => g.id === sessionId);
    const user = mockUsers.find(u => u.id === session?.user_id);
    
    if (!session || !session.board || session.status !== GameStatus.ACTIVE) return;

    const { result, isWin } = SeaBattleGame.processShot(session.board, x, y);

    // Обновляем состояние сессии
    session.moves_count++;
    session.updated_at = new Date().toISOString();
    session.state_summary = `Ход ${session.moves_count}: ${coordToText(x, y)} - ${result}`;

    // LTV Event: Game Play
    if (user) {
      registerEvent(user, EventType.GAME_PLAY);
    }

    if (isWin) {
      session.status = GameStatus.FINISHED;
      session.state_summary = 'ПОБЕДА! Игра завершена.';
      // LTV Event: Win
      if (user) {
        registerEvent(user, EventType.GAME_WIN);
      }
    }
  }
}

// Хелпер для координат
function coordToText(x: number, y: number): string {
  const letters = 'ABCDEFGHIJ';
  return `${letters[x]}${y + 1}`;
}
