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

const buildEffectCategories = (skill) => {
  const effects = flattenEffects(skill.effects);
  const categories = new Set();
  const statusNames = [
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

  for (const effect of effects) {
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

    if (/バリア/.test(type)) {
      categories.add("barrier");
    }

    if (type === "サブ属性" || type === "サブ属性付与") {
      categories.add("sub_attribute");
    }

    if (type === "被ダメージアップ") {
      categories.add("damage_taken_up");
    }

    if (
      hasText(effect, /(?:極冷|融解|雷傷|刻印|烙印|呪傷)/)
      && hasText(effect, /被ダメージ|被ダメ/)
    ) {
      categories.add("special_damage_taken_up");
    }

    if (type === "弱点属性" || type === "弱点属性付与") {
      categories.add("weakness_attribute");
    }

    if (/睡眠|スタン|強制スタン|行動阻害/.test(type) || /睡眠|スタン|強制スタン|行動阻害/.test(raw)) {
      categories.add("action_control");
    }

    if (statusNames.includes(type)) {
      categories.add("status_infliction");
    }
  }

  return [...categories].sort();
};

export const buildSkillFinderIndex = ({ skills, characters }) => {
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
        release_order: character.release_order || null,
        effect_categories: buildEffectCategories(skill),
        effect_types: unique(effects.map(effect => effect.type)),
        effect_tags: unique(effects.flatMap(effect => effect.tags || [])),
        effect_classes: unique(effects.map(effect => effect.effect_class))
      };
    })
    .filter(Boolean);
};

export const jsonForHtml = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
