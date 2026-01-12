use async_graphql::{Enum, InputObject, Request, Response, SimpleObject};
use linera_sdk::graphql::GraphQLMutationRoot;
use linera_sdk::linera_base_types::{ContractAbi, ServiceAbi};
use serde::{Deserialize, Serialize};

pub struct CheckersAbi;

impl ContractAbi for CheckersAbi {
    type Operation = Operation;
    type Response = OperationResult;
}

impl ServiceAbi for CheckersAbi {
    type Query = Request;
    type QueryResponse = Response;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum, Default)]
pub enum Piece {
    #[default]
    Empty,
    Red,
    Black,
    RedKing,
    BlackKing,
}

impl Piece {
    pub fn is_red(&self) -> bool {
        matches!(self, Piece::Red | Piece::RedKing)
    }

    pub fn is_black(&self) -> bool {
        matches!(self, Piece::Black | Piece::BlackKing)
    }

    pub fn is_king(&self) -> bool {
        matches!(self, Piece::RedKing | Piece::BlackKing)
    }

    pub fn is_empty(&self) -> bool {
        matches!(self, Piece::Empty)
    }

    pub fn to_king(&self) -> Self {
        match self {
            Piece::Red => Piece::RedKing,
            Piece::Black => Piece::BlackKing,
            other => *other,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum, Default)]
pub enum GameStatus {
    #[default]
    Pending,
    Active,
    Finished,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum GameResult {
    RedWins,
    BlackWins,
    Draw,
    InProgress,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum, Default)]
pub enum PlayerType {
    #[default]
    Human,
    AI,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum, Default)]
pub enum Turn {
    #[default]
    Red,
    Black,
}

impl Turn {
    pub fn opposite(&self) -> Self {
        match self {
            Turn::Red => Turn::Black,
            Turn::Black => Turn::Red,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "MoveInput")]
pub struct CheckersMove {
    pub from_row: u8,
    pub from_col: u8,
    pub to_row: u8,
    pub to_col: u8,
    pub captured_row: Option<u8>,
    pub captured_col: Option<u8>,
    pub promoted: bool,
    pub timestamp: u64,
}

impl CheckersMove {
    pub fn new(from_row: u8, from_col: u8, to_row: u8, to_col: u8) -> Self {
        Self {
            from_row,
            from_col,
            to_row,
            to_col,
            captured_row: None,
            captured_col: None,
            promoted: false,
            timestamp: 0,
        }
    }

    pub fn with_capture(mut self, captured_row: u8, captured_col: u8) -> Self {
        self.captured_row = Some(captured_row);
        self.captured_col = Some(captured_col);
        self
    }

    pub fn with_promotion(mut self) -> Self {
        self.promoted = true;
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct PlayerStats {
    #[graphql(name = "chainId")]
    pub chain_id: String,
    #[graphql(name = "gamesPlayed")]
    pub games_played: u32,
    #[graphql(name = "gamesWon")]
    pub games_won: u32,
    #[graphql(name = "gamesLost")]
    pub games_lost: u32,
    #[graphql(name = "gamesDrawn")]
    pub games_drawn: u32,
    #[graphql(name = "winStreak")]
    pub win_streak: u32,
    #[graphql(name = "bestStreak")]
    pub best_streak: u32,
    #[graphql(name = "bulletRating")]
    pub bullet_rating: u32,
    #[graphql(name = "bulletGames")]
    pub bullet_games: u32,
    #[graphql(name = "blitzRating")]
    pub blitz_rating: u32,
    #[graphql(name = "blitzGames")]
    pub blitz_games: u32,
    #[graphql(name = "rapidRating")]
    pub rapid_rating: u32,
    #[graphql(name = "rapidGames")]
    pub rapid_games: u32,
}

impl Default for PlayerStats {
    fn default() -> Self {
        Self {
            chain_id: String::new(),
            games_played: 0,
            games_won: 0,
            games_lost: 0,
            games_drawn: 0,
            win_streak: 0,
            best_streak: 0,
            bullet_rating: 1200,
            bullet_games: 0,
            blitz_rating: 1200,
            blitz_games: 0,
            rapid_rating: 1200,
            rapid_games: 0,
        }
    }
}

impl PlayerStats {
    pub fn new(chain_id: String) -> Self {
        Self {
            chain_id,
            ..Default::default()
        }
    }

    pub fn record_win(&mut self) {
        self.games_played += 1;
        self.games_won += 1;
        self.win_streak += 1;
        if self.win_streak > self.best_streak {
            self.best_streak = self.win_streak;
        }
    }

    pub fn record_loss(&mut self) {
        self.games_played += 1;
        self.games_lost += 1;
        self.win_streak = 0;
    }

    pub fn record_draw(&mut self) {
        self.games_played += 1;
        self.games_drawn += 1;
    }

    pub fn get_rating(&self, time_control: &TimeControl) -> u32 {
        match time_control {
            TimeControl::Bullet1_0 | TimeControl::Bullet2_1 => self.bullet_rating,
            TimeControl::Blitz3_0 | TimeControl::Blitz5_3 => self.blitz_rating,
            TimeControl::Rapid10_0 => self.rapid_rating,
        }
    }

    pub fn get_games_in_category(&self, time_control: &TimeControl) -> u32 {
        match time_control {
            TimeControl::Bullet1_0 | TimeControl::Bullet2_1 => self.bullet_games,
            TimeControl::Blitz3_0 | TimeControl::Blitz5_3 => self.blitz_games,
            TimeControl::Rapid10_0 => self.rapid_games,
        }
    }

    pub fn update_rating(&mut self, opponent_rating: u32, outcome: f64, time_control: &TimeControl) {
        let my_rating = self.get_rating(time_control) as f64;
        let opp_rating = opponent_rating as f64;
        let games = self.get_games_in_category(time_control);
        let k: f64 = if games < 30 { 32.0 } else { 16.0 };
        let expected = 1.0 / (1.0 + 10_f64.powf((opp_rating - my_rating) / 400.0));
        let change = k * (outcome - expected);
        let new_rating = (my_rating + change).round() as i32;
        let new_rating = new_rating.max(100).min(3000) as u32;

        match time_control {
            TimeControl::Bullet1_0 | TimeControl::Bullet2_1 => {
                self.bullet_rating = new_rating;
                self.bullet_games += 1;
            }
            TimeControl::Blitz3_0 | TimeControl::Blitz5_3 => {
                self.blitz_rating = new_rating;
                self.blitz_games += 1;
            }
            TimeControl::Rapid10_0 => {
                self.rapid_rating = new_rating;
                self.rapid_games += 1;
            }
        }
    }

    pub fn record_win_with_rating(&mut self, opponent_rating: u32, time_control: &TimeControl) {
        self.record_win();
        self.update_rating(opponent_rating, 1.0, time_control);
    }

    pub fn record_loss_with_rating(&mut self, opponent_rating: u32, time_control: &TimeControl) {
        self.record_loss();
        self.update_rating(opponent_rating, 0.0, time_control);
    }

    pub fn record_draw_with_rating(&mut self, opponent_rating: u32, time_control: &TimeControl) {
        self.record_draw();
        self.update_rating(opponent_rating, 0.5, time_control);
    }
}

pub const STARTING_BOARD: &str = " r r r r/r r r r / r r r r/        /        /b b b b / b b b b/b b b b ";

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject, Default)]
pub struct CheckersGame {
    pub id: String,
    pub red_player: Option<String>,
    pub black_player: Option<String>,
    pub red_player_type: PlayerType,
    pub black_player_type: PlayerType,
    pub board_state: String,
    pub current_turn: Turn,
    pub moves: Vec<CheckersMove>,
    pub move_count: u32,
    pub status: GameStatus,
    pub result: Option<GameResult>,
    pub created_at: u64,
    pub updated_at: u64,
    pub clock: Option<Clock>,
    pub draw_offer: DrawOfferState,
    #[graphql(name = "isRated")]
    #[serde(default = "default_is_rated")]
    pub is_rated: bool,
    #[graphql(name = "colorPreference")]
    #[serde(default)]
    pub color_preference: ColorPreference,
    #[serde(default)]
    pub creator_wants_random: bool,
    #[graphql(name = "tournamentId")]
    #[serde(default)]
    pub tournament_id: Option<String>,
    #[graphql(name = "tournamentMatchId")]
    #[serde(default)]
    pub tournament_match_id: Option<String>,
}

fn default_is_rated() -> bool {
    true
}

impl CheckersGame {
    pub fn new(id: String, red_player: Option<String>, red_type: PlayerType) -> Self {
        Self {
            id,
            red_player,
            black_player: None,
            red_player_type: red_type,
            black_player_type: PlayerType::Human,
            board_state: STARTING_BOARD.to_string(),
            current_turn: Turn::Red,
            moves: Vec::new(),
            move_count: 0,
            status: GameStatus::Pending,
            result: None,
            created_at: 0,
            updated_at: 0,
            clock: None,
            draw_offer: DrawOfferState::None,
            is_rated: true,
            color_preference: ColorPreference::Red,
            creator_wants_random: false,
            tournament_id: None,
            tournament_match_id: None,
        }
    }

    pub fn new_timed(id: String, red_player: Option<String>, red_type: PlayerType, time_control: TimeControl) -> Self {
        let mut game = Self::new(id, red_player, red_type);
        game.clock = Some(Clock::new(time_control));
        game
    }

    pub fn new_with_options(
        id: String,
        creator: String,
        color_pref: ColorPreference,
        is_rated: bool,
        time_control: Option<TimeControl>,
    ) -> Self {
        let mut game = Self {
            id,
            red_player: None,
            black_player: None,
            red_player_type: PlayerType::Human,
            black_player_type: PlayerType::Human,
            board_state: STARTING_BOARD.to_string(),
            current_turn: Turn::Red,
            moves: Vec::new(),
            move_count: 0,
            status: GameStatus::Pending,
            result: None,
            created_at: 0,
            updated_at: 0,
            clock: time_control.map(Clock::new),
            draw_offer: DrawOfferState::None,
            is_rated,
            color_preference: color_pref,
            creator_wants_random: false,
            tournament_id: None,
            tournament_match_id: None,
        };

        match color_pref {
            ColorPreference::Red => game.red_player = Some(creator),
            ColorPreference::Black => game.black_player = Some(creator),
            ColorPreference::Random => {
                game.red_player = Some(creator);
                game.creator_wants_random = true;
            }
        }

        game
    }

    pub fn can_player_move(&self, chain_id: &str) -> bool {
        if self.status != GameStatus::Active {
            return false;
        }
        match self.current_turn {
            Turn::Red => self.red_player.as_deref() == Some(chain_id),
            Turn::Black => self.black_player.as_deref() == Some(chain_id),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, GraphQLMutationRoot)]
pub enum Operation {
    CreateGame {
        vs_ai: bool,
        time_control: Option<TimeControl>,
        color_preference: Option<ColorPreference>,
        is_rated: Option<bool>,
        player_id: String,
    },
    JoinGame {
        game_id: String,
        player_id: String,
    },
    MakeMove {
        game_id: String,
        from_row: u8,
        from_col: u8,
        to_row: u8,
        to_col: u8,
        player_id: String,
    },
    Resign {
        game_id: String,
        player_id: String,
    },
    RequestAiMove {
        game_id: String,
    },
    JoinQueue {
        time_control: TimeControl,
    },
    LeaveQueue,
    OfferDraw {
        game_id: String,
    },
    AcceptDraw {
        game_id: String,
    },
    DeclineDraw {
        game_id: String,
    },
    ClaimTimeWin {
        game_id: String,
    },
    CreateTournament {
        name: String,
        time_control: TimeControl,
        max_players: u32,
        is_public: bool,
        scheduled_start: Option<u64>,
    },
    JoinTournament {
        tournament_id: String,
    },
    JoinTournamentByCode {
        invite_code: String,
    },
    LeaveTournament {
        tournament_id: String,
    },
    StartTournament {
        tournament_id: String,
    },
    StartTournamentMatch {
        tournament_id: String,
        match_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationResult {
    GameCreated { game_id: String },
    GameJoined { game_id: String },
    MoveMade { game_id: String, game_over: bool },
    Resigned { game_id: String },
    AiMoveMade { game_id: String, game_over: bool },
    QueueJoined { time_control: TimeControl },
    QueueLeft,
    MatchFound { game_id: String, opponent: String },
    DrawOffered { game_id: String },
    DrawAccepted { game_id: String },
    DrawDeclined { game_id: String },
    TimeWinClaimed { game_id: String },
    TournamentCreated { tournament_id: String },
    TournamentJoined { tournament_id: String },
    TournamentJoinedByCode { tournament_id: String, tournament_name: String },
    TournamentLeft { tournament_id: String },
    TournamentStarted { tournament_id: String },
    TournamentMatchStarted {
        tournament_id: String,
        match_id: String,
        game_id: String,
    },
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Message {
    JoinRequest { game_id: String, player_chain: String },
    GameStarted { game_id: String, red_player: String, black_player: String },
    MoveMade {
        game_id: String,
        chess_move: CheckersMove,
        new_board_state: String,
        new_turn: Turn,
        game_status: GameStatus,
        game_result: Option<GameResult>,
    },
    GameEnded { game_id: String, result: GameResult, winner: Option<String> },
    SyncGameState { game: CheckersGame },
    MatchFound {
        game_id: String,
        red_player: String,
        black_player: String,
        time_control: TimeControl,
    },
    DrawOffered {
        game_id: String,
        offered_by: Turn,
    },
    DrawDeclined {
        game_id: String,
    },
    DrawAccepted {
        game_id: String,
    },
}

pub fn get_piece(board_state: &str, row: u8, col: u8) -> Piece {
    let rows: Vec<&str> = board_state.split('/').collect();
    if row as usize >= rows.len() {
        return Piece::Empty;
    }
    let chars: Vec<char> = rows[row as usize].chars().collect();
    if col as usize >= chars.len() {
        return Piece::Empty;
    }
    match chars[col as usize] {
        'r' => Piece::Red,
        'b' => Piece::Black,
        'R' => Piece::RedKing,
        'B' => Piece::BlackKing,
        _ => Piece::Empty,
    }
}

pub fn set_piece(board_state: &str, row: u8, col: u8, piece: Piece) -> String {
    let mut rows: Vec<String> = board_state.split('/').map(|s| s.to_string()).collect();
    if row as usize >= rows.len() {
        return board_state.to_string();
    }
    let mut chars: Vec<char> = rows[row as usize].chars().collect();
    if col as usize >= chars.len() {
        return board_state.to_string();
    }
    chars[col as usize] = match piece {
        Piece::Red => 'r',
        Piece::Black => 'b',
        Piece::RedKing => 'R',
        Piece::BlackKing => 'B',
        Piece::Empty => if (row + col) % 2 == 1 { '.' } else { ' ' },
    };
    rows[row as usize] = chars.into_iter().collect();
    rows.join("/")
}

pub fn is_valid_square(row: u8, col: u8) -> bool {
    row < 8 && col < 8 && (row + col) % 2 == 1
}

pub fn count_pieces(board_state: &str) -> (u8, u8) {
    let mut red = 0;
    let mut black = 0;
    for ch in board_state.chars() {
        match ch {
            'r' | 'R' => red += 1,
            'b' | 'B' => black += 1,
            _ => {}
        }
    }
    (red, black)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Enum, Default)]
pub enum TimeControl {
    #[default]
    Bullet1_0,
    Bullet2_1,
    Blitz3_0,
    Blitz5_3,
    Rapid10_0,
}

impl TimeControl {
    pub fn all() -> Vec<TimeControl> {
        vec![
            TimeControl::Bullet1_0,
            TimeControl::Bullet2_1,
            TimeControl::Blitz3_0,
            TimeControl::Blitz5_3,
            TimeControl::Rapid10_0,
        ]
    }

    pub fn initial_time_ms(&self) -> u64 {
        match self {
            TimeControl::Bullet1_0 => 60_000,
            TimeControl::Bullet2_1 => 120_000,
            TimeControl::Blitz3_0 => 180_000,
            TimeControl::Blitz5_3 => 300_000,
            TimeControl::Rapid10_0 => 600_000,
        }
    }

    pub fn increment_ms(&self) -> u64 {
        match self {
            TimeControl::Bullet1_0 => 0,
            TimeControl::Bullet2_1 => 1_000,
            TimeControl::Blitz3_0 => 0,
            TimeControl::Blitz5_3 => 3_000,
            TimeControl::Rapid10_0 => 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject, Default)]
pub struct Clock {
    pub initial_time_ms: u64,
    pub increment_ms: u64,
    pub red_time_ms: u64,
    pub black_time_ms: u64,
    pub last_move_at: u64,
    pub active_player: Option<Turn>,
}

impl Clock {
    pub fn new(time_control: TimeControl) -> Self {
        let initial = time_control.initial_time_ms();
        let increment = time_control.increment_ms();
        Self {
            initial_time_ms: initial,
            increment_ms: increment,
            red_time_ms: initial,
            black_time_ms: initial,
            last_move_at: 0,
            active_player: None,
        }
    }

    pub fn start(&mut self, current_time_ms: u64) {
        self.last_move_at = current_time_ms;
        self.active_player = Some(Turn::Red);
    }

    pub fn timed_out(&self, current_time_ms: u64) -> Option<Turn> {
        match self.active_player {
            Some(Turn::Red) => {
                let elapsed = current_time_ms.saturating_sub(self.last_move_at);
                if elapsed >= self.red_time_ms {
                    Some(Turn::Red)
                } else {
                    None
                }
            }
            Some(Turn::Black) => {
                let elapsed = current_time_ms.saturating_sub(self.last_move_at);
                if elapsed >= self.black_time_ms {
                    Some(Turn::Black)
                } else {
                    None
                }
            }
            None => None,
        }
    }

    pub fn make_move(&mut self, current_time_ms: u64) -> bool {
        let Some(active) = self.active_player else {
            return false;
        };

        let elapsed = current_time_ms.saturating_sub(self.last_move_at);

        match active {
            Turn::Red => {
                if elapsed >= self.red_time_ms {
                    self.red_time_ms = 0;
                    return false;
                }
                self.red_time_ms = self.red_time_ms.saturating_sub(elapsed) + self.increment_ms;
                self.active_player = Some(Turn::Black);
            }
            Turn::Black => {
                if elapsed >= self.black_time_ms {
                    self.black_time_ms = 0;
                    return false;
                }
                self.black_time_ms = self.black_time_ms.saturating_sub(elapsed) + self.increment_ms;
                self.active_player = Some(Turn::Red);
            }
        }

        self.last_move_at = current_time_ms;
        true
    }

    pub fn get_remaining(&self, player: Turn, current_time_ms: u64) -> u64 {
        let base_time = match player {
            Turn::Red => self.red_time_ms,
            Turn::Black => self.black_time_ms,
        };

        if self.active_player == Some(player) {
            let elapsed = current_time_ms.saturating_sub(self.last_move_at);
            base_time.saturating_sub(elapsed)
        } else {
            base_time
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum, Default)]
pub enum DrawOfferState {
    #[default]
    None,
    OfferedByRed,
    OfferedByBlack,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum, Default)]
pub enum ColorPreference {
    #[default]
    Red,
    Black,
    Random,
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct QueueEntry {
    pub chain_id: String,
    pub time_control: TimeControl,
    pub joined_at: u64,
}

impl QueueEntry {
    pub fn new(chain_id: String, time_control: TimeControl, joined_at: u64) -> Self {
        Self {
            chain_id,
            time_control,
            joined_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct QueueStatus {
    pub time_control: TimeControl,
    pub player_count: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum, Default)]
pub enum TournamentStatus {
    #[default]
    Registration,
    InProgress,
    Finished,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum, Default)]
pub enum MatchStatus {
    #[default]
    Pending,
    Ready,
    InProgress,
    Finished,
    Bye,
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject, Default)]
pub struct TournamentMatch {
    pub id: String,
    pub round: u32,
    pub match_number: u32,
    pub player1: Option<String>,
    pub player2: Option<String>,
    pub game_id: Option<String>,
    pub winner: Option<String>,
    pub status: MatchStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject, Default)]
pub struct Tournament {
    pub id: String,
    pub name: String,
    pub creator: String,
    pub status: TournamentStatus,
    pub time_control: TimeControl,
    pub max_players: u32,
    pub registered_players: Vec<String>,
    pub matches: Vec<TournamentMatch>,
    pub current_round: u32,
    pub total_rounds: u32,
    pub winner: Option<String>,
    pub created_at: u64,
    pub started_at: Option<u64>,
    pub finished_at: Option<u64>,
    #[graphql(name = "isPublic")]
    #[serde(default = "default_is_public")]
    pub is_public: bool,
    #[graphql(name = "inviteCode")]
    #[serde(default)]
    pub invite_code: Option<String>,
    #[graphql(name = "scheduledStart")]
    #[serde(default)]
    pub scheduled_start: Option<u64>,
}

fn default_is_public() -> bool {
    true
}
