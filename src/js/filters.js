const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const optionMap = (items, getItems) => {
    const map = new Map();
    for (const item of items) {
        for (const value of getItems(item)) {
            if (!value || value.id === undefined || value.id === null) continue;
            map.set(String(value.id), {
                id: String(value.id),
                label: value.label,
                icon: value.icon
            });
        }
    }
    return [...map.values()].sort((a, b) => Number(a.id) - Number(b.id));
};

const ICON_ONLY = new Set(["attr", "role"]); // アイコンのみ表示するタグ
const optInner = (catKey, o) => {
    // class="filter-icon"
    const img = o.icon ? `<img src="img/${escapeHtml(o.icon)}" alt="${escapeHtml(o.label)}">` : "";
    return ICON_ONLY.has(catKey) ? img : img + escapeHtml(o.label);
};

const filterButtonsHTML = (title, group, options, is_chip) => `
<div class="${is_chip ? "cat-grid" : "filter-buttons"}">
    ${options.map(option => `
    <button
        class="${is_chip ? "cat-chip" : "pill"} ${ICON_ONLY.has(group) ? "icon-only" : ""} ${group === "rarity" ? "rarity-pill" : ""}"
        type="button"
        data-filter-group="${escapeHtml(group)}"
        data-filter-value="${escapeHtml(option.id)}"
        aria-pressed="false"
        aria-label="${escapeHtml(title)} ${escapeHtml(option.label)}"
    >
        ${option.rarity ? `
        <span class="rarity-stars" aria-hidden="true">
            ${[1, 2, 3].map(i => `
            <img
                class="rarity-star ${i <= option.rarity ? 'filled' : 'empty'}"
                src="img/${i <= option.rarity ? 'rare.webp' : 'rare_slot.webp'}"
                alt=""
            >`).join('')}
        </span>
        ` : optInner(group, option)
        }
    </button>
    `).join('')}
</div>`;

const renderButtonGroup = (title, group, options) => `
    ${title ? `<div class="filter-title">${escapeHtml(title)}</div>` : ''}
    ${filterButtonsHTML(title, group, options, true)}
`;

/* キャラクター情報の絞り込み — 折りたたみ式の facet。
   ヘッダーに選択数バッジ(facet-count)を出し、開閉はapp.js側で制御する */
function facetsHTML(defines) {
    return defines.map((f) => {
        return renderFacet(f.label, f.key, f.opts, f.icon)
    }).join("");
}

function  renderFacet(title, group, options, icon) {
    return `<section class="facet" data-facet-group="${escapeHtml(group)}">
        <button
            type="button"
            class="facet-header"
            data-act="facet-toggle"
            aria-expanded="false"
            aria-controls="facet-body-${escapeHtml(group)}"
        >
            <i class="bi ${icon}" style="color:var(--sub)"></i> ${escapeHtml(title)}
            <span class="facet-count" hidden>0</span>
            <i class="bi bi-chevron-right facet-chev" aria-hidden="true"></i>
        </button>
        <div class="facet-body" id="facet-body-${escapeHtml(group)}" hidden>
            ${filterButtonsHTML(title, group, options, false)}
        </div>
    </section>`;
}

export function renderFilterButtons(characters) {
    const rarityOptions = [1, 2, 3].map(value => ({
        id: String(value),
        label: `★${value}`,
        rarity: value
    }));

    const attributeOptions = optionMap(characters, chara => [chara.attr_type]);

    const raceOptions = optionMap(characters, chara => chara.camps || []);

    const roleOptions = optionMap(characters, chara => [chara.role]);

    const attackTypeOptions = optionMap(characters, chara => chara.sp_equip_types || []);

    const affiliationOptions = optionMap(characters, chara => chara.affiliations || [])
        .map(option => option.id === '5' ? { ...option, label: '流星学園付属' } : option)
        .sort((a, b) => {
            const order = { '2': 1, '1': 2, '5': 3, '3': 4, '4': 5, '7': 6, '8': 7, '0': 8 };
            return (order[a.id] || 99) - (order[b.id] || 99);
        });

    const effectOptions = [
        ['all_attack',            '全体攻撃'],
        ['multi_attack',          '多段攻撃'],
        ['note_backward',         'ノーツ後退系'],
        ['note_move',             'ノーツ移動系'],
        ['atk_up',                'ATKアップ'],
        ['critical_up',           'クリティカルアップ'],
        ['critical_damage_up',    'クリダメアップ'],
        ['stun_damage_up',        'スタンダメアップ'],
        ['action_ct_short',       '行動CT短縮'],
        ['barrier',               'バリア系'],
        ['sub_attribute',         'サブ属性'],
        ['damage_taken_up',       '被ダメ増加'],
        ['special_damage_taken_up','特殊被ダメ増加系'],
        ['weakness_attribute',    '弱点属性'],
        ['action_control',        '行動阻害系'],
        ['status_infliction',     '状態付与系']
    ].map(([id, label]) => ({ id, label }));

    const releaseYearOptions = [2026, 2025, 2024, 2023].map(value => ({
        id: String(value),
        label: `${value}年`
    }));

    const obtainOptions = [
        ['standard',       '恒常'],
        ['limited',        '期間限定'],
        ['starter',        '初期加入'],
        ['collab_limited', 'コラボ限定'],
        ['collab_reward',  'コラボ報酬'],
        ['event_reward',   'イベント報酬'],
        ['medal_exchange', 'メモリーメダル']
    ].map(([id, label]) => ({ id, label }));

    const facet_defs = [
        { key: "rarity", label: "レアリティ", icon: "bi-star", opts: rarityOptions},
        { key: "attr", label: "属性", icon: "bi-droplet", opts: attributeOptions },
        { key: "races", label: "種族", icon: "bi-people", opts: raceOptions },
        { key: "role", label: "役割", icon: "bi-shield", opts: roleOptions },
        { key: "attack_types", label: "武器", icon: "bi-hammer", opts: attackTypeOptions },
        { key: "affiliations", label: "所属", icon: "bi-flag", opts: affiliationOptions },
        { key: "obtains", label: "入手方法", icon: "bi-person-plus", opts: obtainOptions},
        { key: "release_years", label: "実装年", icon: "bi-calendar3", opts: releaseYearOptions}
    ];

    return `
    <section class="filter-group keyword-group">
        <div class="filter-title"><i class="bi bi-search"></i>キーワード</div>
        <div class="search-box">
            <i class="bi bi-search" aria-hidden="true"></i>
            <input
                id="skill-search"
                type="search"
                autocomplete="off"
                placeholder="キャラ名・スキル名・効果"
            >
        </div>
    </section>
    <section class="filter-group">
        <div class="filter-title">粒度</div>
        <div class="seg" role="group" aria-label="表示粒度">
            <button
                class="active"
                data-character-scope-value="skill"
                data-character-scope-toggle
                aria-pressed="true"
            >スキル単位</button>
            <button
                data-character-scope-value="character"
                data-character-scope-toggle
                aria-pressed="false"
            >キャラ単位</button>
        </div>
    </section>
    <section class="filter-group">
        <div class="filter-title">EXスキル</div>
        <div class="seg">
            <button class="active"
                data-filter-group="skill_group" data-filter-value="all"
                aria-pressed="true">全て</button>
            <button
                data-filter-group="skill_group" data-filter-value="ex1"
                aria-pressed="false">EX1</button>
            <button
                data-filter-group="skill_group" data-filter-value="ex2"
                aria-pressed="false">EX2</button>
            <button
                data-filter-group="skill_group" data-filter-value="awaken"
                aria-pressed="false">覚醒</button>
        </div>
    </section>

    <section class="effect-section">
        <div class="filter-title"><i class="bi bi-stars" style="color:var(--accent)"></i>スキル効果</div>
        <div class="mode-tabs" role="tablist">
            <button class="active" role="tab" aria-selected="true" data-effect-mode="cat"><i class="bi bi-grid-3x3-gap"></i>カテゴリ</button>
            <button role="tab" aria-selected="false" data-effect-mode="detail"><i class="bi bi-sliders2"></i>詳細</button>
        </div>
        <div class="mode-pane" data-effect-pane="cat">
            ${renderButtonGroup('', 'effect_categories', effectOptions)}
        </div>
        <div class="mode-pane" data-effect-pane="detail" hidden>
            <div id="detail-filter-root"></div>
        </div>
    </section>

    <div class="filter-group" style="margin-bottom:0">
        <div class="filter-title">キャラ条件 <span class="hint">キャラ情報で絞り込み</span></div>
        ${facetsHTML(facet_defs)}
    </div>
`;
}
