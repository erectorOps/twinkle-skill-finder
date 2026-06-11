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

const filterButtonsHTML = (title, group, options) => `
<div class="filter-buttons">
    ${options.map(option => `
    <button
        class="filter-button"
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
                src="img/${i <= option.rarity ? 'rare.png' : 'rare_slot.png'}"
                alt=""
            >`).join('')}
        </span>
        ` : `
        ${option.icon ? `<img class="filter-icon" src="img/${escapeHtml(option.icon)}" alt="">` : ''}
        <span>${escapeHtml(option.label)}</span>
        `}
    </button>
    `).join('')}
</div>`;

const renderButtonGroup = (title, group, options) => `
<section class="filter-group">
    ${title ? `<div class="filter-title">${escapeHtml(title)}</div>` : ''}
    ${filterButtonsHTML(title, group, options)}
</section>`;

/* キャラクター情報の絞り込み — 折りたたみ式の facet。
   ヘッダーに選択数バッジ(facet-count)を出し、開閉はapp.js側で制御する */
const renderFacet = (title, group, options) => `
<section class="filter-group facet" data-facet-group="${escapeHtml(group)}">
    <button
        type="button"
        class="facet-header"
        data-act="facet-toggle"
        aria-expanded="false"
        aria-controls="facet-body-${escapeHtml(group)}"
    >
        <span class="facet-title">${escapeHtml(title)}</span>
        <span class="facet-count" hidden>0</span>
        <i class="bi bi-chevron-down facet-chev" aria-hidden="true"></i>
    </button>
    <div class="facet-body" id="facet-body-${escapeHtml(group)}" hidden>
        ${filterButtonsHTML(title, group, options)}
    </div>
</section>`;

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

    return `
<div class="filter-panel">
    <section class="filter-group">
        <div class="filter-title">粒度</div>
        <div class="scope-toggle" role="group" aria-label="表示粒度">
            <button
                class="scope-toggle-button active"
                type="button"
                data-character-scope-value="skill"
                data-character-scope-toggle
                aria-pressed="true"
            >スキル単位</button>
            <button
                class="scope-toggle-button"
                type="button"
                data-character-scope-value="character"
                data-character-scope-toggle
                aria-pressed="false"
            >キャラ単位</button>
        </div>
    </section>

    <section class="filter-group">
        <div class="filter-title">EXスキル</div>
        <div class="filter-buttons">
            <button class="filter-button active" type="button"
                data-filter-group="skill_group" data-filter-value="all"
                aria-pressed="true">全て</button>
            <button class="filter-button" type="button"
                data-filter-group="skill_group" data-filter-value="ex1"
                aria-pressed="false">EX1</button>
            <button class="filter-button" type="button"
                data-filter-group="skill_group" data-filter-value="ex2"
                aria-pressed="false">EX2</button>
            <button class="filter-button" type="button"
                data-filter-group="skill_group" data-filter-value="awaken"
                aria-pressed="false">覚醒</button>
        </div>
    </section>

    <section class="filter-group effect-section">
        <div class="filter-title">スキル効果</div>
        <div class="mode-tabs" role="tablist">
            <button class="mode-tab active" type="button" role="tab" aria-selected="true" data-effect-mode="cat">カテゴリ</button>
            <button class="mode-tab" type="button" role="tab" aria-selected="false" data-effect-mode="detail">詳細</button>
        </div>
        <div class="mode-pane" data-effect-pane="cat">
            ${renderButtonGroup('', 'effect_categories', effectOptions)}
        </div>
        <div class="mode-pane" data-effect-pane="detail" hidden>
            <div id="detail-filter-root"></div>
        </div>
    </section>

    ${renderFacet('レアリティ',     'rarity',            rarityOptions)}
    ${renderFacet('属性',           'attr',              attributeOptions)}
    ${renderFacet('種族',           'races',             raceOptions)}
    ${renderFacet('役割',           'role',              roleOptions)}
    ${renderFacet('武器',           'attack_types',      attackTypeOptions)}
    ${renderFacet('所属',           'affiliations',      affiliationOptions)}
    ${renderFacet('入手方法',       'obtains',           obtainOptions)}
    ${renderFacet('実装年',         'release_years',     releaseYearOptions)}
</div>`;
}
