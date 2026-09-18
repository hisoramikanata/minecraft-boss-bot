const { goto } = require('../utils/navigation');
const { placeAt } = require('./placement');
const { PLANK_NAMES, findItem } = require('./materials');

function findNearbyTable(bot) {
  return bot.findBlock({
    matching: (block) => block && block.name === 'crafting_table',
    maxDistance: 8,
  });
}

// 近くにクラフトテーブルがなければ、所持品から設置(なければ丸太からクラフトして設置)する。
async function ensureCraftingTable(bot, log = () => {}) {
  let table = findNearbyTable(bot);
  if (table) return table;

  let tableItem = findItem(bot, 'crafting_table');
  if (!tableItem) {
    await craftItem(bot, 'crafting_table', 1, log);
    tableItem = findItem(bot, 'crafting_table');
    if (!tableItem) throw new Error('クラフトテーブルを作成できません(木材不足)');
  }

  const feet = bot.entity.position.floored();
  const placePos = feet.offset(1, 0, 0);
  await placeAt(bot, placePos, 'crafting_table');
  table = bot.blockAt(placePos);
  return table;
}

function findNearbyFurnace(bot) {
  return bot.findBlock({
    matching: (block) => block && block.name === 'furnace',
    maxDistance: 8,
  });
}

async function ensureFurnace(bot, log = () => {}) {
  let furnace = findNearbyFurnace(bot);
  if (furnace) return furnace;

  let furnaceItem = findItem(bot, 'furnace');
  if (!furnaceItem) {
    await craftItem(bot, 'furnace', 1, log);
    furnaceItem = findItem(bot, 'furnace');
    if (!furnaceItem) throw new Error('かまどを作成できません(丸石不足)');
  }

  const feet = bot.entity.position.floored();
  const placePos = feet.offset(-1, 0, 0);
  await placeAt(bot, placePos, 'furnace');
  furnace = bot.blockAt(placePos);
  return furnace;
}

// itemNameのレシピを検索してcount回クラフトする。テーブルが必要なレシピなら自動で用意する。
async function craftItem(bot, itemName, count = 1, log = () => {}) {
  const itemData = bot.registry.itemsByName[itemName];
  if (!itemData) throw new Error(`不明なアイテム: ${itemName}`);

  let recipes = bot.recipesFor(itemData.id, null, 1, null);
  let table = null;

  if (recipes.length === 0) {
    table = findNearbyTable(bot) || await ensureCraftingTableSafe(bot, log);
    if (table) {
      await goto(bot, table.position, 3);
      recipes = bot.recipesFor(itemData.id, null, 1, table);
    }
  }

  if (recipes.length === 0) {
    throw new Error(`${itemName} のレシピが見つかりません(材料不足の可能性)`);
  }

  await bot.craft(recipes[0], count, table || undefined);
  log(`${itemName} をクラフトしました (x${count})`);
}

// craftItem内で無限再帰しないよう、テーブル未設置時のみ新規設置を試みる薄いラッパー
async function ensureCraftingTableSafe(bot, log) {
  try {
    return await ensureCraftingTable(bot, log);
  } catch (err) {
    log(`クラフトテーブルの用意に失敗: ${err.message}`);
    return null;
  }
}

module.exports = {
  findNearbyTable,
  ensureCraftingTable,
  findNearbyFurnace,
  ensureFurnace,
  craftItem,
};
