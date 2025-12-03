import React, { useState, useMemo } from 'react';
import { GameSession, GameStatus, GameChannel, CellState, GameType, User, TimePeriod } from '../types';
import { Gamepad2, X, Eye, Filter, Clock, Calendar } from 'lucide-react';
import { isDateInPeriod } from '../utils/dateHelpers';

interface GamesProps {
  users: User[];
}

const Games: React.FC<GamesProps> = ({ users }) => {
  const [selectedGame, setSelectedGame] = useState<GameSession | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'FINISHED'>('ACTIVE');
  const [filterPeriod, setFilterPeriod] = useState<TimePeriod>('ALL');

  const realGames: GameSession[] = useMemo(() => {
    const list: GameSession[] = [];
    users.forEach(user => {
      if (user.games && user.games.length > 0) {
        user.games.forEach((dbGame: any) => {
          let parsedBoard = [];
          try { parsedBoard = JSON.parse(dbGame.board); } catch (e) {}
          list.push({
            id: dbGame.id,
            user_id: user.id,
            user_name: user.first_name ? `${user.first_name} ${user.last_name}` : `User ${user.vk_id}`,
            type: GameType.BATTLESHIP,
            channel: GameChannel.DM,
            status: dbGame.status as GameStatus,
            started_at: dbGame.createdAt,
            updated_at: dbGame.updatedAt || dbGame.createdAt,
            moves_count: dbGame.moves || 0,
            state_summary: dbGame.status === 'ACTIVE' ? 'Идет бой' : 'Завершено',
            board: parsedBoard
          });
        });
      }
    });
    const filtered = list.filter(game => {
        if (filterStatus !== 'ALL' && game.status !== filterStatus) return false;
        if (!isDateInPeriod(game.updated_at, filterPeriod)) return false;
        return true;
    });
    return filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [users, filterStatus, filterPeriod]);

  const letters = 'АБВГДЕЖЗИК'.split('');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ЗАГОЛОВОК И ФИЛЬТРЫ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
            <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900">
            <Gamepad2 className="text-purple-600" />
            Игровые сессии
            </h3>
            <p className="text-xs text-gray-500 mt-1">Всего найдено: {realGames.length}</p>
        </div>
        <div className="flex flex-wrap gap-3">
           <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
               <Filter size={16} className="text-gray-400" />
               <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer"
               >
                   <option value="ALL">Все статусы</option>
                   <option value="ACTIVE">🔥 Активные</option>
                   <option value="FINISHED">🏁 Завершенные</option>
               </select>
           </div>
           <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
               <Clock size={16} className="text-gray-400" />
               <select 
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value as any)}
                  className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer"
               >
                   <option value="ALL">За всё время</option>
                   <option value="1d">За 24 часа</option>
                   <option value="7d">За неделю</option>
                   <option value="1m">За месяц</option>
               </select>
           </div>
        </div>
      </div>

      {/* СПИСОК ИГР */}
      {realGames.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed flex flex-col items-center">
              <Gamepad2 size={48} className="opacity-20 mb-4" />
              <p>Игр с такими параметрами не найдено.</p>
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {realGames.map((game) => (
            <div key={game.id} onClick={() => setSelectedGame(game)} className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden group shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-pizza-red">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${game.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                      <span className="font-bold text-gray-900">Бой #{game.id}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded font-bold ${game.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {game.status === 'ACTIVE' ? 'ACTIVE' : 'DONE'}
                  </span>
                </div>
                <div className="space-y-1 mb-4 border-b border-gray-100 pb-3">
                  <div className="text-sm text-gray-500">Игрок: <span className="text-gray-900 font-medium">{game.user_name}</span></div>
                  <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                      <Calendar size={10} /> 
                      {new Date(game.updated_at).toLocaleString('ru-RU')}
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs text-gray-500 font-medium">Ходов: {game.moves_count}</span>
                  <span className="text-xs bg-red-50 text-pizza-red px-2 py-1 rounded font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye size={12} /> Поле
                  </span>
                </div>
            </div>
            ))}
        </div>
      )}

      {/* МОДАЛКА С ПОЛЕМ (ЭМОДЗИ ВЕРСИЯ) */}
      {selectedGame && selectedGame.board && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <div>
                 <h4 className="font-bold text-lg text-gray-900">
                    {selectedGame.status === 'FINISHED' ? 'Результат игры' : 'Текущая ситуация'}
                 </h4>
                 <p className="text-xs text-gray-500">Игрок: {selectedGame.user_name}</p>
               </div>
               <button onClick={() => setSelectedGame(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                 <X size={20} />
               </button>
            </div>
            
            <div className="p-6 flex justify-center bg-white overflow-y-auto">
               <div className="inline-block bg-gray-50 p-3 rounded-xl border border-gray-200 select-none">
                  <table className="border-collapse">
                    <thead>
                      <tr>
                        <th className="w-8 h-8"></th>
                        {letters.map((l, i) => (
                          <th key={i} className="w-8 h-8 text-xs font-bold text-gray-500 text-center align-middle">{l}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedGame.board.map((row, y) => (
                        <tr key={y}>
                          <td className="w-8 h-8 text-xs font-bold text-gray-500 text-center align-middle">{y + 1}</td>
                          {row.map((cell, x) => (
                            <td key={x} className="p-0.5">
                              <div 
                                className={`
                                  w-7 h-7 flex items-center justify-center rounded text-base leading-none transition-all relative
                                  ${cell === 0 ? 'bg-white border border-gray-200' : ''} 
                                  ${cell === 1 ? 'bg-blue-600 border border-blue-700 shadow-sm' : ''} 
                                  ${cell === 2 ? 'bg-gray-200 text-gray-400 text-xs font-bold' : ''}
                                  ${cell === 3 ? 'bg-red-100 border-red-300' : ''}
                                  ${cell === 4 ? 'bg-gray-700 border-gray-800' : ''}
                                `}
                                title={`Координата: ${letters[x]}${y+1}`}
                              >
                                 {cell === 2 && '•'}
                                 {/* ЭМОДЗИ ВМЕСТО КРЕСТОВ */}
                                 {cell === 3 && '🔥'}
                                 {cell === 4 && '☠️'}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
            
            {/* Оновленная легенда */}
            <div className="p-4 bg-gray-50 text-xs text-gray-600 flex justify-center gap-4 flex-wrap">
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600 rounded"></div> Корабль</span>
                <span className="flex items-center gap-1">🔥 Попадание</span>
                <span className="flex items-center gap-1">☠️ Убит</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-200 rounded"></div> Мимо</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Games;
