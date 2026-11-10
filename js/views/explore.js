// 探索：章節清單、章節總覽、一節一節的畫面播放。
// 網址：#/explore（清單）、#/explore/intro（全景開場）、#/explore/ic-design（章節總覽）、
//       #/explore/ic-design/know.what（播放「認識」部分的「在做什麼」這一節）
import { esc, toast } from "../util.js";
import { state, save } from "../state.js";
import { renderScreen } from "../screens.js";
import { renderQuiz } from "../quiz.js";
import { runMatch } from "../match.js";

const STATE_TEXT = { locked: "🔒 尚未解鎖", soon: "內容製作中", open: "可以開始", started: "進行中", done: "✓ 完成" };
const cache = {};

async function loadChapter(ctx, id) {
  if (cache[id]) return cache[id];
  const file = id === "intro" ? "intro.json" : ctx.chapterIndex.chapters.find((c) => c.node === id)?.file;
  if (!file) return null;
  const res = await fetch(`data/chapters/${file}`);
  if (!res.ok) throw new Error(`讀不到章節 ${file}`);
  return (cache[id] = await res.json());
}

// ---- 進度 ----
const progress = (id) => (state().chapters[id] ||= { sections: {}, parts: {} });
const sectionDone = (id, key) => Boolean(state().chapters[id]?.sections?.[key]);
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

  function list() {
    const items = ctx.chapterList();
    const intro = state().onboarded;
    root.innerHTML = `
      <div class="view-head"><div><h1>探索</h1>
        <p class="muted">從 IC 設計出發，一章一章往相鄰的環節走。完成一章的「認識」，相鄰的環節就會解鎖。</p></div></div>
      <a class="chapter-item intro-item${intro ? " is-done" : ""}" href="#/explore/intro">
        <span class="ch-no">★</span>
        <div class="ch-body"><p class="ch-name">全景開場：一顆 AI 晶片的旅程</p>
          <p class="muted small">${intro ? "✓ 看過了，可以隨時重看" : "3 分鐘・不考試・先看全貌"}</p></div>
        <span class="btn">${intro ? "重看" : "開始"}</span></a>
      <ol class="chapter-list">
        ${items.map((c, i) => `
          <li class="chapter-item is-${c.state} zone-${esc(c.zone)}">
            <span class="ch-no">${i + 1}</span>
            <div class="ch-body">
              <p class="ch-name">${esc(c.name)} <span class="en">${esc(c.nameEn)}</span></p>
              <p class="muted small">${c.state === "locked" ? `先完成相鄰環節的「認識」：${esc(c.neighbors.join("、"))}` : esc(STATE_TEXT[c.state])}</p>
            </div>
            ${c.state === "locked" || c.state === "soon" ? `<span class="ch-state muted small">${esc(STATE_TEXT[c.state])}</span>`
              : `<a class="btn" href="#/explore/${esc(c.id)}">${c.state === "done" ? "複習" : c.state === "started" ? "繼續" : "開始"}</a>`}
          </li>`).join("")}
      </ol>`;
  }

  function overview(ch) {
    const id = chId(ch);
    const n = ctx.nodeById[id];
    const first = firstUnfinished(ch);
    root.innerHTML = `
      <div class="view-head"><div><p><a href="#/explore">← 探索</a></p>
        <h1>${esc(ch.title)}</h1><p class="muted">${esc(ch.tagline || "")}</p></div>
        ${n ? `<a class="btn" href="#/hq/${esc(id)}">在研究總部看完整卡片</a>` : ""}</div>
      ${first ? `<p><a class="btn primary" href="#/explore/${esc(id)}/${esc(first)}">${Object.keys(progress(id).sections).length ? "繼續" : "開始"}：${esc(sectionTitle(ch, first))}</a></p>` : `<p class="done-note">✓ 這一章完成了。可以重玩任何一節，或回研究總部複習。</p>`}
      <div class="parts">${ch.parts.map((p, pi) => {
        const open = partUnlocked(ctx, ch, pi);
        const done = state().chapters[id]?.parts?.[p.id];
        return `<section class="panel part ${open ? "" : "is-locked"}${done ? " is-done" : ""}">
          <h2 class="panel-title">${done ? "✓ " : open ? "" : "🔒 "}${esc(p.name)}</h2>
          ${p.minRank && !open ? `<p class="muted small">升到${esc(ctx.game.ranks.find((r) => r.id === p.minRank)?.name || "")}才會開放</p>` : ""}
          ${!open && !p.minRank ? `<p class="muted small">先完成前面的部分</p>` : ""}
          <ol class="section-list">${p.sections.map((s) => {
            const key = `${p.id}.${s.id}`;
            const sd = sectionDone(id, key);
            return `<li class="${sd ? "is-done" : ""}">${open ? `<a href="#/explore/${esc(id)}/${esc(key)}">${sd ? "✓ " : ""}${esc(s.title)}</a>` : `<span>${esc(s.title)}</span>`}
              <span class="muted small">${s.match ? "對局" : `${s.screens.length} 張`}</span></li>`;
          }).join("")}</ol></section>`;
      }).join("")}</div>`;
  }

  function firstUnfinished(ch) {
    const id = chId(ch);
    for (let pi = 0; pi < ch.parts.length; pi++) {
      if (!partUnlocked(ctx, ch, pi)) continue;
      for (const s of ch.parts[pi].sections) {
        const key = `${ch.parts[pi].id}.${s.id}`;
        if (!sectionDone(id, key)) return key;
      }
    }
    return null;
  }
  const sectionTitle = (ch, key) => {
    const [pid, sid] = key.split(".");
    return ch.parts.find((p) => p.id === pid)?.sections.find((s) => s.id === sid)?.title || "";
  };

  // ---- 播放一節 ----
  function play(ch, key, rv) {
    const id = chId(ch);
    const [pid, sid] = key.split(".");
    const pi = rv ? -1 : ch.parts.findIndex((p) => p.id === pid);
    const part = rv ? rv.part : ch.parts[pi];
    const sec = rv ? rv.sec : part?.sections.find((s) => s.id === sid);
    if (!rv && (!sec || !partUnlocked(ctx, ch, pi))) return overview(ch);
    const back = rv ? rv.back : id === "intro" ? "#/explore" : `#/explore/${id}`;

    root.innerHTML = `
      <div class="player">
        <div class="player-head">
          <a class="player-back" href="${esc(back)}" aria-label="離開">✕</a>
          <div class="player-title"><p class="muted small">${esc(ch.title)}・${esc(part.name)}</p><p><b>${esc(sec.title)}</b></p></div>
        </div>
        ${sec.match ? "" : `<div class="player-progress"><span></span></div>`}
        <div class="player-stage panel"></div>
        ${sec.match ? "" : `<div class="player-nav"><button class="btn" data-prev>上一張</button><button class="btn primary" data-next disabled>下一步</button></div>`}
      </div>`;
    const stage = root.querySelector(".player-stage");

    if (sec.match) {
      runMatch(stage, ctx, {
        key: `${id}.${key}`, title: `${ch.title}・章末對局`, questions: sec.screens.filter((s) => s.type === "quiz"),
        onExit: (sum) => { if (sum) finishSection(ch, part, sec, sum); else ctx.nav(`/explore/${id}`); },
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
      next.textContent = i === sec.screens.length - 1 ? "完成這一節" : "下一步";
      const s = sec.screens[i];
      if (s.type === "quiz") {
        root.querySelector(".player-nav").hidden = true;
        const m = ctx.game.standing().tier.rank.match || {};
        renderQuiz(stage, s, ctx, { seconds: m.seconds || 0, label: "計分題", continueLabel: i === sec.screens.length - 1 ? "完成這一節" : "下一步",
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

  function finishSection(ch, part, sec, sum) {
    const id = chId(ch);
    const pr = progress(id);
    pr.sections[`${part.id}.${sec.id}`] = true;
    pr.at = Date.now();
    const partDone = part.sections.every((s) => pr.sections[`${part.id}.${s.id}`]);
    const firstTime = partDone && !pr.parts[part.id];
    if (partDone) pr.parts[part.id] = true;
    if (id === "intro") state().onboarded = true;
    save();

    if (id === "intro") return ctx.nav(`/explore/${ctx.chapterIndex.start}`);
    if (firstTime && part.id === "know") {
      const unlocked = ctx.chapterList().filter((c) => c.state !== "locked" && c.id !== id).map((c) => c.name);
      toast(`完成「認識」！地圖上的${ctx.nodeById[id].name}亮起來了${unlocked.length ? `，解鎖：${unlocked.join("、")}` : ""}`);
    } else if (firstTime && part.id === "final") {
      toast(`🎉 ${ctx.nodeById[id].name} 這一章完成了！研究總部的地圖已打勾`);
    } else toast(`✓ 完成：${sec.title}`);
    const nextKey = firstUnfinished(ch);
    ctx.nav(nextKey && !sum ? `/explore/${id}/${nextKey}` : `/explore/${id}`);
  }

  async function render(p) {
    const my = ++token;
    const [id, key] = p;
    if (!id) return list();
    if (key === "review") return review(id, my);
    if (id !== "intro") {
      const st = ctx.chapterState(id);
      if (st === "locked" || st === "soon") return list();
    }
    let ch;
    try { ch = await loadChapter(ctx, id); } catch (err) { root.innerHTML = `<p class="error">${esc(err.message)}</p>`; return; }
    if (my !== token) return;
    if (!ch) return list();
    if (id === "intro" && !key) return play(ch, "intro.journey");
    return key ? play(ch, key) : overview(ch);
  }

  // ---- 速覽／5 分鐘速複習：從環節卡的資料自動產生 7 張重點卡，學過的章節再加 3 題 ----
  async function review(id, my) {
    const n = ctx.nodeById[id];
    if (!n) return list();
    let ch = null;
    try { ch = await loadChapter(ctx, id); } catch { ch = null; }
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
        if (known) { progress(id).reviewAt = Date.now(); save(); toast(`⚡ 複習完成：${n.name}`); }
        else toast(`看完了「${n.name}」的速覽`);
        ctx.nav(`/hq/${id}`);
      },
    });
  }

  render(initial);
  return { update: render };
}
