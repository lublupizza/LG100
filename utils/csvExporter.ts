
import { User } from '../types';

/**
 * Преобразует массив пользователей в CSV и инициирует скачивание
 * @param users - список пользователей (уже отфильтрованный)
 * @param filename - имя файла
 */
export const exportUsersToCsv = (users: User[], filename: string = 'pizza_audience_export.csv') => {
  if (!users || users.length === 0) {
    alert('Нет данных для экспорта');
    return;
  }

  // 1. Заголовки CSV
  const headers = [
    'ID (System)',
    'VK ID',
    'Имя',
    'Фамилия',
    'Сегмент',
    'LTV Общий',
    'LTV Игры',
    'LTV Реакции',
    'LTV Соц.Актив',
    'LTV Продажи',
    'Игр сыграно',
    'Последняя активность',
    'Источник'
  ];

  // 2. Преобразование данных в строки
  const rows = users.map(user => {
    return [
      user.id,
      user.vk_id,
      // Экранирование запятых в текстовых полях
      `"${user.first_name}"`,
      `"${user.last_name}"`,
      user.segment,
      user.ltv_stats.total,
      user.ltv_stats.game,
      user.ltv_stats.reaction,
      user.ltv_stats.social,
      user.ltv_stats.trigger,
      user.games_played,
      user.last_active,
      `"${user.source}"`
    ].join(',');
  });

  // 3. Сборка контента (с BOM для корректного открытия кириллицы в Excel)
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');

  // 4. Создание Blob и скачивание
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};