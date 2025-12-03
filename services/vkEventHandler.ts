
import { EventType } from '../types';
import { registerEvent } from './ltvEngine';
import { mockUsers } from './mockData';
import { SeaBattleSessionManager } from './seaBattleEngine';

// === BACKEND SIMULATION ===
interface VkEvent {
  type: string;
  object: any;
  group_id: number;
}

/**
 * Основной обработчик событий от ВКонтакте
 */
export const handleVkEvent = (event: VkEvent) => {
  const { type, object } = event;
  let userId: number | null = null;
  let eventType: EventType | null = null;
  let postId: number | undefined;

  // 1.1. Разбор событий
  
  switch (type) {
    case 'message_new': {
        const msg = object.message; // Структура VK API для сообщения
        const text = msg.text;
        const fromId = msg.from_id;

        console.log(`[VK Bot] Received message from ${fromId}: "${text}"`);
        
        // Пытаемся обработать как ход в игре
        const gameResponse = SeaBattleSessionManager.handleUserMessage(fromId, text);
        
        if (gameResponse) {
            console.log(`[VK Bot] Reply to ${fromId}: "${gameResponse}"`);
            // В реальном коде здесь: vk.messages.send({ peer_id: fromId, message: gameResponse })
        } else {
            // Если это не ход игры, можно обработать другие команды (меню и т.д.)
            console.log(`[VK Bot] Message ignored or processed as generic text.`);
        }
        
        // Для LTV можно считать просто сообщение как PUSH_REPLY (ответ боту)
        userId = fromId;
        eventType = EventType.PUSH_REPLY; 
        break;
    }

    case 'like_add':
      userId = object.liker_id;
      if (object.object_type === 'post') {
        eventType = EventType.LIKE_POST;
        postId = object.object_id; // ID поста
      }
      break;

    case 'wall_reply_new':
      userId = object.from_id;
      eventType = EventType.COMMENT_POST;
      postId = object.post_id; // ID поста
      break;

    case 'wall_post_new':
      if (object.post_type === 'copy') {
        userId = object.owner_id;
        eventType = EventType.REPOST_POST;
        // Для репоста ID оригинала находится глубже, но для упрощения считаем, что мы знаем copy_history[0].id
        if (object.copy_history && object.copy_history.length > 0) {
            postId = object.copy_history[0].id;
        }
      }
      break;

    case 'group_join':
      userId = object.user_id;
      eventType = EventType.GROUP_JOIN;
      break;

    case 'group_leave':
      userId = object.user_id;
      eventType = EventType.GROUP_LEAVE;
      break;
      
    default:
      console.log('Unhandled event type for social LTV:', type);
      break;
  }

  // 1.2. Регистрация события
  if (userId && eventType) {
    const user = mockUsers.find(u => u.vk_id === userId);
    
    if (user) {
      console.log(`[VK Handler] Processing ${eventType} for user ${userId} (Post: ${postId || 'none'})`);
      
      // Передаем post_id в метаданные для Campaign Tracking
      registerEvent(user, eventType, { post_id: postId });
      
    } else {
      console.log(`[VK Handler] User ${userId} not found in CRM`);
    }
  }
};