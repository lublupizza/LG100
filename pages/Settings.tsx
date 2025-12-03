
import React from 'react';
import { Save, TrendingUp } from 'lucide-react';
import { EVENT_WEIGHTS, EVENT_CATEGORIES } from '../services/ltvEngine';
import { EventType } from '../types';

const Settings: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h3 className="text-2xl font-bold mb-2 text-gray-900">Настройки Бота</h3>
        <p className="text-gray-500">Управление конфигурацией подключения к ВКонтакте и параметрами игры.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Main Config */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 shadow-sm">
            <h4 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                <span className="w-1 h-6 bg-pizza-red rounded-full"></span>
                VK Подключение
            </h4>
            
            <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Group ID</label>
                  <input type="text" defaultValue="20045123" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none transition-all" />
                </div>
                <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-1.5">Admin IDs</label>
                   <input type="text" defaultValue="123456, 789012" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none transition-all" />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">API Token</label>
                    <input type="password" value="vk1.a.********************************" readOnly className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-400 font-mono" />
                </div>
            </div>
        </div>

        {/* LTV Logic Visualization */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 shadow-sm">
            <h4 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                <span className="w-1 h-6 bg-yellow-400 rounded-full"></span>
                <TrendingUp size={20} className="text-yellow-500" />
                Расчет LTV (Веса)
            </h4>
            <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-4">Баллы начисляются автоматически при событиях.</p>
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-4 py-2 text-left">Событие</th>
                                <th className="px-4 py-2 text-left">Категория</th>
                                <th className="px-4 py-2 text-right">Баллы</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {(Object.keys(EVENT_WEIGHTS) as EventType[]).map(type => (
                                <tr key={type}>
                                    <td className="px-4 py-2 text-gray-700 font-medium">{type}</td>
                                    <td className="px-4 py-2 text-xs text-gray-500">{EVENT_CATEGORIES[type]}</td>
                                    <td className="px-4 py-2 text-right font-mono text-pizza-red font-bold">+{EVENT_WEIGHTS[type]}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h4 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800">
            <span className="w-1 h-6 bg-purple-600 rounded-full"></span>
            Ресурсы и Альбомы
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">ID Альбома с ресурсами</label>
              <input type="text" defaultValue="28100100" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none transition-all" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">ID Поста для комментариев (Морской Бой)</label>
              <input type="text" defaultValue="4512" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red focus:outline-none transition-all" />
            </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button className="flex items-center gap-2 bg-pizza-red hover:bg-pizza-dark text-white px-8 py-3 rounded-lg font-bold transition-transform transform active:scale-95 shadow-lg shadow-red-200">
            <Save size={20} />
            Сохранить настройки
        </button>
      </div>
    </div>
  );
};

export default Settings;