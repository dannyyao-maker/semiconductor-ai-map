// 上課：一關一關的畫面播放。入口在「闖關」頁（點關卡），這裡不放清單。
// 網址：#/explore/intro（全景開場）、#/explore/ic-design/know.what（播放「認識」部分的「在做什麼」這一關）、
//       #/explore/<環節>/review（5 分鐘速複習；沒學過的環節是 30 秒速覽）
import { esc } from "../util.js";
import { state, save } from "../state.js";
import { renderScreen } from "../screens.js";
import { renderQuiz } from "../quiz.js";
import { runMatch } from "../match.js";
import { ic, levelIcon } from "../icons.js";

// ---- 進度 ----
const progress = (id) => (state().chapters[id] ||= { sections: {}, parts: {} });
function partUnlocked(ctx, ch, pi) {
  const part = ch.parts[pi];
  if (part.minRank && !ctx.game.difficultyUnlocked(rankLevel(ctx, part.minRank))) return false;
  // 前面的部分都完成才能開（財報部分可以跳過，不擋章末對局）
  return ch.parts.slice(0, pi).filter((p) => !p.minRank).every((p) => state().chapters[chId(ch)]?.parts?.[p.id]);
}
const chId = (ch) => ch.node || ch.id;
function rankLevel(ctx, rankId) {
  const lv = ctx.config.difficulty?.levels?.find((l) => l.minRank === rankId);
  return lv ? lv.level : 1;
}

export function mountExplore(root, ctx, initial) {
  let token = 0;
  const goPath = () => ctx.nav("/path");

  // ---- 播放一關 ----
  function play(ch, key, rv) {
    const id = chId(ch);
    const [pid, sid] = key.split(".");
    const pi = rv ? -1 : ch.parts.findIndex((p) => p.id === pid);
    const part = rv ? rv.part : ch.parts[pi];
    const sec = rv ? rv.sec : part?.sections.find((s) => s.id === sid);
    if (!rv && (!sec || !partUnlocked(ctx, ch, pi))) return goPath();
    const back = rv ? rv.back : "#/path";
    const icon = rv ? "bolt" : id === "intro" ? "globe" : levelIcon(sec.id, sec.match);

    root.innerHTML = `
      <div class="player">
        <div class="player-head">
          <a class="player-back" href="${esc(back)}" aria-label="離開">${ic("close")}</a>
          ${sec.match ? "" : `<div class="player-progress"><span></span></div>`}
          <span class="player-ic" title="${esc(sec.title)}">${ic(icon)}</span>
        </div>
        <div class="player-stage"></div>
        ${sec.match ? "" : `<div class="player-nav"><button class="pn-prev" type="button" data-prev aria-label="上一張">${ic("back")}</button><button class="pn-next" type="button" data-next disabled aria-label="下一步">${ic("play")}</button></div>`}
      </div>`;
    const stage = root.querySelector(".player-stage");

    if (sec.match) {
      runMatch(stage, ctx, {
        key: `${id}.${key}`, title: `${ch.title}・章末對局`, questions: sec.screens.filter((s) => s.type === "quiz"),
        onExit: (sum) => { if (sum) finishSection(ch, part, sec); else goPath(); },
      });
      return;
    }

    const bar = root.querySelector(".player-progress span");
    const next = root.querySelector("[data-next]");
    const prev = root.querySelector("[data-prev]");
    let i = 0;
    const show = () => {
      bar.style.width = `${((i + 1) / sec.screens.length) * 100}%`;
      prev.disabled = i === 0;
      next.disabled = true;
      const last = i === sec.screens.length - 1;
      next.innerHTML = ic(last ? "check" : "play");
      next.setAttribute("aria-label", last ? "完成這一關" : "下一步");
      next.classList.toggle("is-finish", last);
      const s = sec.screens[i];
      if (s.type === "quiz") {
        root.querySelector(".player-nav").hidden = true;
        const m = ctx.game.standing().tier.rank.match || {};
        renderQuiz(stage, s, ctx, { seconds: m.seconds || 0, label: "計分題", continueLabel: last ? "完成" : "繼續",
          onDone: () => { root.querySelector(".player-nav").hidden = false; step(); } });
      } else {
        root.querySelector(".player-nav").hidden = false;
        renderScreen(stage, s, ctx, () => { next.disabled = false; });
      }
      stage.scrollIntoView({ block: "nearest" });
    };
    const step = () => { if (i < sec.screens.length - 1) { i++; show(); } else if (rv) rv.onFinish(); else finishSection(ch, part, sec); };
    next.addEventListener("click", step);
    prev.addEventListener("click", () => { if (i > 0) { i--; show(); } });
    show();
  }

  function finishSection(ch, part, sec) {
    const id = chId(ch);
    const pr = progress(id);
    pr.sections[`${part.id}.${sec.id}`] = true;
    pr.at = Date.now();
    if (part.sections.every((s) => pr.sections[`${part.id}.${s.id}`])) pr.parts[part.id] = true;
    if (id === "intro") state().onboarded = true;
    // 記下「剛完成」哪一關，回到闖關頁時播動畫；整個單元完成就慶祝
    const unitDone = ch.parts.filter((p) => !p.minRank).every((p) => pr.parts[p.id]);
    state().justDone = { unit: id, key: `${part.id}.${sec.id}`, at: Date.now(), finalOfUnit: id !== "intro" && unitDone };
    save();
    goPath();
  }

  async function render(p) {
    const my = ++token;
    const [id, key] = p;
    if (!id) return goPath();
    if (key === "review") return review(id, my);
    if (id !== "intro") {
      const st = ctx.chapterState(id);
      if (st === "locked" || st === "soon") return goPath();
    }
    let ch;
    try { ch = await ctx.loadChapter(id); } catch (err) { root.innerHTML = `<p class="error">${esc(err.message)}</p>`; return; }
    if (my !== token) return;
    if (!ch) return goPath();
    if (id === "intro" && !key) return play(ch, "intro.journey");
    return key ? play(ch, key) : goPath();
  }

  // ---- 速覽／5 分鐘速複習：從環節卡的資料自動產生 7 張重點卡，學過的章節再加 3 題 ----
  async function review(id, my) {
    const n = ctx.nodeById[id];
    if (!n) return goPath();
    let ch = null;
    try { ch = await ctx.loadChapter(id); } catch { ch = null; }
    if (my !== token) return;
    const known = ctx.nodeProgress(id).known;
    const name = (x) => (x.node && ctx.nodeById[x.node]?.name) || "";
    const screens = [
      { type: "story", speaker: "一句話", text: n.oneLiner },
      { type: "story", speaker: "白話比喻", text: n.analogy },
      { type: "flow", title: "跟誰買、賣給誰", here: id, steps: [
        ...n.upstream.map((u) => ({ label: name(u) || "上游", note: u.text })),
        { label: n.name, node: id, note: "這一環" },
        ...n.downstream.map((d) => ({ label: name(d) || "下游", note: d.text })),
      ] },
      { type: "stat", title: "代表公司", items: n.companies.slice(0, 5).map((cid) => ctx.companyById[cid]).filter(Boolean)
        .map((c) => ({ label: c.name, value: c.nameEn, note: c.oneLiner })) },
      { type: "stat", title: "怎麼賺錢", items: [
        { label: "商業模式", value: "", note: n.business.model },
        { label: "利潤高低", value: "", note: n.business.margin },
        { label: "議價能力", value: "", note: n.business.bargainingPower } ] },
      n.issues[0] && { type: "story", speaker: "現在的挑戰", text: n.issues[0].text, sources: n.issues[0].sources },
      n.topics[0] && { type: "story", speaker: "熱門話題", text: n.topics[0].text, sources: n.topics[0].sources },
    ].filter(Boolean);
    if (known && ch) {
      const qs = ch.parts.flatMap((p) => p.sections.flatMap((s) => s.screens)).filter((x) => x.type === "quiz" && ctx.game.difficultyUnlocked(x.difficulty || 1));
      screens.push(...qs.map((q) => [Math.random(), q]).sort((a, b) => a[0] - b[0]).slice(0, 3).map((p) => p[1]));
    }
    const fake = ch || { id, title: n.name, parts: [] };
    play(fake, "review", {
      part: { id: "review", name: known ? "5 分鐘速複習" : "30 秒速覽" },
      sec: { id: "review", title: n.name, screens },
      back: `#/hq/${id}`,
      onFinish: () => {
        if (known) { progress(id).reviewAt = Date.now(); save(); }
        ctx.nav(`/hq/${id}`);
      },
    });
  }

  render(initial);
  return { update: render };
}
