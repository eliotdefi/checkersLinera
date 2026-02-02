#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;
use async_graphql::{EmptySubscription, Object, Request, Response, Schema};
use checkers_abi::{CheckersAbi, CheckersGame, Operation, PlayerStats, GameStatus, QueueEntry, QueueStatus, Tournament};
use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::WithServiceAbi,
    views::View,
    Service, ServiceRuntime,
};
use state::CheckersState;

pub struct CheckersService {
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(CheckersService);

impl WithServiceAbi for CheckersService {
    type Abi = CheckersAbi;
}

impl Service for CheckersService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        CheckersService {
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, request: Request) -> Response {
        // CRITICAL FIX: Load state fresh on EVERY query to see latest contract state
        let state = CheckersState::load(self.runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");

        let runtime = self.runtime.clone();
        let schema = Schema::build(
            QueryRoot {
                state: Arc::new(state),
            },
            Operation::mutation_root(runtime),
            EmptySubscription,
        )
        .finish();

        schema.execute(request).await
    }
}

struct QueryRoot {
    state: Arc<CheckersState>,
}

#[Object]
impl QueryRoot {
    async fn all_games(&self) -> Vec<CheckersGame> {
        self.state.get_all_games().await
    }

    async fn game(&self, id: String) -> Option<CheckersGame> {
        self.state.get_game(&id).await
    }

    async fn pending_games(&self) -> Vec<CheckersGame> {
        self.state.get_pending_games().await
    }

    async fn active_games(&self) -> Vec<CheckersGame> {
        self.state
            .get_all_games()
            .await
            .into_iter()
            .filter(|g| g.status == GameStatus::Active)
            .collect()
    }

    async fn player_games(&self, chain_id: String) -> Vec<CheckersGame> {
        self.state.get_player_games(&chain_id).await
    }

    async fn player_stats(&self, chain_id: String) -> PlayerStats {
        self.state.get_player_stats(&chain_id).await
    }

    async fn leaderboard(&self, limit: Option<i32>) -> Vec<PlayerStats> {
        let limit = limit.unwrap_or(10) as usize;
        self.state.get_leaderboard(limit).await
    }

    async fn queue_status(&self) -> Vec<QueueStatus> {
        self.state.get_queue_counts().await
    }

    async fn my_queue_status(&self, chain_id: String) -> Option<QueueEntry> {
        self.state.get_player_queue_entry(&chain_id).await
    }

    // Tournament queries
    async fn tournaments(&self, player_id: Option<String>) -> Vec<Tournament> {
        if let Some(pid) = player_id {
            self.state.get_player_tournaments(&pid).await
        } else {
            // No player_id provided - return only public tournaments
            self.state.get_public_tournaments().await
        }
    }

    async fn tournament(&self, id: String) -> Option<Tournament> {
        self.state.get_tournament(&id).await
    }

    async fn active_tournaments(&self) -> Vec<Tournament> {
        self.state.get_active_tournaments().await
    }

    async fn public_tournaments(&self) -> Vec<Tournament> {
        self.state.get_public_tournaments().await
    }

    async fn tournament_by_code(&self, code: String) -> Option<Tournament> {
        self.state.get_tournament_by_code(&code).await
    }
}
