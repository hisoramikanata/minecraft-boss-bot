const { craftItem } = require('./craftingHelper');
const {
  LOG_NAMES, PLANK_NAMES, itemCount, anyItemCount, findItem,
} = require('./materials');
const { logsToPlanks } = require('./woodcutting');

const TOOLS = ['pickaxe', 'axe', 'sword', 'shovel'];
const ARMOR_PIECES = ['helmet', 'chestplate', 'leggings', 'boots'];

async function ensurePlanks(bot, count, log = () => {}) {
  if (anyItemCount(bot, PLANK_NAMES) >= count) return;
  const missing = count - anyItemCount(bot, PLANK_NAMES);
  const logsNeeded = Math.ceil(missing / 4);
  if (anyItemCount(bot, LOG_NAMES) < logsNeeded) {
    throw new Error('プランク作成に必要な丸太が不足しています');
  }
  await logsToPlanks(bot, logsNeeded, log);
}

async function ensureSticks(bot, count, log = () => {}) {
  if (itemCount(bot, 'stick') >= count) return;
  const missing = count - itemCount(bot, 'stick');
  const planksNeeded = Math.ceil(missing / 4) * 2;
  await ensurePlanks(bot, planksNeeded, log);
  await craftItem(bot, 'stick', Math.ceil(missing / 4), log);
}

function resolvePlankName(bot) {
  const plank = findItem(bot, PLANK_NAMES);
  return plank ? plank.name : 'oak_planks';
}

function materialNameForTier(bot, tier) {
  if (tier === 'wooden') return resolvePlankName(bot);
  if (tier === 'stone') return 'cobblestone';
  if (tier === 'iron') return 'iron_ingot';
  if (tier === 'diamond') return 'diamond';
  throw new Error(`未対応のtier: ${tier}`);
}

const TIER_ORDER = ['diamond', 'iron', 'stone', 'wooden']; // 上位(良い)順

function hasMaterialFor(bot, tier) {
  if (tier === 'wooden') return anyItemCount(bot, PLANK_NAMES) >= 3 || anyItemCount(bot, LOG_NAMES) >= 1;
  if (tier === 'stone') return itemCount(bot, 'cobblestone') >= 3;
  if (tier === 'iron') return itemCount(bot, 'iron_ingot') >= 3;
  if (tier === 'diamond') return itemCount(bot, 'diamond') >= 3;
  return false;
}

// 今の所持品で作れる中で最も上位のtierを返す(何も無ければfallbackTier)。
function bestAvailableTier(bot, fallbackTier) {
  for (const tier of TIER_ORDER) {
    if (hasMaterialFor(bot, tier)) return tier;
  }
  return fallbackTier;
}

function hasToolAtLeast(bot, tool, minTier) {
  const minIndex = TIER_ORDER.indexOf(minTier);
  return TIER_ORDER.some((tier, index) => {
    if (index > minIndex) return false; // minTierより下位は対象外
    const prefix = tier === 'wooden' ? 'wooden' : tier;
    return !!findItem(bot, `${prefix}_${tool}`);
  });
}

// 指定tierの道具一式(つるはし/おの/剣/シャベル)を、材料がある分だけクラフトする。
async function craftToolSet(bot, tier, log = () => {}) {
  await ensureSticks(bot, 8, log);
  // 木材種類(oak/birch等)に関わらず、木の道具は常に"wooden_"接頭辞になる
  const prefix = tier === 'wooden' ? 'wooden' : tier;

  for (const tool of TOOLS) {
    const itemName = `${prefix}_${tool}`;
    if (findItem(bot, itemName)) continue;
    try {
      await craftItem(bot, itemName, 1, log);
    } catch (err) {
      log(`${itemName} のクラフトをスキップ: ${err.message}`);
    }
  }
}

// 単一の道具(pickaxe/axe/sword/shovelのいずれか)がminTier以上で手元に無ければ、
// 今の所持品で作れる最も上位のtierのものを作り直す(採掘中に道具が壊れた場合用)。
async function ensureTool(bot, minTier, tool, log = () => {}) {
  if (hasToolAtLeast(bot, tool, minTier)) return true;

  const bestTier = bestAvailableTier(bot, minTier);
  const prefix = bestTier === 'wooden' ? 'wooden' : bestTier;
  const itemName = `${prefix}_${tool}`;

  log(`${tool}が手元にありません。今ある最上位の素材(${bestTier})で作り直します。`);
  try {
    await ensureSticks(bot, 2, log);
    await craftItem(bot, itemName, 1, log);
    return true;
  } catch (err) {
    log(`${itemName} の再クラフトに失敗: ${err.message}`);
    return false;
  }
}

// 指定tierの防具一式を、材料がある分だけクラフトする。
async function craftArmorSet(bot, tier, log = () => {}) {
  if (tier === 'wooden') return; // 木の防具は存在しないためスキップ

  for (const piece of ARMOR_PIECES) {
    const itemName = `${tier}_${piece}`;
    try {
      await craftItem(bot, itemName, 1, log);
    } catch (err) {
      log(`${itemName} のクラフトをスキップ: ${err.message}`);
    }
  }
}

module.exports = {
  craftToolSet,
  craftArmorSet,
  ensureTool,
  ensureSticks,
  ensurePlanks,
  materialNameForTier,
  bestAvailableTier,
  hasToolAtLeast,
};
