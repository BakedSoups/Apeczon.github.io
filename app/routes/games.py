"""Live multiplayer tic tac toe over WebSocket."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field

from litestar import websocket, WebSocket


WINS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
]


@dataclass
class GameState:
    board: list[str | None] = field(default_factory=lambda: [None] * 9)
    turn: str = "X"
    winner: str | None = None
    win_line: list[int] = field(default_factory=list)
    players: dict[int, str] = field(default_factory=dict)
    sockets: dict[int, WebSocket] = field(default_factory=dict)
    next_id: int = 0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    history: list[dict] = field(default_factory=list)
    game_number: int = 0


_game = GameState()


def _check_winner(board: list[str | None]) -> tuple[str | None, list[int]]:
    for line in WINS:
        a, b, c = line
        if board[a] and board[a] == board[b] == board[c]:
            return board[a], list(line)
    if all(cell is not None for cell in board):
        return "draw", []
    return None, []


def _state_msg() -> str:
    player_count = len(_game.players)
    spectator_count = len(_game.sockets) - player_count
    return json.dumps({
        "type": "state",
        "board": _game.board,
        "turn": _game.turn,
        "winner": _game.winner,
        "win_line": _game.win_line,
        "players": player_count,
        "spectators": max(0, spectator_count),
        "history": _game.history[-20:],
        "game_number": _game.game_number,
    })


async def _broadcast(msg: str) -> None:
    dead = []
    for sid, sock in _game.sockets.items():
        try:
            await sock.send_data(msg)
        except Exception:
            dead.append(sid)
    for sid in dead:
        _game.sockets.pop(sid, None)
        _game.players.pop(sid, None)


@websocket("/api/games/tictactoe")
async def tictactoe_handler(socket: WebSocket) -> None:
    await socket.accept()

    async with _game.lock:
        sid = _game.next_id
        _game.next_id += 1
        _game.sockets[sid] = socket

        mark = None
        taken = set(_game.players.values())
        if "X" not in taken:
            mark = "X"
        elif "O" not in taken:
            mark = "O"

        if mark:
            _game.players[sid] = mark

        await socket.send_data(json.dumps({"type": "assign", "mark": mark}))
        await socket.send_data(_state_msg())

    try:
        while True:
            raw = await socket.receive_data()
            try:
                msg = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue

            async with _game.lock:
                action = msg.get("action")

                if action == "reset":
                    if sid in _game.players:
                        _game.board = [None] * 9
                        _game.turn = "X"
                        _game.winner = None
                        _game.win_line = []
                        _game.game_number += 1
                        await _broadcast(_state_msg())

                elif action == "move":
                    if sid not in _game.players:
                        continue
                    player_mark = _game.players[sid]
                    if player_mark != _game.turn or _game.winner:
                        continue
                    cell = msg.get("cell")
                    if not isinstance(cell, int) or cell < 0 or cell > 8:
                        continue
                    if _game.board[cell] is not None:
                        continue

                    _game.board[cell] = player_mark
                    winner, win_line = _check_winner(_game.board)

                    if winner:
                        _game.winner = winner
                        _game.win_line = win_line
                        _game.history.append({
                            "game": _game.game_number,
                            "winner": winner,
                            "board": list(_game.board),
                        })
                        if len(_game.history) > 50:
                            _game.history = _game.history[-50:]
                    else:
                        _game.turn = "O" if _game.turn == "X" else "X"

                    await _broadcast(_state_msg())

    except Exception:
        pass
    finally:
        async with _game.lock:
            _game.sockets.pop(sid, None)
            _game.players.pop(sid, None)
            await _broadcast(_state_msg())
