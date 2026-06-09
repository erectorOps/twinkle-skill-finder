const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const EX_ICONS = {
    'ex1': {
        viewBox: '6.5 2.5 71 28',
        d: 'M 3 2 M 13 3 L 7 30 L 29 30 L 32 24 L 16 24 L 17 19 L 30 19 L 32 13 L 18 13 L 19 9 L 33 9 L 35 3 Z M 30 30 L 40 30 L 47 22 L 50 30 L 59 30 L 52 17 L 65 3 L 56 3 L 49 11 L 45 3 L 36 3 L 42 16 Z M 63 30 L 67 12 L 63 12 L 64 8 C 66 8 67 8 68 7 C 69 6 70 5 71 4 L 77 4 L 71 30 Z Z',
    },
    'ex2': {
        viewBox: '6.5 2.5 78.53 28',
        d: 'M 3 2 M 13 3 L 7 30 L 29 30 L 32 24 L 16 24 L 17 19 L 30 19 L 32 13 L 18 13 L 19 9 L 33 9 L 35 3 Z M 30 30 L 40 30 L 47 22 L 50 30 L 59 30 L 52 17 L 65 3 L 56 3 L 49 11 L 45 3 L 36 3 L 42 16 Z M 59 30 L 81 30 L 83 24 L 71 24 L 81 18 C 82.994 16.298 84.03 14.527 84.531 11.953 C 84.431 9.279 83.529 7.575 81.924 6.138 C 80.32 4.801 78.448 4.299 76 4 C 73.936 3.731 72.031 3.765 70 4 C 67.051 5.202 66.249 5.77 65 7 C 64.277 8.31 63.508 9.547 62.873 10.884 C 62.573 11.652 62.439 12.187 62.405 12.956 L 69 13 C 69.3333 12.6667 69.692 12.388 70 12 C 70.795 10.583 71.029 10.182 72 10 C 73.101 9.58 73.903 9.714 75 10 C 75.474 10.282 75.775 10.683 76 11 C 76.243 11.586 76.176 12.354 76 13 C 75.574 13.792 74.705 14.393 73.903 14.928 C 72.499 15.463 70.795 16.365 68.522 17.735 C 67.252 18.404 66.182 19.106 65 20 C 63.976 20.944 62.94 21.746 62 23 C 61.169 24.286 60.534 25.556 60 27 Z Z Z',
    },
    'ex1-plus': {
        viewBox: '7 3 97 27',
        d: 'M 3 2 M 13 3 L 7 30 L 29 30 L 32 24 L 16 24 L 17 19 L 30 19 L 32 13 L 18 13 L 19 9 L 33 9 L 35 3 Z M 30 30 L 40 30 L 47 22 L 50 30 L 59 30 L 52 17 L 65 3 L 56 3 L 49 11 L 45 3 L 36 3 L 42 16 Z M 63 30 L 67 12 L 63 12 L 64 8 C 66 8 67 8 68 7 C 69 6 70 5 71 4 L 77 4 L 71 30 Z M 89 30 L 89 21 L 80 21 L 80 16 L 89 16 L 89 7 L 95 7 L 95 16 L 104 16 L 104 21 L 95 21 L 95 30 Z',
    },
    'ex2-plus': {
        viewBox: '6.5 2.5 106 28',
        d: 'M 3 2 M 13 3 L 7 30 L 29 30 L 32 24 L 16 24 L 17 19 L 30 19 L 32 13 L 18 13 L 19 9 L 33 9 L 35 3 Z M 30 30 L 40 30 L 47 22 L 50 30 L 59 30 L 52 17 L 65 3 L 56 3 L 49 11 L 45 3 L 36 3 L 42 16 Z M 59 30 L 81 30 L 83 24 L 71 24 L 81 18 C 82.994 16.298 84.03 14.527 84.531 11.953 C 84.431 9.279 83.529 7.575 81.924 6.138 C 80.32 4.801 78.448 4.299 76 4 C 73.936 3.731 72.031 3.765 70 4 C 67.051 5.202 66.249 5.77 65 7 C 64.277 8.31 63.508 9.547 62.873 10.884 C 62.573 11.652 62.439 12.187 62.405 12.956 L 69 13 C 69.3333 12.6667 69.692 12.388 70 12 C 70.795 10.583 71.029 10.182 72 10 C 73.101 9.58 73.903 9.714 75 10 C 75.474 10.282 75.775 10.683 76 11 C 76.243 11.586 76.176 12.354 76 13 C 75.574 13.792 74.705 14.393 73.903 14.928 C 72.499 15.463 70.795 16.365 68.522 17.735 C 67.252 18.404 66.182 19.106 65 20 C 63.976 20.944 62.94 21.746 62 23 C 61.169 24.286 60.534 25.556 60 27 Z Z Z M 98 30 L 98 21 L 89 21 L 89 16 L 98 16 L 98 7 L 103 7 L 103 16 L 112 16 L 112 21 L 103 21 L 103 30 Z',
    },
};

const renderExIcon = (typeCss) => {
    const icon = EX_ICONS[typeCss];
    if (!icon) return '';
    return `<span class="ex-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}"><path d="${icon.d}"/></svg></span>`;
};

const renderFormula = (formula) =>
    escapeHtml(formula)
        .replace(
            /\{([^{}]+)\}/g,
            '<span class="formula-group"><span class="formula-brace">{</span><span class="formula-body">$1</span><span class="formula-brace">}</span></span>'
        )
        .replace(/\+/g, '<span class="formula-op">+</span>');

const renderEffectBox = (effect, extraClass = '') => `
<div class="effect-box${extraClass ? ' ' + extraClass : ''} ${escapeHtml(effect.effect_class || '')}">
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
        ${effect.children.map(sub => `
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
    ${(effect.notes && effect.notes.length) ? effect.notes.map(note => `
    <div class="effect-note ${escapeHtml(note.type || '')}">
        <span class="tag">${escapeHtml(note.label || '')}</span>
        ${escapeHtml(note.text || '')}
    </div>
    `).join('') : ''}
</div>`;

export function renderCard(skill, chara, accessories) {
    const bgImage = `img/unit/chara_${skill.unit_id}_2_1.png`;

    const skillAccessory = (accessories || []).find(x => x.unit_id === skill.unit_id);

    const accessoryAbilities = skillAccessory
        ? skillAccessory.acc_abilities.filter(ability =>
            ability.skill_type === 'COMMON'
            || String(ability.skill_id) === String(skill.skill_id)
          )
        : [];

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

    let skillIcon = `img/skill_${String(skill.icon_id)}.png`;
    if (skill.icon_id < 10000) {
        skillIcon = `img/skill_${String(skill.icon_id).padStart(4, '0')}.png`;
    }

    const iconGroup = Math.floor(skill.icon_id / 100);
    const skillTypeBgMap = {
        1: 'img/btn_skill_attack.png',
        2: 'img/btn_skill_knockback.png',
        3: 'img/btn_skill_buff.png',
        4: 'img/btn_skill_debuff.png',
        5: 'img/btn_skill_status.png',
        6: 'img/btn_skill_recovery.png',
        7: 'img/btn_skill_special.png',
        30: 'img/btn_skill_specific.png',
    };
    const skillTypeBg = skillTypeBgMap[iconGroup] || 'img/btn_skill_blank.png';

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
                <img class="icon-base" src="img/attribute_base.png" alt="">
                <img class="icon-main icon-sp-equip-type" src="img/${escapeHtml(chara.sp_equip_types[0].icon)}" alt="">
            </div>
            ` : ''}

            <div class="icon-stack">
                <img class="icon-base" src="img/attribute_base.png" alt="">
                <img class="icon-main" src="img/${escapeHtml(chara.role.icon)}" alt="">
            </div>

            <div class="icon-stack">
                <img class="icon-base" src="img/attribute_base.png" alt="">
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
                    ${renderExIcon(skillTypeCss)}
                    <div class="skill-name">${escapeHtml(skill.name)}</div>

                    <div class="skill-sub">
                        <span class="card-rarity" aria-label="レアリティ ${escapeHtml(chara.rarity)}">
                            ${[1, 2, 3].map(i => `
                            <img
                                class="card-rarity-star ${i <= chara.rarity ? 'filled' : 'empty'}"
                                src="img/${i <= chara.rarity ? 'rare.png' : 'rare_slot.png'}"
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

        ${skill.effects.map(effect => renderEffectBox(effect)).join('')}

        ${showAccessory ? `
        <div class="effect-box accessory">
            <div class="accessory-summary">
                ${skillAccessory.illust_id ? `
                <div class="accessory-frame">
                    <img class="accessory-illust" src="img/equip/${escapeHtml(skillAccessory.illust_id)}.png" alt="" decoding="async">
                </div>
                ` : ''}

                <div class="accessory-body">
                    <div class="effect-top">
                        <span class="effect-name">
                            <img class="accessory-title-icon" src="img/icon_equipment_03_s.png" alt="">
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
