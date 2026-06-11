/* ==================================================================
   TSF data — 編集ガイド（ここに項目を足す）
   ------------------------------------------------------------------
   ■ 味方の対象タグ        → taxonomy.{attr|race|role|weapon|affiliation}
   ■ 敵の対象タグ(状態異常)  → taxonomy.ailment
   ■ 単体時の位置/一番       → positions（範囲=単体 のとき出るドロップダウン）
   ■ 特殊条件(味方)         → specialsAlly（対象タグと“重ねて”使う。陣営=味方で表示）
   ■ 特殊条件(敵)           → specialsEnemy（陣営=敵で表示）
   ■ 詳細の「効果」候補       → effectTypes（原子的な効果タイプ）
   ■ カテゴリのトグル群       → presets（検索プリセット。match:[effectType id]）
   ■ スキル(サンプル)        → skills
   ------------------------------------------------------------------
   ※ 対象が「敵」のときは 属性/種族/役割/武器/所属 は付かない（状態異常のみ）。
   ※ 特殊条件は「の味方/の敵」を付けず、陣営で出し分ける。
   ※ 「自身と◯◯の味方」のような複合対象は branches を2つ並べれば自身でも◯◯でもマッチ。
   ================================================================== */
window.TSF = (function () {
  const P = "img/";

  const taxonomy = {
    camp:  [
      { id: "self",  label: "自身" },
      { id: "ally",  label: "味方" },
      { id: "enemy", label: "敵" },
    ],
    scope: [
      { id: "all",    label: "全体" },
      { id: "single", label: "単体" },
      { id: "multi",  label: "複数" },
    ],
    /* 味方の対象タグ（属性・役割はアイコンのみ表示。武器は短ラベル） */
    attr: [
      { id: "1", label: "炎", icon: P + "attribute_01.png", color: "#ff7d5a" },
      { id: "2", label: "水", icon: P + "attribute_02.png", color: "#4aa3ff" },
      { id: "3", label: "雷", icon: P + "attribute_03.png", color: "#ffd23f" },
      { id: "4", label: "光", icon: P + "attribute_04.png", color: "#ffe08a" },
      { id: "5", label: "闇", icon: P + "attribute_05.png", color: "#c07dff" },
    ],
    race: [
      { id: "1", label: "人間", icon: P + "race_1.png" },
      { id: "2", label: "神族", icon: P + "race_4.png" },
      { id: "3", label: "魔族", icon: P + "race_3.png" },
    ],
    role: [
      { id: "1", label: "アタック",   short: "攻", icon: P + "type_1.png" },
      { id: "2", label: "スピード",   short: "速", icon: P + "type_2.png" },
      { id: "3", label: "ディフェンス", short: "守", icon: P + "type_3.png" },
      { id: "4", label: "サポート",   short: "支", icon: P + "type_4.png" },
      { id: "5", label: "ヒール",     short: "癒", icon: P + "type_5.png" },
    ],
    weapon: [
      { id: "1", label: "魔法", short: "魔", icon: P + "icon_equipment_01_01.png" },
      { id: "2", label: "斬撃", short: "斬", icon: P + "icon_equipment_01_02.png" },
      { id: "3", label: "打撃", short: "打", icon: P + "icon_equipment_01_03.png" },
    ],
    affiliation: [
      { id: "2", label: "新星学園",     icon: P + "affiliation_01.png" },
      { id: "1", label: "流星学園",     icon: P + "affiliation_02.png" },
      { id: "3", label: "守護天使",     icon: P + "affiliation_03.png" },
      { id: "4", label: "ネビュラ",     icon: P + "affiliation_04.png" },
      { id: "6", label: "流星学園附属", icon: P + "affiliation_02.png" },
      { id: "5", label: "コラプサー",   icon: P + "affiliation_05.png" },
      { id: "7", label: "極星学園",     icon: P + "affiliation_07.png" },
      { id: "0", label: "所属なし",     icon: P + "affiliation_06.png" },
      /* ▼ 所属を足すならここ */
    ],
    /* 敵の対象タグ＝状態異常（アイコン無し・テキスト表示） */
    ailment: [
      { id: "stun",      label: "スタン" },
      { id: "poison",    label: "毒" },
      { id: "paralysis", label: "麻痺" },
      { id: "confusion", label: "混乱" },
      { id: "shrink",    label: "萎縮" },
      { id: "seal",      label: "封印" },
      { id: "burn",      label: "火傷" },
      { id: "frostbite", label: "凍傷" },
    ],
    ref: [
      { id: "none",  label: "なし" },
      { id: "ally",  label: "味方の数" },
      { id: "enemy", label: "敵の数" },
      { id: "kind",  label: "種類数" },
    ],
  };

  /* 範囲=単体 のときに出る「位置・一番」修飾（任意）。単体に内包する想定 */
  const positions = [
    { id: "rear",     label: "一番後方" },
    { id: "front1",   label: "前から1番目" },
    { id: "front2",   label: "前から2番目" },
    { id: "front3",   label: "前から3番目" },
    { id: "note_last", label: "ノーツが1番後ろ" },
    { id: "ct_slow",  label: "行動CTが一番遅い" },
    { id: "atk_high", label: "ATKが一番高い" },
    { id: "atk_low",  label: "ATKが一番低い" },
  ];

  /* 特殊条件（味方）— 対象タグと重ねて使う。label=ドロップダウン, short=チップ表示 */
  const specialsAlly = [
    { id: "diff_type",     label: "異なるタイプ",            short: "異タイプ" },
    { id: "diff_attr",     label: "異なる属性",              short: "異なる属性" },
    { id: "main_1",        label: "メイン属性が炎属性",       short: "メイン炎" },
    { id: "main_2",        label: "メイン属性が水属性",       short: "メイン水" },
    { id: "main_3",        label: "メイン属性が雷属性",       short: "メイン雷" },
    { id: "main_4",        label: "メイン属性が光属性",       short: "メイン光" },
    { id: "main_5",        label: "メイン属性が闇属性",       short: "メイン闇" },
    { id: "sub_attr",      label: "サブ属性が付与されている", short: "サブ属性付与中" },
    { id: "same_self_sub", label: "自身のサブ属性と同じ属性", short: "自サブと同属性" },
    { id: "stealth",       label: "ステルス状態",            short: "ステルス状態" },
    { id: "unison",        label: "ユニゾン参加者",          short: "ユニゾン参加者" },
    { id: "stun_state",    label: "スタン中",                short: "スタン中" },
    { id: "family_bond",   label: "家族の絆が付与されている", short: "家族の絆付与中" },
    /* ▼ 味方の特殊条件を足すならここ */
  ];

  /* 特殊条件（敵） */
  const specialsEnemy = [
    { id: "random", label: "ランダム",  short: "ランダム" },
    { id: "lily",   label: "百合の花",  short: "百合の花" },
    /* ▼ 敵の特殊条件を足すならここ */
  ];

  /* 詳細モードの「効果」ドロップダウン（原子的効果タイプ） */
  const effectTypes = [
    { "id": "atk_up", "label": "ATKアップ", "klass": "buff" },
    { "id": "atk_down", "label": "ATKダウン", "klass": "debuff" },

    { "id": "ex_gauge_drain", "label": "EXゲージ吸収", "klass": "buff" },
    { "id": "ex_gauge_down", "label": "EXゲージ減少", "klass": "debuff" },
    { "id": "ex_gain_up", "label": "EX上昇アップ", "klass": "buff" },
    { "id": "ex_gain_down", "label": "EX上昇ダウン", "klass": "debuff" },
    { "id": "ex_gain_down_remove", "label": "EX上昇ダウン回復", "klass": "buff" },
    { "id": "ex_cost_down", "label": "EX消費量減少", "klass": "buff" },

    { "id": "hp_recovery", "label": "HP回復", "klass": "main" },
    { "id": "hp_regeneration", "label": "HP継続回復", "klass": "buff" },

    { "id": "wing_form", "label": "ウイングフォーム", "klass": "other" },
    { "id": "sword_form", "label": "ソードフォーム", "klass": "other" },
    { "id": "form_change", "label": "フォームチェンジ", "klass": "other" },

    { "id": "overheal_remove", "label": "オーバーヒール解除", "klass": "debuff" },

    { "id": "counter_moko", "label": "カウンター[猛攻]", "klass": "buff" },
    { "id": "counter_haki", "label": "カウンター[覇気]", "klass": "buff" },
    { "id": "counter_shinko", "label": "カウンター[進攻]", "klass": "buff" },
    { "id": "counter_trigger", "label": "カウンター誘発", "klass": "buff" },

    { "id": "critical_damage_up", "label": "クリティカルダメージアップ", "klass": "buff" },
    { "id": "critical_rate_up", "label": "クリティカル率アップ", "klass": "buff" },

    { "id": "sub_attribute", "label": "サブ属性", "klass": "buff" },

    { "id": "skill_cooldown", "label": "スキル再使用時間", "klass": "debuff" },

    { "id": "stun_gauge_recovery", "label": "スタンゲージ回復", "klass": "buff" },
    { "id": "stun_gauge_consume", "label": "スタンゲージ消費", "klass": "debuff" },
    { "id": "stun_gauge_down", "label": "スタンゲージ減少", "klass": "debuff" },
    { "id": "stun_recovery", "label": "スタン回復", "klass": "buff" },

    { "id": "stealth", "label": "ステルス", "klass": "buff" },

    { "id": "damage", "label": "ダメージ", "klass": "main" },
    { "id": "damage_boost", "label": "ダメージを強化", "klass": "" },
    { "id": "damage_reflect", "label": "ダメージ反射", "klass": "buff" },

    { "id": "charge", "label": "チャージ", "klass": "buff" },
    { "id": "charge_return_reduction", "label": "チャージ時戻り量短縮", "klass": "buff" },

    { "id": "knockback", "label": "ノックバック", "klass": "note" },
    { "id": "knockback_immunity", "label": "ノックバック無効", "klass": "buff" },

    { "id": "force_note_move", "label": "ノーツ強制移動", "klass": "note" },
    { "id": "note_return_position", "label": "ノーツ戻り位置変更", "klass": "note" },
    { "id": "note_move", "label": "ノーツ移動", "klass": "note" },
    { "id": "note_move_boost", "label": "ノーツ移動量強化", "klass": "" },

    { "id": "buff_remove", "label": "バフ解除", "klass": "debuff" },
    { "id": "barrier", "label": "バリア", "klass": "buff" },
    { "id": "barrier_break", "label": "バリア破壊", "klass": "debuff" },

    { "id": "magic_mist", "label": "マジックミスト", "klass": "debuff" },

    { "id": "rush_gain_double", "label": "ラッシュ増加数2倍", "klass": "buff" },

    { "id": "all_status_resist_up", "label": "全状態異常耐性アップ", "klass": "buff" },

    { "id": "frostbite", "label": "凍傷", "klass": "debuff" },

    { "id": "unique_gauge_up", "label": "固有ゲージ増加", "klass": "buff" },
    { "id": "unique_gauge_down", "label": "固有ゲージ減少", "klass": "debuff" },
    { "id": "unique_effect", "label": "固有効果", "klass": "buff" },

    { "id": "family_bond", "label": "家族の絆", "klass": "buff" },
    { "id": "judgement", "label": "審判", "klass": "debuff" },

    { "id": "seal", "label": "封印", "klass": "debuff" },
    { "id": "electrified", "label": "帯電", "klass": "debuff" },

    { "id": "protection", "label": "庇護", "klass": "buff" },

    { "id": "weakness_attribute", "label": "弱点属性", "klass": "debuff" },

    { "id": "force_stun", "label": "強制スタン", "klass": "debuff" },

    { "id": "taunt", "label": "挑発", "klass": "buff" },

    { "id": "max_hp_down", "label": "最大HP減少", "klass": "debuff" },

    { "id": "extreme_cold", "label": "極冷", "klass": "debuff" },

    { "id": "mark", "label": "標的", "klass": "debuff" },

    { "id": "flame_of_justice", "label": "正義の焔", "klass": "buff" },

    { "id": "poison", "label": "毒", "klass": "debuff" },
    { "id": "confusion", "label": "混乱", "klass": "debuff" },

    { "id": "encouragement", "label": "激励", "klass": "buff" },

    { "id": "burn", "label": "火傷", "klass": "debuff" },
    { "id": "burn_major", "label": "火傷【大】", "klass": "debuff" },
    { "id": "burn_resist_up", "label": "火傷耐性アップ", "klass": "buff" },

    { "id": "status_recovery", "label": "状態回復", "klass": "buff" },

    { "id": "lily_bud", "label": "百合の蕾", "klass": "buff" },

    { "id": "stun_damage_up", "label": "相手スタン時ダメージ倍率アップ", "klass": "buff" },

    { "id": "sleep", "label": "睡眠", "klass": "debuff" },

    { "id": "shatter", "label": "破砕", "klass": "debuff" },

    { "id": "stigma", "label": "聖痕", "klass": "debuff" },

    { "id": "atrophy", "label": "萎縮", "klass": "debuff" },
    { "id": "atrophy_major", "label": "萎縮【大】", "klass": "debuff" },

    { "id": "meltdown", "label": "融解", "klass": "debuff" },

    { "id": "action_ct_down", "label": "行動CT短縮", "klass": "buff" },
    { "id": "action_ct_up", "label": "行動CT遅延", "klass": "debuff" },

    { "id": "damage_taken_up", "label": "被ダメージアップ", "klass": "debuff" },
    { "id": "damage_taken_down", "label": "被ダメージ軽減", "klass": "buff" },

    { "id": "laceration", "label": "裂傷", "klass": "debuff" },

    { "id": "dragon_curse", "label": "超竜の呪縛", "klass": "debuff" },

    { "id": "weight_up", "label": "重さアップ", "klass": "buff" },
    { "id": "weight_down", "label": "重さダウン", "klass": "debuff" },

    { "id": "charm", "label": "魅了", "klass": "debuff" },

    { "id": "magic_corruption", "label": "魔障", "klass": "debuff" },

    { "id": "paralysis", "label": "麻痺", "klass": "debuff" }
];

  /* カテゴリ検索のトグル群（検索プリセット） */
  const presets = [
    { id: "all_attack",              label: "全体攻撃",         match: ["all_attack"] },
    { id: "multi_attack",            label: "多段攻撃",         match: ["multi_attack"] },
    { id: "note_backward",           label: "ノーツ後退系",     match: ["note_backward"] },
    { id: "note_move",               label: "ノーツ移動系",     match: ["note_move"] },
    { id: "atk_up",                  label: "ATKアップ",        match: ["atk_up"] },
    { id: "critical_up",             label: "クリティカルアップ", match: ["critical_up"] },
    { id: "critical_damage_up",      label: "クリダメアップ",    match: ["critical_damage_up"] },
    { id: "stun_damage_up",          label: "スタンダメアップ",  match: ["stun_damage_up"] },
    { id: "action_ct_short",         label: "行動CT短縮",       match: ["action_ct_short"] },
    { id: "barrier",                 label: "バリア系",         match: ["barrier"] },
    { id: "sub_attribute",           label: "サブ属性",         match: ["sub_attribute"] },
    { id: "damage_taken_up",         label: "被ダメ増加",       match: ["damage_taken_up"] },
    { id: "special_damage_taken_up", label: "特殊被ダメ増加系",  match: ["special_damage_taken_up"] },
    { id: "weakness_attribute",      label: "弱点属性",         match: ["weakness_attribute"] },
    { id: "action_control",          label: "行動阻害系",       match: ["action_control"] },
    { id: "status_infliction",       label: "状態付与系",       match: ["status_infliction"] },
  ];

  /* ---- branch authoring helpers ---- */
  const ally  = (t = {}) => Object.assign({ camp: "味方", scope: "all" }, t);
  const enemy = (t = {}) => Object.assign({ camp: "敵",   scope: "all" }, t);
  const self  = ()        => ({ camp: "自身", scope: "自身" });

  const skills = [
    {
      id: "s1", name: "ステラ・ジャッジメント", type: "EX2+", rarity: 3, cost: 3,
      char: { name: "フィオナ", unit: "煌炎の超天使", attr: "1", role: "1", race: "2", aff: "3", weapon: "1" },
      effects: [
        { cat: "all_attack", type: "全体攻撃", target: [enemy()], value: "ATK×320% の炎属性ダメージ" },
        { cat: "atk_up", type: "ATKアップ", target: [ally({ attr: "1" })], value: "ATK +40%", dur: 3 },
      ],
    },
    {
      id: "s2", name: "ブレイブ・オーダー", type: "EX1", rarity: 3, cost: 2,
      char: { name: "リエラ", unit: "太陽の祝福", attr: "4", role: "4", race: "1", aff: "1", weapon: "1" },
      effects: [ // 光属性 または 人間 の味方全体（UNION = 2 branches）
        { cat: "atk_up", type: "ATKアップ", target: [ally({ attr: "4" }), ally({ race: "1" })], value: "ATK +30%", dur: 4 },
      ],
    },
    {
      id: "s3", name: "ホーリーレイ・バフ", type: "EX2", rarity: 3, cost: 3,
      char: { name: "セレネ", unit: "ノヴァゴッデス", attr: "4", role: "4", race: "2", aff: "3", weapon: "1" },
      effects: [ // 光属性の人間の味方（INTERSECTION = 1 branch 光∧人）
        { cat: "atk_up", type: "ATKアップ", target: [ally({ attr: "4", race: "1" })], value: "ATK +55%", dur: 3 },
        { cat: "critical_up", type: "クリティカルアップ", target: [ally({ attr: "4", race: "1" })], value: "クリ率 +20%", dur: 3 },
      ],
    },
    {
      id: "s4", name: "イグニッション・チア", type: "EX1+", rarity: 2, cost: 2,
      char: { name: "ノエル", unit: "烈火の料理人", attr: "1", role: "4", race: "1", aff: "2", weapon: "3" },
      effects: [
        { cat: "atk_up", type: "ATKアップ", target: [ally({ attr: "1" })], value: "ATK +25%", dur: 3 },
        { cat: "critical_damage_up", type: "クリダメアップ", target: [ally({ attr: "1" })], value: "クリダメ +35%", dur: 3 },
      ],
    },
    {
      id: "s5", name: "ダーク・カース", type: "EX2", rarity: 3, cost: 3,
      char: { name: "リリス", unit: "未完の魔王", attr: "5", role: "1", race: "3", aff: "4", weapon: "1" },
      effects: [ // 敵には状態異常タグのみ
        { cat: "damage_taken_up", type: "被ダメ増加", target: [enemy()], value: "被ダメ +30%", dur: 3 },
        { cat: "special_damage_taken_up", type: "特殊被ダメ増加", target: [enemy({ ailment: "poison" })], value: "特殊被ダメ +20%", dur: 2 },
      ],
    },
    {
      id: "s6", name: "アクア・シールド", type: "EX1", rarity: 2, cost: 2,
      char: { name: "マリン", unit: "アイスクイーン", attr: "2", role: "3", race: "1", aff: "2", weapon: "2" },
      effects: [
        { cat: "barrier", type: "バリア", target: [ally()], value: "ダメージバリア 2000", dur: 2 },
      ],
    },
    {
      id: "s7", name: "ライトニング・アクセル", type: "EX2+", rarity: 3, cost: 3,
      char: { name: "ステラ", unit: "招福の明星", attr: "3", role: "2", race: "2", aff: "3", weapon: "2" },
      effects: [
        { cat: "action_ct_short", type: "行動CT短縮", target: [self()], value: "CT -1" },
        { cat: "atk_up", type: "ATKアップ", target: [self()], value: "ATK +10%/体", ref: { src: "ally", attr: "3" }, dur: 3 },
      ],
    },
    {
      id: "s8", name: "ガーディアン・ヴァウ", type: "EX2", rarity: 3, cost: 3,
      char: { name: "ユーフィ", unit: "“境界”を護る者", attr: "4", role: "3", race: "2", aff: "3", weapon: "3" },
      effects: [ // 光属性の味方全体（single branch 光）
        { cat: "barrier", type: "バリア", target: [ally({ attr: "4" })], value: "バリア 3000", dur: 3 },
        { cat: "atk_up", type: "ATKアップ", target: [ally({ attr: "4" })], value: "ATK +20%", dur: 3 },
      ],
    },
    {
      id: "s9", name: "ノーツ・リワインド", type: "EX1", rarity: 2, cost: 2,
      char: { name: "ココ", unit: "おちゃめな副会長", attr: "3", role: "2", race: "1", aff: "1", weapon: "1" },
      effects: [
        { cat: "note_backward", type: "ノーツ後退", target: [enemy()], value: "敵ノーツを2マス後退" },
      ],
    },
    {
      id: "s10", name: "ブレイズ・ストライク", type: "EX2", rarity: 3, cost: 3,
      char: { name: "アリア", unit: "賀正ウェルカム", attr: "1", role: "1", race: "1", aff: "1", weapon: "2" },
      effects: [ // 単体＋位置（ATKが一番高い敵）
        { cat: "multi_attack", type: "多段攻撃", target: [enemy({ scope: "single", position: "atk_high" })], value: "ATK×140%×3回" },
        { cat: "atk_up", type: "ATKアップ", target: [ally({ race: "1" })], value: "ATK +35%", dur: 3 },
      ],
    },
    {
      id: "s11", name: "ホーリーナイト・ガード", type: "EX1+", rarity: 3, cost: 2,
      char: { name: "ジャンヌ", unit: "星と花の騎士", attr: "4", role: "3", race: "1", aff: "1", weapon: "3" },
      effects: [ // 光属性 または 人間 の味方（union, defensive）
        { cat: "barrier", type: "バリア", target: [ally({ attr: "4" }), ally({ race: "1" })], value: "バリア 2500", dur: 3 },
      ],
    },
    {
      id: "s12", name: "シャドウ・バインド", type: "EX2+", rarity: 3, cost: 3,
      char: { name: "ヴェルナ", unit: "物語を紡ぐ魔将", attr: "5", role: "1", race: "3", aff: "4", weapon: "1" },
      effects: [
        { cat: "action_control", type: "行動阻害（スタン）", target: [enemy({ scope: "single" })], value: "スタン", dur: 1 },
        { cat: "damage_taken_up", type: "被ダメ増加", target: [enemy({ ailment: "stun" })], value: "被ダメ +25%", dur: 3 },
      ],
    },
    {
      id: "s13", name: "ユニゾン・ブレス", type: "EX2", rarity: 3, cost: 3,
      char: { name: "アンジュ", unit: "命脈の守護天使", attr: "1", role: "4", race: "2", aff: "3", weapon: "1" },
      effects: [ // 特殊条件デモ: ユニゾン参加者の味方
        { cat: "atk_up", type: "ATKアップ", target: [ally({ specials: ["unison"] })], value: "ATK +50%", dur: 3 },
        { cat: "heal", type: "回復", target: [ally({ specials: ["unison"] })], value: "HP +20%/T", dur: 3 },
      ],
    },
    {
      id: "s14", name: "シスター・ブレッシング", type: "EX1", rarity: 3, cost: 2,
      char: { name: "クレア", unit: "純白のシスター", attr: "2", role: "5", race: "1", aff: "2", weapon: "1" },
      effects: [ // 「自身と光属性の味方」= 自身 branch + 光味方 branch（複合対象）
        { cat: "heal", type: "回復", target: [self(), ally({ attr: "4" })], value: "HP +25%" },
      ],
    },
  ];

  return { taxonomy, positions, specialsAlly, specialsEnemy, effectTypes, presets, skills, P };
})();
