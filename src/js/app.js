import { renderCard } from './card.js';
import { renderFilterButtons } from './filters.js';

async function init() {

    // ── データ取得 ───────────────────────────────────
    const [skillIndex, skills, characters, accessories] = await Promise.all([
        fetch('data/index.json').then(r => r.json()),
        fetch('data/skills.json').then(r => r.json()),
        fetch('data/characters.json').then(r => r.json()),
        fetch('data/accessory.json').then(r => r.json()),
    ]);

    // ── フィルターボタンをレンダリング ───────────────
    document.getElementById('filter-panel-placeholder').innerHTML =
        renderFilterButtons(characters);

    // ── スキルカードをレンダリング ───────────────────
    const characterMap = new Map(characters.map(c => [c.unit_id, c]));
    const listElement = document.getElementById('skill-list');
    {
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        for (const skill of skills) {
            const chara = characterMap.get(skill.unit_id);
            if (!chara) continue;
            tempDiv.innerHTML = renderCard(skill, chara, accessories);
            const cardEl = tempDiv.firstElementChild;
            if (cardEl) fragment.appendChild(cardEl);
        }
        listElement.appendChild(fragment);
    }

    // ── DOM 参照 ─────────────────────────────────────
    const countElement =
        document.getElementById('visible-count');
    const searchInput =
        document.getElementById('skill-search');
    const clearFiltersButton =
        document.getElementById('clear-filters');
    const emptyResultElement =
        document.getElementById('empty-result');
    const sortMenuButton =
        document.getElementById('sort-menu-button');
    const sortOptionsElement =
        document.getElementById('sort-options');
    const openFilterPanelButton =
        document.getElementById('open-filter-panel');
    const applyFiltersButton =
        document.getElementById('apply-filters');
    const filterChipRow =
        document.getElementById('filter-chip-row');
    const rawViewToggle =
        document.getElementById('raw-view-toggle');
    const viewModeToggle =
        document.getElementById('view-mode-toggle');
    const compareModeToggle =
        document.getElementById('compare-mode-toggle');
    const compareActionBar =
        document.getElementById('compare-action-bar');
    const compareSelectedCount =
        document.getElementById('compare-selected-count');
    const runCompareButton =
        document.getElementById('run-compare');
    const cancelCompareButton =
        document.getElementById('cancel-compare');
    const compareSheet =
        document.getElementById('compare-sheet');
    const compareTableHost =
        document.getElementById('compare-table-host');
    const detailSheet =
        document.getElementById('detail-sheet');
    const detailTitle =
        document.getElementById('detail-title');
    const detailCardHost =
        document.getElementById('detail-card-host');

    // フィルターボタン・カードはレンダリング後に収集
    const sortOptions = [
        ...document.querySelectorAll('.sort-option')
    ];
    const filterButtons = [
        ...document.querySelectorAll('[data-filter-group]')
    ];
    const characterScopeButtons = [
        ...document.querySelectorAll('[data-character-scope-toggle]')
    ];
    const filterChips = [
        ...document.querySelectorAll('.filter-chip')
    ];

    const cards = [
        ...document.querySelectorAll('[data-skill-id]')
    ];
    const cardMap = new Map(
        cards.map(card => [
            card.dataset.skillId,
            card
        ])
    );
    const itemMap = new Map(
        skillIndex.map(item => [
            item.skill_id,
            item
        ])
    );

    // ── 定数 ─────────────────────────────────────────
    const skillTypeOrder = {
        EX1: 1,
        'EX1+': 2,
        EX2: 3,
        'EX2+': 4
    };
    const groupLabels = {
        rarity: 'レア',
        effect_categories: '効果',
        attr: '属性',
        races: '種族',
        affiliations: '所属',
        role: '役割',
        attack_types: '武器',
        obtains: '入手',
        release_years: '年別'
    };

    // ── 状態 ─────────────────────────────────────────
    const activeFilters = new Map();
    const pendingFilters = new Map();
    const sortedItemsCache = new Map();
    const STORAGE_KEY = 'twinkle_skill_finder_state';

    let currentSortKey = 'release_asc';
    let characterScopeMode = false;
    let pendingCharacterScopeMode = false;
    let appliedSearchText = "";
    let rawViewMode = true;
    let iconViewMode = false;
    let compareMode = false;
    let scheduledRenderFrame = 0;
    let scheduledRenderTimer = 0;

    // ── ソート ───────────────────────────────────────
    const compareNumber = (a, b) =>
        (a ?? Number.MAX_SAFE_INTEGER)
        - (b ?? Number.MAX_SAFE_INTEGER);
    const compareText = (a, b) =>
        String(a ?? '').localeCompare(
            String(b ?? ''),
            'ja'
        );
    const compareSkillType = (a, b) =>
        compareNumber(
            skillTypeOrder[a.skill_type],
            skillTypeOrder[b.skill_type]
        );
    const compareSkillId = (a, b) =>
        String(a.skill_id).localeCompare(
            String(b.skill_id),
            'ja',
            { numeric: true }
        );
    const compareReleaseAsc = (a, b) =>
        compareNumber(a.release_order, b.release_order)
        || compareNumber(a.unit_id, b.unit_id)
        || compareSkillType(a, b)
        || compareSkillId(a, b);
    const compareReleaseDesc = (a, b) =>
        compareNumber(b.release_order, a.release_order)
        || compareNumber(b.unit_id, a.unit_id)
        || compareSkillType(a, b)
        || compareSkillId(a, b);
    const compareRareDesc = (a, b) =>
        compareNumber(b.rarity, a.rarity)
        || compareReleaseAsc(a, b);
    const compareRareAsc = (a, b) =>
        compareNumber(a.rarity, b.rarity)
        || compareReleaseAsc(a, b);
    const compareKanaAsc = (a, b) =>
        compareText(a.character_name_kana, b.character_name_kana)
        || compareText(a.character_name, b.character_name)
        || compareReleaseAsc(a, b);
    const compareKanaDesc = (a, b) =>
        compareText(b.character_name_kana, a.character_name_kana)
        || compareText(b.character_name, a.character_name)
        || compareReleaseAsc(a, b);

    const comparers = {
        release_asc: compareReleaseAsc,
        release_desc: compareReleaseDesc,
        rare_desc: compareRareDesc,
        rare_asc: compareRareAsc,
        kana_asc: compareKanaAsc,
        kana_desc: compareKanaDesc
    };

    // ── フィルター ───────────────────────────────────
    const getActiveValues = (group) =>
        activeFilters.get(group) || new Set();

    const getPendingValues = (group) =>
        pendingFilters.get(group) || new Set();

    const replaceFilters = (target, source) => {
        target.clear();
        for (const [group, values] of source) {
            target.set(group, new Set(values));
        }
    };

    const hasAnyValue = (itemValues, activeValues) => {
        const values =
            Array.isArray(itemValues)
                ? itemValues.map(String)
                : [String(itemValues)];
        return values.some(value => activeValues.has(value));
    };

    const matchesSkillGroup = (item) => {
        const activeValues = getActiveValues('skill_group');
        if (activeValues.size === 0 || activeValues.has('all')) return true;
        if (activeValues.has('ex1')) return item.skill_type === 'EX1' || item.skill_type === 'EX1+';
        if (activeValues.has('ex2')) return item.skill_type === 'EX2' || item.skill_type === 'EX2+';
        return true;
    };

    const matchesFilters = (item) => {
        if (!matchesSkillGroup(item)) return false;
        for (const [group, activeValues] of activeFilters) {
            if (group === 'skill_group' || activeValues.size === 0) continue;
            if (!hasAnyValue(item[group], activeValues)) return false;
        }
        return true;
    };

    const normalizeSearchText = (value) =>
        String(value ?? '').trim().toLowerCase();
    const matchesSearch = (item) => {
        const query = normalizeSearchText(appliedSearchText);
        if (!query) return true;
        return String(item.search_text || '').includes(query);
    };
    const matchesCurrentConditions = (item) =>
        matchesFilters(item) && matchesSearch(item);

    // ── UI 更新 ──────────────────────────────────────
    const updateFilterButton = (button, active) => {
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    };

    const updateCharacterScopeToggle = () => {
        characterScopeButtons.forEach(button => {
            const active =
                button.dataset.characterScopeValue
                === (pendingCharacterScopeMode ? 'character' : 'skill');
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    };

    const setSingleFilter = (group, value, filters = pendingFilters) => {
        filters.set(group, new Set([value]));
        if (filters === pendingFilters) {
            filterButtons
                .filter(button => button.dataset.filterGroup === group)
                .forEach(button =>
                    updateFilterButton(button, button.dataset.filterValue === value)
                );
        }
    };

    const toggleMultiFilter = (button) => {
        const group = button.dataset.filterGroup;
        const value = button.dataset.filterValue;
        const values = new Set(getPendingValues(group));
        if (values.has(value)) {
            values.delete(value);
        } else {
            values.add(value);
        }
        if (values.size === 0) {
            pendingFilters.delete(group);
        } else {
            pendingFilters.set(group, values);
        }
        updateFilterButton(button, values.has(value));
    };

    const setActiveSortOption = (sortKey) => {
        sortOptions.forEach(option => {
            const active = option.dataset.sort === sortKey;
            option.classList.toggle('active', active);
            option.textContent =
                option.textContent.replace(/^[◉○]/, active ? '◉' : '○');
        });
    };

    const updateFilterChips = () => {
        filterChipRow.scrollLeft = 0;

        const orderedChips =
            [...filterChips].sort((a, b) => {
                const aCount = getActiveValues(a.dataset.openFilter).size;
                const bCount = getActiveValues(b.dataset.openFilter).size;
                return Number(bCount > 0) - Number(aCount > 0);
            });

        orderedChips.forEach(chip => {
            const group = chip.dataset.openFilter;
            const count = getActiveValues(group).size;
            chip.classList.toggle('active', count > 0);
            chip.innerHTML =
                count > 0
                    ? `<span>${groupLabels[group]}</span><span class="filter-chip-count">${count}</span><i class="bi bi-x-circle" aria-hidden="true"></i>`
                    : `<span>${groupLabels[group]}</span>`;
            filterChipRow.appendChild(chip);
        });
    };

    const clearFilterGroup = (group) => {
        activeFilters.delete(group);
        pendingFilters.delete(group);
        filterButtons
            .filter(button => button.dataset.filterGroup === group)
            .forEach(button => updateFilterButton(button, false));
        replaceFilters(pendingFilters, activeFilters);
        syncControlsFromState();
        scheduleRender();
    };

    // ── ソートキャッシュ ─────────────────────────────
    const getSortedItems = (sortKey) => {
        if (!sortedItemsCache.has(sortKey)) {
            const comparer = comparers[sortKey] || compareReleaseAsc;
            sortedItemsCache.set(sortKey, [...skillIndex].sort(comparer));
        }
        return sortedItemsCache.get(sortKey);
    };

    // ── 比較モード ───────────────────────────────────
    const getSelectedSkillIds = () =>
        cards
            .filter(card => card.querySelector('[data-compare-check]')?.checked)
            .map(card => card.dataset.skillId);

    const updateCompareSelection = () => {
        const count = getSelectedSkillIds().length;
        compareSelectedCount.textContent = `${count}件選択`;
        runCompareButton.disabled = count < 2;
    };

    const updateModeViews = () => {
        document.body.classList.toggle('icon-view', iconViewMode);
        document.body.classList.toggle('hide-raw', !rawViewMode);
        document.body.classList.toggle('compare-mode', compareMode);
        rawViewToggle.setAttribute('aria-pressed', rawViewMode ? 'true' : 'false');
        viewModeToggle.setAttribute('aria-pressed', iconViewMode ? 'true' : 'false');
        compareModeToggle.classList.toggle('active', compareMode);
        compareActionBar.hidden = !compareMode;
        updateCompareSelection();
    };

    // ── レンダリング ─────────────────────────────────
    const render = (sortKey = currentSortKey) => {
        currentSortKey = sortKey;

        const fragment = document.createDocumentFragment();
        const sortedItems = getSortedItems(sortKey);
        const matchedUnitIds = new Set();
        const visibleSkillIds = new Set();

        for (const item of skillIndex) {
            if (matchesCurrentConditions(item)) {
                matchedUnitIds.add(item.unit_id);
                visibleSkillIds.add(item.skill_id);
            }
        }

        if (characterScopeMode) {
            for (const item of skillIndex) {
                if (matchedUnitIds.has(item.unit_id)) {
                    visibleSkillIds.add(item.skill_id);
                }
            }
        }

        let visibleCount = 0;

        for (const item of sortedItems) {
            const card = cardMap.get(item.skill_id);
            if (card) {
                const visible = visibleSkillIds.has(item.skill_id);
                card.hidden = !visible;
                if (visible) visibleCount++;
                fragment.appendChild(card);
            }
        }

        listElement.appendChild(fragment);
        countElement.textContent = visibleCount;
        emptyResultElement.hidden = visibleCount !== 0;
        setActiveSortOption(sortKey);
        updateFilterChips();
        updateModeViews();
    };

    // ── 状態の保存・復元 ─────────────────────────────
    const serializeFilters = () =>
        Object.fromEntries(
            [...activeFilters].map(([group, values]) => [group, [...values]])
        );

    const saveState = () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                sort: currentSortKey,
                filters: serializeFilters(),
                search: appliedSearchText,
                characterScope: characterScopeMode,
                raw: rawViewMode,
                iconView: iconViewMode
            })
        );
    };

    const scheduleRender = (sortKey = currentSortKey) => {
        currentSortKey = sortKey;
        setActiveSortOption(sortKey);
        if (scheduledRenderFrame) cancelAnimationFrame(scheduledRenderFrame);
        if (scheduledRenderTimer) clearTimeout(scheduledRenderTimer);
        scheduledRenderFrame = requestAnimationFrame(() => {
            scheduledRenderFrame = 0;
            scheduledRenderTimer = setTimeout(() => {
                scheduledRenderTimer = 0;
                render(currentSortKey);
                saveState();
            }, 0);
        });
    };

    const applyFilterButtons = () => {
        filterButtons.forEach(button => {
            const values = getPendingValues(button.dataset.filterGroup);
            updateFilterButton(button, values.has(button.dataset.filterValue));
        });
    };

    const syncControlsFromState = () => {
        applyFilterButtons();
        updateCharacterScopeToggle();
        updateFilterChips();
        updateModeViews();
        setActiveSortOption(currentSortKey);
    };

    const restoreState = () => {
        const rawState = localStorage.getItem(STORAGE_KEY);
        if (!rawState) {
            setSingleFilter('skill_group', 'all', activeFilters);
            setSingleFilter('skill_group', 'all', pendingFilters);
            syncControlsFromState();
            return;
        }
        try {
            const state = JSON.parse(rawState);
            activeFilters.clear();
            pendingFilters.clear();
            for (const [group, values] of Object.entries(state.filters || {})) {
                if (Array.isArray(values) && values.length) {
                    activeFilters.set(group, new Set(values.map(String)));
                }
            }
            if (!getActiveValues('skill_group').size) {
                activeFilters.set('skill_group', new Set(['all']));
            }
            replaceFilters(pendingFilters, activeFilters);
            searchInput.value = state.search || "";
            appliedSearchText = state.search || "";
            characterScopeMode = state.characterScope === true;
            pendingCharacterScopeMode = characterScopeMode;
            rawViewMode = state.raw !== false;
            iconViewMode = state.iconView === true;
            currentSortKey = comparers[state.sort] ? state.sort : 'release_asc';
            syncControlsFromState();
        } catch {
            activeFilters.clear();
            pendingFilters.clear();
            searchInput.value = "";
            appliedSearchText = "";
            characterScopeMode = false;
            pendingCharacterScopeMode = false;
            rawViewMode = true;
            iconViewMode = false;
            currentSortKey = 'release_asc';
            setSingleFilter('skill_group', 'all', activeFilters);
            setSingleFilter('skill_group', 'all', pendingFilters);
            syncControlsFromState();
        }
    };

    // ── パネル開閉 ───────────────────────────────────
    const closeSortMenu = () => {
        sortOptionsElement.hidden = true;
        sortMenuButton.setAttribute('aria-expanded', 'false');
    };

    const openFilterPanel = () => {
        document.body.classList.add('filter-open');
        document.querySelector('.filter-dock-content')
            ?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const closeFilterPanel = () => {
        document.body.classList.remove('filter-open');
    };

    const openFilterGroup = (group) => {
        document.body.classList.add('filter-open');
        const button = document.querySelector(`[data-filter-group="${group}"]`);
        requestAnimationFrame(() => {
            const groupElement = button?.closest('.filter-group');
            const scrollElement = button?.closest('.filter-dock-content');
            if (!groupElement || !scrollElement) return;
            scrollElement.scrollTo({
                top: groupElement.offsetTop - scrollElement.offsetTop - 8,
                behavior: 'smooth'
            });
        });
    };

    const resetFilters = () => {
        activeFilters.clear();
        pendingFilters.clear();
        searchInput.value = "";
        appliedSearchText = "";
        characterScopeMode = false;
        pendingCharacterScopeMode = false;
        setSingleFilter('skill_group', 'all', activeFilters);
        setSingleFilter('skill_group', 'all', pendingFilters);
        syncControlsFromState();
        scheduleRender();
    };

    // ── 比較 ─────────────────────────────────────────
    const ensureCompareSelectors = () => {
        cards.forEach(card => {
            if (card.querySelector('[data-compare-check]')) return;
            const label = document.createElement('label');
            label.className = 'compare-selector';
            label.innerHTML = '<input type="checkbox" data-compare-check><span>選択</span>';
            label.addEventListener('click', event => event.stopPropagation());
            label.querySelector('input').addEventListener('change', updateCompareSelection);
            card.appendChild(label);
        });
    };

    const shortenCompareLabel = (label) =>
        String(label || '')
            .replace(/クリティカルダメージアップ/g, 'クリダメUP')
            .replace(/クリティカル率アップ/g, 'クリ率UP')
            .replace(/相手スタン時ダメージ倍率アップ/g, 'スタン特効')
            .replace(/被ダメージアップ/g, '被ダメUP')
            .replace(/特殊被ダメージアップ/g, '特殊被ダメUP')
            .replace(/行動CT短縮/g, 'CT短縮')
            .replace(/ノーツ強制移動/g, '強制移動')
            .replace(/ノーツ移動/g, 'ノーツ移動')
            .replace(/ATKアップ/g, 'ATK UP')
            .replace(/\s+/g, ' ')
            .trim();

    const collectComparableEffects = (skillId) => {
        const card = cardMap.get(skillId);
        return [...card.querySelectorAll('.effect-box')]
            .filter(box =>
                !box.classList.contains('skill-raw')
                && !box.classList.contains('accessory-raw')
                && !box.classList.contains('accessory')
            )
            .map(box => {
                const name =
                    box.querySelector(':scope > .effect-top .effect-name')
                        ?.textContent
                        ?.replace(/\s+/g, ' ')
                        ?.trim();
                const value =
                    box.querySelector(':scope > .effect-value')
                        ?.textContent
                        ?.replace(/\s+/g, ' ')
                        ?.trim();
                return name ? [shortenCompareLabel(name), value || 'あり'] : null;
            })
            .filter(Boolean);
    };

    const renderCompareTable = () => {
        const skillIds = getSelectedSkillIds();
        const rowLabels = new Set(['スキル']);
        const effectMap = new Map();
        const columns = skillIds.map(skillId => {
            const item = itemMap.get(skillId);
            const effects = collectComparableEffects(skillId);
            effectMap.set(skillId, new Map(effects));
            effects.forEach(([label]) => rowLabels.add(label));
            return { skillId, item };
        });

        const bodyRows =
            [...rowLabels].map(label => {
                const cells = columns.map(column => {
                    if (label === 'スキル') {
                        return {
                            value: column.item?.skill_type || '-',
                            hasValue: Boolean(column.item?.skill_type)
                        };
                    }
                    const value =
                        effectMap.get(column.skillId)?.get(label) || "";
                    return { value: value || '-', hasValue: Boolean(value) };
                });
                return `
                    <tr>
                        <th>${label}</th>
                        ${cells.map(cell =>
                            `<td class="${cell.hasValue ? 'has-value' : 'empty-value'}">${cell.value}</td>`
                        ).join('')}
                    </tr>
                `;
            }).join('');

        compareTableHost.innerHTML = `
            <table class="compare-table">
                <thead>
                    <tr>
                        <th>アイコン</th>
                        ${columns.map(column => `
                            <th>
                                <img src="img/unit/chara_${column.item?.unit_id}_2_1.png" alt="">
                                <span class="compare-unit-name">[${column.item?.unit_name || column.skillId}]</span>
                                <span class="compare-character-name">${column.item?.character_name || ''}</span>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>${bodyRows}</tbody>
            </table>
        `;
    };

    const openCompareSheet = () => {
        compareSheet.hidden = false;
        document.body.classList.add('sheet-open');
    };

    const closeCompareSheet = () => {
        compareSheet.hidden = true;
        document.body.classList.remove('sheet-open');
    };

    const openDetailSheet = (skillId) => {
        const item = itemMap.get(skillId);
        if (!item) return;

        const showsCharacterSkills =
            characterScopeMode || pendingCharacterScopeMode;
        const detailItems =
            showsCharacterSkills
                ? skillIndex.filter(skill => skill.unit_id === item.unit_id)
                : [item];

        detailTitle.textContent =
            showsCharacterSkills
                ? `[${item.unit_name}] ${item.character_name}`
                : item.skill_name;

        detailCardHost.innerHTML = "";

        for (const detailItem of detailItems) {
            const card = cardMap.get(detailItem.skill_id);
            if (!card) continue;
            const clone = card.cloneNode(true);
            clone.removeAttribute('id');
            clone.hidden = false;
            clone.classList.add('skill-modal-card');
            clone.querySelectorAll('[data-compare-check], .compare-selector')
                .forEach(element => element.remove());
            detailCardHost.appendChild(clone);
        }

        detailSheet.hidden = false;
        document.body.classList.add('sheet-open');
    };

    const closeDetailSheet = () => {
        detailSheet.hidden = true;
        detailCardHost.innerHTML = "";
        if (compareSheet.hidden) {
            document.body.classList.remove('sheet-open');
        }
    };

    // ── イベントリスナー ─────────────────────────────

    // マウスホイールの縦スクロールを横スクロールに変換
    filterChipRow.addEventListener('wheel', (event) => {
        if (event.deltaX !== 0) return; // トラックパッドの横スクロールはそのまま通す
        event.preventDefault();
        filterChipRow.scrollLeft += event.deltaY;
    }, { passive: false });

    sortMenuButton.addEventListener('click', () => {
        const expanded =
            sortMenuButton.getAttribute('aria-expanded') === 'true';
        sortOptionsElement.hidden = expanded;
        sortMenuButton.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    });

    sortOptions.forEach(option => {
        option.addEventListener('click', () => {
            scheduleRender(option.dataset.sort);
            closeSortMenu();
        });
    });

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const group = button.dataset.filterGroup;
            const value = button.dataset.filterValue;
            if (group === 'skill_group') {
                setSingleFilter(group, value);
            } else {
                toggleMultiFilter(button);
            }
        });
    });

    characterScopeButtons.forEach(button => {
        button.addEventListener('click', () => {
            pendingCharacterScopeMode =
                button.dataset.characterScopeValue === 'character';
            updateCharacterScopeToggle();
        });
    });

    searchInput.addEventListener('input', () => {
        saveState();
    });

    clearFiltersButton.addEventListener('click', resetFilters);

    openFilterPanelButton.addEventListener('click', openFilterPanel);

    applyFiltersButton.addEventListener('click', () => {
        replaceFilters(activeFilters, pendingFilters);
        characterScopeMode = pendingCharacterScopeMode;
        appliedSearchText = searchInput.value;
        scheduleRender();
        closeFilterPanel();
    });

    document.querySelectorAll('[data-close-filter]').forEach(element => {
        element.addEventListener('click', closeFilterPanel);
    });

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const group = chip.dataset.openFilter;
            if (getActiveValues(group).size > 0) {
                clearFilterGroup(group);
                return;
            }
            openFilterGroup(group);
        });
    });

    viewModeToggle.addEventListener('click', () => {
        iconViewMode = !iconViewMode;
        updateModeViews();
        saveState();
    });

    rawViewToggle.addEventListener('click', () => {
        rawViewMode = !rawViewMode;
        updateModeViews();
        saveState();
    });

    compareModeToggle.addEventListener('click', () => {
        compareMode = !compareMode;
        ensureCompareSelectors();
        if (!compareMode) {
            cards.forEach(card => {
                const check = card.querySelector('[data-compare-check]');
                if (check) check.checked = false;
            });
        }
        updateModeViews();
    });

    cancelCompareButton.addEventListener('click', () => {
        compareMode = false;
        cards.forEach(card => {
            const check = card.querySelector('[data-compare-check]');
            if (check) check.checked = false;
        });
        updateModeViews();
    });

    runCompareButton.addEventListener('click', () => {
        renderCompareTable();
        openCompareSheet();
    });

    document.querySelectorAll('[data-close-compare]').forEach(element => {
        element.addEventListener('click', closeCompareSheet);
    });

    document.querySelectorAll('[data-close-detail]').forEach(element => {
        element.addEventListener('click', closeDetailSheet);
    });

    cards.forEach(card => {
        card.addEventListener('click', event => {
            if (
                !iconViewMode
                || compareMode
                || event.target.closest('.compare-selector')
            ) {
                return;
            }
            openDetailSheet(card.dataset.skillId);
        });
    });

    document.addEventListener('click', event => {
        if (!event.target.closest('.sort-menu') && !sortOptionsElement.hidden) {
            closeSortMenu();
        }
    });

    // ── 初期化 ───────────────────────────────────────
    restoreState();
    syncControlsFromState();
    render(currentSortKey);
}

init();
