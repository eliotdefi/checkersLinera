// Checkers Game State Management
use checkers_abi::{CheckersGame, GameResult, GameStatus, PlayerStats, PlayerType, QueueEntry, QueueStatus, TimeControl, Tournament};
use linera_sdk::views::{linera_views, MapView, RegisterView, RootView, ViewStorageContext};

/// The application state stored on-chain
#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct CheckersState {
    /// All games indexed by game ID
    pub games: MapView<String, CheckersGame>,

    /// Counter for generating unique game IDs
    pub next_game_id: RegisterView<u64>,

    /// Player statistics for leaderboard
    pub player_stats: MapView<String, PlayerStats>,

    /// List of games waiting for opponents (for matchmaking)
    pub pending_games: MapView<String, bool>,

    /// Matchmaking queue indexed by player chain ID
    pub matchmaking_queue: MapView<String, QueueEntry>,

    /// All tournaments indexed by tournament ID
    pub tournaments: MapView<String, Tournament>,

    /// Counter for generating unique tournament IDs
    pub next_tournament_id: RegisterView<u64>,

    /// Index from invite code to tournament ID for fast lookup
    pub invite_code_index: MapView<String, String>,
}

impl CheckersState {
    /// Generate a new unique game ID
    pub async fn generate_game_id(&mut self) -> String {
        let id = *self.next_game_id.get();
        self.next_game_id.set(id + 1);
        format!("game_{:06}", id)
    }

    /// Get a game by ID
    pub async fn get_game(&self, game_id: &str) -> Option<CheckersGame> {
        self.games.get(game_id).await.ok().flatten()
    }

    /// Save or update a game
    pub async fn save_game(&mut self, game: CheckersGame) -> Result<(), String> {
        let game_id = game.id.clone();
        let is_pending = game.status == GameStatus::Pending;

        self.games
            .insert(&game_id, game)
            .map_err(|e| format!("Failed to save game: {}", e))?;

        if is_pending {
            self.pending_games
                .insert(&game_id, true)
                .map_err(|e| format!("Failed to update pending: {}", e))?;
        } else {
            let _ = self.pending_games.remove(&game_id);
        }

        Ok(())
    }

    /// Get all games
    pub async fn get_all_games(&self) -> Vec<CheckersGame> {
        let mut games = Vec::new();
        let _ = self.games
            .for_each_index_value(|_id, game| {
                games.push(game.into_owned());
                Ok(())
            })
            .await;
        games
    }

    /// Get pending games
    pub async fn get_pending_games(&self) -> Vec<CheckersGame> {
        let mut game_ids = Vec::new();
        let _ = self.pending_games
            .for_each_index(|game_id| {
                game_ids.push(game_id.clone());
                Ok(())
            })
            .await;

        let mut result = Vec::new();
        for game_id in game_ids {
            if let Some(game) = self.get_game(&game_id).await {
                result.push(game);
            }
        }
        result
    }

    /// Get games for a player
    pub async fn get_player_games(&self, chain_id: &str) -> Vec<CheckersGame> {
        self.get_all_games()
            .await
            .into_iter()
            .filter(|g| {
                g.red_player.as_deref() == Some(chain_id)
                    || g.black_player.as_deref() == Some(chain_id)
            })
            .collect()
    }

    /// Get player stats
    pub async fn get_player_stats(&self, chain_id: &str) -> PlayerStats {
        self.player_stats
            .get(chain_id)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| PlayerStats::new(chain_id.to_string()))
    }

    /// Update player stats
    pub async fn update_player_stats(&mut self, stats: PlayerStats) -> Result<(), String> {
        let chain_id = stats.chain_id.clone();
        self.player_stats
            .insert(&chain_id, stats)
            .map_err(|e| format!("Failed to update stats: {}", e))
    }

    /// Get leaderboard
    pub async fn get_leaderboard(&self, limit: usize) -> Vec<PlayerStats> {
        let mut all_stats = Vec::new();
        let _ = self.player_stats
            .for_each_index_value(|_id, stats| {
                all_stats.push(stats.into_owned());
                Ok(())
            })
            .await;

        all_stats.sort_by(|a, b| b.games_won.cmp(&a.games_won));
        all_stats.truncate(limit);
        all_stats
    }

    /// Record game result with ELO rating updates
    /// For casual games (is_rated == false), only updates win/loss counts, not ELO
    pub async fn record_game_result(
        &mut self,
        game: &CheckersGame,
        result: GameResult,
    ) -> Result<(), String> {
        // Skip entirely for in-progress games
        if result == GameResult::InProgress {
            return Ok(());
        }

        let red_is_ai = game.red_player.as_deref() == Some("AI") || game.red_player_type == PlayerType::AI;
        let black_is_ai = game.black_player.as_deref() == Some("AI") || game.black_player_type == PlayerType::AI;

        // For casual games, just update win/loss counts without ELO changes
        if !game.is_rated {
            return self.record_game_counts_only(game, result, red_is_ai, black_is_ai).await;
        }

        // Derive time control from clock, default to Blitz5_3 if not set
        let time_control = game.clock.as_ref()
            .map(|clock| {
                // Match initial_time_ms and increment_ms to find the TimeControl
                match (clock.initial_time_ms, clock.increment_ms) {
                    (60_000, 0) => TimeControl::Bullet1_0,
                    (120_000, 1_000) => TimeControl::Bullet2_1,
                    (180_000, 0) => TimeControl::Blitz3_0,
                    (300_000, 3_000) => TimeControl::Blitz5_3,
                    (600_000, 0) => TimeControl::Rapid10_0,
                    _ => TimeControl::Blitz5_3, // Default fallback
                }
            })
            .unwrap_or(TimeControl::Blitz5_3);

        // AI rating is fixed at 1500
        const AI_RATING: u32 = 1500;

        // Get current stats for both players
        let mut red_stats = if !red_is_ai {
            if let Some(chain) = game.red_player.as_deref() {
                self.get_player_stats(chain).await
            } else {
                PlayerStats::new("unknown".to_string())
            }
        } else {
            PlayerStats::new("AI".to_string())
        };

        let mut black_stats = if !black_is_ai {
            if let Some(chain) = game.black_player.as_deref() {
                self.get_player_stats(chain).await
            } else {
                PlayerStats::new("unknown".to_string())
            }
        } else {
            PlayerStats::new("AI".to_string())
        };

        // Get ratings BEFORE updates
        let red_rating = if red_is_ai { AI_RATING } else { red_stats.get_rating(&time_control) };
        let black_rating = if black_is_ai { AI_RATING } else { black_stats.get_rating(&time_control) };

        match result {
            GameResult::RedWins => {
                if !red_is_ai {
                    red_stats.record_win_with_rating(black_rating, &time_control);
                    self.update_player_stats(red_stats).await?;
                }
                if !black_is_ai {
                    black_stats.record_loss_with_rating(red_rating, &time_control);
                    self.update_player_stats(black_stats).await?;
                }
            }
            GameResult::BlackWins => {
                if !black_is_ai {
                    black_stats.record_win_with_rating(red_rating, &time_control);
                    self.update_player_stats(black_stats).await?;
                }
                if !red_is_ai {
                    red_stats.record_loss_with_rating(black_rating, &time_control);
                    self.update_player_stats(red_stats).await?;
                }
            }
            GameResult::Draw => {
                if !red_is_ai {
                    red_stats.record_draw_with_rating(black_rating, &time_control);
                    self.update_player_stats(red_stats).await?;
                }
                if !black_is_ai {
                    black_stats.record_draw_with_rating(red_rating, &time_control);
                    self.update_player_stats(black_stats).await?;
                }
            }
            GameResult::InProgress => {
                // Unreachable - we return early for InProgress
            }
        }

        Ok(())
    }

    /// Record game counts only (for casual games - no ELO updates)
    async fn record_game_counts_only(
        &mut self,
        game: &CheckersGame,
        result: GameResult,
        red_is_ai: bool,
        black_is_ai: bool,
    ) -> Result<(), String> {
        // Get current stats for both players
        let mut red_stats = if !red_is_ai {
            if let Some(chain) = game.red_player.as_deref() {
                self.get_player_stats(chain).await
            } else {
                return Ok(());
            }
        } else {
            return Ok(()); // AI-only scenario
        };

        let mut black_stats = if !black_is_ai {
            if let Some(chain) = game.black_player.as_deref() {
                self.get_player_stats(chain).await
            } else {
                PlayerStats::new("unknown".to_string())
            }
        } else {
            PlayerStats::new("AI".to_string())
        };

        match result {
            GameResult::RedWins => {
                if !red_is_ai {
                    red_stats.record_win();
                    self.update_player_stats(red_stats).await?;
                }
                if !black_is_ai {
                    black_stats.record_loss();
                    self.update_player_stats(black_stats).await?;
                }
            }
            GameResult::BlackWins => {
                if !black_is_ai {
                    black_stats.record_win();
                    self.update_player_stats(black_stats).await?;
                }
                if !red_is_ai {
                    red_stats.record_loss();
                    self.update_player_stats(red_stats).await?;
                }
            }
            GameResult::Draw => {
                if !red_is_ai {
                    red_stats.record_draw();
                    self.update_player_stats(red_stats).await?;
                }
                if !black_is_ai {
                    black_stats.record_draw();
                    self.update_player_stats(black_stats).await?;
                }
            }
            GameResult::InProgress => {}
        }

        Ok(())
    }

    // ========================================================================
    // MATCHMAKING QUEUE METHODS
    // ========================================================================

    /// Join the matchmaking queue
    /// Returns Some(opponent_chain_id) if a match was found, None if added to queue
    pub async fn join_queue(
        &mut self,
        chain_id: &str,
        time_control: TimeControl,
        timestamp: u64,
    ) -> Result<Option<String>, String> {
        let _ = self.matchmaking_queue.remove(chain_id);

        let mut matched_opponent: Option<String> = None;
        let _ = self.matchmaking_queue
            .for_each_index_value(|opponent_chain_id, entry| {
                if entry.time_control == time_control
                    && matched_opponent.is_none()
                    && opponent_chain_id != chain_id
                {
                    matched_opponent = Some(opponent_chain_id.clone());
                }
                Ok(())
            })
            .await;

        if let Some(opponent_chain_id) = matched_opponent {
            // Match found: remove opponent from queue
            let _ = self.matchmaking_queue.remove(&opponent_chain_id);
            Ok(Some(opponent_chain_id))
        } else {
            // No match: add player to queue
            let entry = QueueEntry::new(chain_id.to_string(), time_control, timestamp);
            self.matchmaking_queue
                .insert(&chain_id.to_string(), entry)
                .map_err(|e| format!("Failed to join queue: {}", e))?;
            Ok(None)
        }
    }

    /// Leave the matchmaking queue
    /// Returns true if player was in queue, false otherwise
    pub async fn leave_queue(&mut self, chain_id: &str) -> Result<bool, String> {
        let was_in_queue = self.matchmaking_queue
            .get(chain_id)
            .await
            .ok()
            .flatten()
            .is_some();

        if was_in_queue {
            let _ = self.matchmaking_queue.remove(chain_id);
        }

        Ok(was_in_queue)
    }

    /// Get queue counts for each time control
    pub async fn get_queue_counts(&self) -> Vec<QueueStatus> {
        let mut counts = std::collections::HashMap::new();

        // Initialize counts for all time controls
        for tc in TimeControl::all() {
            counts.insert(tc, 0u32);
        }

        // Count players per time control
        let _ = self.matchmaking_queue
            .for_each_index_value(|_chain_id, entry| {
                *counts.entry(entry.time_control).or_insert(0) += 1;
                Ok(())
            })
            .await;

        // Convert to Vec<QueueStatus>
        TimeControl::all()
            .into_iter()
            .map(|tc| QueueStatus {
                time_control: tc,
                player_count: *counts.get(&tc).unwrap_or(&0),
            })
            .collect()
    }

    /// Get a player's queue entry if they're in the queue
    pub async fn get_player_queue_entry(&self, chain_id: &str) -> Option<QueueEntry> {
        self.matchmaking_queue
            .get(chain_id)
            .await
            .ok()
            .flatten()
    }

    // ========================================================================
    // TOURNAMENT METHODS
    // ========================================================================

    /// Generate a new unique tournament ID
    pub async fn generate_tournament_id(&mut self) -> String {
        let id = *self.next_tournament_id.get();
        self.next_tournament_id.set(id + 1);
        format!("t{:06}", id)
    }

    /// Get a tournament by ID
    pub async fn get_tournament(&self, tournament_id: &str) -> Option<Tournament> {
        self.tournaments.get(tournament_id).await.ok().flatten()
    }

    /// Save or update a tournament
    pub async fn save_tournament(&mut self, tournament: Tournament) -> Result<(), String> {
        let tournament_id = tournament.id.clone();
        self.tournaments
            .insert(&tournament_id, tournament)
            .map_err(|e| format!("Failed to save tournament: {}", e))
    }

    /// Get all tournaments
    pub async fn get_all_tournaments(&self) -> Vec<Tournament> {
        let mut tournaments = Vec::new();
        let _ = self.tournaments
            .for_each_index_value(|_id, tournament| {
                tournaments.push(tournament.into_owned());
                Ok(())
            })
            .await;
        tournaments
    }

    /// Get active tournaments (Registration or InProgress)
    pub async fn get_active_tournaments(&self) -> Vec<Tournament> {
        use checkers_abi::TournamentStatus;
        self.get_all_tournaments()
            .await
            .into_iter()
            .filter(|t| t.status == TournamentStatus::Registration || t.status == TournamentStatus::InProgress)
            .collect()
    }

    /// Get public tournaments (for browsing)
    pub async fn get_public_tournaments(&self) -> Vec<Tournament> {
        self.get_all_tournaments()
            .await
            .into_iter()
            .filter(|t| t.is_public)
            .collect()
    }

    /// Get tournaments for a specific player (ones they're registered in or created)
    pub async fn get_player_tournaments(&self, player_id: &str) -> Vec<Tournament> {
        self.get_all_tournaments()
            .await
            .into_iter()
            .filter(|t| {
                t.creator == player_id || t.registered_players.contains(&player_id.to_string())
            })
            .collect()
    }

    /// Save invite code index mapping
    pub async fn save_invite_code_index(&mut self, invite_code: &str, tournament_id: &str) -> Result<(), String> {
        self.invite_code_index
            .insert(&invite_code.to_uppercase(), tournament_id.to_string())
            .map_err(|e| format!("Failed to save invite code index: {}", e))
    }

    /// Get tournament by invite code
    pub async fn get_tournament_by_code(&self, invite_code: &str) -> Option<Tournament> {
        // First look up the tournament ID from the invite code
        let tournament_id = self.invite_code_index
            .get(&invite_code.to_uppercase())
            .await
            .ok()
            .flatten()?;

        // Then get the tournament
        self.get_tournament(&tournament_id).await
    }

    /// Remove invite code index (when tournament is cancelled/finished)
    pub async fn remove_invite_code_index(&mut self, invite_code: &str) -> Result<(), String> {
        let _ = self.invite_code_index.remove(&invite_code.to_uppercase());
        Ok(())
    }
}
