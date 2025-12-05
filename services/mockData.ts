
import { User, UserSegment, GameSession, GameType, GameChannel, GameStatus, Campaign, CampaignType, CellState } from '../types';

export const mockUsers: User[] = [
  {
    id: 1,
    vk_id: 1001,
    first_name: 'Иван',
    last_name: 'Иванов',
    photo_url: 'https://picsum.photos/50/50?random=1',
    segment: UserSegment.HOT,
    ltv: 85,
    ltv_stats: {
      total: 85,
      game: 25,
      reaction: 20,
      social: 10,
      trigger: 30
    },
    social_stats: {
        likes: 15,
        comments: 4,
        reposts: 2,
        is_member: true
    },
    games_played: 12,
    last_active: '2025-12-02T21:15:00',
    source: 'contest_nov_2025'
  },
  {
    id: 2,
    vk_id: 1002,
    first_name: 'Мария',
    last_name: 'Петрова',
    photo_url: 'https://picsum.photos/50/50?random=2',
    segment: UserSegment.WARM,
    ltv: 28,
    ltv_stats: {
      total: 28,
      game: 18,
      reaction: 10,
      social: 0,
      trigger: 0
    },
    social_stats: {
        likes: 2,
        comments: 0,
        reposts: 0,
        is_member: true
    },
    games_played: 3,
    last_active: '2025-12-01T10:00:00',
    source: 'organic'
  },
  {
    id: 3,
    vk_id: 1003,
    first_name: 'Сергей',
    last_name: 'Смирнов',
    photo_url: 'https://picsum.photos/50/50?random=3',
    segment: UserSegment.COLD,
    ltv: 3,
    ltv_stats: {
      total: 3,
      game: 1,
      reaction: 2,
      social: 0,
      trigger: 0
    },
    social_stats: {
        likes: 0,
        comments: 0,
        reposts: 0,
        is_member: false
    },
    games_played: 1,
    last_active: '2025-11-20T14:30:00',
    source: 'ad_campaign_1'
  },
  {
    id: 4,
    vk_id: 1004,
    first_name: 'Анна',
    last_name: 'Сидорова',
    photo_url: 'https://picsum.photos/50/50?random=4',
    segment: UserSegment.WARM,
    ltv: 42,
    ltv_stats: {
      total: 42,
      game: 12,
      reaction: 5,
      social: 25,
      trigger: 0
    },
    social_stats: {
        likes: 20,
        comments: 10,
        reposts: 3,
        is_member: true
    },
    games_played: 5,
    last_active: '2025-12-02T18:45:00',
    source: 'battleship_post'
  },
  {
    id: 5,
    vk_id: 1005,
    first_name: 'Дмитрий',
    last_name: 'Козлов',
    photo_url: 'https://picsum.photos/50/50?random=5',
    segment: UserSegment.HOT,
    ltv: 150,
    ltv_stats: {
      total: 150,
      game: 80,
      reaction: 30,
      social: 0,
      trigger: 40
    },
    social_stats: {
        likes: 45,
        comments: 12,
        reposts: 5,
        is_member: true
    },
    games_played: 45,
    last_active: '2025-12-02T21:28:00',
    source: 'vip_club'
  }
];

// Helper to create empty board for mocks
const createBoard = () => Array(10).fill(null).map(() => Array(10).fill(CellState.EMPTY));
const boardWithHits = createBoard();
boardWithHits[0][0] = CellState.MISS;
boardWithHits[1][1] = CellState.HIT;
boardWithHits[1][2] = CellState.SHIP;

export const mockGames: GameSession[] = [
  {
    id: 'g1',
    user_id: 1,
    user_name: 'Иван Иванов',
    type: GameType.BATTLESHIP,
    channel: GameChannel.DM,
    status: GameStatus.ACTIVE,
    started_at: '2025-12-02T21:00:00',
    updated_at: '2025-12-02T21:10:00',
    moves_count: 8,
    state_summary: 'Попаданий: 1, Мимо: 1',
    board: boardWithHits,
    campaign_id: 'c2'
  },
  {
    id: 'g2',
    user_id: 4,
    user_name: 'Анна Сидорова',
    type: GameType.RPS,
    channel: GameChannel.COMMENT,
    status: GameStatus.FINISHED,
    started_at: '2025-12-02T18:00:00',
    updated_at: '2025-12-02T18:05:00',
    moves_count: 1,
    state_summary: 'Победа бота'
  }
];

export const mockCampaigns: Campaign[] = [
  {
    id: 'c2',
    name: 'Возврат холодных (Морской бой)',
    type: CampaignType.GAME_BATTLESHIP,
    segment_target: UserSegment.COLD,
    message: 'Мы скучаем! Заходи сыграть в Морской бой. Напиши координаты!',
    status: 'SCHEDULED',
    stats: { sent: 0, delivered: 0, clicked: 0, games_started: 0, players_active: 0 },
    created_at: '2025-12-01'
  }
];