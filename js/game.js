// 遊戲規則：盃數、段位、連續天數。數字設定在 data/game.json。
//
// 段位仿荒野亂鬥（Brawl Stars）的排位賽：
// - 8 個段位，前 7 個各分 3 階，PRO 單獨一階，共 22 階
// - 前期答對加很多、答錯扣很少；越後期加得越少、扣得越多
// - 盃數不會掉出已經達到的大段位
// 連續天數仿 Duolingo：當天完成至少一題計分題才算，斷一天就歸零。
import { state, save } from "./state.js";
import { esc } from "./util.js";

const ROMAN = ["I", "II", "III"];

export function makeGame(cfg) {
  const ranks = cfg.ranks;
  const tz = cfg.streak?.timeZone || "Asia/Taipei";
  const milestones = cfg.streak?.milestones || [];

  // 把 8 個段位攤平成 22 階
  const tiers = [];
  ranks.forEach((r, ri) => r.tiers.forEach((from, ti) => tiers.push({
    rank: r, ri, ti, from,
    label: r.tiers.length > 1 ? `${r.name} ${ROMAN[ti]}` : r.name,
  })));
  tiers.forEach((t, i) => { t.index = i; t.to = tiers[i + 1]?.from ?? null; });

  const tierOf = (trophies) => {
    let t = tiers[0];
    for (const x of tiers) if (trophies >= x.from) t = x;
    return t;
  };
  /** 不會掉出的地板：曾經到過的大段位的起始盃數 */
  const floorOf = (peak) => ranks[tierOf(peak).ri].tiers[0];
  const rankIndex = (id) => ranks.findIndex((r) => r.id === id);

  // ---- 連續天數 ----
  const dayKey = (date = new Date()) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const addDays = (key, n) => {
    const d = new Date(key + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  /** 目前的連續天數：昨天或今天有完成才算，否則已經歸零 */
  function streakNow() {
    const { count, last } = state().streak;
    const today = dayKey();
    const alive = last === today || last === addDays(today, -1);
    return { count: alive ? count : 0, doneToday: last === today, double: state().streak.doubleDay === today };
  }

  /** 完成一題計分題時呼叫：今天第一次完成就加一天 */
  function bumpStreak() {
    const st = state().streak;
    const today = dayKey();
    if (st.last === today) return { milestone: null };
    st.count = st.last === addDays(today, -1) ? st.count + 1 : 1;
    st.last = today;
    const m = milestones.find((x) => x.days === st.count) || null;
    if (m?.reward === "double") st.doubleDay = today;
    return { milestone: m };
  }

  // ---- 作答 ----
  /** 這個難度的題目，目前的段位能不能出 */
  function difficultyUnlocked(level) {
    const d = cfg.difficulty?.levels?.find((x) => x.level === level);
    if (!d) return true;
    return tierOf(state().trophies).ri >= rankIndex(d.minRank);
  }

  /** 預覽：現在答對、答錯各會加減多少 */
  function preview(mult = 1) {
    const s = state();
    const r = tierOf(s.trophies).rank;
    const double = streakNow().double;
    const win = r.win * (double ? 2 : 1) * mult;
    const loss = Math.min(r.loss, s.trophies - floorOf(s.peak));
    return { win, loss: Math.max(0, loss), double };
  }

  /**
   * 回答一題計分題。同一題只有第一次作答會加減盃數，之後是練習。
   * mult：答對時盃數的倍數（每局最後一題是 2 倍）。
   * 回傳加減的盃數、段位變化和連續天數的變化，給畫面顯示用。
   */
  function answer(qid, correct, mult = 1) {
    const s = state();
    if (s.answers[qid]) return { practice: true, correct };
    const before = tierOf(s.trophies);
    const streakBefore = streakNow().count;
    const { milestone } = bumpStreak();
    const r = before.rank;
    const double = s.streak.doubleDay === dayKey();
    const raw = correct ? r.win * (double ? 2 : 1) * mult : -r.loss;
    const next = Math.max(floorOf(s.peak), s.trophies + raw);
    const d = next - s.trophies;
    s.trophies = next;
    s.peak = Math.max(s.peak, next);
    const at = Date.now();
    s.answers[qid] = { ok: correct, at, d };
    s.history.push({ at, qid, d, t: next });
    if (s.history.length > 500) s.history.splice(0, s.history.length - 500);
    save();
    const after = tierOf(next);
    return {
      practice: false, correct, d, double, mult,
      before, after,
      tierUp: after.index > before.index,
      rankUp: after.ri > before.ri,
      tierDown: after.index < before.index,
      floored: !correct && raw < 0 && d > raw,
      streak: streakNow().count, streakUp: streakNow().count > streakBefore, milestone,
    };
  }

  /** 目前的段位與這一階的進度（給進度條用） */
  function standing() {
    const s = state();
    const t = tierOf(s.trophies);
    const span = t.to == null ? null : t.to - t.from;
    return {
      tier: t, trophies: s.trophies,
      progress: span ? (s.trophies - t.from) / span : 1,
      toNext: t.to == null ? null : t.to - s.trophies,
      next: tiers[t.index + 1] || null,
      floor: floorOf(s.peak),
    };
  }

  return { ranks, tiers, tierOf, floorOf, standing, preview, answer, streakNow, difficultyUnlocked, dayKey };
}

/** 段位徽章：盾牌形狀，顏色依段位 */
export function rankBadge(tier, size = "md") {
  const r = tier.rank;
  const roman = r.tiers.length > 1 && tier.ti != null ? ROMAN[tier.ti] : "";
  return `<span class="rank-badge rank-${esc(r.id)} size-${size}" style="--rank:${esc(r.color)}" title="${esc(tier.label)}" aria-label="段位：${esc(tier.label)}">
    <span class="rank-shield"><i>${esc(r.icon || "★")}</i>${roman ? `<b>${roman}</b>` : ""}</span></span>`;
}
