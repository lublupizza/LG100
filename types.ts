
export enum UserSegment {
  COLD = 'COLD',   // Холодный
  WARM = 'WARM',   // Тёплый
  HOT = 'HOT'      // Горячий
}

export enum GameType {
  BATTLESHIP = 'BATTLESHIP',
  RPS = 'RPS', // Камень-ножницы-бумага
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
  STANDARD = 'STANDARD', // Обычная рассылка (текст/картинка)
  GAME_BATTLESHIP = 'GAME_BATTLESHIP' // Игровая активация
}

export type TimePeriod = '1d' | '7d' | '14d' | '1m' | '3m' | 'ALL';

// === Sea Battle Specific ===

export enum CellState {
  EMPTY = 0,
  SHIP = 1,
  MISS = 2,
  HIT = 3,
  KILLED = 4
}

export interface SeaBattleState {
  board: CellState[][]; // 10x10 grid
  shipsAlive: number;   // Кол-во живых палуб/кораблей
}

// === LTV & Event Types ===

export enum LtvCategory {
  GAME = 'GAME',       // Игровая активность
  REACTION = 'REACTION', // Реакции на пуши/сообщения
  SOCIAL = 'SOCIAL',   // Лайки, репосты, подписки
  TRIGGER = 'TRIGGER'  // СИЛЬНОЕ НАМЕРЕНИЕ (Intent): Заявки, клики по меню/доставке
}

export enum EventType {
  // Game
  GAME_START = 'game_start', // Запуск игры
  GAME_PLAY = 'game_play',   // Ход
  GAME_WIN = 'game_win',     // Победа
  
  // Reaction
  PUSH_OPEN = 'push_open',
  PUSH_REPLY = 'push_reply',
  PUSH_CLICK = 'push_click',
  
  // Social
  LIKE_POST = 'like_post',
  COMMENT_POST = 'comment_post',
  REPOST_POST = 'repost_post',
  GROUP_JOIN = 'group_join',   // Подписка на группу
  GROUP_LEAVE = 'group_leave', // Отписка от группы
  
  // Trigger / Intent (Намерение купить)
  LEAD = 'lead',             // Оставил заявку / написал "хочу пиццу"
  MENU_CLICK = 'menu_click', // Кликнул на кнопку "Меню"
  DELIVERY_CLICK = 'delivery_click', // Кликнул на "Доставка"
  SITE_CLICK = 'site_click', // Перешел на сайт
  
  // Reserved (Future Use)
  SALE = 'sale'              // Реальная оплата (пока не используется)
}

export interface EventMetadata {
  campaign_id?: string;
  post_id?: number;
  [key: string]: any;
}

export interface LtvBreakdown {
  total: number;    // Общая сумма
  game: number;     // За игры
  reaction: number; // За коммуникацию
  social: number;   // За соц. активность
  trigger: number;  // За намерение (клики по меню, заявки)
}

export interface SocialStats {
  likes: number;
  comments: number;
  reposts: number;
  is_member: boolean; // Подписан ли сейчас
}

export interface User {
  id: number;
  vk_id: number;
  first_name: string;
  last_name: string;
  photo_url: string;
  segment: UserSegment;
  
  // Legacy field support
  ltv: number; 
  
  // New behavioral LTV
  ltv_stats: LtvBreakdown;
  
  // Social interactions counters
  social_stats: SocialStats;
  
  games_played: number;
  last_active: string;
  source: string;
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

export interface GameSession {
  id: string;
  user_id: number;
  user_name: string;
  type: GameType;
  channel: GameChannel;
  status: GameStatus;
  started_at: string;
  updated_at: string;
  moves_count: number;
  state_summary: string;
  
  // Link to campaign
  campaign_id?: string;
  
  // Detailed state for Battleship
  board?: CellState[][]; 
}

// === Campaign Tracking ===

export interface CampaignSend {
  id: string;
  campaign_id: string;
  user_id: number;
  vk_message_id?: number;
  sent_at: string;
  
  viewed_at?: string;       // Когда пользователь впервые проявил активность после пуша
  first_action_at?: string; // Когда совершил первое целевое действие
  first_action_type?: string; // Тип действия
}

export interface CampaignReactionStats {
  recipients_total: number;
  
  views: number;
  view_conversion: number; // %
  
  actions_total: number;
  action_conversion: number; // %
  
  avg_delay_seconds: number;
  actions_by_type: Record<string, number>;
}

// NEW: Полная воронка кампании
export interface CampaignFunnelStats extends CampaignReactionStats {
    warm_hot_count: number;     // Сколько пользователей сейчас Warm/Hot
    warm_hot_rate: number;      // % от получивших
    warm_hot_from_acted: number;// % от совершивших действие
}

export interface CampaignStats {
  sent: number;
  delivered: number;
  clicked: number;
  
  // Game Specific Stats
  games_started?: number;
  players_active?: number; // > N moves
  games_finished?: number;
  avg_moves?: number;
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  segment_target: UserSegment | 'ALL';
  message: string;
  image_id?: string;
  voice_id?: string;
  status: 'DRAFT' | 'SENT' | 'SCHEDULED';
  
  target_post_id?: number; // ID поста для отслеживания соц. реакций
  
  stats: CampaignStats;
  created_at: string;
}

export interface Config {
  group_id: string;
  token: string;
  album_id: string;
  test_post_id: string;
  admin_ids: string[];
}

export interface LtvFilters {
  ltv_total_min?: number;
  ltv_total_max?: number;
  
  ltv_game_min?: number;
  ltv_game_max?: number;
  
  ltv_reaction_min?: number;
  ltv_reaction_max?: number;
  
  ltv_social_min?: number;
  ltv_social_max?: number;
  
  ltv_trigger_min?: number;
  ltv_trigger_max?: number;
  
  // Новые социальные фильтры
  is_member?: boolean;
  min_likes?: number;
  min_comments?: number;
  min_reposts?: number;
  has_played?: boolean;
  period?: TimePeriod;
}