const { placeNearBot } = require('./placement');
const { craftItem } = require('./craftingHelper');
const { findItem } = require('./materials');
const { ensurePlanks } = require('./toolProgression');
const { goto } = require('../utils/navigation');

// 荷物が一杯の時、優先的に手放してよい「ジャンク」アイテム。
// 道具・武器・防具・食料・ボス討伐やネザー/エンド関連の重要アイテムは含めない。
const JUNK_ITEMS = [
  'cobblestone', 'stone', 'andesite', 'diorite', 'granite', 'cobbled_deepslate',
  'deepslate', 'dirt', 'gravel', 'sand', 'netherrack', 'tuff',
  'rotten_flesh', 'poisonous_potato', 'string', 'spider_eye', 'gunpowder',
];

function findNearbyChest(bot, maxDistance = 16) {
  return bot.findBlock({
    matching: (b) => b && b.name === 'chest',
    maxDistance,
  });
}

// 拠点用のチェストを1つ用意し、mineflayer-collectblockが荷物満杯時に
// 自動でアイテムを預けられるよう登録する。道具・武器・防具は預けず
// 手元に残す(collectblockのデフォルトitemFilterに準拠)。
async function ensureChest(bot, log = () => {}) {
  let chest = findNearbyChest(bot);

  if (!chest) {
    if (!findItem(bot, 'chest')) {
      try {
        // 木材の種類(oak/birch等)を問わず、板材が8枚未満なら丸太から変換する
        await ensurePlanks(bot, 8, log);
      } catch (err) {
        // 板材/丸太が無ければ何もしない(チェスト無しでも進行は継続できる)
        log(`チェスト用の板材が不足しているため、チェスト設置はスキップします: ${err.message}`);
        return null;
      }
      try {
        await craftItem(bot, 'chest', 1, log);
      } catch (err) {
        log(`チェストのクラフトに失敗: ${err.message}`);
        return null;
      }
    }
    try {
      chest = await placeNearBot(bot, 'chest', log);
    } catch (err) {
      log(`チェストの設置に失敗: ${err.message}`);
      return null;
    }
  }

  if (chest && bot.collectBlock) {
    bot.collectBlock.chestLocations = [chest.position];
    log('拠点チェストを設定しました。荷物が一杯になると自動で預けます。');
  }
  return chest;
}

// 近くの既知のチェスト(既に設定済みのものがあれば)にジャンク品だけを預ける。
async function depositJunkToChest(bot, log = () => {}) {
  const chestPos = (bot.collectBlock && bot.collectBlock.chestLocations
    && bot.collectBlock.chestLocations[0]) || null;
  const chestBlock = chestPos ? bot.blockAt(chestPos) : findNearbyChest(bot, 48);
  if (!chestBlock || chestBlock.name !== 'chest') return false;

  try {
    await goto(bot, chestBlock.position, 2);
    const chestWindow = await bot.openChest(chestBlock);
    let deposited = false;
    for (const item of bot.inventory.items()) {
      if (!JUNK_ITEMS.includes(item.name)) continue;
      if (chestWindow.firstEmptyContainerSlot() === null) break;
      await chestWindow.deposit(item.type, item.metadata, item.count).catch(() => {});
      deposited = true;
    }
    await chestWindow.close();
    return deposited;
  } catch (err) {
    log(`チェストへの荷下ろしに失敗: ${err.message}`);
    return false;
  }
}

// ジャンク品をその場に捨てて空きを作る(チェストが使えない場合の最終手段)。
async function dropJunk(bot, log = () => {}, minEmptySlots = 2) {
  for (const name of JUNK_ITEMS) {
    if (bot.inventory.emptySlotCount() >= minEmptySlots) return;
    const item = bot.inventory.items().find((i) => i.name === name);
    if (!item) continue;
    try {
      await bot.toss(item.type, item.metadata, item.count);
      log(`${item.name} を捨てて空きを作りました。`);
    } catch (err) {
      log(`${item.name} を捨てるのに失敗: ${err.message}`);
    }
  }
}

function hasKnownChest(bot) {
  return !!(bot.collectBlock && bot.collectBlock.chestLocations && bot.collectBlock.chestLocations.length > 0);
}

// 荷物の空きが少ない時、チェストへ預ける→それでも足りなければ捨てる、の順で空きを作る。
// まだチェストが1つも無ければ、この場で新しく作ってから預ける。
async function makeRoom(bot, log = () => {}, minEmptySlots = 2) {
  if (bot.inventory.emptySlotCount() >= minEmptySlots) return;

  if (!hasKnownChest(bot) && !findNearbyChest(bot, 48)) {
    await ensureChest(bot, log);
  }

  await depositJunkToChest(bot, log);
  if (bot.inventory.emptySlotCount() < minEmptySlots) {
    await dropJunk(bot, log, minEmptySlots);
  }
}

module.exports = {
  ensureChest, findNearbyChest, makeRoom, depositJunkToChest, dropJunk,
};
