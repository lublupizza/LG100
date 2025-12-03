import { CellState, GameSession, GameType, GameChannel, GameStatus, EventType, User } from '../types';
import { registerEvent } from './ltvEngine';
import { mockGames, mockUsers } from './mockData';

// === 1. ЯДРО ИГРЫ (Logic) ===

export class SeaBattleGame {
  // Генерация пустого поля 10x10
  static createEmptyBoard(): CellState[][] {
    return Array(10).fill(null).map(() => Array(10).fill(CellState.EMPTY));
  }

  // Генерация поля с кораблями
  static generateBoard(): CellState[][] {
    const board = this.createEmptyBoard();
    const ships = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]; // Размеры кораблей
    
    ships.forEach(size => {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 100) {
        const isHorizontal = Math.random() > 0.5;
        const x = Math.floor(Math.random() * 10);
        const y = Math.floor(Math.random() * 10);
        
        // Проверка границ и наложений
        if (isHorizontal && x + size <= 10) {
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

  // Helper: Найти все клетки конкретного корабля
  static getShipCells(board: CellState[][], x: number, y: number): {x: number, y: number}[] {
    const cells: {x: number, y: number}[] = [];
    const visited = new Set<string>();
    
    const traverse = (cx: number, cy: number) => {
        const key = `${cx},${cy}`;
        if (visited.has(key)) return;
        visited.add(key);

        if (cx < 0 || cx >= 10 || cy < 0 || cy >= 10) return;
        const cell = board[cy][cx];
        
        // Ищем и живые, и подбитые части корабля
        if (cell === CellState.SHIP || cell === CellState.HIT || cell === CellState.KILLED) {
            cells.push({x: cx, y: cy});
            traverse(cx + 1, cy);
            traverse(cx - 1, cy);
            traverse(cx, cy + 1);
            traverse(cx, cy - 1);
        }
    };

    traverse(x, y);
    return cells;
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
      // 1. Помечаем попадание
      board[y][x] = CellState.HIT;
      
      // 2. Проверяем, убит ли корабль полностью
      const shipCells = this.getShipCells(board, x, y);
      const isKilled = shipCells.every(c => board[c.y][c.x] === CellState.HIT || board[c.y][c.x] === CellState.KILLED);
      
      let resultText = 'Попал!';
      let newState = CellState.HIT;

      if (isKilled) {
        resultText = 'УБИЛ! Корабль пошел ко дну.';
        newState = CellState.KILLED;
        
        // 3. Красим корабль в KILLED и ставим MISS вокруг (ореол)
        shipCells.forEach(c => {
            board[c.y][c.x] = CellState.KILLED;
            
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = c.x + dx;
                    const ny = c.y + dy;
                    if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
                        if (board[ny][nx] === CellState.EMPTY) {
                            board[ny][nx] = CellState.MISS;
                        }
                    }
                }
            }
        });
      }

      // 4. Проверка на победу
      const hasShips = board.some(row => row.includes(CellState.SHIP));
      
      return { result: hasShips ? resultText : 'ПОБЕДА! Флот уничтожен.', newState: newState, isWin: !hasShips };
    }

    return { result: 'Ошибка', newState: CellState.EMPTY, isWin: false };
  }
}

// === 2. МЕНЕДЖЕР СЕССИЙ (Session Manager) ===

export class SeaBattleSessionManager {
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
    mockGames.unshift(newSession);
    if (user) registerEvent(user, EventType.GAME_START);
    return newSession;
  }

  static adminForceMove(sessionId: string, x: number, y: number) {
    const session = mockGames.find(g => g.id === sessionId);
    const user = mockUsers.find(u => u.id === session?.user_id);
    
    if (!session || !session.board || session.status !== GameStatus.ACTIVE) return;

    const { result, isWin } = SeaBattleGame.processShot(session.board, x, y);

    session.moves_count++;
    session.updated_at = new Date().toISOString();
    session.state_summary = `Ход ${session.moves_count}: ${coordToText(x, y)} - ${result}`;

    if (user) registerEvent(user, EventType.GAME_PLAY);

    if (isWin) {
      session.status = GameStatus.FINISHED;
      session.state_summary = 'ПОБЕДА! Игра завершена.';
      if (user) registerEvent(user, EventType.GAME_WIN);
    }
  }
}

function coordToText(x: number, y: number): string {
  const letters = 'ABCDEFGHIJ';
  return `${letters[x]}${y + 1}`;
}