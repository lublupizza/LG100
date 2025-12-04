export enum UserSegment {
  COLD = 'COLD',
  WARM = 'WARM',
  HOT = 'HOT'
}

export enum GameType {
  BATTLESHIP = 'BATTLESHIP',
  RPS = 'RPS',
  QUIZ = 'QUIZ'
}

export enum GameChannel {
  COMMENT = 'COMMENT',
  DM = 'DM'
}

export enum GameStatus {
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
  WAITING = 'WAITING'
}

export enum CampaignType {
  STANDARD = 'STANDARD',
  GAME_BATTLESHIP = 'GAME_BATTLESHIP'
}

export enum CellState {
  EMPTY = 0,
  SHIP = 1,
  MISS = 2,
  HIT = 3,
  KILLED = 4
}

export type TimePeriod = '1d' | '7d' | '14d' | '1m' | '3m' | 'ALL';

export enum LtvCategory {
  GAME = 'GAME',
  REACTION = 'REACTION',
  SOCIAL = 'SOCIAL',
  TRIGGER = 'TRIGGER'
}

// === ЭТОГО НЕ ХВАТАЛО ===
export enum EventType {
  GAME_START = 'game_start',
  GAME_PLAY = 'game_play',
  GAME_WIN = 'game_win',
  PUSH_OPEN = 'push_open',
  PUSH_REPLY = 'push_reply',
  PUSH_CLICK = 'push_click',
  LIKE_POST = 'like_post',
  COMMENT_POST = 'comment_post',
  REPOST_POST = 'repost_post',
  GROUP_JOIN = 'group_join',
  GROUP_LEAVE = 'group_leave',
  LEAD = 'lead',
  MENU_CLICK = 'menu_click',
  DELIVERY_CLICK = 'delivery_click',
  SITE_CLICK = 'site_click',
  SALE = 'sale'
}

// Interfaces

export interface CampaignStats {
  sent: number;
  delivered: number;
  clicked: number;
  games_started?: number;
  players_active?: number;
  games_finished?: number;
  avg_moves?: number;
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  segment_target: UserSegment | 'ALL';
  message: string;
  image_url?: string;
  voice_url?: string;
  voice_base64?: string;
  voice_name?: string;
  status: 'DRAFT' | 'SENT' | 'SCHEDULED';
  target_post_id?: number;
  stats: CampaignStats;
  created_at: string;
}

export interface GameSession {
  id: string | number;
  user_id: number;
  user_name: string;
  type: GameType;
  channel: GameChannel;
  status: GameStatus;
  started_at: string;
  updated_at: string;
  moves_count: number;
  state_summary: string;
  campaign_id?: string;
  board?: CellState[][];
}

export interface LtvBreakdown {
  total: number;
  game: number;
  reaction: number;
  social: number;
  trigger: number;
}

export interface SocialStats {
  likes: number;
  comments: number;
  reposts: number;
  is_member: boolean;
}

export interface User {
  id: number;
  vk_id: number;
  first_name: string;
  last_name: string;
  photo_url: string;
  segment: UserSegment;
  ltv: number;
  ltv_stats: LtvBreakdown;
  social_stats: SocialStats;
  games_played: number;
  last_active: string;
  source: string;
  games?: any[];
}

export interface UserHistoryItem {
  id: string;
  type: EventType;
  category: LtvCategory;
  date: string;
  description: string;
  value_change: number;
  metadata?: any;
}

export interface CampaignReactionStats {
  recipients_total: number;
  views: number;
  view_conversion: number;
  actions_total: number;
  action_conversion: number;
  avg_delay_seconds: number;
  actions_by_type: Record<string, number>;
}

export interface CampaignFunnelStats extends CampaignReactionStats {
    warm_hot_count: number;
    warm_hot_rate: number;
    warm_hot_from_acted: number;
}

export interface CampaignSend {
  id: string;
  campaign_id: string;
  user_id?: number;
  user_vk_id?: number;
  segment?: UserSegment | 'ALL';
  vk_message_id?: number;
  sent_at: string;
  viewed_at?: string;
  first_action_at?: string;
  first_action_type?: EventType | string;
}

export interface EventMetadata {
  campaign_id?: string;
  post_id?: number;
  [key: string]: any;
}

export interface LtvFilters {
  ltv_total_min?: number;
  ltv_total_max?: number;
  period?: TimePeriod;
  is_member?: boolean;
  has_played?: boolean;
  [key: string]: any;
}
