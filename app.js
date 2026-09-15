const SKILL_GROUPS = [
  {
    label: "Gathering",
    skills: ["woodcutting", "mining", "hacking", "fishing", "farming",
             "scavenging", "energy", "agility", "infiltration"],
  },
  {
    label: "Production",
    skills: ["smithing", "crafting", "cooking", "chemistry", "engineering"],
  },
  {
    label: "Combat",
    skills: ["combat", "defence", "ranged", "vitality", "bounty_hunting"],
  },
];

const skillNav = document.getElementById("skill-nav");
const skillSelect = document.getElementById("skill-select");
const boardTitle = document.getElementById("board-title");
const boardBody = document.getElementById("board-body");
const boardEmpty = document.getElementById("board-empty");
const boardTable = document.getElementById("board-table");
const meta = document.getElementById("meta");
const countdownEl = document.getElementById("countdown");

// The workflow runs hourly (.github/workflows/update-leaderboards.yml) -- keep
// this in sync with that cron schedule if it's ever changed.
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

let data = null;
let nextUpdateAt = null;

function formatSkillName(skill) {
  return skill.replace(/_/g, " ");
}

function buildNav() {
  skillNav.innerHTML = "";
  for (const group of SKILL_GROUPS) {
    const wrap = document.createElement("div");
    wrap.className = "skill-group";

    const heading = document.createElement("h3");
    heading.textContent = group.label;
    wrap.appendChild(heading);

    const list = document.createElement("div");
    list.className = "skill-list";
    for (const skill of group.skills) {
      const btn = document.createElement("button");
      btn.className = "skill-btn";
      btn.type = "button";
      btn.textContent = formatSkillName(skill);
      btn.dataset.skill = skill;
      btn.addEventListener("click", () => selectSkill(skill));
      list.appendChild(btn);
    }
    wrap.appendChild(list);
    skillNav.appendChild(wrap);
  }
}

function buildSelect() {
  skillSelect.innerHTML = "";
  for (const group of SKILL_GROUPS) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    for (const skill of group.skills) {
      const opt = document.createElement("option");
      opt.value = skill;
      opt.textContent = formatSkillName(skill);
      optgroup.appendChild(opt);
    }
    skillSelect.appendChild(optgroup);
  }
  skillSelect.addEventListener("change", () => selectSkill(skillSelect.value));
}

function selectSkill(skill) {
  document.querySelectorAll(".skill-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.skill === skill);
  });
  skillSelect.value = skill;
  boardTitle.textContent = formatSkillName(skill);
  renderBoard(skill);
  try {
    localStorage.setItem("mc-leaderboard-skill", skill);
  } catch (e) { /* private browsing / storage disabled -- fine, just no memory */ }
  history.replaceState(null, "", `#${skill}`);
}

function renderBoard(skill) {
  const rows = (data && data.skills && data.skills[skill]) || [];
  boardBody.innerHTML = "";
  if (!rows.length) {
    boardTable.hidden = true;
    boardEmpty.hidden = false;
    return;
  }
  boardTable.hidden = false;
  boardEmpty.hidden = true;

  rows.forEach((row, i) => {
    const tr = document.createElement("tr");
    const rank = i + 1;
    if (rank <= 3) tr.classList.add(`rank-${rank}`);

    const tdRank = document.createElement("td");
    tdRank.className = "col-rank";
    tdRank.textContent = rank;

    const tdName = document.createElement("td");
    tdName.className = "col-name";
    tdName.textContent = row.name;

    const tdLevel = document.createElement("td");
    tdLevel.className = "col-level";
    tdLevel.textContent = `L${row.level}`;

    const tdXp = document.createElement("td");
    tdXp.className = "col-xp";
    tdXp.textContent = row.xp.toLocaleString();

    tr.append(tdRank, tdName, tdLevel, tdXp);
    boardBody.appendChild(tr);
  });
}

function formatMeta() {
  if (!data) return "";
  const generated = new Date(data.generated_at);
  const when = isNaN(generated) ? data.generated_at : generated.toLocaleString();
  return `${data.agent_count.toLocaleString()} agents tracked - updated ${when}`;
}

function tickCountdown() {
  if (!countdownEl || !nextUpdateAt) return;
  const diff = nextUpdateAt - Date.now();
  if (diff <= 0) {
    countdownEl.textContent = "Update due any moment";
    return;
  }
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  countdownEl.textContent = `Next update in ${mins}m ${String(secs).padStart(2, "0")}s`;
}

function startCountdown() {
  if (!data) return;
  const generated = new Date(data.generated_at);
  if (isNaN(generated)) return;
  nextUpdateAt = generated.getTime() + UPDATE_INTERVAL_MS;
  tickCountdown();
  setInterval(tickCountdown, 1000);
}

async function load() {
  try {
    const res = await fetch("data/leaderboards.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    meta.textContent = "Couldn't load leaderboard data.";
    return;
  }
  meta.textContent = formatMeta();
  startCountdown();
  buildNav();
  buildSelect();

  const fromHash = location.hash.replace("#", "");
  let saved = null;
  try {
    saved = localStorage.getItem("mc-leaderboard-skill");
  } catch (e) { /* ignore */ }
  const allSkills = SKILL_GROUPS.flatMap((g) => g.skills);
  const initial = allSkills.includes(fromHash) ? fromHash
                 : allSkills.includes(saved) ? saved
                 : "chemistry";
  selectSkill(initial);
}

load();
