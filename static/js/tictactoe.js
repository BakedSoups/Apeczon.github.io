/**
 * Tic Tac Toe - WebSocket client
 * Connects to /api/games/tictactoe for live multiplayer.
 */

(function () {
  'use strict';

  const board = document.getElementById('ttt-board');
  const status = document.getElementById('ttt-status');
  const resetBtn = document.getElementById('ttt-reset');
  const historyList = document.getElementById('ttt-history-list');
  if (!board || !status) return;

  let ws = null;
  let myMark = null;
  let gameState = null;
  let reconnectTimer = null;

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/api/games/tictactoe`);

    ws.onopen = () => {
      status.textContent = 'Connected, waiting for assignment...';
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'assign') {
        myMark = msg.mark;
        if (myMark) {
          status.textContent = `You are ${myMark}`;
        } else {
          status.textContent = 'Spectating';
        }
      }

      if (msg.type === 'state') {
        gameState = msg;
        renderBoard();
        updateStatus();
        renderHistory();
      }
    };

    ws.onclose = () => {
      status.textContent = 'Disconnected, reconnecting...';
      myMark = null;
      reconnectTimer = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  function renderBoard() {
    if (!gameState) return;
    const cells = board.querySelectorAll('.ttt-cell');
    const winLine = gameState.win_line || [];

    cells.forEach((cell, i) => {
      const val = gameState.board[i];
      cell.textContent = val || '';
      cell.className = 'ttt-cell';
      if (val === 'X') cell.classList.add('x');
      if (val === 'O') cell.classList.add('o');
      if (winLine.includes(i)) cell.classList.add('win');
    });
  }

  function updateStatus() {
    if (!gameState) return;

    let msg = '';
    if (gameState.winner) {
      if (gameState.winner === 'draw') {
        msg = "It's a draw!";
      } else {
        const isMe = gameState.winner === myMark;
        msg = isMe ? 'You win!' : `${gameState.winner} wins!`;
      }
    } else if (!myMark) {
      msg = `Spectating: ${gameState.turn}'s turn`;
    } else if (gameState.turn === myMark) {
      msg = "Your turn!";
    } else {
      msg = `Waiting for ${gameState.turn}...`;
    }

    const players = gameState.players || 0;
    const spectators = gameState.spectators || 0;
    status.textContent = `${msg} (${players} players, ${spectators} spectators)`;
  }

  function renderHistory() {
    if (!historyList || !gameState) return;
    const history = gameState.history || [];

    if (history.length === 0) {
      historyList.innerHTML = '<p class="ttt-history-empty">No finished games yet.</p>';
      return;
    }

    historyList.innerHTML = history.slice().reverse().map(entry => {
      const resultText = entry.winner === 'draw'
        ? 'Draw'
        : `${entry.winner} wins`;
      const resultClass = entry.winner === 'draw' ? 'result draw' : 'result';
      return `<div class="ttt-history-entry">
        <span>Game #${entry.game + 1}</span>
        <span class="${resultClass}">${resultText}</span>
      </div>`;
    }).join('');
  }

  board.addEventListener('click', (e) => {
    const cell = e.target.closest('.ttt-cell');
    if (!cell || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (!myMark) return;

    const idx = parseInt(cell.dataset.cell, 10);
    ws.send(JSON.stringify({ action: 'move', cell: idx }));
  });

  resetBtn?.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ action: 'reset' }));
  });

  connect();
})();
