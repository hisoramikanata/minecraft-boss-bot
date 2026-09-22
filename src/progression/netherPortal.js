const { placeAt, clearIfSolid } = require('./placement');
const { craftItem } = require('./craftingHelper');
const { findItem, itemCount } = require('./materials');
const { goto } = require('../utils/navigation');
const { wander } = require('./woodcutting');
const { throwIfCancelled } = require('./cancellation');

const OBSIDIAN = 'obsidian';

function findObsidian(bot, maxDistance = 64) {
  return bot.findBlocks({
    matching: (b) => b && b.name === OBSIDIAN,
    maxDistance,
    count: 16,
  }).map((p) => bot.blockAt(p));
}

// 天然/既存の黒曜石を優先的に採掘する。ダイヤモンド以上のピッケルが必要。
async function mineNaturalObsidian(bot, count, log = () => {}) {
  let collected = 0;
  let attempts = 0;
  while (collected < count && attempts < 20) {
    throwIfCancelled();
    attempts += 1;
    const blocks = findObsidian(bot, 48 + attempts * 16);
    if (blocks.length === 0) break;
    try {
      await bot.collectBlock.collect(blocks, { ignoreNoPath: true });
      collected = itemCount(bot, OBSIDIAN);
    } catch (err) {
      log(`黒曜石採掘に失敗: ${err.message}`);
      break;
    }
  }
  return collected;
}

// 溶岩に水をかけて黒曜石を作る(実験的機能)。溶岩源湖の近くで水入りバケツを使用する。
async function farmObsidianFromLava(bot, count, log = () => {}) {
  const waterBucket = findItem(bot, 'water_bucket');
  const emptyBucket = findItem(bot, 'bucket');
  if (!waterBucket) {
    log('水入りバケツがないため、溶岩からの黒曜石生成はスキップします。');
    return itemCount(bot, OBSIDIAN);
  }

  let attempts = 0;
  while (itemCount(bot, OBSIDIAN) < count && attempts < 10) {
    throwIfCancelled();
    attempts += 1;
    const lava = bot.findBlock({
      matching: (b) => b && b.name === 'lava',
      maxDistance: 48,
    });
    if (!lava) {
      log('溶岩源が見つかりません。');
      break;
    }
    try {
      await goto(bot, lava.position, 3);
      await bot.equip(waterBucket, 'hand');
      await bot.lookAt(lava.position.offset(0.5, 0.5, 0.5), true);
      bot.activateItem();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // 黒曜石化を確認したら、要らない水を空バケツで回収(なくても採掘は可能)
      if (emptyBucket) {
        await bot.equip(emptyBucket, 'hand');
        bot.activateItem();
      }
      const obsidianBlock = bot.blockAt(lava.position);
      if (obsidianBlock && obsidianBlock.name === OBSIDIAN) {
        await bot.collectBlock.collect(obsidianBlock, { ignoreNoPath: true }).catch(() => {});
      }
    } catch (err) {
      log(`溶岩からの黒曜石生成に失敗: ${err.message}`);
    }
  }
  return itemCount(bot, OBSIDIAN);
}

async function obtainObsidian(bot, count, log = () => {}) {
  let have = itemCount(bot, OBSIDIAN);
  if (have >= count) return have;

  log('黒曜石を探索・採掘します。');
  have = await mineNaturalObsidian(bot, count, log);
  if (have < count) {
    log('天然の黒曜石が不足。溶岩+水での生成を試みます(実験的)。');
    have = await farmObsidianFromLava(bot, count, log);
  }
  if (have < count) {
    throw new Error(`黒曜石が不足しています (${have}/${count})。手動での補充が必要な場合があります。`);
  }
  return have;
}

function findGravel(bot, maxDistance = 48) {
  return bot.findBlocks({
    matching: (b) => b && b.name === 'gravel',
    maxDistance,
    count: 8,
  }).map((p) => bot.blockAt(p));
}

// フリント&スチール用のフリントを、砂利採掘(確率ドロップ)で集める。
async function gatherFlint(bot, log = () => {}) {
  let attempts = 0;
  while (itemCount(bot, 'flint') < 1 && attempts < 40) {
    throwIfCancelled();
    attempts += 1;
    const gravels = findGravel(bot);
    if (gravels.length === 0) {
      log('砂利が見つかりません。探索します...');
      await wander(bot);
      continue;
    }
    await bot.collectBlock.collect(gravels[0], { ignoreNoPath: true }).catch(() => {});
  }
  if (itemCount(bot, 'flint') < 1) {
    throw new Error('フリントを入手できませんでした');
  }
}

async function ensureFlintAndSteel(bot, log = () => {}) {
  if (findItem(bot, 'flint_and_steel')) return;
  if (itemCount(bot, 'flint') < 1) {
    await gatherFlint(bot, log);
  }
  if (itemCount(bot, 'iron_ingot') < 1) {
    throw new Error('フリント&スチール用の鉄インゴットがありません');
  }
  await craftItem(bot, 'flint_and_steel', 1, log);
}

// bot足元を基準に、幅4x高さ5の中空長方形ポータル枠を黒曜石で建築する(実験的: 平地前提)。
async function buildFrame(bot, log = () => {}) {
  const base = bot.entity.position.floored().offset(2, 0, 0);
  const width = 4;
  const height = 5;

  log('ポータル建築予定地を整地します。');
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      await clearIfSolid(bot, base.offset(x, y, 0));
    }
  }

  const perimeter = [];
  for (let x = 0; x < width; x += 1) {
    perimeter.push(base.offset(x, 0, 0));
    perimeter.push(base.offset(x, height - 1, 0));
  }
  for (let y = 1; y < height - 1; y += 1) {
    perimeter.push(base.offset(0, y, 0));
    perimeter.push(base.offset(width - 1, y, 0));
  }

  log('黒曜石を設置してポータル枠を建築します。');
  for (const pos of perimeter) {
    await placeAt(bot, pos, OBSIDIAN);
  }

  return { base, width, height, igniteAt: base.offset(1, 1, 0) };
}

async function ignitePortal(bot, frame, log = () => {}) {
  await ensureFlintAndSteel(bot, log);
  const flintAndSteel = findItem(bot, 'flint_and_steel');
  await bot.equip(flintAndSteel, 'hand');
  const targetBlock = bot.blockAt(frame.base.offset(0, 1, 0));
  await goto(bot, frame.igniteAt, 2);
  await bot.lookAt(targetBlock.position.offset(0.5, 0.5, 0.5), true);
  await bot.activateBlock(targetBlock);
  log('ポータルに着火しました。');
}

async function enterPortal(bot, frame, log = () => {}) {
  const startDim = bot.game.dimension;
  await goto(bot, frame.igniteAt, 0);
  log('ポータルに入ります。次元移動を待機します...');
  const start = Date.now();
  while (bot.game.dimension === startDim && Date.now() - start < 30000) {
    bot.setControlState('forward', true);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  bot.clearControlStates();
  if (bot.game.dimension === startDim) {
    throw new Error('次元移動を検出できませんでした');
  }
  log(`次元移動完了: ${bot.game.dimension}`);
}

// 黒曜石確保→建築→着火→突入までを一括実行する。
async function buildAndEnterPortal(bot, log = () => {}) {
  await obtainObsidian(bot, 10, log);
  const frame = await buildFrame(bot, log);
  await ignitePortal(bot, frame, log);
  await enterPortal(bot, frame, log);
}

module.exports = {
  obtainObsidian, buildFrame, ignitePortal, enterPortal, buildAndEnterPortal, gatherFlint, ensureFlintAndSteel,
};
