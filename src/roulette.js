import { tableSettings } from "./mockData.js";

const wheelNumbers = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const denominations = [5, 10, 25, 50, 100];
const wheelColors = { green: "#197347", red: "#bd343d", black: "#151a17" };
const segmentAngle = 360 / wheelNumbers.length;
const wheelBackground = `conic-gradient(from -${segmentAngle / 2}deg, ${wheelNumbers.map((number, index) => {
  const color = number === 0 ? wheelColors.green : redNumbers.has(number) ? wheelColors.red : wheelColors.black;
  return `${color} ${index * segmentAngle}deg ${(index + 1) * segmentAngle}deg`;
}).join(", ")})`;
const rouletteBets = [
  { kind: "low", label: "1–18", multiplier: 2 },
  { kind: "even", label: "PAR", multiplier: 2 },
  { kind: "red", label: "ROJO", multiplier: 2 },
  { kind: "black", label: "NEGRO", multiplier: 2 },
  { kind: "odd", label: "IMPAR", multiplier: 2 },
  { kind: "high", label: "19–36", multiplier: 2 },
];

function colorOf(number) {
  return number === 0 ? "green" : redNumbers.has(number) ? "red" : "black";
}

function format(amount) {
  return `${Math.max(0, amount).toLocaleString("es-ES")} CR`;
}

function betKey(bet) {
  if (bet.kind === "split") return `split-${bet.numbers.join("-")}`;
  return `${bet.kind}-${bet.value ?? "all"}`;
}

function isWinner(bet, result) {
  if (bet.kind === "number") return bet.value === result;
  if (bet.kind === "split") return bet.numbers.includes(result);
  if (result === 0) return false;
  if (bet.kind === "red" || bet.kind === "black") return colorOf(result) === bet.kind;
  if (bet.kind === "even") return result % 2 === 0;
  if (bet.kind === "odd") return result % 2 !== 0;
  if (bet.kind === "low") return result <= 18;
  if (bet.kind === "high") return result >= 19;
  if (bet.kind === "dozen") return result >= (bet.value - 1) * 12 + 1 && result <= bet.value * 12;
  return false;
}

function createBet(kind, label, multiplier, value, numbers) {
  return { kind, label, multiplier, ...(value === undefined ? {} : { value }), ...(numbers ? { numbers } : {}) };
}

export function initRoulette(root) {
  const storedBalance = Number(localStorage.getItem("royal-balance"));
  const state = {
    balance: Number.isFinite(storedBalance) && storedBalance > 0 ? storedBalance : tableSettings.startingChips,
    history: [],
    bets: {},
    order: [],
    chip: 25,
    allIn: false,
    rotation: 0,
    spinFrom: 0,
    busy: false,
    message: "Elige dónde apostar y coloca tus fichas.",
  };
  try {
    const savedHistory = JSON.parse(localStorage.getItem("royal-history") || "[]");
    if (Array.isArray(savedHistory)) state.history = savedHistory.filter((number) => Number.isInteger(number) && number >= 0 && number <= 36).slice(0, 100);
  } catch {
    state.history = [];
  }

  const totalBet = () => Object.values(state.bets).reduce((sum, entry) => sum + entry.chips.reduce((lineSum, chip) => lineSum + chip, 0), 0);
  const available = () => Math.max(0, state.balance - totalBet());
  const amountOn = (bet) => state.bets[betKey(bet)]?.chips.reduce((sum, value) => sum + value, 0) ?? 0;
  const wheelSlots = wheelNumbers.map((number, index) => `<span class="${colorOf(number)}" style="--slot:${index}">${number}</span>`).join("");
  const numberTiles = Array.from({ length: 36 }, (_, index) => {
    const number = index + 1;
    return `<button type="button" class="roulette-tile ${colorOf(number)}" data-kind="number" data-number="${number}" aria-label="Apostar al ${number}">${number}<small class="bet-chip"></small></button>`;
  }).join("");
  const outsideTiles = rouletteBets.map((bet) => `<button type="button" class="outside-bet ${bet.kind}" data-outside="${bet.kind}" aria-label="Apostar ${bet.label}">${bet.label}<small class="bet-chip"></small></button>`).join("");

  function render() {
    const total = totalBet();
    const winners = [...new Set(state.history)].slice(0, 5);
    const cold = Array.from({ length: 37 }, (_, number) => ({
      number,
      count: state.history.filter((result) => result === number).length,
    })).sort((a, b) => a.count - b.count || a.number - b.number).slice(0, 5);
    const hot = [...cold].sort((a, b) => b.count - a.count || a.number - b.number).slice(0, 5);
    root.innerHTML = `<div class="roulette-app">
      <header class="roulette-heading">
        <div><p class="roulette-eyebrow">ROYAL CLUB · MESA 07</p><h1>Ruleta <em>europea</em></h1><p>Una sola casilla puede cambiarlo todo.</p></div>
        <div class="roulette-wallet"><small>SALDO DISPONIBLE</small><b data-balance>${format(state.balance)}</b></div>
      </header>
      <div class="roulette-grid">
        <section class="roulette-table-panel">
          <div class="roulette-wheel-area">
            <div class="roulette-wheel-wrap">
              <div class="roulette-wheel ${state.busy ? "spinning" : ""}" style="--wheel-background:${wheelBackground};--wheel-rotation:${state.busy ? state.spinFrom : state.rotation}deg">
                <div class="roulette-wheel-numbers">${wheelSlots}</div><div class="roulette-wheel-center"><b>R</b><small>ROYAL</small></div>
              </div>
              <span class="roulette-ball-orbit ${state.busy ? "spinning" : ""}" aria-hidden="true"><i class="roulette-ball"></i></span>
            </div>
            <span class="roulette-result">ÚLTIMO RESULTADO <b class="${state.history.length ? colorOf(state.history[0]) : ""}">${state.history.length ? state.history[0] : "—"}</b></span>
          </div>
          <div class="roulette-status" role="status" aria-live="polite"><i>✦</i><span>${state.message}</span></div>
          <section class="roulette-board-section">
            <div class="roulette-section-heading"><span>01</span><div><b>ELIGE DÓNDE APOSTAR</b><small>Número pleno paga 35:1 · Apuesta dividida 17:1</small></div></div>
            <div class="roulette-board">
              <button type="button" class="roulette-tile zero" data-kind="number" data-number="0" aria-label="Apostar al 0">0<small class="bet-chip"></small></button>
              <div class="roulette-numbers-board">
                <div class="roulette-number-grid">${numberTiles}</div>
                <div class="roulette-splits">${Array.from({ length: 36 }, (_, index) => {
                  const number = index + 1;
                  const column = index % 12;
                  const row = Math.floor(index / 12);
                  const options = [];
                  if (column < 11) options.push({ adjacent: number + 1, orientation: "horizontal", x: (column + 1) / 12 * 100, y: (row + .5) / 3 * 100 });
                  if (row < 2) options.push({ adjacent: number + 12, orientation: "vertical", x: (column + .5) / 12 * 100, y: (row + 1) / 3 * 100 });
                  const splits = options.map(({ adjacent, orientation, x, y }) => {
                    const bet = createBet("split", `${number} / ${adjacent}`, 18, undefined, [number, adjacent]);
                    const amount = amountOn(bet);
                    return `<button type="button" class="roulette-split desktop-split ${orientation}" style="left:${x}%;top:${y}%" data-split="${number},${adjacent}" data-bet-key="${betKey(bet)}" aria-label="Apostar ${number} y ${adjacent}">${amount ? format(amount) : "+"}</button>`;
                  });
                  const mobileOptions = [];
                  const mobileColumn = index % 6;
                  const mobileRow = Math.floor(index / 6);
                  if (mobileColumn < 5) mobileOptions.push({ adjacent: number + 1, orientation: "horizontal", x: (mobileColumn + 1) / 6 * 100, y: (mobileRow + .5) / 6 * 100 });
                  if (mobileRow < 5) mobileOptions.push({ adjacent: number + 6, orientation: "vertical", x: (mobileColumn + .5) / 6 * 100, y: (mobileRow + 1) / 6 * 100 });
                  mobileOptions.forEach(({ adjacent, orientation, x, y }) => {
                    const bet = createBet("split", `${number} / ${adjacent}`, 18, undefined, [number, adjacent]);
                    const amount = amountOn(bet);
                    splits.push(`<button type="button" class="roulette-split mobile-split ${orientation}" style="left:${x}%;top:${y}%" data-split="${number},${adjacent}" data-bet-key="${betKey(bet)}" aria-label="Apostar ${number} y ${adjacent}">${amount ? format(amount) : "+"}</button>`);
                  });
                  return splits.join("");
                }).join("")}</div>
              </div>
            </div>
            <div class="roulette-outside-grid">${outsideTiles}</div>
            <div class="roulette-dozens">${[1, 2, 3].map((dozen) => `<button type="button" class="outside-bet dozen" data-dozen="${dozen}">${dozen}${dozen === 1 ? "ª" : "ª"} DOCENA <small class="bet-chip"></small></button>`).join("")}</div>
          </section>
        </section>
        <aside class="roulette-controls">
          <section class="roulette-card">
            <div class="roulette-section-heading"><span>02</span><div><b>ELIGE TU FICHA</b><small>Selecciona importe y pulsa una casilla</small></div></div>
            <div class="roulette-chips">${denominations.map((value) => `<button type="button" class="roulette-chip chip-${value} ${!state.allIn && state.chip === value ? "selected" : ""}" data-chip="${value}"><b>${value}</b><small>CR</small></button>`).join("")}</div>
            <button type="button" class="roulette-all-in ${state.allIn ? "selected" : ""}" data-action="all-in" ${available() === 0 ? "disabled" : ""}><b>ALL IN</b><span>${format(available())}</span></button>
            <div class="roulette-total"><span><small>APUESTAS COLOCADAS</small><b>${Object.keys(state.bets).length || "Ninguna"}</b></span><strong>${format(total)}</strong></div>
          </section>
          <section class="roulette-card roulette-play-card">
            <div class="roulette-control-links"><button type="button" data-action="undo" ${!state.order.length || state.busy ? "disabled" : ""}>− QUITAR ÚLTIMA</button><button type="button" data-action="clear" ${!state.order.length || state.busy ? "disabled" : ""}>LIMPIAR TODO</button></div>
            <button type="button" class="roulette-spin" data-action="spin" ${state.busy ? "disabled" : ""}><span>⟳</span>${state.busy ? "GIRANDO…" : "GIRAR RULETA"}<small>TOTAL ${format(total)}</small></button>
            <p>Juega con responsabilidad. Solo créditos virtuales.</p>
          </section>
          <section class="roulette-card roulette-trends"><div><b>ÚLTIMAS TIRADAS</b><button type="button" data-action="clear-history" ${state.history.length ? "" : "disabled"}>LIMPIAR</button></div><div class="roulette-history">${state.history.length ? state.history.slice(0, 8).map((number) => `<span class="${colorOf(number)}">${number}</span>`).join("") : "<small>Aún no hay resultados</small>"}</div><div class="cold-numbers"><b>NÚMEROS FRÍOS</b>${cold.map(({ number }) => `<span class="${colorOf(number)}">${number}</span>`).join("")}</div><div class="hot-numbers"><b>NÚMEROS CALIENTES</b>${hot.map(({ number }) => `<span class="${colorOf(number)}">${number}</span>`).join("")}</div></section>
        </aside>
      </div>
    </div>`;
    root.querySelectorAll("[data-number]").forEach((button) => {
      const number = Number(button.dataset.number);
      applyBetAmount(button, createBet("number", String(number), 36, number));
    });
    root.querySelectorAll("[data-outside]").forEach((button) => {
      const bet = rouletteBets.find((candidate) => candidate.kind === button.dataset.outside);
      if (bet) applyBetAmount(button, bet);
    });
    root.querySelectorAll("[data-dozen]").forEach((button) => {
      const value = Number(button.dataset.dozen);
      applyBetAmount(button, createBet("dozen", `${value}ª DOCENA`, 3, value));
    });
    root.querySelectorAll("[data-bet-key]").forEach((button) => {
      const line = state.bets[button.dataset.betKey];
      button.textContent = line ? format(line.chips.reduce((sum, chip) => sum + chip, 0)) : "+";
      button.classList.toggle("has-bet", Boolean(line));
    });
    bindEvents();
  }

  function applyBetAmount(button, bet) {
    const chip = button.querySelector(".bet-chip");
    const amount = amountOn(bet);
    if (chip && amount) {
      chip.textContent = format(amount);
      chip.style.display = "block";
      button.classList.add("has-bet");
    }
  }

  function bindEvents() {
    root.querySelectorAll("[data-kind=number]").forEach((button) => button.addEventListener("click", () => {
      const number = Number(button.dataset.number);
      addBet(createBet("number", `${number} ${colorOf(number).toUpperCase()}`, 36, number));
    }));
    root.querySelectorAll("[data-outside]").forEach((button) => button.addEventListener("click", () => {
      const bet = rouletteBets.find((candidate) => candidate.kind === button.dataset.outside);
      if (bet) addBet(bet);
    }));
    root.querySelectorAll("[data-dozen]").forEach((button) => button.addEventListener("click", () => {
      const value = Number(button.dataset.dozen);
      addBet(createBet("dozen", `${value}ª DOCENA`, 3, value));
    }));
    root.querySelectorAll("[data-split]").forEach((button) => button.addEventListener("click", () => {
      const numbers = button.dataset.split.split(",").map(Number);
      addBet(createBet("split", `${numbers[0]} / ${numbers[1]}`, 18, undefined, numbers));
    }));
    root.querySelectorAll("[data-chip]").forEach((button) => button.addEventListener("click", () => {
      state.chip = Number(button.dataset.chip);
      state.allIn = false;
      render();
    }));
    root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.action === "all-in") { state.allIn = true; render(); }
      if (button.dataset.action === "undo") undoBet();
      if (button.dataset.action === "clear") clearBets();
      if (button.dataset.action === "clear-history") { state.history = []; localStorage.setItem("royal-history", "[]"); render(); }
      if (button.dataset.action === "spin") spin();
    }));
  }

  function addBet(bet) {
    if (state.busy) return;
    const amount = state.allIn ? available() : state.chip;
    if (!amount) {
      state.message = "No tienes saldo disponible. Reinicia la ruleta para recuperar los créditos.";
      render();
      return;
    }
    if (amount > available()) {
      state.message = "No tienes saldo suficiente para esa ficha.";
      render();
      return;
    }
    const key = betKey(bet);
    state.bets[key] ??= { bet, chips: [] };
    state.bets[key].chips.push(amount);
    state.order.push(key);
    state.allIn = false;
    state.message = `+${format(amount)} en ${bet.label}.`;
    render();
  }

  function undoBet() {
    if (state.busy || !state.order.length) return;
    const key = state.order.pop();
    state.bets[key].chips.pop();
    if (!state.bets[key].chips.length) delete state.bets[key];
    state.message = "Se ha retirado la última ficha.";
    render();
  }

  function clearBets() {
    if (state.busy) return;
    state.bets = {};
    state.order = [];
    state.allIn = false;
    state.message = "Apuestas retiradas. La mesa está limpia.";
    render();
  }

  function spin() {
    const lines = Object.values(state.bets);
    const wager = totalBet();
    if (state.busy) return;
    if (!lines.length) {
      state.message = "Primero coloca una apuesta en la mesa.";
      render();
      return;
    }
    state.balance -= wager;
    state.busy = true;
    state.message = "La bola está girando…";
    state.spinFrom = state.rotation;
    const result = Math.floor(Math.random() * 37);
    const index = wheelNumbers.indexOf(result);
    state.rotation += 1440 + (360 - index * segmentAngle) - (state.rotation % 360);
    render();
    window.requestAnimationFrame(() => {
      const wheel = root.querySelector(".roulette-wheel");
      wheel?.style.setProperty("--wheel-rotation", `${state.rotation}deg`);
    });
    window.setTimeout(() => {
      const payout = lines.reduce((sum, line) => {
        const amount = line.chips.reduce((subtotal, chip) => subtotal + chip, 0);
        return sum + (isWinner(line.bet, result) ? amount * line.bet.multiplier : 0);
      }, 0);
      state.balance += payout;
      state.history = [result, ...state.history].slice(0, 100);
      localStorage.setItem("royal-balance", String(state.balance));
      localStorage.setItem("royal-history", JSON.stringify(state.history));
      state.bets = {};
      state.order = [];
      state.busy = false;
      state.message = payout ? `Salió ${result} ${colorOf(result)}. Cobras ${format(payout)}.` : `Salió ${result} ${colorOf(result)}. Prueba otra vez.`;
      render();
    }, 1900);
  }

  render();
}
