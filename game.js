(() => {
  "use strict";

  const DURATION = 45;
  const TRAVEL_MS = 1850;
  const HIT_WINDOW_MS = 310;
  const START_SIGNAL = 64;
  const keys = { a: 0, s: 1, d: 2 };
  const schedule = Array.from({ length: 56 }, (_, index) => ({
    at: 900 + index * 720 + (index % 5 === 0 ? 180 : 0),
    lane: (index * 2 + Math.floor(index / 4)) % 3
  })).filter((note) => note.at < DURATION * 1000 - 1000);

  const shell = document.querySelector(".game-shell");
  const playfield = document.getElementById("playfield");
  const startPanel = document.getElementById("start-panel");
  const startButton = document.getElementById("start-button");
  const gameStatus = document.getElementById("game-status");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const timeEl = document.getElementById("time");
  const meterFill = document.getElementById("meter-fill");
  const meterValue = document.getElementById("meter-value");
  const bestScoreEl = document.getElementById("best-score");
  const feedback = document.getElementById("feedback");
  const laneEls = [...document.querySelectorAll(".lane")];
  const hitButtons = [...document.querySelectorAll("[data-hit]")];

  let running = false;
  let startAt = 0;
  let animationFrame = 0;
  let score = 0;
  let combo = 0;
  let signal = START_SIGNAL;
  let spawnIndex = 0;
  let activeNotes = [];

  const savedBest = Number.parseInt(localStorage.getItem("signalEncoreBest") || "0", 10);
  bestScoreEl.textContent = String(Number.isFinite(savedBest) ? savedBest : 0);

  function setScore() {
    scoreEl.textContent = String(score).padStart(4, "0");
    comboEl.textContent = `×${combo}`;
    meterFill.style.width = `${Math.max(0, Math.min(100, signal))}%`;
    meterValue.textContent = `${Math.round(signal)}%`;
  }

  function announce(label, color = "var(--cyan)") {
    feedback.textContent = label;
    feedback.style.color = color;
    feedback.classList.remove("show");
    void feedback.offsetWidth;
    feedback.classList.add("show");
  }

  function spawnNote(note) {
    const element = document.createElement("div");
    element.className = "note";
    element.dataset.lane = String(note.lane);
    element.setAttribute("aria-hidden", "true");
    playfield.append(element);
    activeNotes.push({ ...note, element, hit: false });
  }

  function markMiss(note) {
    if (note.hit) return;
    note.hit = true;
    note.element.remove();
    combo = 0;
    signal = Math.max(0, signal - 7);
    announce("Miss", "#ff7b9f");
    setScore();
  }

  function hitLane(lane) {
    if (!running) return;
    const now = performance.now() - startAt;
    const button = hitButtons[lane];
    laneEls[lane].classList.add("active");
    button.classList.add("active");
    setTimeout(() => {
      laneEls[lane].classList.remove("active");
      button.classList.remove("active");
    }, 100);

    const candidates = activeNotes
      .filter((note) => !note.hit && note.lane === lane)
      .map((note) => ({ note, distance: Math.abs(now - note.at) }))
      .filter(({ distance }) => distance <= HIT_WINDOW_MS)
      .sort((a, b) => a.distance - b.distance);

    if (!candidates.length) {
      combo = 0;
      signal = Math.max(0, signal - 2);
      announce("Static", "#b8afd3");
      setScore();
      return;
    }

    const { note, distance } = candidates[0];
    note.hit = true;
    note.element.remove();
    const perfect = distance < 125;
    combo += 1;
    score += (perfect ? 120 : 80) + Math.min(combo, 20) * 4;
    signal = Math.min(100, signal + (perfect ? 4 : 2.5));
    announce(perfect ? "Perfect" : "Linked", perfect ? "var(--gold)" : "var(--cyan)");
    setScore();
  }

  function finish() {
    running = false;
    cancelAnimationFrame(animationFrame);
    activeNotes.forEach((note) => note.element.remove());
    activeNotes = [];
    shell.dataset.state = "finished";
    const best = Math.max(score, Number.parseInt(localStorage.getItem("signalEncoreBest") || "0", 10));
    localStorage.setItem("signalEncoreBest", String(best));
    bestScoreEl.textContent = String(best);
    startPanel.hidden = false;
    gameStatus.textContent = signal >= 65
      ? `Encore saved — ${score} points.`
      : `Signal lost, but Eira is ready to retry — ${score} points.`;
    startButton.textContent = "Run it back";
    timeEl.textContent = "0";
  }

  function tick(now) {
    if (!running) return;
    const elapsed = now - startAt;
    const remaining = Math.max(0, DURATION - elapsed / 1000);
    timeEl.textContent = String(Math.ceil(remaining));

    while (spawnIndex < schedule.length && schedule[spawnIndex].at - TRAVEL_MS <= elapsed) {
      spawnNote(schedule[spawnIndex]);
      spawnIndex += 1;
    }

    activeNotes.forEach((note) => {
      if (note.hit) return;
      const progress = (elapsed - (note.at - TRAVEL_MS)) / TRAVEL_MS;
      const travel = playfield.clientHeight - 38;
      note.element.style.transform = `translateY(${progress * travel}px)`;
      if (elapsed - note.at > HIT_WINDOW_MS) markMiss(note);
    });
    activeNotes = activeNotes.filter((note) => !note.hit);

    if (remaining <= 0 || signal <= 0) {
      finish();
      return;
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    score = 0;
    combo = 0;
    signal = START_SIGNAL;
    spawnIndex = 0;
    activeNotes.forEach((note) => note.element.remove());
    activeNotes = [];
    setScore();
    timeEl.textContent = String(DURATION);
    startPanel.hidden = true;
    running = true;
    shell.dataset.state = "running";
    startAt = performance.now();
    animationFrame = requestAnimationFrame(tick);
  }

  startButton.addEventListener("click", start);
  hitButtons.forEach((button) => button.addEventListener("pointerdown", () => hitLane(Number(button.dataset.hit))));
  window.addEventListener("keydown", (event) => {
    const lane = keys[event.key.toLowerCase()];
    if (lane === undefined || event.repeat) return;
    event.preventDefault();
    hitLane(lane);
  });
})();
