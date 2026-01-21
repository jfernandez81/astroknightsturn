// ---------- Registro del Service Worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
    } catch (e) {
      console.warn("Service Worker no registrado:", e);
    }
  });
}

// ---------- Estado de la app ----------
const state = {
  step: "players", // players -> heroes -> boss -> round
  numPlayers: null,
  selectedHeroes: [],
  selectedBoss: null,

  round: 1,
  deck: [],
  deckIndex: 0
};

// ---------- Anti doble toque ----------
let tapLock = false;
let revealTick = 0;

function revealNextSafe() {
  if (tapLock) return;
  tapLock = true;

  revealNext();

  setTimeout(() => {
    tapLock = false;
  }, 350);
}

// ---------- Datos (con imágenes) ----------
const HEROES = [
  { id: "axiol", name: "Axiol", img: "assets/heroes/axiol.png" },
  { id: "kaelis", name: "Kaelis", img: "assets/heroes/kaelis.png" },
  { id: "renji", name: "Renji", img: "assets/heroes/renji.png" },
  { id: "noira", name: "Noira", img: "assets/heroes/noira.png" },
  { id: "sylvara", name: "Sylvara", img: "assets/heroes/sylvara.png" },
  { id: "viren", name: "Viren", img: "assets/heroes/viren.png" },
  { id: "elynnar", name: "Elynnar", img: "assets/heroes/elynnar.png" },
  { id: "tovahn", name: "Tovahn", img: "assets/heroes/tovahn.png" }
];

const BOSSES = [
  { id: "colossus", name: "Colossus", img: "assets/bosses/colossus.png" },
  { id: "hive", name: "Hive", img: "assets/bosses/hive.png" },
  { id: "oracle", name: "Oracle", img: "assets/bosses/oracle.png" },
  { id: "bastion", name: "Bastion", img: "assets/bosses/bastion.png" },
  { id: "knight", name: "Knight", img: "assets/bosses/knight.png" }
];

// Ruta de imagen del comodín (3 jugadores)
const WILD_CARD_IMG = "assets/heroes/wild.png";

// ---------- Utilidades ----------
function shuffle(array) {
  // Fisher-Yates
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildDeck() {
  const boss = state.selectedBoss;
  const heroes = state.selectedHeroes;

  /** Carta:
   * { type: 'player'|'boss'|'wild', label: string, img: string|null }
   */
  let deck = [];

  if (state.numPlayers === 2) {
    deck = [
      { type: "player", label: heroes[0].name, img: heroes[0].img },
      { type: "player", label: heroes[0].name, img: heroes[0].img },
      { type: "player", label: heroes[1].name, img: heroes[1].img },
      { type: "player", label: heroes[1].name, img: heroes[1].img },
      { type: "boss", label: boss.name, img: boss.img },
      { type: "boss", label: boss.name, img: boss.img }
    ];
  }

  if (state.numPlayers === 3) {
    deck = [
      { type: "player", label: heroes[0].name, img: heroes[0].img },
      { type: "player", label: heroes[1].name, img: heroes[1].img },
      { type: "player", label: heroes[2].name, img: heroes[2].img },
      { type: "wild", label: "Comodín", img: WILD_CARD_IMG },
      { type: "boss", label: boss.name, img: boss.img },
      { type: "boss", label: boss.name, img: boss.img }
    ];
  }

  if (state.numPlayers === 4) {
    deck = [
      { type: "player", label: heroes[0].name, img: heroes[0].img },
      { type: "player", label: heroes[1].name, img: heroes[1].img },
      { type: "player", label: heroes[2].name, img: heroes[2].img },
      { type: "player", label: heroes[3].name, img: heroes[3].img },
      { type: "boss", label: boss.name, img: boss.img },
      { type: "boss", label: boss.name, img: boss.img }
    ];
  }

  state.deck = shuffle(deck);
  state.deckIndex = 0;
}

function currentCard() {
  if (state.deckIndex <= 0) return null;
  return state.deck[state.deckIndex - 1];
}

// ---------- Render ----------
const root = document.getElementById("screen-root");

function render() {
  root.innerHTML = "";

  if (state.step === "players") renderPlayers();
  else if (state.step === "heroes") renderHeroes();
  else if (state.step === "boss") renderBoss();
  else if (state.step === "round") renderRound();
}

function renderPlayers() {
  root.append(
    el("div", { class: "card" }, [
      el("div", { class: "big" }, "¿Cuántos jugadores?"),
      el("p", { class: "muted" }, "Elige 2, 3 o 4 para preparar la partida.")
    ])
  );

  const row = el("div", { class: "row" }, [
    button("2 jugadores", () => setPlayers(2)),
    button("3 jugadores", () => setPlayers(3)),
    button("4 jugadores", () => setPlayers(4))
  ]);

  root.append(el("div", { class: "divider" }));
  root.append(row);
}

function setPlayers(n) {
  state.numPlayers = n;
  state.selectedHeroes = [];
  state.selectedBoss = null;
  state.round = 1;
  state.deck = [];
  state.deckIndex = 0;
  state.step = "heroes";
  render();
}

function renderHeroes() {
  root.append(
    el("div", { class: "card" }, [
      el("div", { class: "big" }, "Elige personajes"),
      el("p", { class: "muted" }, `Selecciona ${state.numPlayers} personaje(s).`)
    ])
  );

  const grid = el("div", { class: "grid" });

  HEROES.forEach((h) => {
    const selected = state.selectedHeroes.some((x) => x.id === h.id);

    const tile = el("button", { class: `tile ${selected ? "selected" : ""}` }, [
      el("img", { class: "thumb", src: h.img, alt: h.name }),
      el("div", { class: "label" }, h.name)
    ]);

    tile.addEventListener("click", () => toggleHero(h));
    grid.append(tile);
  });

  root.append(el("div", { class: "divider" }));
  root.append(grid);

  root.append(el("div", { class: "divider" }));

  const canContinue = state.selectedHeroes.length === state.numPlayers;
  const controls = el("div", { class: "row" }, [
    button("← Atrás", () => {
      state.step = "players";
      render();
    }),
    button(
      "Continuar →",
      () => {
        state.step = "boss";
        render();
      },
      canContinue ? "primary" : "",
      !canContinue
    )
  ]);
  root.append(controls);
}

function toggleHero(hero) {
  const exists = state.selectedHeroes.some((h) => h.id === hero.id);
  if (exists) {
    state.selectedHeroes = state.selectedHeroes.filter((h) => h.id !== hero.id);
  } else {
    if (state.selectedHeroes.length < state.numPlayers) state.selectedHeroes.push(hero);
  }
  render();
}

function renderBoss() {
  root.append(
    el("div", { class: "card" }, [
      el("div", { class: "big" }, "Elige Jefe"),
      el("p", { class: "muted" }, "Selecciona el jefe al que os vais a enfrentar.")
    ])
  );

  const grid = el("div", { class: "grid" });

  BOSSES.forEach((b) => {
    const selected = state.selectedBoss?.id === b.id;

    const tile = el("button", { class: `tile ${selected ? "selected" : ""}` }, [
      el("img", { class: "thumb", src: b.img, alt: b.name }),
      el("div", { class: "label" }, b.name)
    ]);

    tile.addEventListener("click", () => {
      state.selectedBoss = b;
      render();
    });

    grid.append(tile);
  });

  root.append(el("div", { class: "divider" }));
  root.append(grid);

  root.append(el("div", { class: "divider" }));

  const canStart = !!state.selectedBoss;
  const controls = el("div", { class: "row" }, [
    button("← Atrás", () => {
      state.step = "heroes";
      render();
    }),
    button(
      "Empezar partida",
      () => startGame(),
      canStart ? "primary" : "",
      !canStart
    )
  ]);
  root.append(controls);
}

function startGame() {
  state.round = 1;
  buildDeck();
  state.step = "round";
  render();
}

function renderRound() {
  const card = currentCard();
  const finished = state.deckIndex >= 6;

  root.append(
    el("div", { class: "card" }, [
      el("div", { class: "big" }, `Ronda ${state.round}`),
      el("div", { class: "row" }, [
        el("span", { class: "pill" }, `Reveladas: ${state.deckIndex}/6`),
        el("span", { class: "pill" }, `Restan: ${6 - state.deckIndex}`),
        el("span", { class: "pill" }, `${state.numPlayers} jugadores`)
      ]),
      el("p", { class: "muted" }, finished ? "Fin de ronda." : "Toca la carta o pulsa el botón para revelar.")
    ])
  );

  root.append(el("div", { class: "divider" }));

  const revealChildren = [];

  if (!card) {
    revealChildren.push(el("div", { class: "big" }, "—"));
    revealChildren.push(el("p", { class: "muted" }, "Aún no se ha revelado ninguna carta."));
  } else {
    revealChildren.push(el("div", { class: "big" }, labelFor(card)));
    revealChildren.push(el("p", { class: "muted" }, sublabelFor(card)));

    if (card.img) {
      revealChildren.push(el("img", { class: "reveal-img", src: card.img, alt: card.label }));
    } else {
      revealChildren.push(el("div", { class: "pill" }, "Sin imagen"));
    }
  }

  const revealCardBox = el(
  "div",
  { class: `card reveal ${card ? "reveal-animate" : ""}`, "data-tick": String(revealTick) },
  revealChildren
);

  // Tocar la carta para revelar (solo si la ronda no ha terminado)
  if (!finished) {
    revealCardBox.style.cursor = "pointer";
    revealCardBox.title = "Toca para revelar la siguiente carta";
    revealCardBox.addEventListener("click", () => revealNextSafe());
  }

  root.append(revealCardBox);

  root.append(el("div", { class: "divider" }));

  const row = el("div", { class: "row actions" });

  if (!finished) {
    row.append(button("Revelar carta", () => revealNextSafe(), "primary"));
  } else {
    row.append(button("Fin de ronda · OK", () => nextRound(), "primary"));
  }

  row.append(button("Reiniciar partida", () => confirmReset(), "danger"));
  root.append(row);
}

function revealNext() {
  state.deckIndex += 1;
  revealTick += 1;
  render();
}

function nextRound() {
  state.round += 1;
  buildDeck();
  render();
}

function resetAll() {
  state.step = "players";
  state.numPlayers = null;
  state.selectedHeroes = [];
  state.selectedBoss = null;
  state.round = 1;
  state.deck = [];
  state.deckIndex = 0;
  render();
}

function confirmReset() {
  const ok = confirm(
    "¿Seguro que quieres reiniciar la partida?\n\nSe perderá la ronda actual."
  );
  if (ok) resetAll();
}

function labelFor(card) {
  if (card.type === "boss") return "JEFE";
  if (card.type === "wild") return "COMODÍN";
  return "JUGADOR";
}

function sublabelFor(card) {
  if (card.type === "boss") return card.label;
  if (card.type === "wild") return "Elige quién actúa (según reglas).";
  return card.label;
}

// ---------- Helpers DOM ----------
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (!Array.isArray(children)) children = [children];
  children.forEach((c) => {
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else if (c) node.appendChild(c);
  });
  return node;
}

function button(text, onClick, extraClass = "", disabled = false) {
  const b = document.createElement("button");
  b.className = `btn ${extraClass}`.trim();
  b.textContent = text;
  b.disabled = disabled;
  b.addEventListener("click", onClick);
  return b;
}

// Inicial
render();

