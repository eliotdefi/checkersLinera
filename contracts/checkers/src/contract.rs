#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use checkers_abi::{
    CheckersAbi, CheckersGame, CheckersMove, Clock, ColorPreference, DrawOfferState, GameResult,
    GameStatus, MatchStatus, Message, Operation, OperationResult, Piece, PlayerType,
    SwissParticipant, TimeControl, Tournament, TournamentFormat, TournamentMatch, TournamentRound,
    TournamentStatus, Turn,
    count_pieces, get_piece, is_valid_square, set_piece, STARTING_BOARD,
};
use linera_sdk::{
    linera_base_types::{ChainId, WithContractAbi},
    views::{RootView, View},
    Contract, ContractRuntime,
};
use state::CheckersState;

pub struct CheckersContract {
    state: CheckersState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(CheckersContract);

impl WithContractAbi for CheckersContract {
    type Abi = CheckersAbi;
}

impl Contract for CheckersContract {
    type Message = Message;
    type Parameters = ();
    type InstantiationArgument = ();
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = CheckersState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        CheckersContract { state, runtime }
    }

    async fn instantiate(&mut self, _argument: Self::InstantiationArgument) {
        self.state.next_game_id.set(1);
        self.state.next_tournament_id.set(1);
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        match operation {
            Operation::CreateGame { vs_ai, time_control, color_preference, is_rated, player_id } => {
                self.create_game(vs_ai, time_control, color_preference, is_rated, player_id).await
            }
            Operation::JoinGame { game_id, player_id } => self.join_game(game_id, player_id).await,
            Operation::MakeMove {
                game_id,
                from_row,
                from_col,
                to_row,
                to_col,
                player_id,
            } => {
                self.make_move(game_id, from_row, from_col, to_row, to_col, player_id)
                    .await
            }
            Operation::Resign { game_id, player_id } => self.resign(game_id, player_id).await,
            Operation::RequestAiMove { game_id } => self.make_ai_move(game_id).await,
            Operation::JoinQueue { time_control, player_id } => self.join_queue(time_control, player_id).await,
            Operation::LeaveQueue { player_id } => self.leave_queue(player_id).await,
            Operation::OfferDraw { game_id } => self.offer_draw(game_id).await,
            Operation::AcceptDraw { game_id } => self.accept_draw(game_id).await,
            Operation::DeclineDraw { game_id } => self.decline_draw(game_id).await,
            Operation::ClaimTimeWin { game_id } => self.claim_time_win(game_id).await,
            Operation::CreateTournament { name, time_control, max_players, is_public, scheduled_start, player_id } => {
                self.create_tournament(name, time_control, max_players, is_public, scheduled_start, player_id).await
            }
            Operation::JoinTournament { tournament_id, player_id } => {
                self.join_tournament(tournament_id, player_id).await
            }
            Operation::JoinTournamentByCode { invite_code, player_id } => {
                self.join_tournament_by_code(invite_code, player_id).await
            }
            Operation::LeaveTournament { tournament_id, player_id } => {
                self.leave_tournament(tournament_id, player_id).await
            }
            Operation::StartTournament { tournament_id, player_id } => {
                self.start_tournament(tournament_id, player_id).await
            }
            Operation::StartTournamentMatch { tournament_id, match_id, player_id } => {
                self.start_tournament_match(tournament_id, match_id, player_id).await
            }
            Operation::ForfeitTournamentMatch { tournament_id, match_id, player_id } => {
                self.forfeit_tournament_match(tournament_id, match_id, player_id).await
            }
            Operation::CancelTournament { tournament_id, player_id } => {
                self.cancel_tournament(tournament_id, player_id).await
            }
        }
    }

    async fn execute_message(&mut self, message: Self::Message) {
        match message {
            Message::JoinRequest { game_id, player_chain } => {
                self.handle_join_request(&game_id, &player_chain).await;
            }
            Message::MoveMade {
                game_id,
                chess_move,
                new_board_state,
                new_turn,
                game_status,
                game_result,
            } => {
                self.handle_move_received(
                    &game_id, chess_move, &new_board_state, new_turn, game_status, game_result,
                ).await;
            }
            Message::GameStarted { game_id, red_player, black_player } => {
                self.handle_game_started(&game_id, &red_player, &black_player).await;
            }
            Message::GameEnded { game_id, result, winner } => {
                self.handle_game_ended(&game_id, result, winner.as_deref()).await;
            }
            Message::SyncGameState { game } => {
                let _ = self.state.save_game(game).await;
            }
            Message::MatchFound { game_id, red_player, black_player, time_control } => {
                // Handle match found notification - create/sync the game locally
                self.handle_match_found(&game_id, &red_player, &black_player, time_control).await;
            }
            Message::DrawOffered { game_id, offered_by } => {
                // Handle draw offer notification
                self.handle_draw_offered(&game_id, offered_by).await;
            }
            Message::DrawDeclined { game_id } => {
                // Handle draw declined notification
                self.handle_draw_declined(&game_id).await;
            }
            Message::DrawAccepted { game_id } => {
                // Handle draw accepted notification
                self.handle_draw_accepted(&game_id).await;
            }
        }
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}

impl CheckersContract {
    async fn create_game(
        &mut self,
        vs_ai: bool,
        time_control: Option<TimeControl>,
        color_preference: Option<ColorPreference>,
        is_rated: Option<bool>,
        player_id: String,
    ) -> OperationResult {
        let game_id = self.state.generate_game_id().await;
        // Use player_id from frontend instead of chain_id
        let creator_id = player_id;
        let timestamp = self.runtime.system_time().micros();
        // Convert micros to millis for clock
        let timestamp_ms = timestamp / 1000;

        let color_pref = color_preference.unwrap_or(ColorPreference::Red);
        let rated = is_rated.unwrap_or(true);

        // Use the new constructor with full options
        let mut game = CheckersGame::new_with_options(
            game_id.clone(),
            creator_id.clone(),
            color_pref,
            rated,
            time_control,
        );
        game.created_at = timestamp;
        game.updated_at = timestamp;

        if vs_ai {
            // Handle AI games based on color preference
            match color_pref {
                ColorPreference::Red => {
                    // Creator is red, AI is black
                    game.red_player = Some(creator_id.clone());
                    game.black_player = Some("AI".to_string());
                    game.black_player_type = PlayerType::AI;
                }
                ColorPreference::Black => {
                    // Creator is black, AI is red (AI plays first)
                    game.black_player = Some(creator_id.clone());
                    game.red_player = Some("AI".to_string());
                    game.red_player_type = PlayerType::AI;
                }
                ColorPreference::Random => {
                    // Use timestamp for randomness
                    if timestamp % 2 == 0 {
                        game.red_player = Some(creator_id.clone());
                        game.black_player = Some("AI".to_string());
                        game.black_player_type = PlayerType::AI;
                    } else {
                        game.black_player = Some(creator_id.clone());
                        game.red_player = Some("AI".to_string());
                        game.red_player_type = PlayerType::AI;
                    }
                }
            }
            game.status = GameStatus::Active;
            game.creator_wants_random = false; // Not needed for AI games

            // Start the clock when game becomes active
            if let Some(ref mut clock) = game.clock {
                clock.start(timestamp_ms);
            }
        }

        if let Err(e) = self.state.save_game(game).await {
            return OperationResult::Error { message: e };
        }

        OperationResult::GameCreated { game_id }
    }

    async fn join_game(&mut self, game_id: String, player_id: String) -> OperationResult {
        // Use player_id from frontend instead of chain_id
        let joiner_id = player_id;
        let timestamp = self.runtime.system_time().micros();
        let timestamp_ms = timestamp / 1000;

        let mut game = match self.state.get_game(&game_id).await {
            Some(g) => g,
            None => return OperationResult::Error { message: "Game not found".to_string() },
        };

        if game.status != GameStatus::Pending {
            return OperationResult::Error { message: "Game not available".to_string() };
        }

        // Check if joiner is the creator (can't join own game)
        if game.red_player.as_deref() == Some(joiner_id.as_str())
            || game.black_player.as_deref() == Some(joiner_id.as_str()) {
            return OperationResult::Error { message: "Cannot join own game".to_string() };
        }

        // Handle color assignment based on game setup
        if game.creator_wants_random {
            // Random color: use timestamp to decide
            if timestamp % 2 == 0 {
                // Swap: creator becomes black, joiner becomes red
                let creator = game.red_player.take();
                game.black_player = creator;
                game.red_player = Some(joiner_id.clone());
            } else {
                // Keep: creator is red, joiner is black
                game.black_player = Some(joiner_id.clone());
            }
        } else if game.red_player.is_none() {
            // Creator chose black, joiner gets red
            game.red_player = Some(joiner_id.clone());
        } else {
            // Creator chose red (default), joiner gets black
            game.black_player = Some(joiner_id.clone());
        }

        game.black_player_type = PlayerType::Human;
        game.red_player_type = PlayerType::Human;
        game.status = GameStatus::Active;
        game.updated_at = timestamp;

        // Start the clock when game becomes active
        if let Some(ref mut clock) = game.clock {
            clock.start(timestamp_ms);
        }

        if let Err(e) = self.state.save_game(game.clone()).await {
            return OperationResult::Error { message: e };
        }

        // Note: With Hub Chain pattern, all players are on the same chain
        // Cross-chain messaging is not needed - both players poll the same chain

        OperationResult::GameJoined { game_id }
    }

    async fn make_move(
        &mut self,
        game_id: String,
        from_row: u8,
        from_col: u8,
        to_row: u8,
        to_col: u8,
        player_id: String,
    ) -> OperationResult {
        // Use player_id from frontend instead of chain_id
        let player = player_id;
        let timestamp = self.runtime.system_time().micros();
        let timestamp_ms = timestamp / 1000;

        let mut game = match self.state.get_game(&game_id).await {
            Some(g) => g,
            None => return OperationResult::Error { message: "Game not found".to_string() },
        };

        if game.status != GameStatus::Active {
            return OperationResult::Error { message: "Game not active".to_string() };
        }

        if !game.can_player_move(&player) {
            return OperationResult::Error { message: "Not your turn".to_string() };
        }

        // Check if clock exists and if player has timed out
        if let Some(ref clock) = game.clock {
            if let Some(timed_out_player) = clock.timed_out(timestamp_ms) {
                // Player has timed out, end the game
                game.status = GameStatus::Finished;
                game.result = Some(match timed_out_player {
                    Turn::Red => GameResult::BlackWins,
                    Turn::Black => GameResult::RedWins,
                });
                game.updated_at = timestamp;

                if let Err(e) = self.state.save_game(game.clone()).await {
                    return OperationResult::Error { message: e };
                }

                if let Some(result) = game.result {
                    let _ = self.state.record_game_result(&game, result).await;
                }

                return OperationResult::Error {
                    message: "Time expired".to_string()
                };
            }
        }

        match self.validate_and_execute_move(&mut game, from_row, from_col, to_row, to_col) {
            Ok(checkers_move) => {
                game.moves.push(checkers_move.clone());
                game.move_count += 1;
                game.updated_at = timestamp;

                // Update clock after successful move
                if let Some(ref mut clock) = game.clock {
                    if !clock.make_move(timestamp_ms) {
                        // Time ran out during this move
                        game.status = GameStatus::Finished;
                        game.result = Some(match game.current_turn.opposite() {
                            Turn::Red => GameResult::BlackWins,
                            Turn::Black => GameResult::RedWins,
                        });
                    }
                }

                // Clear any pending draw offer after a move
                game.draw_offer = DrawOfferState::None;

                let game_over = self.check_game_over(&mut game);

                if let Err(e) = self.state.save_game(game.clone()).await {
                    return OperationResult::Error { message: e };
                }

                if game_over {
                    if let Some(result) = game.result {
                        let _ = self.state.record_game_result(&game, result).await;
                    }
                }

                self.notify_opponent(&game, checkers_move).await;

                OperationResult::MoveMade { game_id, game_over }
            }
            Err(e) => OperationResult::Error { message: e },
        }
    }

    async fn resign(&mut self, game_id: String, player_id: String) -> OperationResult {
        // Use player_id from frontend instead of chain_id
        let player = player_id;

        let mut game = match self.state.get_game(&game_id).await {
            Some(g) => g,
            None => return OperationResult::Error { message: "Game not found".to_string() },
        };

        if game.status != GameStatus::Active {
            return OperationResult::Error { message: "Game not active".to_string() };
        }

        let is_red = game.red_player.as_deref() == Some(player.as_str());
        let is_black = game.black_player.as_deref() == Some(player.as_str());

        if !is_red && !is_black {
            return OperationResult::Error { message: "Not in this game".to_string() };
        }

        game.status = GameStatus::Finished;
        game.result = Some(if is_red { GameResult::BlackWins } else { GameResult::RedWins });
        game.updated_at = self.runtime.system_time().micros();

        if let Err(e) = self.state.save_game(game.clone()).await {
            return OperationResult::Error { message: e };
        }

        if let Some(result) = game.result {
            let _ = self.state.record_game_result(&game, result).await;
        }

        // Update tournament if this is a tournament game
        self.handle_tournament_game_finished(&game).await;

        OperationResult::Resigned { game_id }
    }

    async fn make_ai_move(&mut self, game_id: String) -> OperationResult {
        let mut game = match self.state.get_game(&game_id).await {
            Some(g) => g,
            None => return OperationResult::Error { message: "Game not found".to_string() },
        };

        if game.status != GameStatus::Active {
            return OperationResult::Error { message: "Game not active".to_string() };
        }

        let is_ai_turn = match game.current_turn {
            Turn::Red => game.red_player_type == PlayerType::AI,
            Turn::Black => game.black_player_type == PlayerType::AI,
        };

        if !is_ai_turn {
            return OperationResult::Error { message: "Not AI's turn".to_string() };
        }

        match self.calculate_ai_move(&game) {
            Some((from_row, from_col, to_row, to_col)) => {
                match self.validate_and_execute_move(&mut game, from_row, from_col, to_row, to_col) {
                    Ok(checkers_move) => {
                        game.moves.push(checkers_move);
                        game.move_count += 1;
                        game.updated_at = self.runtime.system_time().micros();

                        let game_over = self.check_game_over(&mut game);

                        if let Err(e) = self.state.save_game(game.clone()).await {
                            return OperationResult::Error { message: e };
                        }

                        if game_over {
                            if let Some(result) = game.result {
                                let _ = self.state.record_game_result(&game, result).await;
                            }
                        }

                        OperationResult::AiMoveMade { game_id, game_over }
                    }
                    Err(e) => OperationResult::Error { message: e },
                }
            }
            None => {
                game.status = GameStatus::Finished;
                game.result = Some(match game.current_turn {
                    Turn::Red => GameResult::BlackWins,
                    Turn::Black => GameResult::RedWins,
                });
                game.updated_at = self.runtime.system_time().micros();

                if let Err(e) = self.state.save_game(game.clone()).await {
                    return OperationResult::Error { message: e };
                }

                if let Some(result) = game.result {
                    let _ = self.state.record_game_result(&game, result).await;
                }

                OperationResult::AiMoveMade { game_id, game_over: true }
            }
        }
    }

    fn validate_and_execute_move(
        &self,
        game: &mut CheckersGame,
        from_row: u8,
        from_col: u8,
        to_row: u8,
        to_col: u8,
    ) -> Result<CheckersMove, String> {
        if !is_valid_square(from_row, from_col) || !is_valid_square(to_row, to_col) {
            return Err("Invalid square".to_string());
        }

        let piece = get_piece(&game.board_state, from_row, from_col);

        match game.current_turn {
            Turn::Red => {
                if !piece.is_red() {
                    return Err("Not your piece".to_string());
                }
            }
            Turn::Black => {
                if !piece.is_black() {
                    return Err("Not your piece".to_string());
                }
            }
        }

        if !get_piece(&game.board_state, to_row, to_col).is_empty() {
            return Err("Destination not empty".to_string());
        }

        let row_diff = (to_row as i8 - from_row as i8).abs();
        let col_diff = (to_col as i8 - from_col as i8).abs();

        if row_diff != col_diff {
            return Err("Must move diagonally".to_string());
        }

        let mut checkers_move = CheckersMove::new(from_row, from_col, to_row, to_col);
        checkers_move.timestamp = game.updated_at;

        // Simple move
        if row_diff == 1 {
            if !piece.is_king() {
                let valid_dir = match game.current_turn {
                    Turn::Red => to_row > from_row,
                    Turn::Black => to_row < from_row,
                };
                if !valid_dir {
                    return Err("Invalid direction".to_string());
                }
            }

            if self.has_capture_available(game) {
                return Err("Must capture".to_string());
            }

            game.board_state = set_piece(&game.board_state, from_row, from_col, Piece::Empty);
            let promoted = self.check_promotion(piece, to_row);
            let final_piece = if promoted { piece.to_king() } else { piece };
            game.board_state = set_piece(&game.board_state, to_row, to_col, final_piece);

            if promoted {
                checkers_move = checkers_move.with_promotion();
            }

            game.current_turn = game.current_turn.opposite();
            return Ok(checkers_move);
        }

        // Capture move
        if row_diff == 2 {
            let mid_row = ((from_row as i16 + to_row as i16) / 2) as u8;
            let mid_col = ((from_col as i16 + to_col as i16) / 2) as u8;
            let captured = get_piece(&game.board_state, mid_row, mid_col);

            let is_enemy = match game.current_turn {
                Turn::Red => captured.is_black(),
                Turn::Black => captured.is_red(),
            };

            if !is_enemy {
                return Err("No piece to capture".to_string());
            }

            if !piece.is_king() {
                let valid_dir = match game.current_turn {
                    Turn::Red => to_row > from_row,
                    Turn::Black => to_row < from_row,
                };
                if !valid_dir {
                    return Err("Invalid capture direction".to_string());
                }
            }

            game.board_state = set_piece(&game.board_state, from_row, from_col, Piece::Empty);
            game.board_state = set_piece(&game.board_state, mid_row, mid_col, Piece::Empty);

            let promoted = self.check_promotion(piece, to_row);
            let final_piece = if promoted { piece.to_king() } else { piece };
            game.board_state = set_piece(&game.board_state, to_row, to_col, final_piece);

            checkers_move = checkers_move.with_capture(mid_row, mid_col);
            if promoted {
                checkers_move = checkers_move.with_promotion();
            }

            // Chain jump logic: if the piece wasn't promoted and can capture again,
            // don't switch turns - the player must continue jumping
            let can_continue_jumping = !promoted && self.piece_has_capture(game, to_row, to_col, final_piece);

            if !can_continue_jumping {
                // No more captures available or piece was promoted - switch turns
                game.current_turn = game.current_turn.opposite();
            }
            // If can_continue_jumping is true, DON'T switch turns - player continues

            return Ok(checkers_move);
        }

        Err("Invalid move distance".to_string())
    }

    fn has_capture_available(&self, game: &CheckersGame) -> bool {
        for row in 0..8u8 {
            for col in 0..8u8 {
                let piece = get_piece(&game.board_state, row, col);
                let is_current = match game.current_turn {
                    Turn::Red => piece.is_red(),
                    Turn::Black => piece.is_black(),
                };
                if is_current && self.piece_has_capture(game, row, col, piece) {
                    return true;
                }
            }
        }
        false
    }

    fn piece_has_capture(&self, game: &CheckersGame, row: u8, col: u8, piece: Piece) -> bool {
        let dirs: Vec<(i8, i8)> = if piece.is_king() {
            vec![(-1, -1), (-1, 1), (1, -1), (1, 1)]
        } else {
            match game.current_turn {
                Turn::Red => vec![(1, -1), (1, 1)],
                Turn::Black => vec![(-1, -1), (-1, 1)],
            }
        };

        for (dr, dc) in dirs {
            let mid_r = row as i8 + dr;
            let mid_c = col as i8 + dc;
            let to_r = row as i8 + 2 * dr;
            let to_c = col as i8 + 2 * dc;

            if to_r >= 0 && to_r < 8 && to_c >= 0 && to_c < 8 {
                let mid_piece = get_piece(&game.board_state, mid_r as u8, mid_c as u8);
                let to_piece = get_piece(&game.board_state, to_r as u8, to_c as u8);

                let is_enemy = match game.current_turn {
                    Turn::Red => mid_piece.is_black(),
                    Turn::Black => mid_piece.is_red(),
                };

                if is_enemy && to_piece.is_empty() {
                    return true;
                }
            }
        }
        false
    }

    fn check_promotion(&self, piece: Piece, to_row: u8) -> bool {
        match piece {
            Piece::Red => to_row == 7,
            Piece::Black => to_row == 0,
            _ => false,
        }
    }

    fn check_game_over(&self, game: &mut CheckersGame) -> bool {
        let (red, black) = count_pieces(&game.board_state);

        if red == 0 {
            game.status = GameStatus::Finished;
            game.result = Some(GameResult::BlackWins);
            return true;
        }
        if black == 0 {
            game.status = GameStatus::Finished;
            game.result = Some(GameResult::RedWins);
            return true;
        }

        if !self.has_any_valid_move(game) {
            game.status = GameStatus::Finished;
            game.result = Some(match game.current_turn {
                Turn::Red => GameResult::BlackWins,
                Turn::Black => GameResult::RedWins,
            });
            return true;
        }

        false
    }

    fn has_any_valid_move(&self, game: &CheckersGame) -> bool {
        for row in 0..8u8 {
            for col in 0..8u8 {
                let piece = get_piece(&game.board_state, row, col);
                let is_current = match game.current_turn {
                    Turn::Red => piece.is_red(),
                    Turn::Black => piece.is_black(),
                };
                if is_current {
                    if self.piece_has_capture(game, row, col, piece) {
                        return true;
                    }
                    if self.piece_has_simple_move(game, row, col, piece) {
                        return true;
                    }
                }
            }
        }
        false
    }

    fn piece_has_simple_move(&self, game: &CheckersGame, row: u8, col: u8, piece: Piece) -> bool {
        let dirs: Vec<(i8, i8)> = if piece.is_king() {
            vec![(-1, -1), (-1, 1), (1, -1), (1, 1)]
        } else {
            match game.current_turn {
                Turn::Red => vec![(1, -1), (1, 1)],
                Turn::Black => vec![(-1, -1), (-1, 1)],
            }
        };

        for (dr, dc) in dirs {
            let to_r = row as i8 + dr;
            let to_c = col as i8 + dc;
            if to_r >= 0 && to_r < 8 && to_c >= 0 && to_c < 8 {
                if get_piece(&game.board_state, to_r as u8, to_c as u8).is_empty() {
                    return true;
                }
            }
        }
        false
    }

    fn calculate_ai_move(&self, game: &CheckersGame) -> Option<(u8, u8, u8, u8)> {
        let mut best_move: Option<(u8, u8, u8, u8)> = None;
        let mut best_score = i32::MIN;

        for row in 0..8u8 {
            for col in 0..8u8 {
                let piece = get_piece(&game.board_state, row, col);
                let is_ai = match game.current_turn {
                    Turn::Red => piece.is_red(),
                    Turn::Black => piece.is_black(),
                };

                if !is_ai {
                    continue;
                }

                let moves = self.get_valid_moves_for_piece(game, row, col, piece);

                for (to_row, to_col, is_capture) in moves {
                    let mut score = 0;

                    if is_capture {
                        score += 100;
                    }

                    match game.current_turn {
                        Turn::Red => {
                            if !piece.is_king() {
                                score += (to_row as i32) * 2;
                                if to_row == 7 {
                                    score += 50;
                                }
                            }
                        }
                        Turn::Black => {
                            if !piece.is_king() {
                                score += (7 - to_row as i32) * 2;
                                if to_row == 0 {
                                    score += 50;
                                }
                            }
                        }
                    }

                    let center_dist = ((to_row as i32 - 4).abs() + (to_col as i32 - 4).abs()) as i32;
                    score -= center_dist;

                    let random_factor = ((row as i32 * 13 + col as i32 * 17 + game.move_count as i32) % 5) as i32;
                    score += random_factor;

                    if score > best_score {
                        best_score = score;
                        best_move = Some((row, col, to_row, to_col));
                    }
                }
            }
        }

        best_move
    }

    fn get_valid_moves_for_piece(&self, game: &CheckersGame, row: u8, col: u8, piece: Piece) -> Vec<(u8, u8, bool)> {
        let mut moves = Vec::new();
        let has_capture = self.has_capture_available(game);

        let dirs: Vec<(i8, i8)> = if piece.is_king() {
            vec![(-1, -1), (-1, 1), (1, -1), (1, 1)]
        } else {
            match game.current_turn {
                Turn::Red => vec![(1, -1), (1, 1)],
                Turn::Black => vec![(-1, -1), (-1, 1)],
            }
        };

        for (dr, dc) in &dirs {
            let mid_r = row as i8 + dr;
            let mid_c = col as i8 + dc;
            let to_r = row as i8 + 2 * dr;
            let to_c = col as i8 + 2 * dc;

            if to_r >= 0 && to_r < 8 && to_c >= 0 && to_c < 8 {
                let mid_piece = get_piece(&game.board_state, mid_r as u8, mid_c as u8);
                let to_piece = get_piece(&game.board_state, to_r as u8, to_c as u8);

                let is_enemy = match game.current_turn {
                    Turn::Red => mid_piece.is_black(),
                    Turn::Black => mid_piece.is_red(),
                };

                if is_enemy && to_piece.is_empty() {
                    moves.push((to_r as u8, to_c as u8, true));
                }
            }
        }

        if !has_capture {
            for (dr, dc) in &dirs {
                let to_r = row as i8 + dr;
                let to_c = col as i8 + dc;
                if to_r >= 0 && to_r < 8 && to_c >= 0 && to_c < 8 {
                    if get_piece(&game.board_state, to_r as u8, to_c as u8).is_empty() {
                        moves.push((to_r as u8, to_c as u8, false));
                    }
                }
            }
        }

        moves
    }

    async fn handle_join_request(&mut self, game_id: &str, player_chain: &str) {
        if let Some(mut game) = self.state.get_game(game_id).await {
            if game.status == GameStatus::Pending && game.black_player.is_none() {
                game.black_player = Some(player_chain.to_string());
                game.status = GameStatus::Active;
                game.updated_at = self.runtime.system_time().micros();
                let _ = self.state.save_game(game).await;
            }
        }
    }

    async fn handle_move_received(
        &mut self,
        game_id: &str,
        checkers_move: CheckersMove,
        new_board_state: &str,
        new_turn: Turn,
        game_status: GameStatus,
        game_result: Option<GameResult>,
    ) {
        if let Some(mut game) = self.state.get_game(game_id).await {
            game.board_state = new_board_state.to_string();
            game.current_turn = new_turn;
            game.status = game_status;
            game.result = game_result;
            game.moves.push(checkers_move);
            game.move_count += 1;
            game.updated_at = self.runtime.system_time().micros();
            let _ = self.state.save_game(game).await;
        }
    }

    async fn handle_game_started(&mut self, game_id: &str, red_player: &str, black_player: &str) {
        if let Some(mut game) = self.state.get_game(game_id).await {
            game.red_player = Some(red_player.to_string());
            game.black_player = Some(black_player.to_string());
            game.status = GameStatus::Active;
            game.updated_at = self.runtime.system_time().micros();
            let _ = self.state.save_game(game).await;
        }
    }

    async fn handle_game_ended(&mut self, game_id: &str, result: GameResult, _winner: Option<&str>) {
        if let Some(mut game) = self.state.get_game(game_id).await {
            game.status = GameStatus::Finished;
            game.result = Some(result);
            game.updated_at = self.runtime.system_time().micros();
            let _ = self.state.save_game(game.clone()).await;
            let _ = self.state.record_game_result(&game, result).await;
            // Update tournament if this is a tournament game
            self.handle_tournament_game_finished(&game).await;
        }
    }

    async fn notify_opponent(&mut self, game: &CheckersGame, checkers_move: CheckersMove) {
        let my_chain = self.runtime.chain_id().to_string();
        let opponent = if game.red_player.as_deref() == Some(my_chain.as_str()) {
            game.black_player.as_deref()
        } else {
            game.red_player.as_deref()
        };

        if let Some(opp) = opponent {
            if opp == "AI" {
                return;
            }
            if let Ok(chain_id) = opp.parse::<ChainId>() {
                self.runtime
                    .prepare_message(Message::MoveMade {
                        game_id: game.id.clone(),
                        chess_move: checkers_move,
                        new_board_state: game.board_state.clone(),
                        new_turn: game.current_turn,
                        game_status: game.status,
                        game_result: game.result,
                    })
                    .with_tracking()
                    .send_to(chain_id);
            }
        }
    }

    // ========================================================================
    // MATCHMAKING QUEUE OPERATIONS
    // ========================================================================

    async fn join_queue(&mut self, time_control: TimeControl, player_id: String) -> OperationResult {
        let timestamp = self.runtime.system_time().micros();
        let timestamp_ms = timestamp / 1000;

        match self.state.join_queue(&player_id, time_control, timestamp).await {
            Ok(Some(opponent_chain_id)) => {
                // Match found! Create a game with clock
                let game_id = self.state.generate_game_id().await;

                let mut game = CheckersGame::new(
                    game_id.clone(),
                    Some(opponent_chain_id.clone()), // First player in queue is red
                    PlayerType::Human,
                );
                game.black_player = Some(player_id.clone());
                game.black_player_type = PlayerType::Human;
                game.status = GameStatus::Active;
                game.created_at = timestamp;
                game.updated_at = timestamp;

                // Initialize and start the clock
                let mut clock = Clock::new(time_control);
                clock.start(timestamp_ms);
                game.clock = Some(clock);

                if let Err(e) = self.state.save_game(game.clone()).await {
                    return OperationResult::Error { message: e };
                }

                // Notify the opponent (red player) about the game
                if let Ok(opponent_chain) = opponent_chain_id.parse::<ChainId>() {
                    self.runtime
                        .prepare_message(Message::GameStarted {
                            game_id: game_id.clone(),
                            red_player: opponent_chain_id.clone(),
                            black_player: player_id.clone(),
                        })
                        .with_tracking()
                        .send_to(opponent_chain);

                    // Also sync the game state
                    self.runtime
                        .prepare_message(Message::SyncGameState { game })
                        .with_tracking()
                        .send_to(opponent_chain);
                }

                OperationResult::MatchFound {
                    game_id,
                    opponent: opponent_chain_id,
                }
            }
            Ok(None) => {
                // Added to queue, no match yet
                OperationResult::QueueJoined { time_control }
            }
            Err(e) => OperationResult::Error { message: e },
        }
    }

    async fn leave_queue(&mut self, player_id: String) -> OperationResult {
        match self.state.leave_queue(&player_id).await {
            Ok(_was_in_queue) => OperationResult::QueueLeft,
            Err(e) => OperationResult::Error { message: e },
        }
    }

    // ========================================================================
    // DRAW OPERATIONS
    // ========================================================================

    async fn offer_draw(&mut self, game_id: String) -> OperationResult {
        let player_chain = self.runtime.chain_id().to_string();

        let mut game = match self.state.get_game(&game_id).await {
            Some(g) => g,
            None => return OperationResult::Error { message: "Game not found".to_string() },
        };

        // Validate game is active
        if game.status != GameStatus::Active {
            return OperationResult::Error { message: "Game not active".to_string() };
        }

        // Prevent draws in tournament games
        if game.tournament_id.is_some() {
            return OperationResult::Error { message: "Draws not allowed in tournament games".to_string() };
        }

        // Validate player is in this game
        let is_red = game.red_player.as_deref() == Some(player_chain.as_str());
        let is_black = game.black_player.as_deref() == Some(player_chain.as_str());

        if !is_red && !is_black {
            return OperationResult::Error { message: "Not in this game".to_string() };
        }

        // Check no existing draw offer
        if game.draw_offer != DrawOfferState::None {
            return OperationResult::Error { message: "Draw already offered".to_string() };
        }

        // Set draw offer
        game.draw_offer = if is_red {
            DrawOfferState::OfferedByRed
        } else {
            DrawOfferState::OfferedByBlack
        };
        game.updated_at = self.runtime.system_time().micros();

        if let Err(e) = self.state.save_game(game).await {
            return OperationResult::Error { message: e };
        }

        OperationResult::DrawOffered { game_id }
    }

    async fn accept_draw(&mut self, game_id: String) -> OperationResult {
        let player_chain = self.runtime.chain_id().to_string();

        let mut game = match self.state.get_game(&game_id).await {
            Some(g) => g,
            None => return OperationResult::Error { message: "Game not found".to_string() },
        };

        // Validate game is active
        if game.status != GameStatus::Active {
            return OperationResult::Error { message: "Game not active".to_string() };
        }

        // Prevent draws in tournament games
        if game.tournament_id.is_some() {
            return OperationResult::Error { message: "Draws not allowed in tournament games".to_string() };
        }

        // Validate player is in this game
        let is_red = game.red_player.as_deref() == Some(player_chain.as_str());
        let is_black = game.black_player.as_deref() == Some(player_chain.as_str());

        if !is_red && !is_black {
            return OperationResult::Error { message: "Not in this game".to_string() };
        }

        // Validate accepter is the one who was offered the draw
        // (i.e., the opponent of whoever offered)
        let can_accept = match game.draw_offer {
            DrawOfferState::OfferedByRed => is_black,
            DrawOfferState::OfferedByBlack => is_red,
            DrawOfferState::None => false,
        };

        if !can_accept {
            return OperationResult::Error { message: "No draw offer to accept".to_string() };
        }

        // End game as draw
        game.status = GameStatus::Finished;
        game.result = Some(GameResult::Draw);
        game.draw_offer = DrawOfferState::None;
        game.updated_at = self.runtime.system_time().micros();

        if let Err(e) = self.state.save_game(game.clone()).await {
            return OperationResult::Error { message: e };
        }

        // Record the result
        let _ = self.state.record_game_result(&game, GameResult::Draw).await;

        OperationResult::DrawAccepted { game_id }
    }

    async fn decline_draw(&mut self, game_id: String) -> OperationResult {
        let player_chain = self.runtime.chain_id().to_string();

        let mut game = match self.state.get_game(&game_id).await {
            Some(g) => g,
            None => return OperationResult::Error { message: "Game not found".to_string() },
        };

        // Validate game is active
        if game.status != GameStatus::Active {
            return OperationResult::Error { message: "Game not active".to_string() };
        }

        // Validate player is in this game
        let is_red = game.red_player.as_deref() == Some(player_chain.as_str());
        let is_black = game.black_player.as_deref() == Some(player_chain.as_str());

        if !is_red && !is_black {
            return OperationResult::Error { message: "Not in this game".to_string() };
        }

        // Validate decliner is the one who was offered the draw
        let can_decline = match game.draw_offer {
            DrawOfferState::OfferedByRed => is_black,
            DrawOfferState::OfferedByBlack => is_red,
            DrawOfferState::None => false,
        };

        if !can_decline {
            return OperationResult::Error { message: "No draw offer to decline".to_string() };
        }

        // Clear draw offer
        game.draw_offer = DrawOfferState::None;
        game.updated_at = self.runtime.system_time().micros();

        if let Err(e) = self.state.save_game(game).await {
            return OperationResult::Error { message: e };
        }

        OperationResult::DrawDeclined { game_id }
    }

    // ========================================================================
    // TIME WIN CLAIM
    // ========================================================================

    async fn claim_time_win(&mut self, game_id: String) -> OperationResult {
        let player_chain = self.runtime.chain_id().to_string();
        let timestamp = self.runtime.system_time().micros();
        let timestamp_ms = timestamp / 1000;

        let mut game = match self.state.get_game(&game_id).await {
            Some(g) => g,
            None => return OperationResult::Error { message: "Game not found".to_string() },
        };

        // Validate game is active
        if game.status != GameStatus::Active {
            return OperationResult::Error { message: "Game not active".to_string() };
        }

        // Validate player is in this game
        let is_red = game.red_player.as_deref() == Some(player_chain.as_str());
        let is_black = game.black_player.as_deref() == Some(player_chain.as_str());

        if !is_red && !is_black {
            return OperationResult::Error { message: "Not in this game".to_string() };
        }

        // Check if game has a clock
        let clock = match &game.clock {
            Some(c) => c,
            None => return OperationResult::Error { message: "Not a timed game".to_string() },
        };

        // Check if opponent has timed out
        if let Some(timed_out_player) = clock.timed_out(timestamp_ms) {
            // Verify the claimant is not the one who timed out
            let claimant_timed_out = match timed_out_player {
                Turn::Red => is_red,
                Turn::Black => is_black,
            };

            if claimant_timed_out {
                return OperationResult::Error { message: "You timed out, not your opponent".to_string() };
            }

            // End game with claimant winning
            game.status = GameStatus::Finished;
            game.result = Some(match timed_out_player {
                Turn::Red => GameResult::BlackWins,
                Turn::Black => GameResult::RedWins,
            });
            game.updated_at = timestamp;

            if let Err(e) = self.state.save_game(game.clone()).await {
                return OperationResult::Error { message: e };
            }

            if let Some(result) = game.result {
                let _ = self.state.record_game_result(&game, result).await;
            }

            // Update tournament if this is a tournament game
            self.handle_tournament_game_finished(&game).await;

            OperationResult::TimeWinClaimed { game_id }
        } else {
            OperationResult::Error { message: "Opponent has not timed out".to_string() }
        }
    }

    // ========================================================================
    // MESSAGE HANDLERS FOR NEW MESSAGE TYPES
    // ========================================================================

    async fn handle_match_found(
        &mut self,
        game_id: &str,
        red_player: &str,
        black_player: &str,
        time_control: TimeControl,
    ) {
        // Check if game already exists
        if self.state.get_game(game_id).await.is_some() {
            return;
        }

        let timestamp = self.runtime.system_time().micros();
        let timestamp_ms = timestamp / 1000;

        // Create the game locally
        let mut game = CheckersGame::new(
            game_id.to_string(),
            Some(red_player.to_string()),
            PlayerType::Human,
        );
        game.black_player = Some(black_player.to_string());
        game.black_player_type = PlayerType::Human;
        game.status = GameStatus::Active;
        game.created_at = timestamp;
        game.updated_at = timestamp;

        // Initialize and start the clock
        let mut clock = Clock::new(time_control);
        clock.start(timestamp_ms);
        game.clock = Some(clock);

        let _ = self.state.save_game(game).await;
    }

    async fn handle_draw_offered(&mut self, game_id: &str, offered_by: Turn) {
        if let Some(mut game) = self.state.get_game(game_id).await {
            if game.status == GameStatus::Active {
                game.draw_offer = match offered_by {
                    Turn::Red => DrawOfferState::OfferedByRed,
                    Turn::Black => DrawOfferState::OfferedByBlack,
                };
                game.updated_at = self.runtime.system_time().micros();
                let _ = self.state.save_game(game).await;
            }
        }
    }

    async fn handle_draw_declined(&mut self, game_id: &str) {
        if let Some(mut game) = self.state.get_game(game_id).await {
            if game.status == GameStatus::Active {
                game.draw_offer = DrawOfferState::None;
                game.updated_at = self.runtime.system_time().micros();
                let _ = self.state.save_game(game).await;
            }
        }
    }

    async fn handle_draw_accepted(&mut self, game_id: &str) {
        if let Some(mut game) = self.state.get_game(game_id).await {
            if game.status == GameStatus::Active {
                game.status = GameStatus::Finished;
                game.result = Some(GameResult::Draw);
                game.draw_offer = DrawOfferState::None;
                game.updated_at = self.runtime.system_time().micros();
                let _ = self.state.save_game(game.clone()).await;
                let _ = self.state.record_game_result(&game, GameResult::Draw).await;
                // Note: Draws in tournaments are rare but if they happen, we don't advance anyone
                // Tournament games should not allow draws - the match would need replay
            }
        }
    }

    // ========================================================================
    // TOURNAMENT OPERATIONS
    // ========================================================================

    async fn create_tournament(
        &mut self,
        name: String,
        time_control: TimeControl,
        max_players: u32,
        is_public: bool,
        scheduled_start: Option<u64>,
        player_id: String,
    ) -> OperationResult {
        // Validate max_players is within reasonable bounds
        if max_players < 2 || max_players > 64 {
            return OperationResult::Error {
                message: "Max players must be between 2 and 64".to_string(),
            };
        }

        let creator = player_id;
        let tournament_id = self.state.generate_tournament_id().await;
        let timestamp = self.runtime.system_time().micros();

        // Generate invite code for private tournaments
        let invite_code = if !is_public {
            Some(self.generate_invite_code(&tournament_id, timestamp))
        } else {
            None
        };

        // Calculate total rounds: log2(max_players)
        let total_rounds = (max_players as f64).log2() as u32;

        let tournament = Tournament {
            id: tournament_id.clone(),
            name,
            creator: creator.clone(),
            status: TournamentStatus::Registration,
            time_control,
            max_players,
            registered_players: vec![creator], // Creator auto-joins
            matches: Vec::new(),
            current_round: 0,
            total_rounds,
            winner: None,
            created_at: timestamp,
            started_at: None,
            finished_at: None,
            is_public,
            invite_code: invite_code.clone(),
            scheduled_start,
            format: TournamentFormat::Swiss,
            participants: Vec::new(),
            rounds: Vec::new(),
            num_rounds: 0,
        };

        if let Err(e) = self.state.save_tournament(tournament).await {
            return OperationResult::Error { message: e };
        }

        // Save invite code index for private tournaments
        if let Some(code) = &invite_code {
            if let Err(e) = self.state.save_invite_code_index(code, &tournament_id).await {
                return OperationResult::Error { message: e };
            }
        }

        OperationResult::TournamentCreated { tournament_id }
    }

    /// Generate a 6-character alphanumeric invite code
    fn generate_invite_code(&self, tournament_id: &str, timestamp: u64) -> String {
        // Characters that are easy to read (no 0/O, 1/I/l confusion)
        const CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let mut code = String::with_capacity(6);

        // Mix tournament_id and timestamp for better uniqueness
        let id_hash: u64 = tournament_id.bytes().fold(0u64, |acc, b| {
            acc.wrapping_mul(31).wrapping_add(b as u64)
        });
        let mut seed = timestamp.wrapping_mul(id_hash);

        for i in 0..6 {
            let idx = ((seed >> (i * 5)) % 32) as usize;
            code.push(CHARS[idx] as char);
            seed = seed.wrapping_mul(1103515245).wrapping_add(12345); // LCG mixing
        }

        code
    }

    async fn join_tournament(&mut self, tournament_id: String, player_id: String) -> OperationResult {
        let player = player_id;

        let mut tournament = match self.state.get_tournament(&tournament_id).await {
            Some(t) => t,
            None => return OperationResult::Error { message: "Tournament not found".to_string() },
        };

        // Only allow joining public tournaments via this method
        if !tournament.is_public {
            return OperationResult::Error { message: "Private tournament - use invite code to join".to_string() };
        }

        if tournament.status != TournamentStatus::Registration {
            return OperationResult::Error { message: "Tournament not accepting registrations".to_string() };
        }

        if tournament.registered_players.contains(&player) {
            return OperationResult::Error { message: "Already registered".to_string() };
        }

        if tournament.registered_players.len() >= tournament.max_players as usize {
            return OperationResult::Error { message: "Tournament is full".to_string() };
        }

        tournament.registered_players.push(player);

        if let Err(e) = self.state.save_tournament(tournament).await {
            return OperationResult::Error { message: e };
        }

        OperationResult::TournamentJoined { tournament_id }
    }

    async fn join_tournament_by_code(&mut self, invite_code: String, player_id: String) -> OperationResult {
        let player = player_id;

        // Look up tournament by invite code
        let mut tournament = match self.state.get_tournament_by_code(&invite_code).await {
            Some(t) => t,
            None => return OperationResult::Error { message: "Invalid invite code".to_string() },
        };

        // Verify this is a private tournament with matching code
        let code_upper = invite_code.to_uppercase();
        if tournament.is_public || tournament.invite_code.as_deref() != Some(code_upper.as_str()) {
            return OperationResult::Error { message: "Invalid invite code".to_string() };
        }

        if tournament.status != TournamentStatus::Registration {
            return OperationResult::Error { message: "Tournament not accepting registrations".to_string() };
        }

        if tournament.registered_players.contains(&player) {
            return OperationResult::Error { message: "Already registered".to_string() };
        }

        if tournament.registered_players.len() >= tournament.max_players as usize {
            return OperationResult::Error { message: "Tournament is full".to_string() };
        }

        let tournament_id = tournament.id.clone();
        let tournament_name = tournament.name.clone();
        tournament.registered_players.push(player);

        if let Err(e) = self.state.save_tournament(tournament).await {
            return OperationResult::Error { message: e };
        }

        OperationResult::TournamentJoinedByCode { tournament_id, tournament_name }
    }

    async fn leave_tournament(&mut self, tournament_id: String, player_id: String) -> OperationResult {
        let player = player_id;

        let mut tournament = match self.state.get_tournament(&tournament_id).await {
            Some(t) => t,
            None => return OperationResult::Error { message: "Tournament not found".to_string() },
        };

        if tournament.status != TournamentStatus::Registration {
            return OperationResult::Error { message: "Cannot leave after tournament started".to_string() };
        }

        if tournament.creator == player {
            return OperationResult::Error { message: "Creator cannot leave tournament".to_string() };
        }

        let original_len = tournament.registered_players.len();
        tournament.registered_players.retain(|p| p != &player);

        if tournament.registered_players.len() == original_len {
            return OperationResult::Error { message: "Not registered in this tournament".to_string() };
        }

        if let Err(e) = self.state.save_tournament(tournament).await {
            return OperationResult::Error { message: e };
        }

        OperationResult::TournamentLeft { tournament_id }
    }

    async fn start_tournament(&mut self, tournament_id: String, player_id: String) -> OperationResult {
        let player = player_id;

        let mut tournament = match self.state.get_tournament(&tournament_id).await {
            Some(t) => t,
            None => return OperationResult::Error { message: "Tournament not found".to_string() },
        };

        if tournament.creator != player {
            return OperationResult::Error { message: "Only creator can start tournament".to_string() };
        }

        if tournament.status != TournamentStatus::Registration {
            return OperationResult::Error { message: "Tournament already started".to_string() };
        }

        // Enforce minimum players: at least 25% of max_players
        let min_players = (tournament.max_players / 4).max(2) as usize;
        if tournament.registered_players.len() < min_players {
            return OperationResult::Error {
                message: format!("Need at least {} players (25% of max) to start", min_players)
            };
        }

        let timestamp = self.runtime.system_time().micros();

        // Enforce scheduled start time if set
        // BUG #13 FIX: Convert milliseconds to microseconds for comparison
        if let Some(scheduled_start) = tournament.scheduled_start {
            let scheduled_start_micros = scheduled_start * 1000; // Convert ms to µs
            if timestamp < scheduled_start_micros {
                return OperationResult::Error {
                    message: "Tournament cannot start before scheduled time".to_string()
                };
            }
        }
        tournament.status = TournamentStatus::InProgress;
        tournament.started_at = Some(timestamp);
        tournament.current_round = 1;

        // Generate bracket
        self.generate_bracket(&mut tournament);

        // Process any byes immediately
        self.process_byes(&mut tournament);

        if let Err(e) = self.state.save_tournament(tournament).await {
            return OperationResult::Error { message: e };
        }

        OperationResult::TournamentStarted { tournament_id }
    }

    fn generate_bracket(&self, tournament: &mut Tournament) {
        let player_count = tournament.registered_players.len();

        // Initialize Swiss participants
        tournament.participants = tournament.registered_players
            .iter()
            .map(|pid| SwissParticipant {
                player_id: pid.clone(),
                score: 0,
                opponents: Vec::new(),
                has_bye: false,
            })
            .collect();

        // Calculate number of rounds
        tournament.num_rounds = self.calculate_swiss_rounds(player_count);
        tournament.total_rounds = tournament.num_rounds;

        // Generate first round pairings
        let pairings = self.generate_first_round_pairings(&tournament.registered_players);

        // Create Round 1 matches
        let mut round_matches = Vec::new();
        for (i, (p1, p2)) in pairings.iter().enumerate() {
            let is_bye = p1 == p2;
            let match_id = format!("{}_r1_m{}", tournament.id, i + 1);

            let status = if is_bye {
                MatchStatus::Bye
            } else {
                MatchStatus::Ready
            };

            round_matches.push(TournamentMatch {
                id: match_id,
                round: 1,
                match_number: i as u32 + 1,
                player1: p1.clone(),
                player2: if is_bye { None } else { p2.clone() },
                game_id: None,
                winner: if is_bye { p1.clone() } else { None },
                status,
            });

            // If bye, mark participant
            // BUG #24 FIX: Don't add score here - process_byes() will handle it
            if is_bye {
                if let Some(participant) = tournament.participants
                    .iter_mut()
                    .find(|p| Some(&p.player_id) == p1.as_ref())
                {
                    participant.has_bye = true;
                    // Score will be added by process_byes(), not here
                }
            }
        }

        // Store matches in both locations for compatibility
        tournament.matches = round_matches.clone();
        tournament.rounds.push(TournamentRound {
            round_number: 1,
            matches: round_matches,
            completed: false,
        });
    }

    fn get_seed_order(&self, bracket_size: usize) -> Vec<usize> {
        match bracket_size {
            4 => vec![0, 3, 1, 2],
            8 => vec![0, 7, 3, 4, 1, 6, 2, 5],
            16 => vec![0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10],
            32 => vec![
                0, 31, 15, 16, 7, 24, 8, 23, 3, 28, 12, 19, 4, 27, 11, 20,
                1, 30, 14, 17, 6, 25, 9, 22, 2, 29, 13, 18, 5, 26, 10, 21,
            ],
            _ => (0..bracket_size).collect(),
        }
    }

    // Swiss Tournament Utility Functions

    fn calculate_swiss_rounds(&self, player_count: usize) -> u32 {
        // Standard: ceil(log2(players)) + 1, minimum 3
        let log_rounds = (player_count as f64).log2().ceil() as u32;
        log_rounds.max(3)
    }

    fn generate_first_round_pairings(&self, players: &[String]) -> Vec<(Option<String>, Option<String>)> {
        let n = players.len();
        let mut pairings = Vec::new();

        // Handle odd number - last player gets bye
        let pair_count = n / 2;

        for i in 0..pair_count {
            // Fold pairing: 0 vs (n-1), 1 vs (n-2), etc.
            let p1 = players.get(i).cloned();
            let p2 = players.get(n - 1 - i).cloned();
            pairings.push((p1, p2));
        }

        // If odd number, last player gets a bye (plays themselves)
        if n % 2 == 1 {
            let bye_player = players.get(n / 2).cloned();
            pairings.push((bye_player.clone(), bye_player));
        }

        pairings
    }

    fn generate_swiss_pairings(
        &self,
        participants: &mut Vec<SwissParticipant>,
    ) -> Vec<(Option<String>, Option<String>)> {
        let mut pairings = Vec::new();

        // Sort by score (descending), then by player_id (tiebreaker)
        participants.sort_by(|a, b| {
            b.score.cmp(&a.score)
                .then_with(|| a.player_id.cmp(&b.player_id))
        });

        // Track who's been paired this round
        let mut paired: Vec<bool> = vec![false; participants.len()];

        // Handle bye for odd number - give to lowest scorer without bye
        // BUG #17 FIX: Don't add score here - it will be added in process_byes()
        if participants.len() % 2 == 1 {
            for i in (0..participants.len()).rev() {
                if !participants[i].has_bye {
                    let bye_player = participants[i].player_id.clone();
                    pairings.push((Some(bye_player.clone()), Some(bye_player)));
                    participants[i].has_bye = true;
                    // Score will be added when bye is processed, not here
                    paired[i] = true;
                    break;
                }
            }
        }

        // Pair remaining players by score groups
        for i in 0..participants.len() {
            if paired[i] {
                continue;
            }

            // Find best opponent (similar score, haven't played before)
            let mut best_opponent: Option<usize> = None;

            for j in (i + 1)..participants.len() {
                if paired[j] {
                    continue;
                }

                // Check if they've played before
                let already_played = participants[i]
                    .opponents
                    .contains(&participants[j].player_id);

                if !already_played {
                    best_opponent = Some(j);
                    break;
                }
            }

            // Fallback: allow repeat if no valid opponent
            if best_opponent.is_none() {
                for j in (i + 1)..participants.len() {
                    if !paired[j] {
                        best_opponent = Some(j);
                        break;
                    }
                }
            }

            if let Some(j) = best_opponent {
                let p1 = participants[i].player_id.clone();
                let p2 = participants[j].player_id.clone();

                // BUG #18 FIX: Don't record opponents here - only record after match finishes
                // Opponents will be recorded in record_swiss_result() when the match completes

                pairings.push((Some(p1), Some(p2)));
                paired[i] = true;
                paired[j] = true;
            }
        }

        pairings
    }

    fn record_swiss_result(
        &self,
        participants: &mut Vec<SwissParticipant>,
        winner_id: &str,
        loser_id: &str,
        is_draw: bool,
    ) {
        // BUG #3 FIX: Update opponents list when recording results
        // This ensures players don't get paired again if possible
        for p in participants.iter_mut() {
            if p.player_id == winner_id {
                p.score += if is_draw { 1 } else { 2 };
                // Add opponent to list if not already there
                if !p.opponents.contains(&loser_id.to_string()) {
                    p.opponents.push(loser_id.to_string());
                }
            } else if p.player_id == loser_id {
                p.score += if is_draw { 1 } else { 0 };
                // Add opponent to list if not already there
                if !p.opponents.contains(&winner_id.to_string()) {
                    p.opponents.push(winner_id.to_string());
                }
            }
        }
    }

    fn process_byes(&self, tournament: &mut Tournament) {
        // BUG #23 FIX: For Swiss format, just update match status and scores
        // Don't use advance_winner() which is for single-elimination brackets
        let bye_matches: Vec<(String, Option<String>)> = tournament.matches.iter()
            .filter(|m| m.status == MatchStatus::Bye && m.round == tournament.current_round)
            .map(|m| {
                let winner = m.player1.clone().or(m.player2.clone());
                (m.id.clone(), winner)
            })
            .collect();

        for (match_id, winner_id) in bye_matches {
            if let Some(winner) = winner_id {
                // Update match status
                if let Some(m) = tournament.matches.iter_mut().find(|m| m.id == match_id) {
                    m.winner = Some(winner.clone());
                    m.status = MatchStatus::Finished; // Mark as finished, not Bye
                }

                // Update round status
                if let Some(round) = tournament.rounds.iter_mut()
                    .find(|r| r.round_number == tournament.current_round)
                {
                    if let Some(round_match) = round.matches.iter_mut().find(|m| m.id == match_id) {
                        round_match.winner = Some(winner.clone());
                        round_match.status = MatchStatus::Finished;
                    }
                }

                // Update participant score (Swiss scoring: bye = 2 points)
                if let Some(participant) = tournament.participants.iter_mut()
                    .find(|p| p.player_id == winner)
                {
                    participant.score += 2;
                }
            }
        }

        // BUG #4 FIX: Check if round complete after processing byes
        self.advance_to_next_round(tournament);
    }

    fn advance_winner(&self, tournament: &mut Tournament, match_id: &str, winner_id: &str) {
        // Update the match winner
        if let Some(m) = tournament.matches.iter_mut().find(|m| m.id == match_id) {
            m.winner = Some(winner_id.to_string());
            if m.status != MatchStatus::Bye {
                m.status = MatchStatus::Finished;
            }
        }

        // Parse match_id to get round and match_number
        let parts: Vec<&str> = match_id.split('_').collect();
        if parts.len() < 3 {
            return;
        }
        let round: u32 = parts[1][1..].parse().unwrap_or(0);
        let match_num: u32 = parts[2][1..].parse().unwrap_or(0);

        if round >= tournament.total_rounds {
            return;
        }

        // Find next round match
        let next_match_num = (match_num + 1) / 2;
        let next_match_id = format!("{}_r{}_m{}", tournament.id, round + 1, next_match_num);

        if let Some(next_match) = tournament.matches.iter_mut().find(|m| m.id == next_match_id) {
            if match_num % 2 == 1 {
                next_match.player1 = Some(winner_id.to_string());
            } else {
                next_match.player2 = Some(winner_id.to_string());
            }

            if next_match.player1.is_some() && next_match.player2.is_some() {
                next_match.status = MatchStatus::Ready;
            }
        }
    }

    fn advance_to_next_round(&self, tournament: &mut Tournament) -> bool {
        let current_round = tournament.current_round as usize;

        // Check if current round is complete
        if let Some(round) = tournament.rounds.get(current_round - 1) {
            let all_complete = round.matches.iter().all(|m|
                m.status == MatchStatus::Finished || m.status == MatchStatus::Bye
            );

            if !all_complete {
                return false; // Current round not finished
            }
        }

        // Check if tournament is complete
        // BUG #20 FIX: Ensure ALL matches are truly finished before completing tournament
        if tournament.current_round >= tournament.num_rounds {
            // Double-check that the final round is actually complete
            if let Some(final_round) = tournament.rounds.last() {
                let all_final_matches_done = final_round.matches.iter().all(|m|
                    m.status == MatchStatus::Finished || m.status == MatchStatus::Bye
                );

                if all_final_matches_done {
                    tournament.status = TournamentStatus::Finished;

                    // Determine winner (highest score)
                    if let Some(winner) = tournament.participants
                        .iter()
                        .max_by_key(|p| p.score)
                    {
                        tournament.winner = Some(winner.player_id.clone());
                    }
                    return true;
                }
            }
            // Final round not complete yet, don't advance
            return false;
        }

        // Generate next round pairings
        let pairings = self.generate_swiss_pairings(&mut tournament.participants);
        let next_round = tournament.current_round + 1;

        let mut round_matches = Vec::new();
        for (i, (p1, p2)) in pairings.iter().enumerate() {
            let is_bye = p1 == p2;
            let match_id = format!("{}_r{}_m{}", tournament.id, next_round, i + 1);

            let status = if is_bye {
                MatchStatus::Bye
            } else {
                MatchStatus::Ready
            };

            round_matches.push(TournamentMatch {
                id: match_id,
                round: next_round,
                match_number: i as u32 + 1,
                player1: p1.clone(),
                player2: if is_bye { None } else { p2.clone() },
                game_id: None,
                winner: if is_bye { p1.clone() } else { None },
                status,
            });
        }

        // Update tournament state
        tournament.current_round = next_round;
        tournament.matches.extend(round_matches.clone());
        tournament.rounds.push(TournamentRound {
            round_number: next_round,
            matches: round_matches,
            completed: false,
        });

        // Mark previous round as completed
        if let Some(prev_round) = tournament.rounds.get_mut(current_round - 1) {
            prev_round.completed = true;
        }

        // BUG #19 FIX: Process byes immediately after generating new round
        self.process_byes(tournament);

        true
    }

    async fn start_tournament_match(
        &mut self,
        tournament_id: String,
        match_id: String,
        player_id: String,
    ) -> OperationResult {
        let player = player_id;
        let timestamp = self.runtime.system_time().micros();
        let timestamp_ms = timestamp / 1000;

        let mut tournament = match self.state.get_tournament(&tournament_id).await {
            Some(t) => t,
            None => return OperationResult::Error { message: "Tournament not found".to_string() },
        };

        let match_idx = match tournament.matches.iter().position(|m| m.id == match_id) {
            Some(idx) => idx,
            None => return OperationResult::Error { message: "Match not found".to_string() },
        };

        let tournament_match = &tournament.matches[match_idx];

        if tournament_match.status != MatchStatus::Ready {
            return OperationResult::Error { message: "Match not ready".to_string() };
        }

        // Prevent race condition: check if game already created
        if tournament_match.game_id.is_some() {
            return OperationResult::Error { message: "Match already started".to_string() };
        }

        let is_player1 = tournament_match.player1.as_ref() == Some(&player);
        let is_player2 = tournament_match.player2.as_ref() == Some(&player);
        if !is_player1 && !is_player2 {
            return OperationResult::Error { message: "Not in this match".to_string() };
        }

        // Validate both players exist before proceeding (BUG #6 FIX)
        let player1 = match tournament_match.player1.clone() {
            Some(p) => p,
            None => return OperationResult::Error { message: "Player 1 not set".to_string() },
        };
        let player2 = match tournament_match.player2.clone() {
            Some(p) => p,
            None => return OperationResult::Error { message: "Player 2 not set".to_string() },
        };

        // Create game ID and claim it atomically in tournament (BUG #1 FIX)
        let game_id = self.state.generate_game_id().await;

        // Update tournament FIRST to claim this match (prevents race condition)
        tournament.matches[match_idx].game_id = Some(game_id.clone());
        tournament.matches[match_idx].status = MatchStatus::InProgress;

        if let Err(e) = self.state.save_tournament(tournament.clone()).await {
            return OperationResult::Error { message: e };
        }

        // Random color assignment
        let (red_player, black_player) = if timestamp % 2 == 0 {
            (player1, player2)
        } else {
            (player2, player1)
        };

        let mut game = CheckersGame {
            id: game_id.clone(),
            red_player: Some(red_player),
            black_player: Some(black_player),
            red_player_type: PlayerType::Human,
            black_player_type: PlayerType::Human,
            board_state: STARTING_BOARD.to_string(),
            current_turn: Turn::Red,
            moves: Vec::new(),
            move_count: 0,
            status: GameStatus::Active,
            result: None,
            created_at: timestamp,
            updated_at: timestamp,
            clock: Some(Clock::new(tournament.time_control)),
            draw_offer: DrawOfferState::None,
            is_rated: true,
            color_preference: ColorPreference::Random,
            creator_wants_random: false,
            tournament_id: Some(tournament_id.clone()),
            tournament_match_id: Some(match_id.clone()),
        };

        // Start the clock
        if let Some(ref mut clock) = game.clock {
            clock.start(timestamp_ms);
        }

        // Now create the actual game (tournament already updated above)
        if let Err(e) = self.state.save_game(game).await {
            // If game save fails, we need to rollback tournament update
            // But Linera doesn't support rollback, so we accept this inconsistency
            // The match will show InProgress but no game exists
            return OperationResult::Error { message: e };
        }

        OperationResult::TournamentMatchStarted {
            tournament_id,
            match_id,
            game_id,
        }
    }

    async fn forfeit_tournament_match(
        &mut self,
        tournament_id: String,
        match_id: String,
        player_id: String,
    ) -> OperationResult {
        let player = player_id;

        let mut tournament = match self.state.get_tournament(&tournament_id).await {
            Some(t) => t,
            None => return OperationResult::Error { message: "Tournament not found".to_string() },
        };

        let match_idx = match tournament.matches.iter().position(|m| m.id == match_id) {
            Some(idx) => idx,
            None => return OperationResult::Error { message: "Match not found".to_string() },
        };

        let tournament_match = &tournament.matches[match_idx];

        // Can only forfeit matches that are Ready or InProgress
        if tournament_match.status != MatchStatus::Ready && tournament_match.status != MatchStatus::InProgress {
            return OperationResult::Error { message: "Match not active".to_string() };
        }

        // Determine who is forfeiting and who wins
        let winner = if tournament_match.player1.as_ref() == Some(&player) {
            // Player 1 forfeits, player 2 wins
            tournament_match.player2.clone()
        } else if tournament_match.player2.as_ref() == Some(&player) {
            // Player 2 forfeits, player 1 wins
            tournament_match.player1.clone()
        } else {
            return OperationResult::Error { message: "Not in this match".to_string() };
        };

        let winner_id = match winner {
            Some(w) => w,
            None => return OperationResult::Error { message: "Cannot determine winner".to_string() },
        };

        // Update match
        tournament.matches[match_idx].winner = Some(winner_id.clone());
        tournament.matches[match_idx].status = MatchStatus::Finished;

        // Update Swiss scores
        let loser_id = if tournament.matches[match_idx].player1.as_ref() == Some(&winner_id) {
            tournament.matches[match_idx].player2.clone()
        } else {
            tournament.matches[match_idx].player1.clone()
        };

        if let Some(loser) = loser_id {
            self.record_swiss_result(
                &mut tournament.participants,
                &winner_id,
                &loser,
                false, // Not a draw
            );
        }

        // Update round status
        if let Some(round) = tournament.rounds.iter_mut().find(|r| r.round_number == tournament.current_round) {
            if let Some(match_in_round) = round.matches.iter_mut().find(|m| m.id == match_id) {
                match_in_round.winner = Some(winner_id.clone());
                match_in_round.status = MatchStatus::Finished;
            }
        }

        // Check if round is complete and advance
        self.advance_to_next_round(&mut tournament);

        if let Err(e) = self.state.save_tournament(tournament).await {
            return OperationResult::Error { message: e };
        }

        OperationResult::TournamentMatchForfeited {
            tournament_id,
            match_id,
            winner: winner_id,
        }
    }

    async fn cancel_tournament(&mut self, tournament_id: String, player_id: String) -> OperationResult {
        let player = player_id;

        let mut tournament = match self.state.get_tournament(&tournament_id).await {
            Some(t) => t,
            None => return OperationResult::Error { message: "Tournament not found".to_string() },
        };

        // Only creator can cancel
        if tournament.creator != player {
            return OperationResult::Error { message: "Only creator can cancel tournament".to_string() };
        }

        // Can only cancel during registration
        if tournament.status != TournamentStatus::Registration {
            return OperationResult::Error { message: "Can only cancel during registration".to_string() };
        }

        // Mark as cancelled by setting status to Finished with no winner
        tournament.status = TournamentStatus::Finished;
        tournament.finished_at = Some(self.runtime.system_time().micros());

        if let Err(e) = self.state.save_tournament(tournament).await {
            return OperationResult::Error { message: e };
        }

        OperationResult::TournamentCancelled { tournament_id }
    }

    /// Update tournament bracket when a game finishes
    async fn handle_tournament_game_finished(&mut self, game: &CheckersGame) {
        // Check if this is a tournament game
        let (tournament_id, match_id) = match (&game.tournament_id, &game.tournament_match_id) {
            (Some(tid), Some(mid)) => (tid.clone(), mid.clone()),
            _ => return, // Not a tournament game
        };

        // Get tournament
        let mut tournament = match self.state.get_tournament(&tournament_id).await {
            Some(t) => t,
            None => return,
        };

        // Find the match
        let match_idx = match tournament.matches.iter().position(|m| m.id == match_id) {
            Some(idx) => idx,
            None => return,
        };

        // BUG #11 FIX: Handle draw case properly
        let winner = match game.result {
            Some(GameResult::RedWins) => game.red_player.clone(),
            Some(GameResult::BlackWins) => game.black_player.clone(),
            Some(GameResult::Draw) => {
                // Record draw for both players
                if let (Some(p1), Some(p2)) = (&game.red_player, &game.black_player) {
                    self.record_swiss_result(&mut tournament.participants, p1, p2, true);
                }
                tournament.matches[match_idx].status = MatchStatus::Finished;

                // Update round status
                if let Some(round) = tournament.rounds.iter_mut().find(|r| r.round_number == tournament.current_round) {
                    if let Some(match_in_round) = round.matches.iter_mut().find(|m| m.id == match_id.clone()) {
                        match_in_round.status = MatchStatus::Finished;
                    }
                }

                self.advance_to_next_round(&mut tournament);
                let _ = self.state.save_tournament(tournament).await;
                return;
            },
            _ => return, // No result yet
        };

        let winner_id = match winner {
            Some(w) => w,
            None => return,
        };

        // Update the match

        tournament.matches[match_idx].winner = Some(winner_id.clone());
        tournament.matches[match_idx].status = MatchStatus::Finished;

        // Update Swiss scores
        let loser_id = if tournament.matches[match_idx].player1.as_ref() == Some(&winner_id) {
            tournament.matches[match_idx].player2.clone()
        } else {
            tournament.matches[match_idx].player1.clone()
        };

        if let Some(loser) = loser_id {
            self.record_swiss_result(
                &mut tournament.participants,
                &winner_id,
                &loser,
                false, // Not a draw
            );
        }

        // Update round status
        if let Some(round) = tournament.rounds.iter_mut().find(|r| r.round_number == tournament.current_round) {
            if let Some(match_in_round) = round.matches.iter_mut().find(|m| m.id == match_id.clone()) {
                match_in_round.winner = Some(winner_id.clone());
                match_in_round.status = MatchStatus::Finished;
            }
        }

        // Check if round is complete and advance
        self.advance_to_next_round(&mut tournament);

        let _ = self.state.save_tournament(tournament).await;
    }
}
