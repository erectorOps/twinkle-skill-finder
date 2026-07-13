import {
    taxonomy,
    positions,
    specialsAlly,
    specialsEnemy,
    effectTypes,
} from './data.js';
import { normalizeBranches, effectCategoriesOf } from '../task/skillFinderIndex.mjs';

const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const byId = (list, id) => (list || []).find(item => String(item.id) === String(id));

/* target_branches.specials は string / string[] / バグで文字単位に分解された配列が混在する */
export const normalizeSpecials = (value) => {
    if (!value) return [];
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) {
        if (value.length > 1 && value.every(v => typeof v === 'string' && v.length === 1)) {
            return [value.join('')];
        }
        return value.filter(v => typeof v === 'string');
    }
    return [];
};

const ALL_SPECIALS = specialsAlly.concat(specialsEnemy);
const ALLY_TAGS = ['attr', 'race', 'role', 'weapon', 'affiliation'];
const ALL_TAG_KEYS = [...ALLY_TAGS, 'ailment'];
const REF_TAG_KEYS = { ally: ALLY_TAGS, enemy: ['ailment'] };
const TAG_LABEL = { attr: '属性', race: '種族', role: '役割', weapon: '武器', affiliation: '所属', ailment: '状態異常' };
const ICON_ONLY = new Set(['attr', 'role']);
const FIELD_FOR_TAG = { attr: 'attr', race: 'camp', role: 'role', weapon: 'equip_type', affiliation: 'affiliation', ailment: 'ailment' };
const SCOPE_OPTIONS = [{ id: '', label: '指定なし' }, ...taxonomy.scope];

const tagsFor = (side) => side === 'ally' ? ALLY_TAGS : [];
const specialsFor = (side) => {
    if (side === 'self') return [];
    if (side === 'enemy') return specialsEnemy;
    if (side === 'ally') return specialsAlly;
    return ALL_SPECIALS;
};

/* 参照する数(scale_refs.src) — 「なし/味方/敵/その他」の大分類。その他はサブ選択で詳細指定 */
const OTHER_REF_IDS = ['rush', 'ex_gauge', 'self_atk', 'self_hp', 'burst_lv', 'stun_gauge', 'overheal', 'ex_use_count', 'unison'];
const REF_GROUPS = [
    { id: 'none', label: 'なし' },
    { id: 'ally', label: '味方' },
    { id: 'enemy', label: '敵' },
    { id: 'other', label: 'その他' },
];

// カテゴリ定義（タブ行の順序・ラベルはここで管理）
const ALLY_FIELD_CATS = [
    { id: 'attr',        label: '属性',    taxKey: 'attr' },
    { id: 'race',        label: '種族',    taxKey: 'race' },
    { id: 'role',        label: '役割',    taxKey: 'role' },
    { id: 'weapon',      label: '武器',    taxKey: 'weapon' },
    { id: 'affiliation', label: '所属',    taxKey: 'affiliation' },
];
const AILMENT_CAT = { id: 'ailment', label: '状態異常', taxKey: 'ailment' };
const SPECIAL_CAT = { id: 'special', label: '特殊', taxKey: null };
const ALLY_CATS = [...ALLY_FIELD_CATS, SPECIAL_CAT];
const ENEMY_CATS = [AILMENT_CAT, SPECIAL_CAT];
const ALL_CATS = [...ALLY_FIELD_CATS, AILMENT_CAT, SPECIAL_CAT];
const campCats = (side) => {
    if (side === 'self') return [];
    if (side === 'enemy') return ENEMY_CATS;
    if (side === 'ally') return ALLY_CATS;
    return ALL_CATS;
};

const refGroupOf = (src) => (src === 'none' || src === 'ally' || src === 'enemy') ? src : 'other';

/* ==================================================================
   マッチングエンジン
   ================================================================== */

export const isLive = (cond) =>
    !!(
        cond.effectType
        || cond.side
        || cond.scope !== 'all'
        || cond.attr || cond.race || cond.role || cond.weapon || cond.affiliation
        || (cond.specials && cond.specials.length)
        || cond.position
        || (cond.ref && cond.ref.src && cond.ref.src !== 'none')
    );

export const branchSatisfies = (branch, cond) => {
    if (!branch) return false;

    if (cond.side && branch.side !== cond.side) return false;

    if (cond.side && cond.side !== 'self' && cond.scope && branch.scope && branch.scope !== cond.scope) {
        return false;
    }

    if (cond.position) {
        const posDef = byId(positions, cond.position);
        if (!posDef || branch[posDef.field] !== cond.position) return false;
    }

    for (const tag of Object.keys(FIELD_FOR_TAG)) {
        if (cond[tag] && String(branch[FIELD_FOR_TAG[tag]] ?? '') !== String(cond[tag])) {
            return false;
        }
    }

    if (cond.specials && cond.specials.length) {
        const branchSpecials = normalizeSpecials(branch.specials);
        if (!cond.specials.every(s => branchSpecials.includes(s))) return false;
    }

    return true;
};

const condFromRef = (ref) => ({
    side: ref.src,
    scope: '',
    position: '',
    attr: ref.attr || '',
    race: ref.race || '',
    role: ref.role || '',
    weapon: ref.weapon || '',
    affiliation: ref.affiliation || '',
    ailment: ref.ailment || '',
    specials: ref.specials || [],
});

export const scaleRefSatisfies = (scaleRefs, ref) => {
    if (!ref || !ref.src || ref.src === 'none') return true;

    const refDef = byId(taxonomy.ref, ref.src);
    const tagRefinable = !!(refDef && refDef.tagRefinable);

    return (scaleRefs || []).some(r => {
        if (!r || r.src !== ref.src) return false;
        if (!tagRefinable) return true;

        const keys = REF_TAG_KEYS[ref.src] || [];
        const hasRefine = keys.some(k => ref[k]) || (ref.specials && ref.specials.length);
        if (!hasRefine) return true;

        const branches = normalizeBranches(r.branches);
        const cond = condFromRef(ref);
        return branches.some(b => branchSatisfies(b, cond));
    });
};

/* target_branches を持たない effect (children 由来など) は、対象指定を伴う条件のみ判定対象から外す */
const hasBranchConstraint = (cond) =>
    !!(cond.side || cond.position || ALL_TAG_KEYS.some(k => cond[k]) || (cond.specials && cond.specials.length));

export const effectMatchesCond = (effectMeta, cond) => {
    if (cond.effectType) {
        const etDef = byId(effectTypes, cond.effectType);
        if (!etDef || effectMeta.type !== etDef.label) return false;
    }

    if (hasBranchConstraint(cond)) {
        const branches = effectMeta.target_branches || [];
        if (!branches.some(b => branchSatisfies(b, cond))) return false;
    }

    if (!scaleRefSatisfies(effectMeta.scale_refs, cond.ref)) return false;

    return true;
};

const candidateEffectIndexes = (item, cond) => {
    const keys = [];
    (item.effects || []).forEach((effect, idx) => {
        if (effectMatchesCond(effect, cond)) keys.push(idx);
    });
    return keys;
};

/* 二部マッチング: 各条件が異なる effect に割り当て可能なら true (augmenting path 法) */
export const matchesDetailConditions = (item, conditions) => {
    const live = (conditions || []).filter(isLive);
    if (live.length === 0) return true;

    const candidates = live.map(cond => candidateEffectIndexes(item, cond));
    if (candidates.some(keys => keys.length === 0)) return false;

    const assign = new Map();
    const tryAssign = (i, seen) => {
        for (const key of candidates[i]) {
            if (seen.has(key)) continue;
            seen.add(key);
            if (!assign.has(key) || tryAssign(assign.get(key), seen)) {
                assign.set(key, i);
                return true;
            }
        }
        return false;
    };

    for (let i = 0; i < candidates.length; i++) {
        if (!tryAssign(i, new Set())) return false;
    }
    return true;
};

/* skill.effects (children を含む完全構造) を DFS で辿り、各 effect-box 単位でヒット判定する。
   ヒットした effect-box 自身は matched、ヒットした子孫を持つ（自身は非ヒットの）祖先は
   hasMatchChild に入れて「通り道」として区別する。 */
export const getMatchedEffectKeys = (skill, { effectFilterMode, effectCategories, detailConditions } = {}) => {
    const matched = new Set();
    const hasMatchChild = new Set();
    const liveConditions = (detailConditions || []).filter(isLive);
    let idx = 0;

    /* 戻り値: このリスト (子孫含む) の中に一つでもヒットがあったか */
    const walk = (effects) => {
        let anyMatch = false;
        for (const effect of (effects || [])) {
            const currentIdx = idx++;
            let isMatch = false;

            if (effectFilterMode === 'detail') {
                if (liveConditions.length > 0) {
                    const meta = {
                        type: effect.type || null,
                        target_branches: normalizeBranches(effect.target_branches),
                        scale_refs: (effect.scale_refs || []).filter(Boolean),
                    };
                    isMatch = liveConditions.some(cond => effectMatchesCond(meta, cond));
                }
            } else if (effectCategories && effectCategories.size > 0) {
                const cats = effectCategoriesOf(effect);
                isMatch = [...cats].some(cat => effectCategories.has(cat));
            }

            if (isMatch) matched.add(currentIdx);

            const childMatch = walk(effect.children);
            if (!isMatch && childMatch) hasMatchChild.add(currentIdx);
            if (isMatch || childMatch) anyMatch = true;
        }
        return anyMatch;
    };

    walk(skill && skill.effects);
    return { matched, hasMatchChild };
};

/* ==================================================================
   条件カードビルダー UI
   ================================================================== */

let _uid = 0;
const updateUidFromId = (id) => {
    const m = /^c(\d+)$/.exec(id || '');
    if (m) _uid = Math.max(_uid, Number(m[1]));
};
const nextId = () => 'c' + (++_uid);

const cloneCondition = (cond = {}) => ({
    id: cond.id || nextId(),
    effectType: cond.effectType || '',
    side: cond.side || '',
    scope: cond.scope !== undefined && cond.scope !== null ? cond.scope : 'all',
    position: cond.position || '',
    attr: cond.attr || '',
    race: cond.race || '',
    role: cond.role || '',
    weapon: cond.weapon || '',
    affiliation: cond.affiliation || '',
    ailment: cond.ailment || '',
    specials: Array.isArray(cond.specials) ? [...cond.specials] : [],
    tagCat: cond.tagCat || '',
    ref: {
        src: (cond.ref && cond.ref.src) || 'none',
        attr: (cond.ref && cond.ref.attr) || '',
        race: (cond.ref && cond.ref.race) || '',
        role: (cond.ref && cond.ref.role) || '',
        weapon: (cond.ref && cond.ref.weapon) || '',
        affiliation: (cond.ref && cond.ref.affiliation) || '',
        ailment: (cond.ref && cond.ref.ailment) || '',
        specials: Array.isArray(cond.ref?.specials) ? [...cond.ref.specials] : [],
        tagCat: (cond.ref && cond.ref.tagCat) || '',
    },
    refOpen: !!cond.refOpen,
});

const newCondition = () => cloneCondition({ scope: 'all' });

const optInner = (cat, o) => {
    const img = o.icon ? `<img src="${escapeHtml(o.icon)}" alt="${escapeHtml(o.label)}">` : '';
    return ICON_ONLY.has(cat) ? img : img + escapeHtml(o.short || o.label);
};

const sideShort = (cond) => {
    if (cond.side === 'self') return '自身';
    if (cond.side === 'enemy') return '敵';
    if (cond.side === 'ally') return '味方';
    return '対象';
};

const sideScopeText = (cond) => {
    if (!cond.side) return '対象';
    if (cond.side === 'self') return '自身';
    const sideLabel = cond.side === 'enemy' ? '敵' : '味方';
    const sc = byId(taxonomy.scope, cond.scope);
    return sc ? sideLabel + sc.label : sideLabel;
};

const tagText = (cond) => {
    const parts = [];
    if (cond.position) {
        parts.push(`<span class="t-attr">${escapeHtml(byId(positions, cond.position).label)}</span>`);
    }
    for (const c of ALL_TAG_KEYS) {
        if (cond[c]) parts.push(`<span class="t-attr">${escapeHtml(byId(taxonomy[c], cond[c]).label)}</span>`);
    }
    for (const s of (cond.specials || [])) {
        const def = byId(ALL_SPECIALS, s);
        parts.push(`<span class="t-attr">${escapeHtml(def ? def.short : s)}</span>`);
    }
    return parts;
};

const refText = (cond) => {
    if (!cond.ref || cond.ref.src === 'none') return '';
    const refDef = byId(taxonomy.ref, cond.ref.src);
    const tagKeys = REF_TAG_KEYS[cond.ref.src] || [];
    const tags = tagKeys.filter(c => cond.ref[c]).map(c => byId(taxonomy[c], cond.ref[c]).label)
        .concat((cond.ref.specials || []).map(s => (byId(ALL_SPECIALS, s) || {}).short || s))
        .join('・');
    const srcLabel = refDef ? refDef.label : cond.ref.src;
    const body = (tags ? tags + 'の' : '') + srcLabel;
    return `<span class="ref">（参照: <b>${escapeHtml(body)}</b>）</span>`;
};

const echoHTML = (cond) => {
    const tags = tagText(cond);
    const tjoin = tags.join('<span class="kw-and">かつ</span>');
    const scopeLabel = escapeHtml(sideScopeText(cond));
    if (!tags.length) {
        return cond.side
            ? `<span class="scope">${scopeLabel}</span> ${refText(cond)}`
            : `<span class="scope">（対象指定なし）</span>${refText(cond)}`;
    }
    return `${tjoin} の <span class="scope">${scopeLabel}</span> ${refText(cond)}`;
};

const plainText = (cond) => {
    const labels = [];
    if (cond.position) labels.push(byId(positions, cond.position).label);
    for (const c of ALL_TAG_KEYS) {
        if (cond[c]) labels.push(byId(taxonomy[c], cond[c]).label);
    }
    for (const s of (cond.specials || [])) {
        const def = byId(ALL_SPECIALS, s);
        labels.push(def ? def.short : s);
    }
    const tags = labels.join('かつ');
    const ss = sideScopeText(cond);
    const etDef = cond.effectType ? byId(effectTypes, cond.effectType) : null;
    const eff = etDef ? etDef.label : '効果未指定';
    return (tags ? tags + 'の' : '') + ss + 'に' + eff;
};

export function createDetailFilter(container, { conditions: initial = [], onChange } = {}) {
    let conditions = (initial || []).map(cloneCondition);
    conditions.forEach(c => updateUidFromId(c.id));
    let editingId = null;

    const getConditions = () => conditions.map(cloneCondition);

    const notify = () => {
        if (typeof onChange === 'function') onChange(getConditions());
    };

    const update = () => {
        render();
        notify();
    };

    const tagRow = (cond, cat, refScope) => {
        const cur = refScope === 'ref' ? cond.ref[cat] : cond[cat];
        const opts = taxonomy[cat].map(o => {
            const active = String(cur) === String(o.id);
            const style = (cat === 'attr' && active && o.color) ? ` style="color:${o.color}"` : '';
            return `<button class="tg ${cat} ${ICON_ONLY.has(cat) ? 'icon-only' : ''} ${active ? 'active' : ''}" type="button" data-act="tag" data-ref="${refScope}" data-cat="${cat}" data-val="${escapeHtml(String(o.id))}" title="${escapeHtml(o.label)}"${style}>${optInner(cat, o)}</button>`;
        }).join('');
        return `<div class="b-tagrow"><span class="tg-name">${TAG_LABEL[cat]}</span><div class="btn-row">${opts}</div></div>`;
    };

    const specialsUI = (obj, refScope, side) => {
        const list = specialsFor(side);
        if (!list.length) return '';
        const sel = obj.specials || [];
        const chips = sel.map(s => {
            const def = byId(ALL_SPECIALS, s);
            return `<button class="tg active sp" type="button" data-act="special-del" data-ref="${refScope}" data-val="${escapeHtml(s)}" title="解除">${escapeHtml(def ? def.short : s)} <i class="bi bi-x"></i></button>`;
        }).join('');
        const opts = list.filter(sp => !sel.includes(sp.id))
            .map(sp => `<option value="${escapeHtml(sp.id)}">${escapeHtml(sp.label)}</option>`).join('');
        return `<div class="b-tagrow"><span class="tg-name">特殊</span><div class="btn-row">${chips}<select class="sp-select" data-act="special" data-ref="${refScope}"><option value="">＋ 追加…</option>${opts}</select></div></div>`;
    };

    const tagCatValBlock = (cond, refScope) => {
        const side = refScope === 'ref' ? cond.ref.src : cond.side;
        const cats = campCats(side);
        if (!cats.length) return '';

        const obj = refScope === 'ref' ? cond.ref : cond;
        const currentCat = obj.tagCat || (cats[0]?.id ?? '');

        const tabs = cats.map(cat =>
            `<button type="button"
                class="tag-cat-tab ${currentCat === cat.id ? 'active' : ''}"
                data-act="tagcat" data-ref="${refScope}" data-val="${escapeHtml(cat.id)}"
            >${escapeHtml(cat.label)}</button>`
        ).join('');

        let valRow = '';
        if (currentCat) {
            const catDef = cats.find(c => c.id === currentCat);
            if (catDef && catDef.taxKey) {
                // 属性〜所属: 既存の taxonomy から生成
                valRow = taxonomy[catDef.taxKey].map(o => {
                    const active = String(obj[catDef.taxKey]) === String(o.id);
                    const style = (catDef.taxKey === 'attr' && active && o.color)
                        ? ` style="color:${o.color}"` : '';
                    return `<button type="button"
                        class="tg ${catDef.taxKey} ${ICON_ONLY.has(catDef.taxKey) ? 'icon-only' : ''} ${active ? 'active' : ''}"
                        data-act="tag" data-ref="${refScope}"
                        data-cat="${catDef.taxKey}" data-val="${escapeHtml(String(o.id))}"
                        title="${escapeHtml(o.label)}"${style}>${optInner(catDef.taxKey, o)}</button>`;
                }).join('');
            } else if (currentCat === 'special') {
                // 特殊: specialsFor から生成
                const list = specialsFor(side);
                valRow = list.map(sp => {
                    const active = (obj.specials || []).includes(sp.id);
                    return `<button type="button"
                        class="tg ${active ? 'active' : ''}"
                        data-act="tag-special" data-ref="${refScope}"
                        data-val="${escapeHtml(sp.id)}">${escapeHtml(sp.short || sp.label)}</button>`;
                }).join('');
            }
            valRow = valRow
                ? `<div class="btn-row tag-val-row">${valRow}</div>`
                : '';
        }

        const label = refScope === 'ref'
            ? `参照タグ <span class="b-sub">どんな${side === 'ally' ? '味方' : '敵'}を数えるか</span>`
            : `対象タグ <span class="b-sub">— どんな対象か (任意)</span>`;

        return `
        <div class="b-block">
            <div class="b-label">${label}</div>
            <div class="tag-cat-tabs">${tabs}</div>
            ${valRow}
        </div>`;
    };

    const builderHTML = (cond) => {
        const sel = tagsFor(cond.side);
        const specialsBlock = specialsUI(cond, 'tag', cond.side);
        const tagLabels = sel.filter(c => cond[c]).map(c => byId(taxonomy[c], cond[c]).label)
            .concat((cond.specials || []).map(s => (byId(ALL_SPECIALS, s) || {}).short || s));
        const tagCount = tagLabels.length;
        const refSel = REF_TAG_KEYS[cond.ref.src] || [];
        const refGroup = refGroupOf(cond.ref.src);

        return `
        <div class="builder" data-cid="${cond.id}">
            <div class="b-block">
                <div class="b-label">効果</div>
                <select class="b-select" data-act="effect-type">
                    <option value="">効果を選択…</option>
                    ${effectTypes.map(c => `<option value="${escapeHtml(c.id)}" ${cond.effectType === c.id ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}
                </select>
            </div>

            <div class="b-block">
                <div class="b-label">対象 <span class="b-sub">— 陣営と範囲 (任意)</span></div>
                <div class="seg">
                    <button type="button" class="${!cond.side ? 'active' : ''}" data-act="side" data-val="">指定なし</button>
                    ${taxonomy.side.map(s => `<button class="${cond.side === s.id ? 'active' : ''}" data-act="side" data-val="${s.id}">${escapeHtml(s.label)}</button>`).join('')}
                </div>
                ${cond.side && cond.side !== 'self' ? `
                <div class="b-inline-row">
                    <span class="b-inline-label">範囲</span>
                    <div class="seg">
                        ${SCOPE_OPTIONS.map(s => `<button class="${cond.scope === s.id ? 'active' : ''}" data-act="scope" data-val="${s.id}">${escapeHtml(s.label)}</button>`).join('')}
                    </div>
                </div>
                ${cond.scope === 'single' ? `
                <div class="b-inline-row" style="margin-top:8px">
                    <span class="b-inline-label">優先</span>
                    <select class="b-select" data-act="position">
                        <option value="">指定なし(単体選択条件いずれも)</option>
                        ${positions.map(p => `<option value="${p.id}" ${cond.position === p.id ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('')}
                    </select>
                </div>` : ''}` : ''}
            </div>

            ${tagCatValBlock(cond, 'tag')}

            <button type="button" class="ref-toggle ${cond.refOpen ? 'open' : ''} ${cond.ref.src !== 'none' ? 'has-ref' : ''}" data-act="ref-toggle">
                <i class="bi bi-box-arrow-in-up"></i> 威力参照${cond.ref.src !== 'none' ? '・設定中' : '<span class="b-sub">任意</span>'}
                <i class="bi bi-chevron-right chev"></i>
            </button>
            <div class="ref-body ${cond.refOpen ? 'open' : ''}">
                <div class="ref-body-inner">
                    <div class="ref-body-title">参照元の設定</div>
                    <div class="b-block" style="margin-top:0">
                        <div class="b-label">参照する数</div>
                        <div class="seg">
                            ${REF_GROUPS.map(g => `<button type="button" class="${refGroup === g.id ? 'active' : ''}" data-act="ref-group" data-val="${g.id}">${escapeHtml(g.label)}</button>`).join('')}
                        </div>
                        ${refGroup === 'other' ? `
                        <div class="b-block">
                            <div class="b-label">特殊な参照をする数 <span class="b-sub">どんな数を数えるか</span></div>
                            <div class="btn-row">
                                ${OTHER_REF_IDS.map(id => `<button type="button" class="tg ${cond.ref.src === id ? 'active' : ''}" data-act="ref-src" data-val="${id}">${escapeHtml(byId(taxonomy.ref, id).label)}</button>`).join('')}
                            </div>
                        </div>` : ''}
                    </div>
                    ${(cond.ref.src === 'ally' || cond.ref.src === 'enemy')
                        ? tagCatValBlock(cond, 'ref') : ''}
                </div>
            </div>

            <div class="b-actions">
                <button type="button" class="btn-ghost" data-act="delete">削除</button>
                <button type="button" class="btn-primary" data-act="done">この条件を確定</button>
            </div>
        </div>`;
    };

    const detailPaneHTML = () => {
        const cards = conditions.map((cond, i) => {
            const expanded = editingId === cond.id;
            const divider = i > 0 ? `<div class="and-divider"><span>かつ</span></div>` : '';
            const etDef = cond.effectType ? byId(effectTypes, cond.effectType) : null;
            return divider + `
            <div class="cond-card">
                <div class="cond-summary" data-act="expand" data-cid="${cond.id}">
                    <span class="cond-echo"><span class="cond-effect-tag ${etDef ? escapeHtml(etDef.klass || '') : ''}">${etDef ? escapeHtml(etDef.short) : '効果未指定'}</span>${echoHTML(cond)}</span>
                    <span class="cond-actions">
                        <button type="button" class="icon-btn" data-act="expand" data-cid="${cond.id}" title="編集"><i class="bi bi-pencil"></i></button>
                        <button type="button" class="icon-btn del" data-act="delete" data-cid="${cond.id}" title="削除"><i class="bi bi-trash3"></i></button>
                    </span>
                </div>
                ${expanded ? builderHTML(cond) : ''}
            </div>`;
        }).join('');

        const live = conditions.filter(isLive);
        const queryPreview = live.length
            ? live.map(c => `「${escapeHtml(plainText(c))}」`).join('<span class="kw-and"> かつ </span>')
            : '<span class="q">すべてのスキル</span>';

        return `
        <div class="cond-list">${cards}</div>
        <button type="button" class="add-group" data-act="add">
            <i class="bi bi-plus-lg"></i> 条件を追加
        </button>
        <div class="detail-foot">
            <i class="bi bi-funnel-fill"></i>
            <span class="q">${live.length}件の条件</span>：${queryPreview} を含むスキル
        </div>`;
    };

    const cleanupEmpty = (currentEditingId, nextEditingId) => {
        if (!currentEditingId || currentEditingId === nextEditingId) return;
        const c = byId(conditions, currentEditingId);
        if (c && !isLive(c)) {
            conditions = conditions.filter(x => x.id !== currentEditingId);
        }
    };

    const onClick = (e) => {
        const target = e.target.closest('[data-act]');
        if (!target) return;
        const act = target.dataset.act;
        const cid = target.dataset.cid;
        const cond = cid ? byId(conditions, cid) : (editingId ? byId(conditions, editingId) : null);

        switch (act) {
            case 'add': {
                const c = newCondition();
                conditions.push(c);
                editingId = c.id;
                update();
                break;
            }
            case 'expand': {
                cleanupEmpty(editingId, cid);
                editingId = (editingId === cid) ? null : cid;
                update();
                break;
            }
            case 'done':
                editingId = null;
                update();
                break;
            case 'delete': {
                const id = cid || editingId;
                conditions = conditions.filter(c => c.id !== id);
                if (editingId === id) editingId = null;
                update();
                break;
            }
            case 'side': {
                if (!cond) break;
                const newSide = target.dataset.val;
                if (newSide === cond.side) break;
                cond.side = newSide;
                if (cond.side === 'self') cond.scope = 'self';
                else if (!cond.side || cond.scope === 'self') cond.scope = 'all';
                ALLY_TAGS.forEach(c => { cond[c] = ''; });
                cond.ailment = '';
                cond.specials = [];
                cond.position = '';
                cond.tagCat = campCats(cond.side)[0]?.id || '';
                update();
                break;
            }
            case 'scope':
                if (!cond) break;
                if (target.dataset.val === cond.scope) break;
                cond.scope = target.dataset.val;
                if (cond.scope !== 'single') cond.position = '';
                update();
                break;
            case 'tag': {
                if (!cond) break;
                const refScope = target.dataset.ref;
                const cat = target.dataset.cat;
                const val = target.dataset.val;
                const obj = refScope === 'ref' ? cond.ref : cond;
                const tagKeys = refScope === 'ref' ? (REF_TAG_KEYS[cond.ref.src] || []) : ALL_TAG_KEYS;
                const turningOn = String(obj[cat]) !== String(val);
                tagKeys.forEach(c => { obj[c] = ''; });
                obj[cat] = turningOn ? val : '';
                if (refScope === 'tag') cond.specials = [];  // ← 追加
                update();
                break;
            }
            case 'special-del': {
                if (!cond) break;
                const refScope = target.dataset.ref;
                const obj = refScope === 'ref' ? cond.ref : cond;
                obj.specials = obj.specials.filter(s => s !== target.dataset.val);
                update();
                break;
            }
            case 'ref-toggle':
                if (!cond) break;
                cond.refOpen = !cond.refOpen;
                update();
                break;
            case 'ref-group': {
                if (!cond) break;
                const group = target.dataset.val;
                if (group === 'other') {
                    if (!OTHER_REF_IDS.includes(cond.ref.src)) cond.ref.src = OTHER_REF_IDS[0];
                } else {
                    cond.ref.src = group;
                }
                ALLY_TAGS.concat(['ailment']).forEach(c => { cond.ref[c] = ''; });
                cond.ref.specials = [];
                cond.ref.tagCat = campCats(cond.ref.src)[0]?.id || '';
                update();
                break;
            }
            case 'ref-src': {
                if (!cond) break;
                cond.ref.src = target.dataset.val;
                ALLY_TAGS.concat(['ailment']).forEach(c => { cond.ref[c] = ''; });
                cond.ref.specials = [];
                cond.ref.tagCat = campCats(cond.ref.src)[0]?.id || '';
                update();
                break;
            }
            // タブ切り替え
            case 'tagcat': {
                if (!cond) break;
                const refScope = target.dataset.ref;
                const obj = refScope === 'ref' ? cond.ref : cond;
                if (obj.tagCat === target.dataset.val) break;
                obj.tagCat = (obj.tagCat === target.dataset.val) ? '' : target.dataset.val;
                update();
                break;
            }
            // 特殊の単一選択
            case 'tag-special': {
                if (!cond) break;
                const refScope = target.dataset.ref;
                const obj = refScope === 'ref' ? cond.ref : cond;
                const val = target.dataset.val;
                const wasSelected = (obj.specials || []).includes(val);
                // 特殊を選んだら同じ obj の通常タグをクリア
                const clearKeys = refScope === 'ref'
                    ? (REF_TAG_KEYS[cond.ref.src] || [])
                    : ALL_TAG_KEYS;
                clearKeys.forEach(c => { obj[c] = ''; });
                obj.specials = wasSelected ? [] : [val];
                update();
                break;
            }
        }
    };

    const onInputChange = (e) => {
        const cond = editingId ? byId(conditions, editingId) : null;
        if (!cond) return;

        const effectSel = e.target.closest('select[data-act="effect-type"]');
        if (effectSel) { cond.effectType = effectSel.value || ''; update(); return; }

        const posSel = e.target.closest('select[data-act="position"]');
        if (posSel) { cond.position = posSel.value || ''; update(); return; }

        const spSel = e.target.closest('select[data-act="special"]');
        if (spSel && spSel.value) {
            const refScope = spSel.dataset.ref;
            const obj = refScope === 'ref' ? cond.ref : cond;
            if (!obj.specials.includes(spSel.value)) obj.specials.push(spSel.value);
            update();
        }
    };

    function render() {
        container.innerHTML = detailPaneHTML();
    }

    container.addEventListener('click', onClick);
    container.addEventListener('change', onInputChange);

    render();

    return {
        getConditions,
        setConditions(next) {
            conditions = (next || []).map(cloneCondition);
            conditions.forEach(c => updateUidFromId(c.id));
            editingId = null;
            render();
        },
    };
}
