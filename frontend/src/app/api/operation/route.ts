import { NextRequest, NextResponse } from "next/server";

// For demo mode, we simulate operations
// In production, this would integrate with a Linera wallet service

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, chainId } = body;

    if (!operation) {
      return NextResponse.json({ error: "Operation required" }, { status: 400 });
    }

    console.log("Received operation:", JSON.stringify(operation));
    console.log("Chain ID:", chainId);

    // Demo mode: simulate successful operations
    // In production, this would submit to the Linera network via a wallet service

    if (operation.CreateGame !== undefined) {
      const gameId = `game_${String(Date.now()).slice(-6)}`;
      console.log(`[DEMO] Created game: ${gameId}, vs_ai: ${operation.CreateGame.vs_ai}`);
      return NextResponse.json({
        success: true,
        simulated: true,
        result: { GameCreated: { game_id: gameId } }
      });
    }

    if (operation.JoinGame !== undefined) {
      console.log(`[DEMO] Joined game: ${operation.JoinGame.game_id}`);
      return NextResponse.json({
        success: true,
        simulated: true,
        result: { GameJoined: { game_id: operation.JoinGame.game_id } }
      });
    }

    if (operation.MakeMove !== undefined) {
      console.log(`[DEMO] Move: (${operation.MakeMove.from_row},${operation.MakeMove.from_col}) -> (${operation.MakeMove.to_row},${operation.MakeMove.to_col})`);
      return NextResponse.json({
        success: true,
        simulated: true,
        result: { MoveMade: { game_id: operation.MakeMove.game_id, game_over: false } }
      });
    }

    if (operation.RequestAiMove !== undefined) {
      console.log(`[DEMO] AI move requested for game: ${operation.RequestAiMove.game_id}`);
      return NextResponse.json({
        success: true,
        simulated: true,
        result: { AiMoveMade: { game_id: operation.RequestAiMove.game_id, game_over: false } }
      });
    }

    if (operation.Resign !== undefined) {
      console.log(`[DEMO] Resigned from game: ${operation.Resign.game_id}`);
      return NextResponse.json({
        success: true,
        simulated: true,
        result: { Resigned: { game_id: operation.Resign.game_id } }
      });
    }

    return NextResponse.json({
      success: true,
      simulated: true,
      message: "Operation logged (demo mode)"
    });

  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
