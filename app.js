const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const personaButtons = document.querySelectorAll("[data-persona]");
const pathTitle = document.querySelector("[data-path-title]");
const pathCopy = document.querySelector("[data-path-copy]");
const bindForm = document.querySelector("[data-bind-form]");
const factorInputs = document.querySelectorAll("[data-factor]");
const scoreOutput = document.querySelector("[data-score]");
const ring = document.querySelector("[data-ring]");
const zoneLabel = document.querySelector("[data-zone-label]");
const trendOutput = document.querySelector("[data-trend]");
const alertLabel = document.querySelector("[data-alert-label]");
const governanceAction = document.querySelector("[data-governance-action]");
const riStatus = document.querySelector("[data-ri-status]");
const aStatus = document.querySelector("[data-a-status]");
const boardStatus = document.querySelector("[data-board-status]");
const dashboard = document.querySelector(".stability-dashboard");

const personaPaths = {
  "CEO / Founder": {
    title: "CEO Paradigm Briefing",
    copy:
      "Open a direct CEO operating review focused on acceleration windows, recovery protection, and structural stability authority.",
  },
  "Board Director": {
    title: "Board Governance License",
    copy:
      "Enter the quarterly control loop: Sync-Stability™ review, acceleration authorization, capital rules, and CEO structural brief.",
  },
  "Enterprise License Buyer": {
    title: "Enterprise Sync-Stability™ Assessment",
    copy:
      "Map ER, PR, RI, and acceleration pressure across teams before licensing deployment and certification materials.",
  },
  "Strategic Partner": {
    title: "Strategic Partner Authorization",
    copy:
      "Apply for authorized consulting, leadership institute, AI governance platform, or global alliance use.",
  },
};

const zones = [
  {
    min: 70,
    state: "green",
    color: "#56d09b",
    label: "Controlled Synchronization",
    alert: "Acceleration may be authorized.",
    action:
      "Continue rhythm monitoring. Protect recovery windows before approving new growth commitments.",
  },
  {
    min: 50,
    state: "yellow",
    color: "#f2b45b",
    label: "Volatility Expansion Zone",
    alert: "Expansion must be restricted.",
    action:
      "Reinforce recovery functions. Require diagnostic review before additional acceleration is approved.",
  },
  {
    min: 30,
    state: "red",
    color: "#ef6b68",
    label: "Structural Risk Zone",
    alert: "Governance intervention required.",
    action:
      "Freeze non-core growth. Identify overload nodes and reallocate resources to structural recovery.",
  },
  {
    min: 0,
    state: "dark",
    color: "#d8dfdc",
    label: "Collapse Acceleration Zone",
    alert: "Mandatory Stabilization Cycle.",
    action:
      "Cease discretionary expansion. Activate board override and prioritize structural recovery only.",
  },
];

const previousScore = 71;

function getZone(score) {
  return zones.find((zone) => score >= zone.min);
}

function valueFor(name) {
  const input = document.querySelector(`[data-factor="${name}"]`);
  return input ? Number(input.value) : 1;
}

function updateCalculator() {
  const er = valueFor("er");
  const pr = valueFor("pr");
  const ri = valueFor("ri");
  const a = valueFor("a");
  const score = Math.max(0, Math.min(100, Math.round((er * pr * ri) / (a * 100))));
  const zone = getZone(score);
  const delta = score - previousScore;
  const angle = Math.round((score / 100) * 360);

  factorInputs.forEach((input) => {
    const output = document.querySelector(`[data-value-for="${input.dataset.factor}"]`);
    if (output) output.textContent = input.value;
    input.style.accentColor = zone.color;
  });

  scoreOutput.textContent = score;
  ring.style.setProperty("--angle", `${angle}deg`);
  zoneLabel.textContent = zone.label;
  trendOutput.textContent = `${delta >= 0 ? "+" : ""}${delta}%`;
  alertLabel.textContent = zone.alert;
  governanceAction.textContent = zone.action;
  dashboard.dataset.zoneState = zone.state;
  document.documentElement.style.setProperty("--green", zone.color);

  riStatus.textContent = ri < 50 ? "RI Below Threshold" : "RI Stable";
  aStatus.textContent = a > 78 ? "A High Pressure" : "A Controlled";
  boardStatus.textContent = delta <= -15 ? "Red Alert" : delta <= -8 ? "Yellow Alert" : "Board Watch";
}

navToggle?.addEventListener("click", () => {
  nav.classList.toggle("is-open");
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => nav.classList.remove("is-open"));
});

personaButtons.forEach((button) => {
  button.addEventListener("click", () => {
    personaButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    const path = personaPaths[button.dataset.persona];
    pathTitle.textContent = path.title;
    pathCopy.textContent = path.copy;
  });
});

bindForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = new FormData(bindForm).get("email");
  const activePersona = document.querySelector(".persona-card.is-active")?.dataset.persona;
  const path = personaPaths[activePersona || "CEO / Founder"];
  const subject = encodeURIComponent(`${path.title} - DUAL-RHYTHM ARCHITECTURE`);
  const body = encodeURIComponent(`Identity: ${activePersona}\nEmail: ${email || ""}\nRequested path: ${path.title}`);
  window.location.href = `mailto:kuanxuhome@gmail.com?subject=${subject}&body=${body}`;
});

factorInputs.forEach((input) => {
  input.addEventListener("input", updateCalculator);
});

updateCalculator();
