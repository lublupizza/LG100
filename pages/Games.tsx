
import React, { useState } from 'react';
import { GameSession, GameStatus, GameChannel, CellState, GameType } from '../types';
import { mockGames } from '../services/mockData';
import { SeaBattleSessionManager } from '../services/seaBattleEngine';
import { Gamepad2, Crosshair, X, Clock, PlayCircle } from 'lucide-react';

const Games: React.FC = () => {
  const [selectedGame, setSelectedGame] = useState<GameSession | null>(null);

  // Обработка клика по ячейке (для админ-теста)
  const handleCellClick = (x: number, y: number) => {
    if (!selectedGame || selectedGame.status !== GameStatus.ACTIVE) return;
    
    // Эмуляция хода через движок
    SeaBattleSessionManager.adminForceMove(selectedGame.id, x, y);
    
    // Force rerender (in real app, use state or context)
    setSelectedGame({...selectedGame}); 
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900">
           <Gamepad2 className="text-purple-600" />
           Активные игровые сессии
        </h3>
        <div className="flex gap-2">
           <span className="px-3 py-1 bg-white rounded-lg text-sm border border-gray-200 font-medium text-gray-600 shadow-sm">Морской бой: {mockGames.filter(g => g.type === 'BATTLESHIP').length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {mockGames.map((game) => (
          <div 
            key={game.id} 
            onClick={() => setSelectedGame(game)}
            className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden group shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-pizza-red"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${game.status === GameStatus.ACTIVE ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                <span className="font-bold text-gray-900">{game.type === GameType.BATTLESHIP ? 'Морской Бой' : 'Камень-Ножницы'}</span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-1 bg-gray-100 rounded text-gray-600 border border-gray-200">
                {game.channel === GameChannel.DM ? 'ЛС' : 'Комменты'}
              </span>
            </div>

            <div className="space-y-1 mb-4 border-b border-gray-100 pb-3">
              <div className="text-sm text-gray-500">Игрок: <span className="text-gray-900 font-medium">{game.user_name}</span></div>
              <div className="text-xs text-gray-400">Обновлено: {new Date(game.updated_at).toLocaleTimeString()}</div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3">
               <p className="text-[10px] text-gray-400 mb-1 uppercase font-bold tracking-wider">Состояние</p>
               <p className="text-sm font-mono text-gray-800 font-medium truncate">{game.state_summary}</p>
            </div>
            
            <div className="flex justify-between items-center pt-1">
               <span className="text-xs text-gray-500 font-medium">Ходов: {game.moves_count}</span>
               <span className="text-xs bg-red-50 text-pizza-red px-2 py-1 rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                 Открыть поле
               </span>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: Sea Battle Board */}
      {selectedGame && selectedGame.type === GameType.BATTLESHIP && selectedGame.board && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <div>
                 <h4 className="font-bold text-lg text-gray-900">Морской бой</h4>
                 <p className="text-xs text-gray-500">Игрок: {selectedGame.user_name}</p>
               </div>
               <button onClick={() => setSelectedGame(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                 <X size={20} />
               </button>
            </div>
            
            <div className="p-6 flex justify-center bg-white overflow-y-auto">
               {/* 10x10 GRID */}
               <div className="grid grid-cols-10 gap-1 bg-gray-200 p-1 rounded border border-gray-300 select-none">
                  {selectedGame.board.map((row, y) => (
                    row.map((cell, x) => (
                      <div 
                        key={`${x}-${y}`}
                        onClick={() => handleCellClick(x, y)}
                        className={`
                          w-8 h-8 flex items-center justify-center rounded-sm text-xs cursor-pointer transition-colors
                          ${cell === CellState.EMPTY ? 'bg-blue-50 hover:bg-blue-100' : ''}
                          ${cell === CellState.MISS ? 'bg-gray-300 text-gray-500' : ''}
                          ${cell === CellState.HIT ? 'bg-red-500 text-white' : ''}
                          ${cell === CellState.SHIP ? 'bg-blue-100 hover:bg-red-100 border border-blue-200' : ''} 
                        `}
                      >
                         {/* В админке мы видим корабли (SHIP), но показываем их прозрачно или специально,
                             чтобы админ мог подсказать или потестить. Для игрока SHIP выглядит как EMPTY */}
                         {cell === CellState.MISS && '•'}
                         {cell === CellState.HIT && 'X'}
                         {cell === CellState.SHIP && <div className="w-2 h-2 bg-blue-300 rounded-full opacity-50" />}
                      </div>
                    ))
                  ))}
               </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50">
               <div className="flex justify-between items-center">
                  <div className="text-sm">
                    <span className="font-bold text-gray-900">{selectedGame.status}</span>
                    <span className="mx-2 text-gray-300">|</span>
                    Ходов: {selectedGame.moves_count}
                  </div>
                  <button onClick={() => handleCellClick(0,0)} className="text-xs text-pizza-red hover:underline">
                    Эмуляция хода (Admin)
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Games;
