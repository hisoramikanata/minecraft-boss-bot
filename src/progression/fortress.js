const { nearestHostile, fightMob } = require('../utils/combat');
const { goto } = require('../utils/navigation');
const { itemCount } = require('./materials');
const { throwIfCancelled } = require('./cancellation');
const { makeRoom } = require('./chest');

const FORTRESS_BLOCKS = ['nether_bricks', 'nether_brick_fence', 'nether_brick_stairs', 'nether_brick_wall'];

function findFortressBlock(bot, maxDistance = 80) {
  return bot.findBlock({
    matching: (b) => b && FORTRESS_BLOCKS.includes(b.name),
    maxDistance,
  });
}

// ネザー要塞が見つかるまでランダムな方向へ探索する(実験的: 溶岩地形は迂回できない場合がある)。
async function locateFortress(bot, log = () => {}) {
  let found = findFortressBlock(bot);
  let attempts = 0;
  while (!found && attempts < 60) {
    throwIfCancelled();
    attempts += 1;
    const angle = Math.random() * Math.PI * 2;
    const dist = 40;
    const target = bot.entity.position.offset(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    log(`要塞を探索中... (試行 ${attempts})`);
    try {
      await goto(bot, target, 4);
    } catch (_) { /* 到達不能地形は無視 */ }
    found = findFortressBlock(bot, 96);
  }
  if (!found) throw new Error('ネザー要塞が見つかりませんでした');
  log('ネザー要塞を発見しました。');
  return found;
}

function findMob(bot, name, maxDistance = 32) {
  return nearestHostile(bot, (e) => e.name === name, maxDistance);
}

async function huntMob(bot, name, log = () => {}) {
  const target = findMob(bot, name);
  if (!target) return false;
  await goto(bot, target.position, 3).catch(() => {});
  await fightMob(bot, target, { log });
  return true;
}

// ソウルサンド/ソウルソイルを収集する(ネザーの荒地〜要塞周辺で見つかりやすい)。
async function collectSoulSand(bot, count, log = () => {}) {
  let collected = itemCount(bot, 'soul_sand') + itemCount(bot, 'soul_soil');
  let attempts = 0;
  while (collected < count && attempts < 60) {
    throwIfCancelled();
    attempts += 1;
    const blocks = bot.findBlocks({
      matching: (b) => b && (b.name === 'soul_sand' || b.name === 'soul_soil'),
      maxDistance: 64,
      count: 8,
    }).map((p) => bot.blockAt(p));

    if (blocks.length === 0) {
      const angle = Math.random() * Math.PI * 2;
      const target = bot.entity.position.offset(Math.cos(angle) * 30, 0, Math.sin(angle) * 30);
      await goto(bot, target, 4).catch(() => {});
      continue;
    }
    await makeRoom(bot, log);
    await bot.collectBlock.collect(blocks, { ignoreNoPath: true }).catch(() => {});
    collected = itemCount(bot, 'soul_sand') + itemCount(bot, 'soul_soil');
    log(`ソウルサンド/ソウルソイル: ${collected}/${count}`);
  }
  if (collected < count) throw new Error(`ソウルサンド/ソウルソイルが不足 (${collected}/${count})`);
}

// ウィザースケルトンの頭骨をドロップ運頼みで収集する(ドロップ率が低いため時間がかかる)。
async function collectWitherSkulls(bot, count, log = () => {}) {
  let attempts = 0;
  while (itemCount(bot, 'wither_skeleton_skull') < count && attempts < 200) {
    throwIfCancelled();
    attempts += 1;
    const hunted = await huntMob(bot, 'wither_skeleton', log);
    if (!hunted) {
      const angle = Math.random() * Math.PI * 2;
      const target = bot.entity.position.offset(Math.cos(angle) * 25, 0, Math.sin(angle) * 25);
      await goto(bot, target, 4).catch(() => {});
    }
    log(`頭骨: ${itemCount(bot, 'wither_skeleton_skull')}/${count} (討伐試行 ${attempts})`);
  }
  if (itemCount(bot, 'wither_skeleton_skull') < count) {
    throw new Error(`ウィザースケルトンの頭骨が不足 (${itemCount(bot, 'wither_skeleton_skull')}/${count})`);
  }
}

// ブレイズロッドを収集する(ブレイズスポナー周辺は高難度のため慎重に)。
async function collectBlazeRods(bot, count, log = () => {}) {
  let attempts = 0;
  while (itemCount(bot, 'blaze_rod') < count && attempts < 100) {
    throwIfCancelled();
    attempts += 1;
    const hunted = await huntMob(bot, 'blaze', log);
    if (!hunted) {
      const angle = Math.random() * Math.PI * 2;
      const target = bot.entity.position.offset(Math.cos(angle) * 20, 0, Math.sin(angle) * 20);
      await goto(bot, target, 4).catch(() => {});
    }
    log(`ブレイズロッド: ${itemCount(bot, 'blaze_rod')}/${count}`);
  }
  if (itemCount(bot, 'blaze_rod') < count) {
    throw new Error(`ブレイズロッドが不足 (${itemCount(bot, 'blaze_rod')}/${count})`);
  }
}

module.exports = {
  locateFortress, collectSoulSand, collectWitherSkulls, collectBlazeRods, huntMob,
};
