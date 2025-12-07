import { EventType } from '../types';
import { registerEvent } from './ltvEngine';

interface VkEvent {
  type: string;
  object: any;
  group_id: number;
}

export const handleVkEvent = (event: VkEvent) => {
  const { type, object } = event;
  let userId: number | null = null;
  let eventType: EventType | null = null;
  let postId: number | undefined;

  switch (type) {
    case 'like_add':
      userId = object.liker_id;
      if (object.object_type === 'post') {
        eventType = EventType.LIKE_POST;
        postId = object.object_id;
      }
      break;
    case 'wall_reply_new':
      userId = object.from_id;
      eventType = EventType.COMMENT_POST;
      postId = object.post_id;
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
      break;
  }

  if (userId && eventType) {
    registerEvent({
      id: userId,
      vk_id: userId,
      first_name: 'User',
      last_name: `${userId}`,
      photo_url: '',
      segment: 'COLD' as any,
      ltv: 0,
      ltv_stats: { total: 0, game: 0, reaction: 0, social: 0, trigger: 0 },
      social_stats: { likes: 0, comments: 0, reposts: 0, is_member: false },
      games_played: 0,
      last_active: new Date().toISOString(),
      source: 'bot',
    }, eventType, { post_id: postId });
  }
};
