(() => {
  const $ = (s) => document.querySelector(s);

  function el(tag, attrs = {}, ...children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ===== Datos =====
  const HEROES = [
    { id: "axiol",   name: "Axiol",   img: "assets/heroes/axiol.png" },
    { id: "kaelis",  name: "Kaelis",  img: "assets/heroes/kaelis.png" },
    { id: "renji",   name: "Renji",   img: "assets/heroes/renji.png" },
    { id: "noira",   name: "Noira",   img: "assets/heroes/noira.png" },
    { id: "sylvara", name: "Sylvara", img: "assets/heroes/sylvara.png" },
    { id: "viren",   name: "Viren",   img: "assets/heroes/viren.png" },
    { id: "elynnar", name: "Elynnar", img: "assets/heroes/elynnar.png" },
    { id: "tovahn",  name: "Tovahn",  img: "assets/heroes/tovahn.png" },
  ];

  // Orden de aparición: Colossus, Hive, Oracle, Bastion, Knight
  const BOSSES = [
    { id: "colossus", name: "Coloso", img: "assets/bosses/colossus.png" },
    { id: "hive",     name: "Colmena",     img: "assets/bosses/hive.png" },
    { id: "oracle",   name: "Oráculo",   img: "assets/bosses/oracle.png" },
    { id: "bastion",  name: "Bastión",  img: "assets/bosses/bastion.png" },
    { id: "knight",   name: "Caballero",   img: "assets/bosses/knight.png" },
  ];

  // ===== Estado =====
  const state = {
    step: "players",
    playerCount: 2,
    selectedHeroIds: [],
    selectedBossId: null,

    round: 1,
    deck: [],
    revealedCount: 0,
    heroTurnIndex: 0,
    lastCardShown: null,
    roundCompleteArmed: false,

    // peek
    isPeeking: false,
    peekCard: null,

    // undo
    history: [],
  };

  // ===== Enlaces a tu HTML =====
  const screenTitle = $("#screenTitle");
  const screenHint  = $("#screenHint");
  const content     = $("#content");
  const panelFoot   = $("#panelFoot");

  // (modal existe en tu HTML, pero aquí no lo necesitamos)
  const overlay    = $("#overlay");
  const modalOk    = $("#modalOk");
  if (overlay) overlay.classList.add("hidden");
  if (modalOk) modalOk.addEventListener("click", () => overlay?.classList.add("hidden"));

  function setScreen(title, hint) {
    screenTitle.textContent = title;
    screenHint.textContent = hint || "";
    content.innerHTML = "";
    panelFoot.innerHTML = "";
  }

  function btn(label, opts = {}) {
    const cls = opts.kind === "primary" ? "btn primary" : "btn";
    return el("button", { class: cls, type: "button", onclick: opts.onClick, title: opts.title || "" }, label);
  }

  function toast(text) {
    const prev = screenHint.textContent;
    screenHint.textContent = text;
    setTimeout(() => (screenHint.textContent = prev), 900);
  }

  // ===== Pantalla completa =====
  function isFullscreenSupported() {
    return !!document.documentElement.requestFullscreen;
  }

  function isFullscreen() {
    return !!document.fullscreenElement;
  }

  async function toggleFullscreen() {
    try {
      if (!isFullscreenSupported()) {
        toast("Pantalla completa no disponible en este navegador.");
        return;
      }
      if (isFullscreen()) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      // El render se refresca también con fullscreenchange, pero por si acaso:
      rerender();
    } catch (e) {
      toast("No se pudo activar pantalla completa.");
    }
  }

  document.addEventListener("fullscreenchange", () => {
    // Actualiza el texto del botón al entrar/salir
    rerender();
  });

  function resetToStart() {
    state.step = "players";
    state.playerCount = 2;
    state.selectedHeroIds = [];
    state.selectedBossId = null;

    state.round = 1;
    state.deck = [];
    state.revealedCount = 0;
    state.heroTurnIndex = 0;
    state.lastCardShown = null;
    state.roundCompleteArmed = false;

    state.isPeeking = false;
    state.peekCard = null;

    state.history = [];
  }

  function confirmRestart() {
    const ok = window.confirm("¿Seguro que quieres reiniciar la partida? Se perderá el progreso actual.");
    if (!ok) return;
    resetToStart();
    renderPlayers();
  }

  // ===== Pantalla 1: nº jugadores =====
  function renderPlayers() {
    state.step = "players";
    setScreen("Turnos", "¿Cuántos jugadores? Elige 2, 3 o 4.");

    const actions = el("div", { class: "actions" },
      btn("2 jugadores", { kind: state.playerCount === 2 ? "primary" : "", onClick: () => { state.playerCount = 2; renderPlayers(); } }),
      btn("3 jugadores", { kind: state.playerCount === 3 ? "primary" : "", onClick: () => { state.playerCount = 3; renderPlayers(); } }),
      btn("4 jugadores", { kind: state.playerCount === 4 ? "primary" : "", onClick: () => { state.playerCount = 4; renderPlayers(); } }),
    );

    content.appendChild(actions);

    panelFoot.appendChild(el("div", { class: "actions" },
      btn(isFullscreen() ? "Salir pantalla completa" : "Pantalla completa", {
        onClick: toggleFullscreen,
        title: "Activar/Desactivar pantalla completa"
      }),
      btn("Continuar →", { kind: "primary", onClick: renderHeroPick })
    ));
  }

  // ===== Pantalla 2: héroes =====
  function renderHeroPick() {
    state.step = "heroes";
    setScreen("Elige personajes", `Selecciona ${state.playerCount} personaje(s).`);

    const grid = el("div", { class: "grid grid-heroes" });

    function toggleHero(id) {
      const idx = state.selectedHeroIds.indexOf(id);
      if (idx >= 0) state.selectedHeroIds.splice(idx, 1);
      else {
        if (state.selectedHeroIds.length >= state.playerCount) return;
        state.selectedHeroIds.push(id);
      }
      renderHeroPick();
    }

    for (const h of HEROES) {
      const selected = state.selectedHeroIds.includes(h.id);
      grid.appendChild(
        el("button", { class: `pick ${selected ? "selected" : ""}`, type: "button", onclick: () => toggleHero(h.id) },
          el("img", { src: h.img, alt: h.name }),
          el("div", { class: "pick-name" }, h.name)
        )
      );
    }

    content.appendChild(grid);

    panelFoot.appendChild(el("div", { class: "actions" },
      btn(isFullscreen() ? "Salir pantalla completa" : "Pantalla completa", { onClick: toggleFullscreen }),
      btn("← Atrás", { onClick: renderPlayers }),
      btn("Continuar →", {
        kind: "primary",
        onClick: () => {
          if (state.selectedHeroIds.length !== state.playerCount) {
            toast(`Te faltan ${state.playerCount - state.selectedHeroIds.length} personaje(s).`);
            return;
          }
          renderBossPick();
        }
      })
    ));
  }

  // ===== Pantalla 3: bosses =====
  function renderBossPick() {
    state.step = "boss";
    setScreen("Elige jefe", "Selecciona el jefe para la partida.");

    const grid = el("div", { class: "grid grid-bosses" });

    for (const b of BOSSES) {
      const selected = state.selectedBossId === b.id;
      grid.appendChild(
        el("button", { class: `pick ${selected ? "selected" : ""}`, type: "button", onclick: () => { state.selectedBossId = b.id; renderBossPick(); } },
          el("img", { src: b.img, alt: b.name }),
          el("div", { class: "pick-name" }, b.name)
        )
      );
    }

    content.appendChild(grid);

    panelFoot.appendChild(el("div", { class: "actions" },
      btn(isFullscreen() ? "Salir pantalla completa" : "Pantalla completa", { onClick: toggleFullscreen }),
      btn("← Atrás", { onClick: renderHeroPick }),
      btn("Empezar partida →", { kind: "primary", onClick: startGame })
    ));
  }

  // ===== Juego =====
  function getSelectedHeroes() {
    return state.selectedHeroIds.map(id => HEROES.find(h => h.id === id));
  }

  function getSelectedBoss() {
    return BOSSES.find(b => b.id === state.selectedBossId) || BOSSES[0];
  }

  function startGame() {
    state.step = "round";
    state.round = 1;
    state.heroTurnIndex = 0;
    state.history = [];
    state.revealedCount = 0;
    state.lastCardShown = null;
    state.roundCompleteArmed = false;
    state.isPeeking = false;
    state.peekCard = null;
    buildNewRoundDeck();
    renderRound();
  }

  function buildNewRoundDeck() {
    const heroes = getSelectedHeroes();
    const boss = getSelectedBoss();

    const types = shuffle(["player","player","player","player","boss","boss"]);

    const deck = [];
    for (const t of types) {
      if (t === "player") {
        const hero = heroes[state.heroTurnIndex % heroes.length];
        state.heroTurnIndex++;
        deck.push({ type: "player", label: `Turno de ${hero.name}`, img: hero.img, who: hero.name });
      } else {
        deck.push({ type: "boss", label: `Turno de ${boss.name}`, img: boss.img, who: boss.name });
      }
    }

    state.deck = deck;
    state.revealedCount = 0;
    state.lastCardShown = null;
    state.roundCompleteArmed = false;
    state.isPeeking = false;
    state.peekCard = null;
  }

  function renderRound() {
    const remaining = state.deck.length - state.revealedCount;
    setScreen(`Ronda ${state.round}`, "Toca la carta o usa los botones.");

    const info = el("div", { class: "round-info" },
      `Reveladas: ${state.revealedCount}/6 · Restan: ${Math.max(0, remaining)} · ${getSelectedHeroes().length} jugadores`
    );

    const shown = state.isPeeking ? state.peekCard : state.lastCardShown;

    const imgNode = shown
      ? el("img", { src: shown.img, alt: shown.label })
      : el("div", { class: "card-placeholder" }, "Pulsa para sacar carta");

    const cardClick = el("div", {
      class: `card-click ${state.isPeeking ? "is-peek" : ""}`,
      onclick: () => {
        if (state.roundCompleteArmed) {
          state.round++;
          buildNewRoundDeck();
          renderRound();
          return;
        }
        if (state.isPeeking) return;
        drawCard();
      }
    }, imgNode);

    const wrap = el("div", { class: "card-wrap" },
      info,
      cardClick,
      state.isPeeking ? el("div", { class: "peek-badge" }, "Vista previa") : null,
      shown ? el("div", { class: "card-label" }, shown.label) : el("div", { class: "card-label" }, "Mazo preparado")
    );

    content.appendChild(wrap);

    const actions = el("div", { class: "actions" },
      btn(isFullscreen() ? "Salir pantalla completa" : "Pantalla completa", { onClick: toggleFullscreen }),
      btn("↩ Deshacer", { onClick: undoDraw }),
      btn("Sacar carta", {
        kind: "primary",
        onClick: () => {
          if (state.roundCompleteArmed) {
            state.round++;
            buildNewRoundDeck();
            renderRound();
            return;
          }
          if (state.isPeeking) return;
          drawCard();
        }
      }),
      btn("Revelar carta", {
        onClick: () => {
          if (state.roundCompleteArmed) return;
          if (state.isPeeking) return;
          peekNextCard();
        }
      }),
      // ✅ ahora con confirmación
      btn("Reiniciar partida", { onClick: confirmRestart }),
    );

    panelFoot.appendChild(actions);

    if (state.isPeeking) {
      panelFoot.appendChild(el("div", { class: "actions" },
        btn("Devolver", {
          onClick: () => {
            state.isPeeking = false;
            state.peekCard = null;
            renderRound();
          }
        }),
        btn("Mandar al fondo", {
          kind: "primary",
          onClick: () => {
            const idx = state.revealedCount;
            const [c] = state.deck.splice(idx, 1);
            state.deck.push(c);
            state.isPeeking = false;
            state.peekCard = null;
            renderRound();
          }
        })
      ));
    }
  }

  function drawCard() {
    if (state.revealedCount >= 6) {
      state.roundCompleteArmed = true;
      renderRound();
      return;
    }

    const card = state.deck[state.revealedCount];
    if (!card) return;

    state.history.push({
      deck: [...state.deck],
      revealedCount: state.revealedCount,
      lastCardShown: state.lastCardShown ? { ...state.lastCardShown } : null,
      roundCompleteArmed: state.roundCompleteArmed,
      heroTurnIndex: state.heroTurnIndex,
    });

    state.lastCardShown = card;
    state.revealedCount++;

    if (state.revealedCount >= 6) state.roundCompleteArmed = true;

    renderRound();
  }

  function undoDraw() {
    if (!state.history.length) return;

    const prev = state.history.pop();
    state.deck = prev.deck;
    state.revealedCount = prev.revealedCount;
    state.lastCardShown = prev.lastCardShown;
    state.roundCompleteArmed = prev.roundCompleteArmed;
    state.heroTurnIndex = prev.heroTurnIndex;

    state.isPeeking = false;
    state.peekCard = null;

    renderRound();
  }

  function peekNextCard() {
    if (state.revealedCount >= 6) return;
    const card = state.deck[state.revealedCount];
    if (!card) return;

    state.isPeeking = true;
    state.peekCard = card;
    renderRound();
  }

  function rerender() {
    // Redibuja la pantalla actual sin cambiar el estado
    if (state.step === "players") renderPlayers();
    else if (state.step === "heroes") renderHeroPick();
    else if (state.step === "boss") renderBossPick();
    else renderRound();
  }

  // Boot
  renderPlayers();
})();

