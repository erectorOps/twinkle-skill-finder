const normalizeArray = (value) =>
  Array.isArray(value)
    ? value
    : [];

const flattenEffects = (effects = []) => {
  const result = [];
  const stack = [...normalizeArray(effects)];

  while (stack.length > 0) {
    const effect = stack.shift();

    if (!effect) {
      continue;
    }

    result.push(effect);

    if (effect.children) {
      stack.push(...normalizeArray(effect.children));
    }
  }

  return result;
};

const unique = (values) =>
  [...new Set(values.filter(value => value !== undefined && value !== null && value !== ""))];

const getEquipmentUnitId = (item) =>
  item?.game_unit_id ?? item?.unit_id;

const findAccessoryForSkill = (accessories, skill) =>
  (accessories || []).find(accessory => accessory.unit_id === skill.unit_id)
  || (accessories || []).find(accessory =>
    getEquipmentUnitId(accessory) === getEquipmentUnitId(skill)
  );

export const normalizeBranches = (branches) =>
  !branches
    ? []
    : Array.isArray(branches)
      ? branches
      : [branches];

const buildEffectsMeta = (skill) =>
  flattenEffects(skill.effects).map(effect => ({
    type: effect.type || null,
    effect_class: effect.effect_class || null,
    target_branches: normalizeBranches(effect.target_branches),
    scale_refs: (effect.scale_refs || []).filter(Boolean)
  }));

const hasText = (effect, pattern) => {
  const text = [
    effect.type,
    effect.raw,
    effect.display_value,
    effect.formula,
    ...(effect.tags || [])
  ].filter(Boolean).join(" ");

  return pattern.test(text);
};

const STATUS_NAMES = [
  "毒",
  "麻痺",
  "混乱",
  "萎縮",
  "萎縮【大】",
  "封印",
  "火傷",
  "火傷【大】",
  "凍傷"
];

const SPECIAL_DAMAGE_TAKEN_STATUS_NAMES = [
  "融解",
  "極冷",
  "帯電",
  "聖痕",
  "審判",
  "破砕",
  "裂傷",
  "魔障",
  "標的"
];

const ACTION_CONTROL_NAMES = [
  "魅了",
  "強制スタン",
  "睡眠",
  "マジックミスト"
];

export const effectCategoriesOf = (effect) => {
  const categories = new Set();
  const type = effect.type || "";
  const tags = effect.tags || [];
  const raw = effect.raw || "";

  if (tags.includes("全体攻撃")) {
    categories.add("all_attack");
  }

  if (
    tags.includes("多段攻撃")
    || Number(effect.value?.hit || 0) > 1
    || /×\s*\d+回/.test(raw)
  ) {
    categories.add("multi_attack");
  }

  if (type === "ノックバック" || type === "ノーツ強制移動") {
    categories.add("note_backward");
  }

  if (type === "ノーツ移動") {
    categories.add("note_move");
  }

  if (type === "ATKアップ") {
    categories.add("atk_up");
  }

  if (type === "クリティカル率アップ") {
    categories.add("critical_up");
  }

  if (type === "クリティカルダメージアップ") {
    categories.add("critical_damage_up");
  }

  if (type === "相手スタン時ダメージ倍率アップ") {
    categories.add("stun_damage_up");
  }

  if (type === "行動CT短縮") {
    categories.add("action_ct_short");
  }

  if (/バリア/.test(type) && type !== "バリア破壊") {
    categories.add("barrier");
  }

  if (type === "サブ属性" || type === "サブ属性付与") {
    categories.add("sub_attribute");
  }

  if (type === "被ダメージアップ") {
    categories.add("damage_taken_up");
  }

  if (SPECIAL_DAMAGE_TAKEN_STATUS_NAMES.includes(type)) {
    categories.add("special_damage_taken_up");
  }

  if (type === "弱点属性" || type === "弱点属性付与") {
    categories.add("weakness_attribute");
  }

  if (ACTION_CONTROL_NAMES.includes(type)) {
    categories.add("action_control");
  }

  if (STATUS_NAMES.includes(type)) {
    categories.add("status_infliction");
  }

  return categories;
};

const buildEffectCategories = (skill) => {
  const effects = flattenEffects(skill.effects);
  const categories = new Set();

  for (const effect of effects) {
    for (const category of effectCategoriesOf(effect)) {
      categories.add(category);
    }
  }

  return [...categories].sort();
};

const matchingAccessoryAbilities = (accessory, skill) =>
  {
    if (!accessory) return [];

    return (accessory.acc_abilities || []).filter(ability =>
      ability.skill_type === "COMMON"
      || String(ability.skill_id) === String(skill.skill_id)
    );
  };

const buildAccessorySearchText = (accessory, skill) => {
  if (!accessory) {
    return "";
  }

  const abilities = matchingAccessoryAbilities(accessory, skill);

  const inlineCommonEffects =
    abilities
      .filter(ability => ability.skill_type === "COMMON")
      .flatMap(ability => ability.effects || [])
      .filter(effect =>
        effect.type === "属性カウント+"
        && effect.display_value
      )
      .map(effect => effect.display_value);

  return [
    accessory.accessory_name,
    ...abilities.flatMap(ability => [
      ability.text,
      ...(ability.effects || []).flatMap(effect => [
        effect.type,
        effect.display_value,
        effect.formula,
        effect.raw,
        ...(effect.tags || [])
      ])
    ]),
    ...inlineCommonEffects
  ].filter(Boolean).join(" ");
};

const buildSkillSearchText = ({ skill, character, effects, accessory }) =>
  [
    skill.name,
    skill.skill_detail,
    character.character_name,
    character.character_name_kana,
    character.unit_name,
    ...effects.flatMap(effect => [
      effect.type,
      effect.target,
      effect.display_value,
      effect.formula,
      effect.raw,
      ...(effect.tags || [])
    ]),
    buildAccessorySearchText(accessory, skill)
  ].filter(Boolean).join(" ").toLowerCase();

const buildObtainIndex = (obtain) => {
  const obtains = [];

  for (const text of (obtain || "").split("\n")) {
    if ("ガチャ(恒常)" === text) {
      obtains.push("standard");
    }
    if ("ガチャ(限定)" === text) {
      obtains.push("limited");
    }
    if ("初期加入" === text) {
      obtains.push("starter");
    }
    if ("ガチャ(コラボ)" === text) {
      obtains.push("collab_limited");
    }
    if ("コラボ報酬" === text) {
      obtains.push("collab_reward");
    }
    if ("イベント報酬" === text) {
      obtains.push("event_reward");
    }
    if ("メモリーメダル" === text) {
      obtains.push("medal_exchange");
    }
  }
  return unique(obtains);
};

const buildReleaseYear = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length < 1 || parts[0].length != 4) return null;
  const year = parseInt(parts[0], 10);
  return isNaN(year) ? null : year;
}


export const buildSkillFinderIndex = ({ skills, characters, accessories = [] }) => {
  const invalidRarityCharacters =
    characters.filter(character =>
      ![1, 2, 3].includes(Number(character.rarity))
    );

  if (invalidRarityCharacters.length > 0) {
    throw new Error(
      [
        "未対応のレアリティがあります",
        ...invalidRarityCharacters.map(character =>
          `${character.unit_id}: rarity=${character.rarity} ${character.unit_name} ${character.character_name}`
        )
      ].join("\n")
    );
  }

  const characterMap = new Map(
    characters.map(character => [
      character.unit_id,
      character
    ])
  );
  return skills
    .map(skill => {
      const character =
        characterMap.get(skill.unit_id);

      if (!character) {
        return null;
      }

      const effects =
        flattenEffects(skill.effects);
      const accessory =
        findAccessoryForSkill(accessories, skill);
      const accessoryEffects =
        matchingAccessoryAbilities(accessory, skill)
          .flatMap(ability => ability.effects || []);
      const effectsWithAccessory =
        effects.concat(flattenEffects(accessoryEffects));

      return {
        skill_id: String(skill.skill_id),
        unit_id: character.unit_id,
        skill_type: skill.skill_type,
        skill_name: skill.name,
        character_name: character.character_name,
        character_name_kana: character.character_name_kana,
        unit_name: character.unit_name,
        rarity: character.rarity,
        attr: character.attr_type?.id || null,
        races: unique((character.camps || []).map(camp => String(camp.id))),
        role: character.role?.id || null,
        attack_types: unique((character.sp_equip_types || []).map(type => String(type.id))),
        affiliations: unique((character.affiliations || []).map(affiliation => String(affiliation.id))),
        release_date: character.release_date || null,
        release_date_raw: character.release_date_raw || null,
        release_years: buildReleaseYear(character.release_date),
        release_order: character.release_order || null,
        obtains: buildObtainIndex(character.obtain),
        effect_categories: unique([
          ...buildEffectCategories(skill),
          ...accessoryEffects.flatMap(effect => [...effectCategoriesOf(effect)])
        ]),
        effect_types: unique(effectsWithAccessory.map(effect => effect.type)),
        effect_tags: unique(effectsWithAccessory.flatMap(effect => effect.tags || [])),
        effect_classes: unique(effectsWithAccessory.map(effect => effect.effect_class)),
        effects: buildEffectsMeta({ effects: effectsWithAccessory }),
        search_text: buildSkillSearchText({
          skill,
          character,
          effects: effectsWithAccessory,
          accessory
        })
      };
    })
    .filter(Boolean);
};

export const jsonForHtml = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
