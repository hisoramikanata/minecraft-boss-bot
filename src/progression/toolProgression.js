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

// 指定tierの単一の道具(pickaxe/axe/sword/shovelのいずれか)が無ければ作り直す。
// 採掘中に道具が壊れた場合の自動再クラフト用。
async function ensureTool(bot, tier, tool, log = () => {}) {
  const prefix = tier === 'wooden' ? 'wooden' : tier;
  const itemName = `${prefix}_${tool}`;
  if (findItem(bot, itemName)) return true;

  log(`${itemName} が手元にありません。材料があれば作り直します。`);
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
  craftToolSet, craftArmorSet, ensureTool, ensureSticks, ensurePlanks, materialNameForTier,
};
