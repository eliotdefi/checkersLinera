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
        player_id: String,
    },
    LeaveQueue {
        player_id: String,
    },
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
        player_id: String,
    },
    JoinTournament {
        tournament_id: String,
        player_id: String,
    },
    JoinTournamentByCode {
        invite_code: String,
        player_id: String,
    },
    LeaveTournament {
        tournament_id: String,
        player_id: String,
    },
    StartTournament {
        tournament_id: String,
        player_id: String,
    },
    StartTournamentMatch {
        tournament_id: String,
        match_id: String,
        player_id: String,
    },
    ForfeitTournamentMatch {
        tournament_id: String,
        match_id: String,
        player_id: String,
    },
    CancelTournament {
        tournament_id: String,
        player_id: String,
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
    TournamentMatchForfeited {
        tournament_id: String,
        match_id: String,
        winner: String,
    },
    TournamentCancelled {
        tournament_id: String,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum, Default)]
pub enum TournamentFormat {
    #[default]
    Swiss,
    SingleElimination,
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject, Default)]
pub struct SwissParticipant {
    pub player_id: String,
    pub score: u32,
    pub opponents: Vec<String>,
    pub has_bye: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject, Default)]
pub struct TournamentRound {
    pub round_number: u32,
    pub matches: Vec<TournamentMatch>,
    pub completed: bool,
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
    #[serde(default)]
    pub format: TournamentFormat,
    #[serde(default)]
    pub participants: Vec<SwissParticipant>,
    #[serde(default)]
    pub rounds: Vec<TournamentRound>,
    #[serde(default)]
    pub num_rounds: u32,
}

fn default_is_public() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    // ========================================================================
    // BOARD UTILITY TESTS
    // ========================================================================

    #[test]
    fn test_get_piece_starting_position() {
        let board = STARTING_BOARD;
        assert!(get_piece(board, 0, 1).is_red());
        assert!(get_piece(board, 0, 3).is_red());
        assert!(get_piece(board, 7, 0).is_black());
        assert!(get_piece(board, 7, 2).is_black());
        assert!(get_piece(board, 3, 0).is_empty());
        assert!(get_piece(board, 4, 1).is_empty());
    }

    #[test]
    fn test_get_piece_out_of_bounds() {
        let board = STARTING_BOARD;
        assert!(get_piece(board, 8, 0).is_empty());
        assert!(get_piece(board, 0, 8).is_empty());
        assert!(get_piece(board, 10, 10).is_empty());
    }

    #[test]
    fn test_set_piece_basic() {
        let board = STARTING_BOARD;
        let new_board = set_piece(board, 3, 0, Piece::Red);
        assert!(get_piece(&new_board, 3, 0).is_red());
    }

    #[test]
    fn test_set_piece_king() {
        let board = STARTING_BOARD;
        let new_board = set_piece(board, 4, 1, Piece::RedKing);
        assert_eq!(get_piece(&new_board, 4, 1), Piece::RedKing);
        assert!(get_piece(&new_board, 4, 1).is_king());
    }

    #[test]
    fn test_set_piece_empty() {
        let board = STARTING_BOARD;
        let new_board = set_piece(board, 0, 1, Piece::Empty);
        assert!(get_piece(&new_board, 0, 1).is_empty());
    }

    #[test]
    fn test_count_pieces_starting() {
        let (red, black) = count_pieces(STARTING_BOARD);
        assert_eq!(red, 12);
        assert_eq!(black, 12);
    }

    #[test]
    fn test_count_pieces_after_capture() {
        let board = STARTING_BOARD;
        let board = set_piece(&board, 0, 1, Piece::Empty);
        let (red, black) = count_pieces(&board);
        assert_eq!(red, 11);
        assert_eq!(black, 12);
    }

    #[test]
    fn test_count_pieces_with_kings() {
        let board = " R R R R/        /        /        /        /        /        /B B B B ";
        let (red, black) = count_pieces(board);
        assert_eq!(red, 4);
        assert_eq!(black, 4);
    }

    #[test]
    fn test_is_valid_square_dark_squares() {
        assert!(is_valid_square(0, 1));
        assert!(is_valid_square(0, 3));
        assert!(is_valid_square(1, 0));
        assert!(is_valid_square(7, 6));
    }

    #[test]
    fn test_is_valid_square_light_squares() {
        assert!(!is_valid_square(0, 0));
        assert!(!is_valid_square(0, 2));
        assert!(!is_valid_square(1, 1));
        assert!(!is_valid_square(7, 7));
    }

    #[test]
    fn test_is_valid_square_out_of_bounds() {
        assert!(!is_valid_square(8, 0));
        assert!(!is_valid_square(0, 8));
        assert!(!is_valid_square(8, 8));
    }

    // ========================================================================
    // PIECE TESTS
    // ========================================================================

    #[test]
    fn test_piece_is_red() {
        assert!(Piece::Red.is_red());
        assert!(Piece::RedKing.is_red());
        assert!(!Piece::Black.is_red());
        assert!(!Piece::BlackKing.is_red());
        assert!(!Piece::Empty.is_red());
    }

    #[test]
    fn test_piece_is_black() {
        assert!(Piece::Black.is_black());
        assert!(Piece::BlackKing.is_black());
        assert!(!Piece::Red.is_black());
        assert!(!Piece::RedKing.is_black());
        assert!(!Piece::Empty.is_black());
    }

    #[test]
    fn test_piece_is_king() {
        assert!(Piece::RedKing.is_king());
        assert!(Piece::BlackKing.is_king());
        assert!(!Piece::Red.is_king());
        assert!(!Piece::Black.is_king());
        assert!(!Piece::Empty.is_king());
    }

    #[test]
    fn test_piece_is_empty() {
        assert!(Piece::Empty.is_empty());
        assert!(!Piece::Red.is_empty());
        assert!(!Piece::Black.is_empty());
        assert!(!Piece::RedKing.is_empty());
        assert!(!Piece::BlackKing.is_empty());
    }

    #[test]
    fn test_piece_to_king() {
        assert_eq!(Piece::Red.to_king(), Piece::RedKing);
        assert_eq!(Piece::Black.to_king(), Piece::BlackKing);
        assert_eq!(Piece::RedKing.to_king(), Piece::RedKing);
        assert_eq!(Piece::BlackKing.to_king(), Piece::BlackKing);
        assert_eq!(Piece::Empty.to_king(), Piece::Empty);
    }

    // ========================================================================
    // TURN TESTS
    // ========================================================================

    #[test]
    fn test_turn_opposite() {
        assert_eq!(Turn::Red.opposite(), Turn::Black);
        assert_eq!(Turn::Black.opposite(), Turn::Red);
    }

    #[test]
    fn test_turn_double_opposite() {
        assert_eq!(Turn::Red.opposite().opposite(), Turn::Red);
        assert_eq!(Turn::Black.opposite().opposite(), Turn::Black);
    }

    // ========================================================================
    // CHECKERS MOVE TESTS
    // ========================================================================

    #[test]
    fn test_checkers_move_new() {
        let m = CheckersMove::new(2, 1, 3, 2);
        assert_eq!(m.from_row, 2);
        assert_eq!(m.from_col, 1);
        assert_eq!(m.to_row, 3);
        assert_eq!(m.to_col, 2);
        assert!(m.captured_row.is_none());
        assert!(!m.promoted);
    }

    #[test]
    fn test_checkers_move_with_capture() {
        let m = CheckersMove::new(2, 1, 4, 3).with_capture(3, 2);
        assert_eq!(m.captured_row, Some(3));
        assert_eq!(m.captured_col, Some(2));
    }

    #[test]
    fn test_checkers_move_with_promotion() {
        let m = CheckersMove::new(6, 1, 7, 2).with_promotion();
        assert!(m.promoted);
    }

    #[test]
    fn test_checkers_move_capture_and_promotion() {
        let m = CheckersMove::new(5, 2, 7, 4).with_capture(6, 3).with_promotion();
        assert!(m.promoted);
        assert_eq!(m.captured_row, Some(6));
    }

    // ========================================================================
    // TIME CONTROL TESTS
    // ========================================================================

    #[test]
    fn test_time_control_bullet_1_0() {
        let tc = TimeControl::Bullet1_0;
        assert_eq!(tc.initial_time_ms(), 60_000);
        assert_eq!(tc.increment_ms(), 0);
    }

    #[test]
    fn test_time_control_bullet_2_1() {
        let tc = TimeControl::Bullet2_1;
        assert_eq!(tc.initial_time_ms(), 120_000);
        assert_eq!(tc.increment_ms(), 1_000);
    }

    #[test]
    fn test_time_control_blitz_3_0() {
        let tc = TimeControl::Blitz3_0;
        assert_eq!(tc.initial_time_ms(), 180_000);
        assert_eq!(tc.increment_ms(), 0);
    }

    #[test]
    fn test_time_control_blitz_5_3() {
        let tc = TimeControl::Blitz5_3;
        assert_eq!(tc.initial_time_ms(), 300_000);
        assert_eq!(tc.increment_ms(), 3_000);
    }

    #[test]
    fn test_time_control_rapid_10_0() {
        let tc = TimeControl::Rapid10_0;
        assert_eq!(tc.initial_time_ms(), 600_000);
        assert_eq!(tc.increment_ms(), 0);
    }

    #[test]
    fn test_time_control_all() {
        let all = TimeControl::all();
        assert_eq!(all.len(), 5);
        assert!(all.contains(&TimeControl::Bullet1_0));
        assert!(all.contains(&TimeControl::Rapid10_0));
    }

    // ========================================================================
    // CLOCK TESTS
    // ========================================================================

    #[test]
    fn test_clock_new() {
        let clock = Clock::new(TimeControl::Blitz5_3);
        assert_eq!(clock.initial_time_ms, 300_000);
        assert_eq!(clock.increment_ms, 3_000);
        assert_eq!(clock.red_time_ms, 300_000);
        assert_eq!(clock.black_time_ms, 300_000);
        assert!(clock.active_player.is_none());
    }

    #[test]
    fn test_clock_start() {
        let mut clock = Clock::new(TimeControl::Bullet1_0);
        clock.start(1000);
        assert_eq!(clock.last_move_at, 1000);
        assert_eq!(clock.active_player, Some(Turn::Red));
    }

    #[test]
    fn test_clock_make_move_switches_player() {
        let mut clock = Clock::new(TimeControl::Bullet1_0);
        clock.start(0);
        assert_eq!(clock.active_player, Some(Turn::Red));

        let success = clock.make_move(5000);
        assert!(success);
        assert_eq!(clock.active_player, Some(Turn::Black));
    }

    #[test]
    fn test_clock_make_move_deducts_time() {
        let mut clock = Clock::new(TimeControl::Bullet1_0);
        clock.start(0);
        clock.make_move(10_000);
        assert_eq!(clock.red_time_ms, 50_000);
    }

    #[test]
    fn test_clock_make_move_adds_increment() {
        let mut clock = Clock::new(TimeControl::Blitz5_3);
        clock.start(0);
        clock.make_move(10_000);
        assert_eq!(clock.red_time_ms, 293_000);
    }

    #[test]
    fn test_clock_timeout_none() {
        let mut clock = Clock::new(TimeControl::Bullet1_0);
        clock.start(0);
        assert!(clock.timed_out(30_000).is_none());
    }

    #[test]
    fn test_clock_timeout_red() {
        let mut clock = Clock::new(TimeControl::Bullet1_0);
        clock.start(0);
        assert_eq!(clock.timed_out(70_000), Some(Turn::Red));
    }

    #[test]
    fn test_clock_timeout_black() {
        let mut clock = Clock::new(TimeControl::Bullet1_0);
        clock.start(0);
        clock.make_move(5_000);
        assert_eq!(clock.timed_out(70_000), Some(Turn::Black));
    }

    #[test]
    fn test_clock_get_remaining_active() {
        let mut clock = Clock::new(TimeControl::Bullet1_0);
        clock.start(0);
        let remaining = clock.get_remaining(Turn::Red, 10_000);
        assert_eq!(remaining, 50_000);
    }

    #[test]
    fn test_clock_get_remaining_inactive() {
        let mut clock = Clock::new(TimeControl::Bullet1_0);
        clock.start(0);
        let remaining = clock.get_remaining(Turn::Black, 10_000);
        assert_eq!(remaining, 60_000);
    }

    // ========================================================================
    // PLAYER STATS / ELO TESTS
    // ========================================================================

    #[test]
    fn test_player_stats_default() {
        let stats = PlayerStats::default();
        assert_eq!(stats.games_played, 0);
        assert_eq!(stats.bullet_rating, 1200);
        assert_eq!(stats.blitz_rating, 1200);
        assert_eq!(stats.rapid_rating, 1200);
    }

    #[test]
    fn test_player_stats_new() {
        let stats = PlayerStats::new("chain123".to_string());
        assert_eq!(stats.chain_id, "chain123");
        assert_eq!(stats.games_played, 0);
    }

    #[test]
    fn test_player_stats_record_win() {
        let mut stats = PlayerStats::default();
        stats.record_win();
        assert_eq!(stats.games_played, 1);
        assert_eq!(stats.games_won, 1);
        assert_eq!(stats.win_streak, 1);
    }

    #[test]
    fn test_player_stats_record_loss() {
        let mut stats = PlayerStats::default();
        stats.record_win();
        stats.record_win();
        stats.record_loss();
        assert_eq!(stats.games_played, 3);
        assert_eq!(stats.games_lost, 1);
        assert_eq!(stats.win_streak, 0);
        assert_eq!(stats.best_streak, 2);
    }

    #[test]
    fn test_player_stats_record_draw() {
        let mut stats = PlayerStats::default();
        stats.record_draw();
        assert_eq!(stats.games_played, 1);
        assert_eq!(stats.games_drawn, 1);
    }

    #[test]
    fn test_player_stats_best_streak() {
        let mut stats = PlayerStats::default();
        stats.record_win();
        stats.record_win();
        stats.record_win();
        stats.record_loss();
        stats.record_win();
        assert_eq!(stats.win_streak, 1);
        assert_eq!(stats.best_streak, 3);
    }

    #[test]
    fn test_elo_win_against_equal() {
        let mut stats = PlayerStats::default();
        stats.update_rating(1200, 1.0, &TimeControl::Blitz5_3);
        assert!(stats.blitz_rating > 1200);
        assert_eq!(stats.blitz_games, 1);
    }

    #[test]
    fn test_elo_loss_against_equal() {
        let mut stats = PlayerStats::default();
        stats.update_rating(1200, 0.0, &TimeControl::Blitz5_3);
        assert!(stats.blitz_rating < 1200);
    }

    #[test]
    fn test_elo_draw_against_equal() {
        let mut stats = PlayerStats::default();
        stats.update_rating(1200, 0.5, &TimeControl::Blitz5_3);
        assert_eq!(stats.blitz_rating, 1200);
    }

    #[test]
    fn test_elo_win_against_higher() {
        let mut stats = PlayerStats::default();
        stats.update_rating(1400, 1.0, &TimeControl::Bullet1_0);
        assert!(stats.bullet_rating > 1216);
    }

    #[test]
    fn test_elo_win_against_lower() {
        let mut stats = PlayerStats::default();
        stats.update_rating(1000, 1.0, &TimeControl::Rapid10_0);
        assert!(stats.rapid_rating < 1216);
        assert!(stats.rapid_rating > 1200);
    }

    #[test]
    fn test_elo_minimum_rating() {
        let mut stats = PlayerStats::default();
        stats.bullet_rating = 110;
        stats.update_rating(1500, 0.0, &TimeControl::Bullet1_0);
        assert!(stats.bullet_rating >= 100);
    }

    #[test]
    fn test_elo_maximum_rating() {
        let mut stats = PlayerStats::default();
        stats.blitz_rating = 2990;
        stats.update_rating(1000, 1.0, &TimeControl::Blitz3_0);
        assert!(stats.blitz_rating <= 3000);
    }

    #[test]
    fn test_elo_k_factor_new_player() {
        let mut stats = PlayerStats::default();
        stats.update_rating(1200, 1.0, &TimeControl::Blitz5_3);
        assert_eq!(stats.blitz_rating, 1216);
    }

    #[test]
    fn test_elo_k_factor_experienced_player() {
        let mut stats = PlayerStats::default();
        stats.blitz_games = 30;
        stats.update_rating(1200, 1.0, &TimeControl::Blitz5_3);
        assert_eq!(stats.blitz_rating, 1208);
    }

    #[test]
    fn test_get_rating_by_time_control() {
        let mut stats = PlayerStats::default();
        stats.bullet_rating = 1100;
        stats.blitz_rating = 1200;
        stats.rapid_rating = 1300;

        assert_eq!(stats.get_rating(&TimeControl::Bullet1_0), 1100);
        assert_eq!(stats.get_rating(&TimeControl::Bullet2_1), 1100);
        assert_eq!(stats.get_rating(&TimeControl::Blitz3_0), 1200);
        assert_eq!(stats.get_rating(&TimeControl::Blitz5_3), 1200);
        assert_eq!(stats.get_rating(&TimeControl::Rapid10_0), 1300);
    }

    #[test]
    fn test_record_win_with_rating() {
        let mut stats = PlayerStats::default();
        stats.record_win_with_rating(1200, &TimeControl::Blitz5_3);
        assert_eq!(stats.games_won, 1);
        assert!(stats.blitz_rating > 1200);
    }

    #[test]
    fn test_record_loss_with_rating() {
        let mut stats = PlayerStats::default();
        stats.record_loss_with_rating(1200, &TimeControl::Blitz5_3);
        assert_eq!(stats.games_lost, 1);
        assert!(stats.blitz_rating < 1200);
    }

    // ========================================================================
    // GAME STATE TESTS
    // ========================================================================

    #[test]
    fn test_checkers_game_new() {
        let game = CheckersGame::new("game1".to_string(), Some("player1".to_string()), PlayerType::Human);
        assert_eq!(game.id, "game1");
        assert_eq!(game.red_player, Some("player1".to_string()));
        assert!(game.black_player.is_none());
        assert_eq!(game.status, GameStatus::Pending);
        assert_eq!(game.current_turn, Turn::Red);
    }

    #[test]
    fn test_checkers_game_new_timed() {
        let game = CheckersGame::new_timed(
            "game2".to_string(),
            Some("player1".to_string()),
            PlayerType::Human,
            TimeControl::Blitz5_3,
        );
        assert!(game.clock.is_some());
        let clock = game.clock.unwrap();
        assert_eq!(clock.initial_time_ms, 300_000);
    }

    #[test]
    fn test_checkers_game_can_player_move_red() {
        let mut game = CheckersGame::new("g".to_string(), Some("p1".to_string()), PlayerType::Human);
        game.black_player = Some("p2".to_string());
        game.status = GameStatus::Active;
        game.current_turn = Turn::Red;

        assert!(game.can_player_move("p1"));
        assert!(!game.can_player_move("p2"));
    }

    #[test]
    fn test_checkers_game_can_player_move_black() {
        let mut game = CheckersGame::new("g".to_string(), Some("p1".to_string()), PlayerType::Human);
        game.black_player = Some("p2".to_string());
        game.status = GameStatus::Active;
        game.current_turn = Turn::Black;

        assert!(!game.can_player_move("p1"));
        assert!(game.can_player_move("p2"));
    }

    #[test]
    fn test_checkers_game_can_player_move_pending() {
        let game = CheckersGame::new("g".to_string(), Some("p1".to_string()), PlayerType::Human);
        assert!(!game.can_player_move("p1"));
    }

    #[test]
    fn test_checkers_game_with_options_red() {
        let game = CheckersGame::new_with_options(
            "g".to_string(),
            "creator".to_string(),
            ColorPreference::Red,
            true,
            None,
        );
        assert_eq!(game.red_player, Some("creator".to_string()));
        assert!(game.black_player.is_none());
    }

    #[test]
    fn test_checkers_game_with_options_black() {
        let game = CheckersGame::new_with_options(
            "g".to_string(),
            "creator".to_string(),
            ColorPreference::Black,
            true,
            None,
        );
        assert!(game.red_player.is_none());
        assert_eq!(game.black_player, Some("creator".to_string()));
    }

    #[test]
    fn test_checkers_game_with_options_random() {
        let game = CheckersGame::new_with_options(
            "g".to_string(),
            "creator".to_string(),
            ColorPreference::Random,
            false,
            Some(TimeControl::Bullet1_0),
        );
        assert!(game.creator_wants_random);
        assert!(!game.is_rated);
        assert!(game.clock.is_some());
    }

    // ========================================================================
    // DRAW OFFER TESTS
    // ========================================================================

    #[test]
    fn test_draw_offer_state_default() {
        let state = DrawOfferState::default();
        assert_eq!(state, DrawOfferState::None);
    }

    #[test]
    fn test_draw_offer_states() {
        assert_ne!(DrawOfferState::OfferedByRed, DrawOfferState::OfferedByBlack);
        assert_ne!(DrawOfferState::None, DrawOfferState::OfferedByRed);
    }

    // ========================================================================
    // QUEUE ENTRY TESTS
    // ========================================================================

    #[test]
    fn test_queue_entry_new() {
        let entry = QueueEntry::new("chain1".to_string(), TimeControl::Blitz5_3, 12345);
        assert_eq!(entry.chain_id, "chain1");
        assert_eq!(entry.time_control, TimeControl::Blitz5_3);
        assert_eq!(entry.joined_at, 12345);
    }

    // ========================================================================
    // TOURNAMENT TESTS
    // ========================================================================

    #[test]
    fn test_tournament_status_default() {
        let status = TournamentStatus::default();
        assert_eq!(status, TournamentStatus::Registration);
    }

    #[test]
    fn test_match_status_default() {
        let status = MatchStatus::default();
        assert_eq!(status, MatchStatus::Pending);
    }

    #[test]
    fn test_tournament_default() {
        let tournament = Tournament::default();
        assert!(tournament.id.is_empty());
        assert_eq!(tournament.status, TournamentStatus::Registration);
        assert!(tournament.registered_players.is_empty());
    }

    // ========================================================================
    // SERIALIZATION TESTS
    // ========================================================================

    #[test]
    fn test_piece_serialization() {
        let piece = Piece::RedKing;
        let serialized = bcs::to_bytes(&piece).unwrap();
        let deserialized: Piece = bcs::from_bytes(&serialized).unwrap();
        assert_eq!(piece, deserialized);
    }

    #[test]
    fn test_game_status_serialization() {
        let status = GameStatus::Active;
        let serialized = bcs::to_bytes(&status).unwrap();
        let deserialized: GameStatus = bcs::from_bytes(&serialized).unwrap();
        assert_eq!(status, deserialized);
    }

    #[test]
    fn test_time_control_serialization() {
        let tc = TimeControl::Blitz5_3;
        let serialized = bcs::to_bytes(&tc).unwrap();
        let deserialized: TimeControl = bcs::from_bytes(&serialized).unwrap();
        assert_eq!(tc, deserialized);
    }

    #[test]
    fn test_checkers_move_serialization() {
        let m = CheckersMove::new(2, 1, 4, 3).with_capture(3, 2);
        let serialized = bcs::to_bytes(&m).unwrap();
        let deserialized: CheckersMove = bcs::from_bytes(&serialized).unwrap();
        assert_eq!(m.from_row, deserialized.from_row);
        assert_eq!(m.captured_row, deserialized.captured_row);
    }

    #[test]
    fn test_message_serialization() {
        let msg = Message::GameStarted {
            game_id: "g1".to_string(),
            red_player: "r".to_string(),
            black_player: "b".to_string(),
        };
        let serialized = bcs::to_bytes(&msg).unwrap();
        let deserialized: Message = bcs::from_bytes(&serialized).unwrap();
        match deserialized {
            Message::GameStarted { game_id, .. } => assert_eq!(game_id, "g1"),
            _ => panic!("Wrong message type"),
        }
    }
}
