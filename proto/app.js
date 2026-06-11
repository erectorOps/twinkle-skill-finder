/* ==================================================
   TSF app — detail-search prototype
================================================== */
(function () {
  const { taxonomy: TAX, effectTypes: ETYPES, presets: PRESETS,
          specialsAlly: SP_ALLY, specialsEnemy: SP_ENEMY, positions: POSITIONS, skills: SKILLS } = window.TSF;
  const ALL_SPECIALS = SP_ALLY.concat(SP_ENEMY);
  const TAG_CATS = ["attr", "race", "role", "weapon", "affiliation", "ailment"]; // 全タグカテゴリ
  const ALLY_TAGS = ["attr", "race", "role", "weapon", "affiliation"];
  const ENEMY_TAGS = ["ailment"];
  const TAG_LABEL = { attr: "属性", race: "種族", role: "役割", weapon: "武器", affiliation: "所属", ailment: "状態異常" };
  const ICON_ONLY = new Set(["attr", "role"]); // アイコンのみ表示するタグ
  // 陣営ごとの対象タグ / 特殊条件
  const tagsFor = (camp) => camp === "enemy" ? ENEMY_TAGS : camp === "self" ? [] : ALLY_TAGS;
  const specialsFor = (camp) => camp === "enemy" ? SP_ENEMY : camp === "self" ? [] : SP_ALLY;

  const byId = (arr, id) => arr.find((x) => String(x.id) === String(id));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const optInner = (catKey, o) => {
    const img = o.icon ? `<img src="${o.icon}" alt="${esc(o.label)}">` : "";
    return ICON_ONLY.has(catKey) ? img : img + esc(o.short || o.label);
  };
  const isLive = (c) => c.cat || TAG_CATS.some((t) => c[t]) || (c.specials && c.specials.length) || c.position || c.ref.src !== "none";
  let _uid = 0;
  const uid = () => "c" + ++_uid;

  /* ---------------- state ---------------- */
  const state = {
    mode: "detail",
    keyword: "",
    ex: "all",
    catSel: new Set(),       // category mode selections
    facets: { rarity: new Set(), attr: new Set(), race: new Set(), role: new Set(), weapon: new Set(), affiliation: new Set() },
    conditions: [],          // detail mode condition cards
    editing: null,           // condition id currently expanded
    openFacets: new Set(),
  };

  function newCond() {
    return {
      id: uid(), cat: null, camp: "ally", scope: "all", position: null,
      attr: null, race: null, role: null, weapon: null, affiliation: null, ailment: null,
      specials: [],
      ref: { src: "none", attr: null, race: null, role: null, weapon: null, affiliation: null, ailment: null, specials: [] },
      refOpen: false,
    };
  }

  /* ---------------- natural-language echo ---------------- */
  function tagText(cond) {
    const parts = [];
    if (cond.position) parts.push(`<span class="t-attr">${esc(byId(POSITIONS, cond.position).label)}</span>`);
    for (const c of TAG_CATS) {
      if (cond[c]) parts.push(`<span class="t-attr">${esc(byId(TAX[c], cond[c]).label)}</span>`);
    }
    for (const s of (cond.specials || [])) parts.push(`<span class="t-attr">${esc((byId(ALL_SPECIALS, s) || {}).short || s)}</span>`);
    return parts;
  }
  // ABBREV_SCOPE を true にすると「味方全体」→「味方」などに省略（文言は一箇所で切替）
  const ABBREV_SCOPE = false;
  function campScopeText(cond) {
    if (cond.camp === "self") return "自身";
    const campLabel = cond.camp === "enemy" ? "敵" : "味方";
    const sc = byId(TAX.scope, cond.scope);
    if (cond.scope === "any" || !sc) return campLabel;
    if (ABBREV_SCOPE && cond.scope === "all") return campLabel;
    return campLabel + sc.label;
  }
  function campShort(cond) { return cond.camp === "self" ? "自身" : cond.camp === "enemy" ? "敵" : "味方"; }
  function refText(cond) {
    if (cond.ref.src === "none") return "";
    const tags = TAG_CATS.filter((c) => cond.ref[c]).map((c) => byId(TAX[c], cond.ref[c]).label)
      .concat((cond.ref.specials || []).map((s) => (byId(ALL_SPECIALS, s) || {}).short || s)).join("・");
    const srcLabel = cond.ref.src === "ally" ? "味方" : cond.ref.src === "enemy" ? "敵" : "種類";
    const body = (tags ? tags + "の" : "") + srcLabel + (cond.ref.src === "kind" ? "数" : "の数");
    return `<span class="ref">（参照: <b>${esc(body)}</b>）</span>`;
  }
  // カードのサマリは「対象のみ」。効果は左のタグpillで、全文は detail-foot で確認できる。
  function echoHTML(cond) {
    const tags = tagText(cond);
    const tjoin = tags.join('<span class="kw-and">かつ</span>');
    const target = tags.length
      ? `${tjoin} の <span class="scope">${esc(campScopeText(cond))}</span>`
      : `<span class="scope">${esc(campScopeText(cond))}</span>`;
    return `${target} ${refText(cond)}`;
  }

  /* ---------------- matching engine ---------------- */
  function branchSatisfies(effect, branch, cond) {
    if (cond.camp && branch.camp !== ({ self: "自身", ally: "味方", enemy: "敵" }[cond.camp])) return false;
    if (cond.scope && cond.scope !== "any" && cond.camp !== "self") {
      if (branch.scope !== cond.scope) return false;
    }
    if (cond.position && branch.position !== cond.position) return false;
    for (const c of TAG_CATS) {
      if (cond[c] && String(branch[c] || "") !== String(cond[c])) return false;
    }
    if (cond.specials && cond.specials.length) {
      const bs = branch.specials || [];
      if (!cond.specials.every((s) => bs.includes(s))) return false;
    }
    return true;
  }
  function effectMatchesCat(effect, cond) {
    if (cond.cat && effect.cat !== cond.cat) return false;
    if (cond.ref.src !== "none") {
      if (!effect.ref || effect.ref.src !== cond.ref.src) return false;
      for (const c of TAG_CATS) {
        if (cond.ref[c] && String(effect.ref[c] || "") !== String(cond.ref[c])) return false;
      }
      const rs = cond.ref.specials || [];
      if (rs.length && !rs.every((s) => (effect.ref.specials || []).includes(s))) return false;
    }
    return true;
  }
  // candidate branch-instance keys for a condition across a skill
  function candidates(skill, cond) {
    const keys = [];
    skill.effects.forEach((e, ei) => {
      if (!effectMatchesCat(e, cond)) return;
      (e.target || []).forEach((b, bi) => {
        if (branchSatisfies(e, b, cond)) keys.push(ei + ":" + bi);
      });
    });
    return keys;
  }
  // bipartite: each condition → distinct branch instance
  function detailMatch(skill, conds) {
    const cand = conds.map((c) => candidates(skill, c));
    if (cand.some((k) => k.length === 0)) return false;
    const assign = {}; // branchKey -> condIndex
    const tryAssign = (i, seen) => {
      for (const k of cand[i]) {
        if (seen.has(k)) continue;
        seen.add(k);
        if (assign[k] === undefined || tryAssign(assign[k], seen)) {
          assign[k] = i; return true;
        }
      }
      return false;
    };
    for (let i = 0; i < cand.length; i++) {
      if (!tryAssign(i, new Set())) return false;
    }
    return true;
  }

  function presetEtypes() {
    const ets = new Set();
    state.catSel.forEach((pid) => { const pr = byId(PRESETS, pid); if (pr) pr.match.forEach((m) => ets.add(m)); });
    return ets;
  }

  function skillMatches(skill) {
    // keyword
    if (state.keyword) {
      const kw = state.keyword.toLowerCase();
      const hay = [skill.name, skill.char.name, skill.char.unit,
        ...skill.effects.map((e) => e.type + " " + e.value)].join(" ").toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    // EX
    if (state.ex !== "all") {
      const t = skill.type.toLowerCase();
      if (state.ex === "ex1" && !t.startsWith("ex1")) return false;
      if (state.ex === "ex2" && !t.startsWith("ex2")) return false;
      if (state.ex === "awaken" && !t.endsWith("+")) return false;
    }
    // character facets (between-group AND, within-group OR)
    const f = state.facets;
    if (f.rarity.size && !f.rarity.has(String(skill.rarity))) return false;
    for (const c of ["attr", "race", "role", "weapon", "affiliation"]) {
      const key = c === "attr" ? skill.char.attr : c === "race" ? skill.char.race : c === "role" ? skill.char.role : c === "weapon" ? skill.char.weapon : skill.char.aff;
      if (f[c].size && !f[c].has(String(key))) return false;
    }
    // effect (mode-specific)
    if (state.mode === "category") {
      if (state.catSel.size) {
        const ets = presetEtypes();
        if (!skill.effects.some((e) => ets.has(e.cat))) return false;
      }
    } else {
      const live = state.conditions.filter(isLive);
      if (live.length && !detailMatch(skill, live)) return false;
    }
    return true;
  }

  function matchedEffectIds(skill) {
    // which effects to highlight
    const out = new Set();
    if (state.mode === "category" && state.catSel.size) {
      const ets = presetEtypes();
      skill.effects.forEach((e, i) => { if (ets.has(e.cat)) out.add(i); });
    } else if (state.mode === "detail") {
      const live = state.conditions.filter(isLive);
      live.forEach((c) => candidates(skill, c).forEach((k) => out.add(+k.split(":")[0])));
    }
    return out;
  }

  /* ---------------- render: results ---------------- */
  function rarityStars(n) {
    let s = "";
    for (let i = 1; i <= 3; i++) s += `<img class="${i <= n ? "" : "empty"}" src="${TSF.P}${i <= n ? "rare" : "rare_slot"}.png" alt="">`;
    return s;
  }
  function exClass(type) {
    return { "EX1": "ex1", "EX2": "ex2", "EX1+": "ex1-plus", "EX2+": "ex2-plus" }[type] || "ex1";
  }
  function effectTargetText(e) {
    if (!e.target || !e.target.length) return "";
    return e.target.map((b) => {
      const labels = [];
      if (b.position) labels.push(byId(POSITIONS, b.position).label);
      TAG_CATS.forEach((c) => { if (b[c]) labels.push(byId(TAX[c], b[c]).label); });
      (b.specials || []).forEach((s) => labels.push((byId(ALL_SPECIALS, s) || {}).short || s));
      const camp = b.camp + (b.scope && b.scope !== "自身" && TAX.scope.find((s) => s.id === b.scope) ? byId(TAX.scope, b.scope).label : "");
      return (labels.length ? labels.join("・") + "の" : "") + camp;
    }).join(" または ");
  }
  function renderResults() {
    const list = SKILLS.filter(skillMatches);
    document.getElementById("count").textContent = list.length;
    const host = document.getElementById("results");
    if (!list.length) {
      host.innerHTML = `<div class="results-empty">該当するスキルがありません<br><span style="font-size:12px;font-weight:400">条件をゆるめてください</span></div>`;
      return;
    }
    host.innerHTML = list.map((sk) => {
      const mh = matchedEffectIds(sk);
      const role = byId(TAX.role, sk.char.role), attr = byId(TAX.attr, sk.char.attr);
      return `
      <div class="skill-card">
        <div class="skill-header">
          <div class="skill-badges">
            <div class="icon-stack"><img class="icon-base" src="${TSF.P}attribute_base.png" alt=""><img class="icon-main" src="${role.icon}" alt="${esc(role.label)}"></div>
            <div class="icon-stack"><img class="icon-base" src="${TSF.P}attribute_base.png" alt=""><img class="icon-main" src="${attr.icon}" alt="${esc(attr.label)}"></div>
          </div>
          <div class="skill-type ${exClass(sk.type)}">${esc(sk.type)}スキル</div>
          <div class="skill-name">${esc(sk.name)}</div>
          <div class="skill-sub">
            <span class="card-rarity">${rarityStars(sk.rarity)}</span>
            <span class="cost-label">消費EX</span><span class="cost-value">${sk.cost}</span>
          </div>
        </div>
        <div class="effect-list">
          ${sk.effects.map((e, i) => `
            <div class="effect-box ${e.klass || (byId(ETYPES, e.cat) || {}).klass || "main"} ${mh.has(i) ? "matched" : ""}">
              <div class="effect-top">
                <span class="effect-name">${esc(e.type)}${e.dur ? ` <span class="effect-target" style="color:#8ec7ff">${e.dur}T</span>` : ""}</span>
                <span class="effect-target">${esc(effectTargetText(e))}</span>
              </div>
              <div class="effect-value">${esc(e.value)}</div>
              ${e.ref ? `<div class="effect-formula">└ 参照: ${esc((TAG_CATS.filter((c) => e.ref[c]).map((c) => byId(TAX[c], e.ref[c]).label).join("・")))}${e.ref.attr ? "属性" : ""}の${e.ref.src === "ally" ? "味方" : "敵"}数</div>` : ""}
            </div>`).join("")}
        </div>
        <div class="skill-footer">[${esc(sk.char.unit)}] ${esc(sk.char.name)}</div>
      </div>`;
    }).join("");
  }

  /* ---------------- render: tag rows in builder ---------------- */
  function tagRow(cond, cat, scope) {
    // scope: 'tag' (cond[cat]) or 'ref' (cond.ref[cat])
    const cur = scope === "ref" ? cond.ref[cat] : cond[cat];
    const opts = TAX[cat].map((o) => {
      const active = String(cur) === String(o.id);
      const style = cat === "attr" && active ? ` style="color:${o.color}"` : "";
      return `<button class="tg ${cat} ${ICON_ONLY.has(cat) ? "icon-only" : ""} ${active ? "active" : ""}" data-act="tag" data-scope="${scope}" data-cat="${cat}" data-val="${o.id}" title="${esc(o.label)}"${style}>${optInner(cat, o)}</button>`;
    }).join("");
    return `<div class="b-tagrow"><span class="tg-name">${TAG_LABEL[cat]}</span><div class="btn-row">${opts}</div></div>`;
  }

  function specialsUI(obj, scopeKey, camp) {
    const list = specialsFor(camp);
    if (!list.length) return "";
    const sel = obj.specials || [];
    const chips = sel.map((s) => {
      const def = byId(ALL_SPECIALS, s);
      return `<button class="tg active sp" data-act="special-del" data-scope="${scopeKey}" data-val="${s}" title="解除">${esc(def ? def.short : s)} <i class="bi bi-x"></i></button>`;
    }).join("");
    const opts = list.filter((sp) => !sel.includes(sp.id)).map((sp) => `<option value="${sp.id}">${esc(sp.label)}</option>`).join("");
    return `<div class="b-tagrow"><span class="tg-name">特殊</span><div class="btn-row">${chips}<select class="sp-select" data-act="special" data-scope="${scopeKey}"><option value="">＋ 追加…</option>${opts}</select></div></div>`;
  }

  function builderHTML(cond) {
    const sel = tagsFor(cond.camp);
    const tagCount = sel.filter((c) => cond[c]).length + (cond.specials ? cond.specials.length : 0);
    const tagLabels = sel.filter((c) => cond[c]).map((c) => byId(TAX[c], cond[c]).label)
      .concat((cond.specials || []).map((s) => (byId(ALL_SPECIALS, s) || {}).short || s));
    const refSel = (cond.ref.src === "ally" || cond.ref.src === "enemy") ? tagsFor(cond.ref.src) : [];
    return `
    <div class="builder" data-cid="${cond.id}">
      <div class="b-block">
        <div class="b-label">効果</div>
        <select class="b-select" data-act="cat">
          <option value="">効果を選択…</option>
          ${ETYPES.map((c) => `<option value="${c.id}" ${cond.cat === c.id ? "selected" : ""}>${esc(c.label)}</option>`).join("")}
        </select>
      </div>

      <div class="b-block">
        <div class="b-label">対象 <span class="b-sub" style="margin:0 0 0 4px">— 誰に効くか</span></div>
        <div class="seg" style="margin-bottom:8px">
          ${TAX.camp.map((c) => `<button class="${cond.camp === c.id ? "active" : ""}" data-act="camp" data-val="${c.id}">${esc(c.label)}</button>`).join("")}
        </div>
        ${cond.camp === "self" ? "" : `
        <div class="btn-row">
          <button class="tg ${cond.scope === "any" ? "active" : ""}" data-act="scope" data-val="any">指定なし</button>
          ${TAX.scope.map((s) => `<button class="tg ${cond.scope === s.id ? "active" : ""}" data-act="scope" data-val="${s.id}">${esc(s.label)}</button>`).join("")}
        </div>
        ${cond.scope === "single" ? `
        <select class="b-select" style="margin-top:8px" data-act="position">
          <option value="">位置・一番（任意）</option>
          ${POSITIONS.map((p) => `<option value="${p.id}" ${cond.position === p.id ? "selected" : ""}>${esc(p.label)}</option>`).join("")}
        </select>` : ""}`}
      </div>

      ${sel.length ? `
      <div class="b-block">
        <div class="b-label">対象タグ <span class="b-sub" style="margin:0 0 0 4px">— 重ねると「かつ」（例: 光属性の人間）</span></div>
        <div class="b-tags">
          ${sel.map((c) => tagRow(cond, c, "tag")).join("")}
          ${specialsUI(cond, "tag", cond.camp)}
        </div>
      </div>` : ""}

      ${tagCount >= 2 ? `
      <div class="union-hint">
        <i class="bi bi-info-circle-fill"></i>
        <span>この条件は「${esc(tagLabels.join("の"))}の${campShort(cond)}」を探します。「または」で探すなら分割して下さい。</span>
        <button data-act="split">またはに分割</button>
      </div>` : ""}

      <button class="ref-toggle ${cond.refOpen ? "open" : ""} ${cond.ref.src !== "none" ? "has-ref" : ""}" data-act="ref-toggle">
        <i class="bi bi-bullseye"></i> 参照元（◯◯の数 × 威力）${cond.ref.src !== "none" ? "・設定中" : "<span class='b-sub' style='margin:0'>任意</span>"}
        <i class="bi bi-chevron-right chev"></i>
      </button>
      <div class="ref-body ${cond.refOpen ? "open" : ""}">
        <div class="b-block" style="margin-top:0">
          <div class="b-label">参照する数</div>
          <div class="seg">
            ${TAX.ref.map((r) => `<button class="${cond.ref.src === r.id ? "active" : ""}" data-act="ref-src" data-val="${r.id}">${esc(r.label)}</button>`).join("")}
          </div>
        </div>
        ${refSel.length ? `
        <div class="b-block">
          <div class="b-label">参照タグ <span class="b-sub" style="margin:0 0 0 4px">どんな${cond.ref.src === "ally" ? "味方" : "敵"}を数えるか</span></div>
          <div class="b-tags">
            ${refSel.map((c) => tagRow(cond, c, "ref")).join("")}
            ${specialsUI(cond.ref, "ref", cond.ref.src)}
          </div>
        </div>` : ""}
      </div>

      <div class="b-actions">
        <button class="btn-ghost" data-act="delete">削除</button>
        <button class="btn-primary" data-act="done">この条件を確定</button>
      </div>
    </div>`;
  }

  /* ---------------- render: detail pane ---------------- */
  function liveConds() {
    return state.conditions.filter(isLive);
  }
  function detailPaneHTML() {
    const cards = state.conditions.map((cond, i) => {
      const expanded = state.editing === cond.id;
      const divider = i > 0 ? `<div class="and-divider"><span>かつ</span></div>` : "";
      return divider + `
        <div class="cond-card">
          <div class="cond-summary" data-act="expand" data-cid="${cond.id}">
            <span class="cond-effect-tag">${cond.cat ? esc(byId(ETYPES, cond.cat).label) : "効果未指定"}</span>
            <span class="cond-echo">${echoHTML(cond)}</span>
            <span class="cond-actions">
              <button class="icon-btn" data-act="expand" data-cid="${cond.id}" title="編集"><i class="bi bi-pencil"></i></button>
              <button class="icon-btn del" data-act="delete" data-cid="${cond.id}" title="削除"><i class="bi bi-trash3"></i></button>
            </span>
          </div>
          ${expanded ? builderHTML(cond) : ""}
        </div>`;
    }).join("");

    const live = liveConds();
    const queryPreview = live.length
      ? live.map((c) => `「${plain(c)}」`).join('<span class="kw-and"> かつ </span>')
      : "<span class='q'>すべてのスキル</span>";

    return `
      <div class="detail-intro">
        <div class="intro-row"><span class="ok">✅</span><div><b>光属性・人間</b>（1つの条件に重ねる）<br><span class="arrow">→</span>「光属性の人間の味方」が対象</div></div>
        <div class="intro-row"><span class="ok">✅</span><div><b>光属性 ＋ 人間</b>（条件を分けて）<br><span class="arrow">→</span>「光属性の味方」対象の効果と「人間の味方」対象の効果を<b>両方持つ</b>スキル</div></div>
      </div>
      <div class="cond-list">${cards}</div>
      <button class="add-group" data-act="add">
        <i class="bi bi-plus-lg"></i> 条件を追加
      </button>
      <div class="detail-foot">
        <i class="bi bi-funnel-fill" style="color:var(--accent)"></i>
        <span class="q">${live.length}件の条件</span>：${queryPreview} を含むスキル
      </div>`;
  }
  function plain(cond) {
    const labels = [];
    if (cond.position) labels.push(byId(POSITIONS, cond.position).label);
    TAG_CATS.forEach((c) => { if (cond[c]) labels.push(byId(TAX[c], cond[c]).label); });
    (cond.specials || []).forEach((s) => labels.push((byId(ALL_SPECIALS, s) || {}).short || s));
    const tags = labels.join("かつ");
    const cs = campScopeText(cond);
    const eff = cond.cat ? byId(ETYPES, cond.cat).label : "効果未指定";
    return (tags ? tags + "の" : "") + cs + "に" + eff;
  }

  /* ---------------- render: category pane ---------------- */
  function categoryPaneHTML() {
    return `<div class="cat-grid">
      ${PRESETS.map((c) => `<button class="cat-chip ${state.catSel.has(c.id) ? "active" : ""}" data-act="catchip" data-id="${c.id}">${esc(c.label)}</button>`).join("")}
    </div>`;
  }

  /* ---------------- render: facets ---------------- */
  const FACET_DEFS = [
    { key: "rarity", label: "レアリティ", icon: "bi-star", opts: [{ id: "3", label: "★3" }, { id: "2", label: "★2" }, { id: "1", label: "★1" }] },
    { key: "attr", label: "属性", icon: "bi-droplet", opts: TAX.attr },
    { key: "race", label: "種族", icon: "bi-people", opts: TAX.race },
    { key: "role", label: "役割", icon: "bi-shield", opts: TAX.role },
    { key: "weapon", label: "武器", icon: "bi-hammer", opts: TAX.weapon },
    { key: "affiliation", label: "所属", icon: "bi-flag", opts: TAX.affiliation },
  ];
  function facetsHTML() {
    return FACET_DEFS.map((f) => {
      const open = state.openFacets.has(f.key);
      const n = state.facets[f.key].size;
      return `<div class="facet ${open ? "open" : ""}">
        <button class="facet-head" data-act="facet-toggle" data-key="${f.key}">
          <i class="bi ${f.icon}" style="color:var(--sub)"></i> ${f.label}
          ${n ? `<span class="facet-count">${n}</span>` : ""}
          <i class="bi bi-chevron-right chev"></i>
        </button>
        <div class="facet-body">
          <div class="btn-row">
            ${f.opts.map((o) => {
              const inner = f.key === "rarity" ? `<span class="card-rarity">${rarityStars(+o.id)}</span>` : optInner(f.key, o);
              return `<button class="pill ${ICON_ONLY.has(f.key) ? "icon-only" : ""} ${f.key === "rarity" ? "rarity-pill" : ""} ${state.facets[f.key].has(String(o.id)) ? "active" : ""}" data-act="facet" data-key="${f.key}" data-id="${o.id}" title="${esc(o.label)}">${inner}</button>`;
            }).join("")}
          </div>
        </div>
      </div>`;
    }).join("");
  }

  /* ---------------- render: dock ---------------- */
  function renderDock() {
    document.getElementById("dock-scroll").innerHTML = `
      <div class="filter-group">
        <div class="filter-title"><i class="bi bi-search"></i> キーワード</div>
        <div class="search-box">
          <i class="bi bi-search"></i>
          <input id="kw" type="search" placeholder="キャラ名・スキル名・効果" value="${esc(state.keyword)}" autocomplete="off">
        </div>
      </div>

      <div class="filter-group">
        <div class="filter-title">粒度</div>
        <div class="seg">
          <button class="active" data-act="noop">スキル単位</button>
          <button data-act="noop">キャラ単位</button>
        </div>
      </div>

      <div class="filter-group">
        <div class="filter-title">EXスキル</div>
        <div class="seg">
          ${[["all", "全て"], ["ex1", "EX1"], ["ex2", "EX2"], ["awaken", "覚醒"]].map(([v, l]) => `<button class="${state.ex === v ? "active" : ""}" data-act="ex" data-val="${v}">${l}</button>`).join("")}
        </div>
      </div>

      <div class="effect-section">
        <div class="filter-title"><i class="bi bi-stars" style="color:var(--accent)"></i> スキル効果</div>
        <div class="mode-tabs">
          <button class="${state.mode === "category" ? "active" : ""}" data-act="mode" data-val="category"><i class="bi bi-grid-3x3-gap"></i> カテゴリ</button>
          <button class="${state.mode === "detail" ? "active" : ""}" data-act="mode" data-val="detail"><i class="bi bi-sliders2"></i> 詳細</button>
        </div>
        <div class="mode-pane ${state.mode === "category" ? "active" : ""}">${categoryPaneHTML()}</div>
        <div class="mode-pane ${state.mode === "detail" ? "active" : ""}">${detailPaneHTML()}</div>
      </div>

      <div class="filter-group" style="margin-bottom:0">
        <div class="filter-title">キャラ条件 <span class="hint">キャラ情報で絞り込み</span></div>
        ${facetsHTML()}
      </div>
    `;
    const kw = document.getElementById("kw");
    if (kw) {
      kw.addEventListener("input", (e) => { state.keyword = e.target.value; renderResults(); });
    }
    renderMobileChips();
  }

  // スマホツールバーの filter-chip 行（PCでは非表示）
  const M_CHIPS = [
    ["effect", "効果"], ["rarity", "レア"], ["attr", "属性"], ["race", "種族"],
    ["role", "役割"], ["weapon", "武器"], ["affiliation", "所属"],
  ];
  function renderMobileChips() {
    const host = document.getElementById("m-chips");
    if (!host) return;
    host.innerHTML = M_CHIPS.map(([k, l]) => {
      const n = k === "effect"
        ? (state.mode === "detail" ? liveConds().length : state.catSel.size)
        : state.facets[k].size;
      return `<button class="m-chip ${n ? "active" : ""}" data-act="mlaunch">${l}${n ? ` <b>${n}</b>` : ""}</button>`;
    }).join("");
  }

  /* ---------------- events (delegated) ---------------- */
  function onClick(e) {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const act = t.dataset.act;
    const cid = t.dataset.cid;
    const cond = cid ? byId(state.conditions, cid) : (state.editing ? byId(state.conditions, state.editing) : null);

    switch (act) {
      case "mode": state.mode = t.dataset.val; renderDock(); renderResults(); break;
      case "ex": state.ex = t.dataset.val; renderDock(); renderResults(); break;
      case "catchip": {
        const id = t.dataset.id;
        state.catSel.has(id) ? state.catSel.delete(id) : state.catSel.add(id);
        renderDock(); renderResults(); break;
      }
      case "facet-toggle": {
        const k = t.dataset.key;
        state.openFacets.has(k) ? state.openFacets.delete(k) : state.openFacets.add(k);
        renderDock(); break;
      }
      case "facet": {
        const k = t.dataset.key, id = String(t.dataset.id);
        state.facets[k].has(id) ? state.facets[k].delete(id) : state.facets[k].add(id);
        renderDock(); renderResults(); break;
      }
      case "add": {
        const c = newCond(); state.conditions.push(c); state.editing = c.id;
        renderDock(); renderResults(); break;
      }
      case "expand": {
        // collapse current empty before switching
        cleanupEmpty(state.editing, cid);
        state.editing = (state.editing === cid) ? null : cid;
        renderDock(); renderResults(); break;
      }
      case "done": {
        state.editing = null; renderDock(); renderResults(); break;
      }
      case "delete": {
        const id = cid || state.editing;
        state.conditions = state.conditions.filter((c) => c.id !== id);
        if (state.editing === id) state.editing = null;
        renderDock(); renderResults(); break;
      }
      case "cat": break; // handled by change
      case "camp": {
        cond.camp = t.dataset.val;
        if (cond.camp === "self") cond.scope = "自身"; else if (cond.scope === "自身") cond.scope = "all";
        TAG_CATS.forEach((c) => { cond[c] = null; });
        cond.specials = []; cond.position = null;
        renderDock(); renderResults(); break;
      }
      case "scope": cond.scope = t.dataset.val; if (cond.scope !== "single") cond.position = null; renderDock(); renderResults(); break;
      case "tag": {
        const scope = t.dataset.scope, cat = t.dataset.cat, val = t.dataset.val;
        const obj = scope === "ref" ? cond.ref : cond;
        obj[cat] = (String(obj[cat]) === String(val)) ? null : val;
        renderDock(); renderResults(); break;
      }
      case "ref-toggle": cond.refOpen = !cond.refOpen; renderDock(); break;
      case "ref-src": cond.ref.src = t.dataset.val; TAG_CATS.forEach((c) => cond.ref[c] = null); cond.ref.specials = []; renderDock(); renderResults(); break;
      case "split": doSplit(cond); break;
      case "special-del": { const obj = t.dataset.scope === "ref" ? cond.ref : cond; obj.specials = obj.specials.filter((s) => s !== t.dataset.val); renderDock(); renderResults(); break; }
      case "clear": clearAll(); break;
      case "mlaunch": document.body.classList.add("filter-open"); break;
      case "close-sheet": document.body.classList.remove("filter-open"); break;
      case "noop": {
        // segmented visual toggle for 粒度 demo
        t.parentElement.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        t.classList.add("active"); break;
      }
      case "view-mode": {
        const opt = e.target.closest(".view-mode-option");
        if (opt) { t.querySelectorAll(".view-mode-option").forEach((o) => o.classList.remove("active")); opt.classList.add("active"); }
        break;
      }
      case "toggle-self": t.classList.toggle("active"); break;
    }
  }

  function onChange(e) {
    const cond = state.editing ? byId(state.conditions, state.editing) : null;
    if (!cond) return;
    const catSel = e.target.closest('select[data-act="cat"]');
    if (catSel) { cond.cat = catSel.value || null; renderDock(); renderResults(); return; }
    const posSel = e.target.closest('select[data-act="position"]');
    if (posSel) { cond.position = posSel.value || null; renderDock(); renderResults(); return; }
    const spSel = e.target.closest('select[data-act="special"]');
    if (spSel && spSel.value) {
      const obj = spSel.dataset.scope === "ref" ? cond.ref : cond;
      if (!obj.specials.includes(spSel.value)) obj.specials.push(spSel.value);
      renderDock(); renderResults();
    }
  }

  function cleanupEmpty(editingId, nextId) {
    if (!editingId || editingId === nextId) return;
    const c = byId(state.conditions, editingId);
    if (c && !isLive(c)) {
      state.conditions = state.conditions.filter((x) => x.id !== editingId);
    }
  }

  function doSplit(cond) {
    const sel = tagsFor(cond.camp);
    const units = [];
    sel.forEach((c) => { if (cond[c]) units.push({ cat: c, val: cond[c] }); });
    (cond.specials || []).forEach((s) => units.push({ special: s }));
    if (units.length < 2) return;
    const idx = state.conditions.findIndex((c) => c.id === cond.id);
    const made = units.map((u) => {
      const nc = newCond();
      nc.cat = cond.cat; nc.camp = cond.camp; nc.scope = cond.scope; nc.position = cond.position;
      if (u.special) nc.specials = [u.special]; else nc[u.cat] = u.val;
      return nc;
    });
    state.conditions.splice(idx, 1, ...made);
    state.editing = made[0].id;
    renderDock(); renderResults();
  }

  function clearAll() {
    state.catSel.clear(); state.conditions = []; state.editing = null;
    Object.values(state.facets).forEach((s) => s.clear());
    state.keyword = ""; state.ex = "all";
    renderDock(); renderResults();
  }

  /* ---------------- boot ---------------- */
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.getElementById("clear-btn").addEventListener("click", clearAll);

  // seed with one illustrative condition so the demo opens informative
  (function seed() {
    const c = newCond(); c.cat = "atk_up"; c.camp = "ally"; c.scope = "all"; c.attr = "4";
    state.conditions.push(c);
  })();

  renderDock();
  renderResults();
})();
