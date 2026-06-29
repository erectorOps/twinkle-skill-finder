const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const renderExIcon = (skillType) =>
    `<span class="ex-icon">${escapeHtml(skillType)}</span>`;

const renderFormula = (formula) =>
    escapeHtml(formula)
        .replace(
            /\{([^{}]+)\}/g,
            '<span class="formula-group"><span class="formula-brace">{</span><span class="formula-body">$1</span><span class="formula-brace">}</span></span>'
        )
        .replace(/\+/g, '<span class="formula-op">+</span>');

const getEquipmentUnitId = (item) =>
    item?.game_unit_id ?? item?.unit_id;

const findAccessoryForSkill = (accessories, skill) =>
    (accessories || []).find(x => x.unit_id === skill.unit_id)
    || (accessories || []).find(x =>
        getEquipmentUnitId(x) === getEquipmentUnitId(skill)
    );

const matchingAccessoryAbilities = (accessory, skill) => {
    if (!accessory) return [];

    return (accessory.acc_abilities || []).filter(ability =>
        ability.skill_type === 'COMMON'
        || String(ability.skill_id) === String(skill.skill_id)
    );
};

/* getMatchedEffectKeys (detailFilter.js) と同じ DFS 順 (親 → 子 → 孫 ...) で idx を割り振る */
const renderEffectBox = (effect, counter, isSub = false) => {
    const idx = counter.value++;
    const classes = ['effect-box', isSub ? 'sub-effect' : '', escapeHtml(effect.effect_class || '')]
        .filter(Boolean).join(' ');
    return `
<div class="${classes}" data-idx="${idx}">
    <div class="effect-top">
        <span class="effect-name">
            ${escapeHtml(effect.type || '')}
            ${effect.duration ? `<span class="effect-ct">${escapeHtml(effect.duration.ct)}CT</span>` : ''}
        </span>
        ${effect.target ? `<span class="effect-target">${escapeHtml(effect.target)}</span>` : ''}
    </div>
    ${effect.display_value ? `<div class="effect-value">${escapeHtml(effect.display_value)}</div>` : ''}
    ${effect.formula ? `<div class="effect-formula">└ ${renderFormula(effect.formula)}</div>` : ''}
    ${(effect.children && effect.children.length) ? `
    <div class="effect-children">
        ${effect.children.map(child => renderEffectBox(child, counter, true)).join('')}
    </div>
    ` : ''}
    ${(effect.notes && effect.notes.length) ? effect.notes.map(note => `
    <div class="effect-note ${escapeHtml(note.type || '')}">
        <span class="tag">${escapeHtml(note.label || '')}</span>
        ${escapeHtml(note.text || '')}
    </div>
    `).join('') : ''}
</div>`;
};

export function renderCard(skill, chara, accessories) {
    const bgImage = `img/unit/chara_${skill.unit_id}_2_1.webp`;

    const skillAccessory = findAccessoryForSkill(accessories, skill);

    const accessoryAbilities = matchingAccessoryAbilities(skillAccessory, skill);

    const accessoryCommonEffects = accessoryAbilities
        .filter(ability => ability.skill_type === 'COMMON')
        .flatMap(ability => ability.effects || []);

    const accessoryInlineCommonEffects = accessoryCommonEffects
        .filter(effect => effect.display_value);

    const accessoryBlockCommonEffects = accessoryCommonEffects
        .filter(effect => !accessoryInlineCommonEffects.includes(effect));

    const accessorySkillEffects = accessoryAbilities
        .filter(ability => ability.skill_type !== 'COMMON')
        .flatMap(ability => ability.effects || []);

    const accessoryRawTexts = accessoryAbilities
        .filter(ability =>
            ability.skill_type !== 'COMMON'
            || !(ability.effects || []).some(effect => effect.display_value)
        )
        .map(ability => {
            if (!ability.text) return '';
            return `${ability.skill_type}：${ability.text}`;
        })
        .filter(Boolean);

    const accessoryStatLabels = {
        hp: 'HP', atk: 'ATK', ex: 'EX',
        ex_up: 'EX上昇', ct: 'CT', critical: 'クリ'
    };

    const accessoryStats = skillAccessory
        ? Object.entries(skillAccessory.stats || {})
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => ({ label: accessoryStatLabels[key] || key, value }))
        : [];

    const renderAccessoryEffectSummary = (effect) => {
        const parts = [effect.type, effect.target, effect.display_value].filter(Boolean);
        const body = escapeHtml(parts.join(' '));
        if (!effect.formula) return body;
        return `${body}<span class="accessory-common-formula">└ ${renderFormula(effect.formula)}</span>`;
    };

    let skillIcon = `img/skill_${String(skill.icon_id)}.webp`;
    if (skill.icon_id < 10000) {
        skillIcon = `img/skill_${String(skill.icon_id).padStart(4, '0')}.webp`;
    }

    const iconGroup = Math.floor(skill.icon_id / 100);
    const skillTypeBgMap = {
        1: 'img/btn_skill_attack.webp',
        2: 'img/btn_skill_knockback.webp',
        3: 'img/btn_skill_buff.webp',
        4: 'img/btn_skill_debuff.webp',
        5: 'img/btn_skill_status.webp',
        6: 'img/btn_skill_recovery.webp',
        7: 'img/btn_skill_special.webp',
        30: 'img/btn_skill_specific.webp',
    };
    const skillTypeBg = skillTypeBgMap[iconGroup] || 'img/btn_skill_blank.webp';

    const skillTypeLabelMap = {
        'EX1':  ['EXスキル1',  'ex1'],
        'EX2':  ['EXスキル2',  'ex2'],
        'EX1+': ['EXスキル1+', 'ex1-plus'],
        'EX2+': ['EXスキル2+', 'ex2-plus'],
    };
    const [skillTypeLabel, skillTypeCss] =
        skillTypeLabelMap[skill.skill_type] || ['EXスキル', 'ex1'];

    const showAccessory =
        skillAccessory
        && (accessoryCommonEffects.length || accessorySkillEffects.length);

    return `
<div
    id="skill-${escapeHtml(skill.skill_id)}"
    class="skill-card ${skillTypeCss}"
    data-skill-id="${escapeHtml(skill.skill_id)}"
>
    <div class="skill-header">
        <img class="skill-bg" src="${bgImage}" alt="" decoding="async">

        <div class="skill-badges">
            ${chara.affiliations.length > 0 ? `
            <div class="icon-with-ruby">
                <img src="img/${escapeHtml(chara.affiliations[0].icon)}" alt="${escapeHtml(chara.affiliations[0].label)}">
                <span class="ruby">${escapeHtml(chara.affiliations[0].label)}</span>
            </div>
            ` : ''}

            ${chara.camps.length > 0 ? `
            <div class="icon-with-ruby">
                <img src="img/${escapeHtml(chara.camps[0].icon)}" alt="${escapeHtml(chara.camps[0].label)}">
                <span class="ruby">${escapeHtml(chara.camps[0].label)}</span>
            </div>
            ` : ''}

            ${chara.sp_equip_types.length > 0 ? `
            <div class="icon-stack">
                <img class="icon-base" src="img/attribute_base.webp" alt="">
                <img class="icon-main icon-sp-equip-type" src="img/${escapeHtml(chara.sp_equip_types[0].icon)}" alt="">
            </div>
            ` : ''}

            <div class="icon-stack">
                <img class="icon-base" src="img/attribute_base.webp" alt="">
                <img class="icon-main" src="img/${escapeHtml(chara.role.icon)}" alt="">
            </div>

            <div class="icon-stack">
                <img class="icon-base" src="img/attribute_base.webp" alt="">
                <img class="icon-main" src="img/${escapeHtml(chara.attr_type.icon)}" alt="">
            </div>
        </div>

        <div class="skill-content">
            <div class="skill-type ${skillTypeCss}">
                ${skillTypeLabel}
            </div>

            <div class="skill-main">
                <div
                    class="skill-cover"
                    style="background-image: url(${skillIcon}), url(${skillTypeBg});"
                ></div>

                <div class="skill-meta">
                    ${renderExIcon(skill.skill_type)}
                    <div class="skill-name">${escapeHtml(skill.name)}</div>

                    <div class="skill-sub">
                        <span class="card-rarity" aria-label="レアリティ ${escapeHtml(chara.rarity)}">
                            ${[1, 2, 3].map(i => `
                            <img
                                class="card-rarity-star ${i <= chara.rarity ? 'filled' : 'empty'}"
                                src="img/${i <= chara.rarity ? 'rare.webp' : 'rare_slot.webp'}"
                                alt=""
                            >`).join('')}
                        </span>

                        <span class="cost-label">消費EX</span>
                        <span class="cost-value">${escapeHtml(skill.cost_ex_gauge)}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="effect-list">
        <div class="effect-box other skill-raw">
            <div class="effect-top">
                <span class="effect-formula">
                    ${escapeHtml(skill.skill_detail).replace(/\n/g, '<br>')}
                </span>
            </div>
        </div>

        ${(() => {
            const counter = { value: 0 };
            return skill.effects.map(effect => renderEffectBox(effect, counter)).join('');
        })()}

        ${showAccessory ? `
        <div class="effect-box accessory">
            <div class="accessory-summary">
                ${skillAccessory.illust_id ? `
                <div class="accessory-frame">
                    <img class="accessory-illust" src="img/equip/${escapeHtml(skillAccessory.illust_id)}.webp" alt="" decoding="async">
                </div>
                ` : ''}

                <div class="accessory-body">
                    <div class="effect-top">
                        <span class="effect-name">
                            <img class="accessory-title-icon" src="img/icon_equipment_03_s.webp" alt="">
                            ${escapeHtml(skillAccessory.accessory_name)}
                        </span>
                    </div>

                    ${(accessoryStats.length || accessoryInlineCommonEffects.length) ? `
                    <div class="accessory-stats">
                        ${accessoryStats.map(stat => `
                        <span class="accessory-stat">
                            <span class="accessory-stat-label">${escapeHtml(stat.label)}</span>
                            <span class="accessory-stat-value">${escapeHtml(stat.value)}</span>
                        </span>
                        `).join('')}
                        ${accessoryInlineCommonEffects.map(effect => `
                        <span class="accessory-stat accessory-stat-effect">
                            <span class="accessory-effect-value">
                                ${escapeHtml(
                                    effect.type === '属性カウント+'
                                        ? effect.display_value
                                        : [effect.type, effect.display_value].filter(Boolean).join(' ')
                                )}
                            </span>
                        </span>
                        `).join('')}
                    </div>
                    ` : ''}

                    ${accessoryBlockCommonEffects.length ? `
                    <div class="effect-value">
                        ${accessoryBlockCommonEffects.map(effect => `
                        <div class="accessory-common-effect">
                            ${renderAccessoryEffectSummary(effect)}
                        </div>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
            </div>

            ${(accessoryRawTexts.length || accessorySkillEffects.length) ? `
            <div class="effect-children">
                ${accessoryRawTexts.map(rawText => `
                <div class="effect-box sub-effect other accessory-raw">
                    <div class="effect-top">
                        <span class="effect-formula">
                            ${escapeHtml(rawText).replace(/\n/g, '<br>')}
                        </span>
                    </div>
                </div>
                `).join('')}

                ${accessorySkillEffects.map(sub => `
                <div class="effect-box sub-effect ${escapeHtml(sub.effect_class || '')}">
                    <div class="effect-top">
                        <span class="effect-name">
                            ${escapeHtml(sub.type || '')}
                            ${sub.duration ? `<span class="effect-ct">${escapeHtml(sub.duration.ct)}CT</span>` : ''}
                        </span>
                        ${sub.target ? `<span class="effect-target">${escapeHtml(sub.target)}</span>` : ''}
                    </div>
                    ${sub.display_value ? `<div class="effect-value">${escapeHtml(sub.display_value)}</div>` : ''}
                    ${sub.formula ? `<div class="effect-formula">└ ${renderFormula(sub.formula)}</div>` : ''}
                    ${(sub.children && sub.children.length) ? `
                    <div class="effect-children">
                        ${sub.children.map(child => `
                        <div class="effect-box accessory${child.effect_class && child.effect_class !== 'accessory' ? ' ' + escapeHtml(child.effect_class) : ''}">
                            <div class="effect-top">
                                <span class="effect-name">
                                    ${escapeHtml(child.type || '')}
                                    ${child.duration ? `<span class="effect-ct">${escapeHtml(child.duration.ct)}CT</span>` : ''}
                                </span>
                                ${child.target ? `<span class="effect-target">${escapeHtml(child.target)}</span>` : ''}
                            </div>
                            ${child.display_value ? `<div class="effect-value">${escapeHtml(child.display_value)}</div>` : ''}
                            ${child.formula ? `<div class="effect-formula">└ ${renderFormula(child.formula)}</div>` : ''}
                            ${(child.notes && child.notes.length) ? child.notes.map(note => `
                            <div class="effect-note ${escapeHtml(note.type || '')}">
                                <span class="tag">${escapeHtml(note.label || '')}</span>
                                ${escapeHtml(note.text || '')}
                            </div>
                            `).join('') : ''}
                        </div>
                        `).join('')}
                    </div>
                    ` : ''}
                    ${(sub.notes && sub.notes.length) ? sub.notes.map(note => `
                    <div class="effect-note ${escapeHtml(note.type || '')}">
                        <span class="tag">${escapeHtml(note.label || '')}</span>
                        ${escapeHtml(note.text || '')}
                    </div>
                    `).join('') : ''}
                </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
        ` : ''}
    </div>

    <div class="skill-footer">
        [${escapeHtml(chara.unit_name)}] ${escapeHtml(chara.character_name)}
    </div>
</div>`;
}
