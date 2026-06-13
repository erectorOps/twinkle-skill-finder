import '../scss/style.scss';
import { renderCard } from './card.js';
import { renderFilterButtons } from './filters.js';
import { matchesDetailConditions, getMatchedEffectKeys, isLive, createDetailFilter } from './detailFilter.js';
import { initSheetDrag } from './sheetDrag.js';
import dataHash from '../data/dataHash.generated.json';

async function init() {

    // ── データ取得 ───────────────────────────────────
    const [skillIndex, skills, characters, accessories] = await Promise.all([
        fetch(`data/index.json?v=${dataHash.index}`).then(r => r.json()),
        fetch(`data/skills.json?v=${dataHash.skills}`).then(r => r.json()),
        fetch(`data/characters.json?v=${dataHash.characters}`).then(r => r.json()),
        fetch(`data/accessory.json?v=${dataHash.accessory}`).then(r => r.json()),
    ]);

    // ── フィルターボタンをレンダリング ───────────────
    document.getElementById('dock-scroll').innerHTML =
        renderFilterButtons(characters);

    // ── カードデータマップ（遅延レンダリング用） ──────
    const characterMap = new Map(characters.map(c => [c.unit_id, c]));
    const skillDataMap = new Map(skills.map(s => [String(s.skill_id), s]));
    const listElement = document.getElementById('skill-list');

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
    const sheetGrip =
        document.querySelector('.sheet-grip');
    const filterDockPanel =
        document.querySelector('.filter-dock-panel');
    const uiSizeToggle =
        document.getElementById('ui-size-toggle');
    const scrollToTopButton =
        document.getElementById('scroll-to-top');

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
    const skillGroupButtons = [
        ...document.querySelectorAll('[data-filter-group="skill_group"]')
    ];
    const filterChips = [
        ...document.querySelectorAll('.filter-chip')
    ];
    const facetSections = [
        ...document.querySelectorAll('.facet')
    ];
    const effectModeButtons = [
        ...document.querySelectorAll('[data-effect-mode]')
    ];
    const effectPanes = [
        ...document.querySelectorAll('[data-effect-pane]')
    ];
    const detailFilterRoot =
        document.getElementById('detail-filter-root');

    const cardMap = new Map();
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
    const UI_SIZE_KEY = 'tsf-ui-size';

    let currentSortKey = 'release_asc';
    let characterScopeMode = false;
    let pendingCharacterScopeMode = false;
    let appliedSearchText = "";
    let rawViewMode = true;
    let iconViewMode = false;
    let comfortableUi = localStorage.getItem(UI_SIZE_KEY) === 'comfortable';
    let compareMode = false;
    let scheduledRenderFrame = 0;
    let scheduledRenderTimer = 0;
    let effectFilterMode = 'cat';
    let pendingEffectFilterMode = 'cat';
    let detailConditions = [];
    let pendingDetailConditions = [];

    // ── 表示幅 ───────────────────────────────────────
    const isLiveMode = () => window.matchMedia('(min-width: 951px)').matches;

    const PAGE_SIZE = 50;
    let currentVisibleItems = [];
    let renderedCount = 0;

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
        if (characterScopeMode) return true;
        const activeValues = getActiveValues('skill_group');
        if (activeValues.size === 0 || activeValues.has('all')) return true;
        if (activeValues.has('ex1')) return item.skill_type === 'EX1';
        if (activeValues.has('ex2')) return item.skill_type === 'EX2';
        if (activeValues.has('awaken')) return item.skill_type === 'EX1+' || item.skill_type === 'EX2+';
        return true;
    };

    const matchesFilters = (item) => {
        if (!matchesSkillGroup(item)) return false;
        if (effectFilterMode === 'detail') {
            if (detailConditions.length > 0 && !matchesDetailConditions(item, detailConditions)) return false;
        }
        for (const [group, activeValues] of activeFilters) {
            if (group === 'skill_group' || activeValues.size === 0) continue;
            if (group === 'effect_categories' && effectFilterMode === 'detail') continue;
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
        skillGroupButtons.forEach(button => {
            button.disabled = pendingCharacterScopeMode;
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

    const getGroupCount = (group) => {
        if (group === 'effect_categories' && effectFilterMode === 'detail') {
            return detailConditions.filter(isLive).length;
        }
        return getActiveValues(group).size;
    };

    const updateFilterChips = () => {
        const orderedChips =
            [...filterChips].sort((a, b) => {
                const aCount = getGroupCount(a.dataset.openFilter);
                const bCount = getGroupCount(b.dataset.openFilter);
                return Number(bCount > 0) - Number(aCount > 0);
            });

        orderedChips.forEach(chip => {
            const group = chip.dataset.openFilter;
            const count = getGroupCount(group);
            chip.classList.toggle('active', count > 0);
            chip.innerHTML =
                count > 0
                    ? `<span>${groupLabels[group]}</span><span class="filter-chip-count">${count}</span><i class="bi bi-x-circle" aria-hidden="true"></i>`
                    : `<span>${groupLabels[group]}</span>`;
            filterChipRow.appendChild(chip);
        });

        // キーワードchipを常に先頭に配置
        if (appliedSearchText) {
            keywordChip.hidden = false;
            keywordChip.innerHTML =
                `<span>${escHtml(appliedSearchText)}</span><i class="bi bi-x-circle" aria-hidden="true"></i>`;
            filterChipRow.prepend(keywordChip);
        } else {
            keywordChip.hidden = true;
        }

        filterChipRow.scrollLeft = 0;
    };

    const setFacetOpen = (section, open) => {
        const header = section.querySelector('.facet-header');
        const body = section.querySelector('.facet-body');
        header.setAttribute('aria-expanded', open ? 'true' : 'false');
        body.hidden = !open;
    };

    const updateFacetCounts = () => {
        facetSections.forEach(section => {
            const group = section.dataset.facetGroup;
            const count = getPendingValues(group).size;
            const badge = section.querySelector('.facet-count');
            badge.hidden = count === 0;
            badge.textContent = count;
        });
    };

    const clearFilterGroup = (group) => {
        activeFilters.delete(group);
        pendingFilters.delete(group);
        filterButtons
            .filter(button => button.dataset.filterGroup === group)
            .forEach(button => updateFilterButton(button, false));
        replaceFilters(pendingFilters, activeFilters);
        if (group === 'effect_categories') {
            detailConditions = [];
            pendingDetailConditions = [];
            detailFilter.setConditions([]);
        }
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
        [...listElement.querySelectorAll('.skill-card.compare-selected')]
            .map(el => el.dataset.skillId)
            .filter(Boolean);

    const updateCompareSelection = () => {
        const count = getSelectedSkillIds().length;
        compareSelectedCount.textContent = `${count}`;
        runCompareButton.disabled = count < 2;
    };

    const toggleCompareSelection = (card) => {
        if (!card.dataset.skillId) return;
        card.classList.toggle('compare-selected');
        updateCompareSelection();
    };

    const updateModeViews = () => {
        document.body.classList.toggle('icon-view', iconViewMode);
        document.body.classList.toggle('hide-raw', !rawViewMode);
        document.body.classList.toggle('compare-mode', compareMode);
        rawViewToggle.setAttribute('aria-pressed', rawViewMode ? 'true' : 'false');
        viewModeToggle.setAttribute('aria-pressed', iconViewMode ? 'true' : 'false');
        compareModeToggle.classList.toggle('active', compareMode);
        if (!compareMode) {
            closeCompareBar();
        } else {
            openCompareBar();
        }
        updateCompareSelection();
    };

    const closeCompareBar = () => {
        compareActionBar.classList.add('is-hidden');
        setTimeout(() => {
            if (compareActionBar.classList.contains('is-hidden')) {
                compareActionBar.hidden = true;
            }
        }, 300);
    }

    const openCompareBar = () => {
        compareActionBar.hidden = false;
        requestAnimationFrame(() => {
            compareActionBar.classList.remove('is-hidden');
        })
    }

    // ── スキル効果フィルター(カテゴリ/詳細) ─────────
    const updateEffectModeUI = () => {
        effectModeButtons.forEach(button => {
            const active = button.dataset.effectMode === pendingEffectFilterMode;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        effectPanes.forEach(pane => {
            pane.hidden = pane.dataset.effectPane !== pendingEffectFilterMode;
        });
    };

    const detailFilter = createDetailFilter(detailFilterRoot, {
        conditions: pendingDetailConditions,
        onChange: (conditions) => {
            pendingDetailConditions = conditions;
            if (isLiveMode()) applyPendingFilters();
            else updateApplyButtonState();
        }
    });

    // ── 効果ハイライト ───────────────────────────────
    const applyEffectHighlight = (cardEl, item) => {
        const skill = skillDataMap.get(String(item.skill_id));
        if (!skill) return;
        const { matched, hasMatchChild } = getMatchedEffectKeys(skill, {
            effectFilterMode,
            effectCategories: getActiveValues('effect_categories'),
            detailConditions
        });
        cardEl.querySelectorAll('.effect-box[data-idx]').forEach(box => {
            const idx = Number(box.dataset.idx);
            box.classList.toggle('is-match', matched.has(idx));
            box.classList.toggle('has-match-child', hasMatchChild.has(idx));
        });
    };

    // ── 遅延レンダリング ─────────────────────────────
    const cardTempDiv = document.createElement('div');

    const getOrCreateCardElement = (skillId, unitId) => {
        const key = String(skillId);
        if (cardMap.has(key)) return cardMap.get(key);
        const skill = skillDataMap.get(key);
        const chara = characterMap.get(unitId);
        if (!skill || !chara) return null;
        cardTempDiv.innerHTML = renderCard(skill, chara, accessories);
        const cardEl = cardTempDiv.firstElementChild;
        if (!cardEl) return null;
        cardMap.set(key, cardEl);
        return cardEl;
    };

    const addCompareBadge = (card) => {
        if (card.querySelector('[data-compare-badge]')) return;
        const badge = document.createElement('div');
        badge.className = 'compare-badge';
        badge.setAttribute('data-compare-badge', '');
        badge.innerHTML = '✓';
        card.appendChild(badge);
    };

    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.hidden = true;
    listElement.insertAdjacentElement('afterend', sentinel);

    const renderNextBatch = () => {
        const from = renderedCount;
        const to = Math.min(from + PAGE_SIZE, currentVisibleItems.length);
        if (from >= to) { sentinel.hidden = true; return; }
        const fragment = document.createDocumentFragment();
        for (let i = from; i < to; i++) {
            const item = currentVisibleItems[i];
            const cardEl = getOrCreateCardElement(item.skill_id, item.unit_id);
            if (!cardEl) continue;
            applyEffectHighlight(cardEl, item);
            if (compareMode && !cardEl.querySelector('[data-compare-badge]')) {
                addCompareBadge(cardEl);
            }
            cardEl.hidden = false;
            fragment.appendChild(cardEl);
        }
        listElement.appendChild(fragment);
        renderedCount = to;
        sentinel.hidden = renderedCount >= currentVisibleItems.length;
    };

    // センチネルがまだ画面内にある間は追加でロードし続ける
    const ensureViewportFilled = () => {
        requestAnimationFrame(() => {
            if (sentinel.hidden) return;
            if (sentinel.getBoundingClientRect().top < window.innerHeight + 300) {
                renderNextBatch();
                ensureViewportFilled();
            }
        });
    };

    new IntersectionObserver(
        (entries) => {
            if (entries[0].isIntersecting) {
                renderNextBatch();
                ensureViewportFilled();
            }
        },
        { rootMargin: '300px' }
    ).observe(sentinel);

    // ── レンダリング ─────────────────────────────────
    const render = (sortKey = currentSortKey) => {
        currentSortKey = sortKey;

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

        currentVisibleItems = sortedItems.filter(item => visibleSkillIds.has(item.skill_id));
        renderedCount = 0;
        listElement.innerHTML = '';

        countElement.textContent = currentVisibleItems.length;
        emptyResultElement.hidden = currentVisibleItems.length !== 0;
        setActiveSortOption(sortKey);
        updateFilterChips();
        updateModeViews();

        renderNextBatch();
        ensureViewportFilled();
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
                iconView: iconViewMode,
                effectFilterMode,
                detailConditions
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
        updateEffectModeUI();
        updateFilterChips();
        updateFacetCounts();
        updateModeViews();
        setActiveSortOption(currentSortKey);
        updateApplyButtonState();
    };

    const hasPendingChanges = () => {
        if (searchInput.value !== appliedSearchText) return true;
        if (pendingCharacterScopeMode !== characterScopeMode) return true;
        if (pendingEffectFilterMode !== effectFilterMode) return true;
        if (JSON.stringify(pendingDetailConditions) !== JSON.stringify(detailConditions)) return true;
        if (pendingFilters.size !== activeFilters.size) return true;
        for (const [group, pending] of pendingFilters) {
            const active = activeFilters.get(group);
            if (!active || pending.size !== active.size) return true;
            for (const v of pending) {
                if (!active.has(v)) return true;
            }
        }
        return false;
    };

    const updateApplyButtonState = () => {
        applyFiltersButton.classList.toggle('has-pending', hasPendingChanges());
    };

    const applyPendingFilters = () => {
        replaceFilters(activeFilters, pendingFilters);
        characterScopeMode = pendingCharacterScopeMode;
        effectFilterMode = pendingEffectFilterMode;
        detailConditions = pendingDetailConditions;
        appliedSearchText = searchInput.value;
        if (!appliedSearchText) keywordChip.hidden = true;
        scheduleRender();
        updateApplyButtonState();
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
            effectFilterMode = state.effectFilterMode === 'detail' ? 'detail' : 'cat';
            pendingEffectFilterMode = effectFilterMode;
            detailFilter.setConditions(Array.isArray(state.detailConditions) ? state.detailConditions : []);
            detailConditions = detailFilter.getConditions();
            pendingDetailConditions = detailFilter.getConditions();
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
            effectFilterMode = 'cat';
            pendingEffectFilterMode = 'cat';
            detailFilter.setConditions([]);
            detailConditions = [];
            pendingDetailConditions = [];
            setSingleFilter('skill_group', 'all', activeFilters);
            setSingleFilter('skill_group', 'all', pendingFilters);
            syncControlsFromState();
        }
    };

    // ── パネル開閉 ───────────────────────────────────
    const closeSortMenu = () => {
        sortOptionsElement.classList.add('is-hidden');
        sortMenuButton.setAttribute('aria-expanded', 'false');
    };

    const openFilterPanel = () => {
        document.body.classList.add('filter-open');
        requestAnimationFrame(() => {
            document.querySelector('.dock-scroll')
                ?.scrollTo({ top: 0 });
        });
    };

    const closeFilterPanel = () => {
        document.body.classList.remove('filter-open');
    };

    const applyUiSize = () => {
        document.body.dataset.uiSize = comfortableUi ? 'comfortable' : 'compact';
        uiSizeToggle.setAttribute('aria-pressed', comfortableUi ? 'true' : 'false');
    };

    const openFilterGroup = (group) => {
        document.body.classList.add('filter-open');
        const button = document.querySelector(`[data-filter-group="${group}"]`);
        const targetFacet = button?.closest('.facet');
        facetSections.forEach(section => {
            setFacetOpen(section, section === targetFacet);
        });
        requestAnimationFrame(() => {
            const groupElement = button?.closest('.filter-group') || button?.closest('.effect-section');
            const scrollElement = button?.closest('.dock-scroll');
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
        effectFilterMode = 'cat';
        pendingEffectFilterMode = 'cat';
        detailConditions = [];
        pendingDetailConditions = [];
        detailFilter.setConditions([]);
        setSingleFilter('skill_group', 'all', activeFilters);
        setSingleFilter('skill_group', 'all', pendingFilters);
        syncControlsFromState();
        scheduleRender();
    };

    // ── 比較 ─────────────────────────────────────────
    const ensureCompareBadges = () => {
        listElement.querySelectorAll('[data-skill-id]').forEach(addCompareBadge);
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

    /* .effect-box を effect-children 経由で再帰的に辿り、比較表の行情報 (depth/isLast込み) を作る。
       skill-raw・accessory-raw・accessory (ラップ用の箱) 自身は行にせず、子を同じ depth で辿る。 */
    const buildCompareRows = (boxes, depth = 0) => {
        const rows = [];
        boxes.forEach((box, i) => {
            const isLast = i === boxes.length - 1;
            const children = [...box.querySelectorAll(':scope > .effect-children > .effect-box')];

            if (
                box.classList.contains('skill-raw')
                || box.classList.contains('accessory-raw')
                || box.classList.contains('accessory')
            ) {
                rows.push(...buildCompareRows(children, depth));
                return;
            }

            const nameEl = box.querySelector(':scope > .effect-top .effect-name');
            const name = nameEl?.textContent;
            if (name) {
                const value =
                    box.querySelector(':scope > .effect-value')
                        ?.textContent
                        ?.replace(/\s+/g, ' ')
                        ?.trim();
                const prefix = depth === 0 ? '' : (isLast ? '└ ' : '├ ');
                rows.push({
                    label: shortenCompareLabel(name),
                    value: value || 'あり',
                    labelHtml: shortenCompareLabel(nameEl.innerHTML),
                    depth,
                    prefix,
                });
            }

            if (children.length) rows.push(...buildCompareRows(children, depth + 1));
        });
        return rows;
    };

    const collectComparableEffects = (skillId) => {
        const card = cardMap.get(skillId);
        const rootBoxes = [...card.querySelectorAll(':scope > .effect-list > .effect-box')];
        return buildCompareRows(rootBoxes, 0);
    };

    const renderCompareTable = () => {
        const skillIds = getSelectedSkillIds();
        const rowLabels = new Set();
        const rowLabelHtml = new Map();
        const rowLabelDepth = new Map();
        const rowLabelPrefix = new Map();
        const effectMap = new Map();
        const columns = skillIds.map(skillId => {
            const item = itemMap.get(skillId);
            const rows = collectComparableEffects(skillId);
            effectMap.set(skillId, new Map(rows.map(row => [row.label, row.value])));
            rows.forEach(row => {
                rowLabels.add(row.label);
                if (!rowLabelHtml.has(row.label)) {
                    rowLabelHtml.set(row.label, row.labelHtml);
                    rowLabelDepth.set(row.label, row.depth);
                    rowLabelPrefix.set(row.label, row.prefix);
                }
            });
            return { skillId, item };
        });

        const bodyRows =
            [...rowLabels].map(label => {
                const depth = rowLabelDepth.get(label);
                const cells = columns.map(column => {
                    const value =
                        effectMap.get(column.skillId)?.get(label) || "";
                    return { value: value || '-', hasValue: Boolean(value) };
                });
                return `
                    <tr data-depth="${depth}">
                        <th>${rowLabelPrefix.get(label)}${rowLabelHtml.get(label)}</th>
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
                            <th data-skill-id="${column.skillId}">
                                <span class="compare-unit-name">[${column.item?.unit_name || column.skillId}]</span>
                                <span class="compare-character-name">${column.item?.character_name || ''}</span>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>${bodyRows}</tbody>
            </table>
        `;

        compareTableHost.querySelectorAll('thead th[data-skill-id]').forEach(th => {
            const item = itemMap.get(th.dataset.skillId);
            if (!item) return;
            const card = cardMap.get(item.skill_id) || getOrCreateCardElement(item.skill_id, item.unit_id);
            if (!card) return;
            const clone = card.cloneNode(true);
            clone.removeAttribute('id');
            clone.hidden = false;
            clone.querySelector('[data-compare-badge]')?.remove();
            th.prepend(clone);
        });
    };

    const openCompareSheet = () => {
        compareSheet.hidden = false;
        document.body.classList.add('sheet-open');
    };

    const closeCompareSheet = () => {
        compareSheet.hidden = true;
        document.body.classList.remove('sheet-open');
    };

    const openDetailSheet = (skillId, { singleOnly = false } = {}) => {
        const item = itemMap.get(skillId);
        if (!item) return;

        const showsCharacterSkills =
            !singleOnly && (characterScopeMode || pendingCharacterScopeMode);
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
            const card = cardMap.get(detailItem.skill_id)
                || getOrCreateCardElement(detailItem.skill_id, detailItem.unit_id);
            if (!card) continue;
            const clone = card.cloneNode(true);
            clone.removeAttribute('id');
            clone.hidden = false;
            clone.classList.add('skill-modal-card');
            clone.querySelectorAll('[data-compare-badge]')
                .forEach(element => element.remove());
            detailCardHost.appendChild(clone);
        }

        detailSheet.querySelector('.detail-panel').dataset.cardCount = detailItems.length;
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

    // キーワードchip（filterChipsとは別管理で動的生成）
    const escHtml = (s) =>
        String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const keywordChip = document.createElement('button');
    keywordChip.id = 'keyword-chip';
    keywordChip.className = 'filter-chip active';
    keywordChip.type = 'button';
    keywordChip.hidden = true;
    filterChipRow.prepend(keywordChip);

    keywordChip.addEventListener('click', () => {
        searchInput.value = '';
        appliedSearchText = '';
        keywordChip.hidden = true;
        scheduleRender();
        saveState();
        updateApplyButtonState();
    });

    // マウスホイールの縦スクロールを横スクロールに変換
    filterChipRow.addEventListener('wheel', (event) => {
        if (event.deltaX !== 0) return; // トラックパッドの横スクロールはそのまま通す
        event.preventDefault();
        filterChipRow.scrollLeft += event.deltaY;
    }, { passive: false });

    sortMenuButton.addEventListener('click', () => {
        const expanded =
            sortMenuButton.getAttribute('aria-expanded') === 'true';
        sortOptionsElement.classList.toggle('is-hidden', expanded);
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
            updateFacetCounts();
            if (isLiveMode()) applyPendingFilters();
            else updateApplyButtonState();
        });
    });

    facetSections.forEach(section => {
        const header = section.querySelector('.facet-header');
        header.addEventListener('click', () => {
            const expanded = header.getAttribute('aria-expanded') === 'true';
            setFacetOpen(section, !expanded);
        });
    });

    effectModeButtons.forEach(button => {
        button.addEventListener('click', () => {
            pendingEffectFilterMode = button.dataset.effectMode;
            updateEffectModeUI();
            if (isLiveMode()) applyPendingFilters();
            else updateApplyButtonState();
        });
    });

    characterScopeButtons.forEach(button => {
        button.addEventListener('click', () => {
            pendingCharacterScopeMode =
                button.dataset.characterScopeValue === 'character';
            updateCharacterScopeToggle();
            if (isLiveMode()) applyPendingFilters();
            else updateApplyButtonState();
        });
    });

    searchInput.addEventListener('input', () => {
        saveState();
        if (isLiveMode()) applyPendingFilters();
        else updateApplyButtonState();
    });

    clearFiltersButton.addEventListener('click', resetFilters);

    openFilterPanelButton.addEventListener('click', openFilterPanel);

    applyFiltersButton.addEventListener('click', () => {
        applyPendingFilters();
        closeFilterPanel();
    });

    document.querySelectorAll('[data-close-filter]').forEach(element => {
        element.addEventListener('click', closeFilterPanel);
    });

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const group = chip.dataset.openFilter;
            if (getGroupCount(group) > 0) {
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

    uiSizeToggle.addEventListener('click', () => {
        comfortableUi = !comfortableUi;
        applyUiSize();
        localStorage.setItem(UI_SIZE_KEY, comfortableUi ? 'comfortable' : 'compact');
    });

    window.addEventListener('scroll', () => {
        scrollToTopButton.classList.toggle('is-visible', window.scrollY > 300);
    }, { passive: true });

    scrollToTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    compareModeToggle.addEventListener('click', () => {
        compareMode = !compareMode;
        ensureCompareBadges();
        if (!compareMode) {
            listElement.querySelectorAll('.skill-card.compare-selected')
                .forEach(el => el.classList.remove('compare-selected'));
        }
        updateModeViews();
    });

    cancelCompareButton.addEventListener('click', () => {
        compareMode = false;
        listElement.querySelectorAll('.skill-card.compare-selected')
            .forEach(el => el.classList.remove('compare-selected'));
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

    compareTableHost.addEventListener('click', event => {
        const card = event.target.closest('.skill-card[data-skill-id]');
        if (!card) return;
        openDetailSheet(card.dataset.skillId, { singleOnly: true });
    });

    listElement.addEventListener('click', event => {
        const card = event.target.closest('[data-skill-id]');
        if (!card) return;

        // compare mode 中はカード全体で選択トグル
        if (compareMode) {
            toggleCompareSelection(card);
            return;
        }

        // 通常時の挙動（既存ロジックを維持）
        if (iconViewMode) {
            openDetailSheet(card.dataset.skillId);
        }
    });

    document.addEventListener('click', event => {
        if (!event.target.closest('.sort-menu') && !sortOptionsElement.classList.contains('is-hidden')) {
            closeSortMenu();
        }
    });

    // ── 初期化 ───────────────────────────────────────
    initSheetDrag(sheetGrip, filterDockPanel, document.body);
    applyUiSize();
    restoreState();
    syncControlsFromState();
    render(currentSortKey);
}

init();
