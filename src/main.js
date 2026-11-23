import { handNames, simulatedPlayers, tableSettings } from "./mockData.js";
import { initRoulette } from "./roulette.js";
import { bestHand, compareScores, describeHand } from "./pokerRules.js";

const suits = [
  { suit: "spades", symbol: "♠", name: "picas", color: "black" },
  { suit: "hearts", symbol: "♥", name: "corazones", color: "red" },
  { suit: "diamonds", symbol: "♦", name: "diamantes", color: "red" },
  { suit: "clubs", symbol: "♣", name: "tréboles", color: "black" },
];
const ranks = [
  { value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" },
  { value: 5, label: "5" }, { value: 6, label: "6" }, { value: 7, label: "7" },
  { value: 8, label: "8" }, { value: 9, label: "9" }, { value: 10, label: "10" },
  { value: 11, label: "J" }, { value: 12, label: "Q" }, { value: 13, label: "K" },
  { value: 14, label: "A" },
];
const stages = ["preflop", "flop", "turn", "river"];
const stageNames = { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River", showdown: "Final" };
const app = document.querySelector("#poker-game");
const rouletteApp = document.querySelector("#roulette-game");
const gameButtons = [...document.querySelectorAll(".switcher-button")];
let currentGame = localStorage.getItem("royal-selected-game") === "roulette" ? "roulette" : "poker";

initRoulette(rouletteApp);

function selectGame(game) {
  currentGame = game;
  localStorage.setItem("royal-selected-game", game);
  app.hidden = game !== "poker";
  rouletteApp.hidden = game !== "roulette";
  gameButtons.forEach((button) => {
    const active = button.dataset.game === game;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.title = game === "poker" ? "Royal Poker Club · Texas Hold'em" : "Royal Poker Club · Ruleta";
}

gameButtons.forEach((button) => button.addEventListener("click", () => selectGame(button.dataset.game)));

function readStoredNumber(key, fallback) {
  const storedValue = localStorage.getItem(key);
  if (storedValue === null) return fallback;
  const value = Number(storedValue);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readOpponentStacks() {
  try {
    const stored = JSON.parse(localStorage.getItem("royal-poker-opponents") || "{}");
    return Object.fromEntries(simulatedPlayers.map((player) => [
      player.id,
      Number.isFinite(stored[player.id]) && stored[player.id] >= 0 ? stored[player.id] : player.chips,
    ]));
  } catch {
    return Object.fromEntries(simulatedPlayers.map((player) => [player.id, player.chips]));
  }
}

const state = {
  balance: readStoredNumber("royal-poker-balance", tableSettings.startingChips),
  hands: readStoredNumber("royal-poker-hands", 0),
  wins: readStoredNumber("royal-poker-wins", 0),
  opponentStacks: readOpponentStacks(),
  deck: [],
  holeCards: [],
  board: [],
  opponents: [],
  pot: 0,
  street: "ready",
  handOver: true,
  revealShowdown: false,
  animateCards: false,
  animateBoardFrom: -1,
  lastHand: null,
  notice: "Pulsa «Repartir mano» para sentarte a la mesa.",
  error: "",
};

function formatChips(amount) {
  return `${Math.max(0, amount).toLocaleString("es-ES")} CR`;
}

function createDeck() {
  const deck = suits.flatMap((suit) => ranks.map((rank) => ({ ...suit, ...rank })));
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function drawCard() {
  return state.deck.pop();
}

function cardMarkup(card, hidden = false, extraClass = "") {
  if (!card || hidden) {
    return `<span class="playing-card card-back ${extraClass}" aria-label="Carta oculta"><i>R</i></span>`;
  }
  return `<span class="playing-card ${card.color} ${extraClass}" aria-label="${card.label} de ${card.name}">
    <span class="card-corner"><b>${card.label}</b><i>${card.symbol}</i></span>
    <span class="card-suit">${card.symbol}</span>
    <span class="card-corner bottom"><b>${card.label}</b><i>${card.symbol}</i></span>
  </span>`;
}

function saveProgress() {
  localStorage.setItem("royal-poker-balance", String(state.balance));
  localStorage.setItem("royal-poker-hands", String(state.hands));
  localStorage.setItem("royal-poker-wins", String(state.wins));
  localStorage.setItem("royal-poker-opponents", JSON.stringify(state.opponentStacks));
}

function renderOpponent(player) {
  const isWinner = state.lastHand?.winnerIds.includes(player.id);
  const revealCards = state.revealShowdown && player.status === "in";
  const statusLabel = player.status === "folded" ? "Se retiró" : player.status === "waiting" ? "En la mesa" : formatChips(player.chips);
  const handDescription = state.lastHand?.hands?.[player.id];
  return `<article class="seat seat-${player.color} ${player.status === "folded" ? "folded" : ""} ${isWinner ? "winner" : ""}">
    <div class="seat-avatar">${player.avatar}<i class="seat-dot"></i></div>
    <div class="seat-details"><b>${player.name}</b><span>${statusLabel}</span></div>
    <div class="opponent-cards">${cardMarkup(player.cards?.[0], !revealCards, state.animateCards ? "deal-in deal-1" : "")}${cardMarkup(player.cards?.[1], !revealCards, state.animateCards ? "deal-in deal-2" : "")}</div>
    ${handDescription ? `<small class="hand-label">${handDescription}</small>` : ""}
    ${isWinner ? `<small class="winner-label">GANADOR</small>` : ""}
  </article>`;
}

function renderPlayerCards() {
  if (!state.holeCards.length) {
    return `<div class="player-cards">${cardMarkup(null)}${cardMarkup(null)}</div>`;
  }
  return `<div class="player-cards">${state.holeCards.map((card, index) => cardMarkup(card, false, state.animateCards ? `deal-in deal-${index + 1}` : "")).join("")}</div>`;
}

function renderBoardCards() {
  return Array.from({ length: 5 }, (_, index) => {
    const card = state.board[index];
    return card ? cardMarkup(card, false, `community-card${state.animateBoardFrom >= 0 && index >= state.animateBoardFrom ? ` deal-in deal-${index - state.animateBoardFrom + 1}` : ""}`) : `<span class="card-placeholder">${index + 1}</span>`;
  }).join("");
}

function renderRoundControls() {
  if (state.handOver) {
    const label = state.street === "ready" ? "Repartir mano" : "Jugar otra mano";
    return `<button class="primary-button deal-button" data-action="deal">${label}<span>ANT. ${formatChips(tableSettings.ante)}</span></button>`;
  }
  return `<div class="action-buttons">
    <button class="secondary-button" data-action="fold">Retirarse</button>
    <button class="check-button" data-action="check">Pasar</button>
    <button class="primary-button" data-action="bet">Apostar <span>+${formatChips(tableSettings.actionAmount)}</span></button>
  </div>
  <form class="raise-form" novalidate>
    <label for="raise-amount">Apuesta personalizada</label>
    <div class="raise-input-row">
      <input id="raise-amount" name="amount" type="number" inputmode="numeric" min="${tableSettings.minimumRaise}" max="${state.balance}" step="1" placeholder="Mín. ${tableSettings.minimumRaise}" required aria-describedby="raise-help raise-error" />
      <button class="raise-button" type="submit">Subir apuesta</button>
    </div>
    <small id="raise-help">Mínimo ${formatChips(tableSettings.minimumRaise)} · Máximo ${formatChips(state.balance)}</small>
    <small class="form-error" id="raise-error" aria-live="polite">${state.error}</small>
  </form>`;
}

function render() {
  const activeOpponents = state.opponents.length
    ? state.opponents.filter((player) => player.status === "in").length
    : simulatedPlayers.length;
  const visibleOpponents = state.opponents.length
    ? state.opponents
    : simulatedPlayers.map((player) => ({ ...player, status: "waiting" }));
  app.innerHTML = `<div class="poker-app">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Royal Poker Club">
        <span class="brand-mark">R</span><span><b>ROYAL</b><small>POKER CLUB</small></span>
      </a>
      <div class="table-status"><i></i> MESA ABIERTA <span>·</span> ${tableSettings.variant.toUpperCase()}</div>
      <div class="top-actions">
        <div class="balance-card"><span class="balance-icon">♧</span><span><small>TUS FICHAS</small><b>${formatChips(state.balance)}</b></span></div>
        <button class="icon-button" data-action="reset" aria-label="Reiniciar partida" title="Reiniciar partida">↻</button>
      </div>
    </header>

    <main>
      <section class="page-heading">
        <div><p class="eyebrow">MESA PRIVADA · MÁXIMO 4 JUGADORES</p><h1>Texas <em>Hold'em</em></h1><p class="heading-copy">Juega tus cartas, lee la mesa y decide cuándo ir con todo.</p></div>
        <div class="heading-stats"><span><small>MANOS</small><b>${state.hands}</b></span><span><small>VICTORIAS</small><b>${state.wins}</b></span><span><small>RIVALES</small><b>03</b></span></div>
      </section>

      <div class="game-grid">
        <section class="table-column" aria-label="Mesa de poker">
          <div class="poker-table">
            <div class="table-lights"></div>
            <div class="table-topline"><span>ROYAL POKER CLUB</span><span>ANTE 25 · APUESTA 20 · SIN CIEGAS</span></div>
            <div class="opponents-row">${visibleOpponents.map(renderOpponent).join("")}</div>
            <div class="board-area">
              <span class="pot-label">BOTE</span><strong class="pot-value">${formatChips(state.pot)}</strong>
              <div class="community-cards">${renderBoardCards()}</div>
              <span class="street-label">${stageNames[state.street] ?? "Preflop"} · ${activeOpponents} RIVALES EN JUEGO</span>
            </div>
            <div class="player-area">
              ${renderPlayerCards()}
              ${state.lastHand?.hands?.player ? `<small class="player-hand-label">Tu mano: ${state.lastHand.hands.player}</small>` : ""}
              <div class="player-info"><span class="player-avatar">TÚ</span><span><b>Tu asiento</b><small>${formatChips(state.balance)}</small></span><i class="player-ready"></i></div>
            </div>
            <div class="table-bottomline"><span>♠ ♥ ♦ ♣</span><span>BUENA SUERTE</span><span>♣ ♦ ♥ ♠</span></div>
          </div>
          <div class="notice ${state.error ? "has-error" : ""}" role="status" aria-live="polite"><i>${state.error ? "!" : "✦"}</i><span>${state.error || state.notice}</span></div>
        </section>

        <aside class="side-panel">
          <section class="action-card">
            <div class="section-title"><span>01</span><div><h2>Tu jugada</h2><small>${state.handOver ? "Listo para empezar" : `${stageNames[state.street]} · Elige tu acción`}</small></div></div>
            ${renderRoundControls()}
            <p class="fair-play">Las fichas son simuladas y no tienen valor real.</p>
          </section>

          <section class="info-card">
            <div class="section-title"><span>02</span><div><h2>Reglas de esta mesa</h2><small>Texas Hold'em simplificado</small></div></div>
            <ol class="how-to-play"><li><b>Ante de ${formatChips(tableSettings.ante)}</b><span>Todos ponen el ante al repartir.</span></li><li><b>Una acción por ronda</b><span>Pasar avanza; apostar añade ${formatChips(tableSettings.actionAmount)}. Las subidas se igualan o el rival se retira.</span></li><li><b>Se comparan las mejores 5 cartas</b><span>Al river se revelan las manos; se muestra la combinación y sus desempates.</span></li></ol>
          </section>

          <section class="ranking-card">
            <div class="ranking-heading"><h2>Manos de poker</h2><small>DE MAYOR A MENOR</small></div>
            <div class="ranking-list">${handNames.slice().reverse().map((name, index) => `<span><i>${String(9 - index).padStart(2, "0")}</i>${name}</span>`).join("")}</div>
          </section>
        </aside>
      </div>
    </main>
    <footer><span>${tableSettings.name}</span><span>JUEGO DE PRÁCTICA · SOLO CRÉDITOS VIRTUALES</span></footer>
  </div>`;
  state.animateCards = false;
  state.animateBoardFrom = -1;
}

function startHand() {
  if (state.balance < tableSettings.ante) {
    state.error = `Necesitas al menos ${formatChips(tableSettings.ante)} para entrar. Reinicia la partida para recuperar tus fichas.`;
    render();
    return;
  }
  const activePlayers = simulatedPlayers.filter((player) => state.opponentStacks[player.id] >= tableSettings.ante);
  if (!activePlayers.length) {
    state.error = "Tus rivales se han quedado sin fichas. Reinicia la partida para empezar una nueva mesa.";
    render();
    return;
  }
  state.error = "";
  state.deck = createDeck();
  state.holeCards = [drawCard(), drawCard()];
  state.board = [];
  state.opponents = activePlayers.map((player) => ({
    ...player,
    chips: state.opponentStacks[player.id],
    status: "in",
    cards: [drawCard(), drawCard()],
  }));
  state.animateCards = true;
  state.balance -= tableSettings.ante;
  state.opponents.forEach((player) => {
    player.chips -= tableSettings.ante;
    state.opponentStacks[player.id] = player.chips;
  });
  state.pot = tableSettings.ante * (state.opponents.length + 1);
  state.street = "preflop";
  state.handOver = false;
  state.revealShowdown = false;
  state.lastHand = null;
  state.notice = `Mano repartida. Has puesto ${formatChips(tableSettings.ante)} de ante.`;
  saveProgress();
  render();
}

function closeHand(message, winnerIds = [], label = "", hands = {}) {
  state.hands += 1;
  state.lastHand = { winnerIds, label, hands };
  state.street = "showdown";
  state.handOver = true;
  state.notice = message;
  state.error = "";
  saveProgress();
}

function resolveShowdown() {
  state.revealShowdown = true;
  state.animateCards = true;
  const playerScore = bestHand([...state.holeCards, ...state.board]);
  const contenders = [{ id: "player", name: "Tú", score: playerScore, description: describeHand(playerScore) }];
  state.opponents.filter((player) => player.status === "in").forEach((player) => {
    const score = bestHand([...player.cards, ...state.board]);
    contenders.push({ id: player.id, name: player.name, score, description: describeHand(score) });
  });
  const winningScore = contenders.map((player) => player.score).sort((a, b) => compareScores(b, a))[0];
  const winners = contenders.filter((player) => compareScores(player.score, winningScore) === 0);
  const label = describeHand(winningScore);
  const playerWon = winners.some((player) => player.id === "player");
  const bestOpponent = contenders.find((contender) => contender.id !== "player");
  const share = Math.floor(state.pot / winners.length);
  const remainder = state.pot % winners.length;
  winners.forEach((winner, index) => {
    const payout = share + (index < remainder ? 1 : 0);
    if (winner.id !== "player") {
      state.opponentStacks[winner.id] += payout;
      const opponent = state.opponents.find((player) => player.id === winner.id);
      if (opponent) opponent.chips += payout;
    }
  });
  const hands = Object.fromEntries(contenders.map((contender) => [contender.id, contender.description]));
  if (playerWon) {
    state.balance += share + (winners.findIndex((winner) => winner.id === "player") < remainder ? 1 : 0);
    state.wins += 1;
    const playerPayout = share + (winners.findIndex((winner) => winner.id === "player") < remainder ? 1 : 0);
    closeHand(winners.length > 1 ? `Empate: tu ${describeHand(playerScore)} iguala la mejor mano. Cobras ${formatChips(playerPayout)}.` : `Tu ${describeHand(playerScore)} supera a ${bestOpponent?.name ?? "la mesa"} (${bestOpponent?.description ?? "sin rival"}). Cobras ${formatChips(playerPayout)}.`, winners.map((winner) => winner.id), label, hands);
  } else {
    const winnerDescriptions = winners.map((winner) => `${winner.name} (${winner.description})`).join(" y ");
    closeHand(`Tu ${describeHand(playerScore)} pierde frente a ${winnerDescriptions}.`, winners.map((winner) => winner.id), label, hands);
  }
  state.pot = 0;
}

function advanceStreet() {
  const nextIndex = stages.indexOf(state.street) + 1;
  if (nextIndex >= stages.length) {
    resolveShowdown();
    return;
  }
  state.street = stages[nextIndex];
  state.animateBoardFrom = state.board.length;
  const cardsToReveal = state.street === "flop" ? 3 : 1;
  for (let index = 0; index < cardsToReveal; index += 1) state.board.push(drawCard());
  state.notice = state.street === "flop"
    ? "Flop revelado. ¿Quieres continuar en la mano?"
    : `${stageNames[state.street]} revelado. Decide tu siguiente jugada.`;
  state.error = "";
}

function simulateOpponentActions(amount) {
  const remaining = [];
  state.opponents.filter((player) => player.status === "in").forEach((player) => {
    const foldChance = amount === 0 ? 0 : amount >= 100 ? 0.42 : player.style === "patient" ? 0.1 : 0.06;
    if (amount > player.chips) {
      player.status = "folded";
      return;
    }
    if (Math.random() < foldChance) {
      player.status = "folded";
      return;
    }
    const contribution = Math.min(amount, player.chips);
    player.chips -= contribution;
    state.opponentStacks[player.id] = player.chips;
    state.pot += contribution;
    remaining.push(player);
  });
  if (remaining.length === 0) {
    state.balance += state.pot;
    state.wins += 1;
    closeHand(`Todos se retiraron. ¡Te llevas ${formatChips(state.pot)} sin mostrar las cartas!`, ["player"], "Bote ganado");
    state.pot = 0;
    return false;
  }
  return true;
}

function makeAction(amount) {
  if (state.handOver) return;
  if (!Number.isInteger(amount) || amount < 0 || amount > state.balance) {
    state.error = `La apuesta debe ser un número entero entre 0 y ${formatChips(state.balance)}.`;
    render();
    return;
  }
  if (amount > 0) {
    state.balance -= amount;
    state.pot += amount;
  }
  if (!simulateOpponentActions(amount)) {
    saveProgress();
    render();
    return;
  }
  if (state.street === "river") {
    resolveShowdown();
  } else {
    advanceStreet();
  }
  saveProgress();
  render();
}

function foldHand() {
  if (state.handOver) return;
  state.revealShowdown = false;
  const winner = state.opponents.find((player) => player.status === "in");
  if (winner) winner.chips += state.pot;
  if (winner) state.opponentStacks[winner.id] = winner.chips;
  closeHand(`${winner?.name ?? "Tus rivales"} se lleva${winner ? "" : "n"} el bote. Te has retirado.`, winner ? [winner.id] : [], "Bote ganado");
  state.pot = 0;
  render();
}

function resetGame() {
  state.balance = tableSettings.startingChips;
  state.hands = 0;
  state.wins = 0;
  state.opponentStacks = Object.fromEntries(simulatedPlayers.map((player) => [player.id, player.chips]));
  state.deck = [];
  state.holeCards = [];
  state.board = [];
  state.opponents = [];
  state.pot = 0;
  state.street = "ready";
  state.handOver = true;
  state.revealShowdown = false;
  state.animateCards = false;
  state.animateBoardFrom = -1;
  state.lastHand = null;
  state.notice = `Partida reiniciada. Empiezas con ${formatChips(tableSettings.startingChips)}.`;
  state.error = "";
  saveProgress();
  render();
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "deal") startHand();
  if (button.dataset.action === "check") makeAction(0);
  if (button.dataset.action === "bet") makeAction(tableSettings.actionAmount);
  if (button.dataset.action === "fold") foldHand();
  if (button.dataset.action === "reset") resetGame();
});

app.addEventListener("submit", (event) => {
  if (!event.target.matches(".raise-form")) return;
  event.preventDefault();
  const input = event.target.elements.amount;
  const amount = input.valueAsNumber;
  const error = event.target.querySelector("#raise-error");
  if (!Number.isInteger(amount)) {
    error.textContent = "Escribe una cantidad entera.";
    input.setCustomValidity("Introduce una cantidad entera.");
    input.reportValidity();
    input.addEventListener("input", () => input.setCustomValidity(""), { once: true });
    return;
  }
  if (amount < tableSettings.minimumRaise) {
    error.textContent = `La subida mínima es ${formatChips(tableSettings.minimumRaise)}.`;
    input.setCustomValidity(`La apuesta mínima es ${tableSettings.minimumRaise}.`);
    input.reportValidity();
    input.addEventListener("input", () => input.setCustomValidity(""), { once: true });
    return;
  }
  if (amount > state.balance) {
    error.textContent = "No puedes apostar más fichas de las que tienes.";
    input.setCustomValidity("La apuesta supera tus fichas disponibles.");
    input.reportValidity();
    input.addEventListener("input", () => input.setCustomValidity(""), { once: true });
    return;
  }
  makeAction(amount);
});

render();
