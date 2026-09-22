const { Vec3 } = require('vec3');
const { goto } = require('../utils/navigation');
const { throwIfCancelled } = require('./cancellation');
const { ensureTool } = require('./toolProgression');
const { makeRoom } = require('./chest');

const TOOL_CHECK_INTERVAL = 5; // 何回の採掘試行ごとに道具切れを確認するか

// 掘削で移動する前に、進行方向・足元に溶岩/水がないか簡易チェックする。
function isDangerousAt(bot, pos) {
  const below = bot.blockAt(pos.offset(0, -1, 0));
  const here = bot.blockAt(pos);
  const dangerNames = ['lava', 'water'];
  return (below && dangerNames.includes(below.name))
    || (here && dangerNames.includes(here.name));
}

async function digIfSolid(bot, pos) {
  const block = bot.blockAt(pos);
  if (block && block.boundingBox === 'block' && block.diggable) {
    await bot.dig(block);
  }
}

// 現在のY座標が目標帯域より高ければ安全確認しつつ掘り下げ、範囲内なら横方向にトンネルを掘り進める。
async function tunnelStep(bot, minY, maxY, log = () => {}) {
  const pos = bot.entity.position.floored();

  if (pos.y > maxY) {
    const below = pos.offset(0, -2, 0);
    if (isDangerousAt(bot, below)) {
      log('直下に溶岩/水を検知。迂回します。');
      await tunnelSideways(bot, log);
      return;
    }
    await digIfSolid(bot, pos.offset(0, -1, 0));
    await digIfSolid(bot, pos.offset(0, -2, 0));
    await goto(bot, pos.offset(0, -1, 0), 0);
    return;
  }

  await tunnelSideways(bot, log);
}

async function tunnelSideways(bot, log = () => {}) {
  const yaw = bot.entity.yaw;
  const dir = new Vec3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  const pos = bot.entity.position.floored();
  const target = pos.offset(Math.round(dir.x * 2), 0, Math.round(dir.z * 2));

  if (isDangerousAt(bot, target)) {
    log('前方に溶岩/水を検知。方向転換します。');
    await bot.look(yaw + Math.PI / 2, 0, true);
    return;
  }

  await digIfSolid(bot, target);
  await digIfSolid(bot, target.offset(0, 1, 0));
  try {
    await goto(bot, target, 0);
  } catch (_) { /* 到達不能なら次のループで別方向を試す */ }
}

// 指定した鉱石ブロック群を目標個数だけ採掘する。見つからなければ目標Y帯へ移動しつつトンネルを掘る。
async function mineOre(bot, oreBlockNames, targetCount, opts = {}, log = () => {}) {
  const {
    minY = -59, maxY = 16, maxAttempts = 400, toolTier = null,
  } = opts;
  let collected = 0;
  let attempts = 0;

  if (toolTier) await ensureTool(bot, toolTier, 'pickaxe', log);

  while (collected < targetCount && attempts < maxAttempts) {
    throwIfCancelled();
    attempts += 1;
    if (toolTier && attempts % TOOL_CHECK_INTERVAL === 0) {
      await ensureTool(bot, toolTier, 'pickaxe', log);
    }
    await makeRoom(bot, log);
    const positions = bot.findBlocks({
      matching: (block) => block && oreBlockNames.includes(block.name),
      maxDistance: 48,
      count: 16,
    });
    const candidates = positions.map((p) => bot.blockAt(p)).filter(Boolean);

    if (candidates.length === 0) {
      await tunnelStep(bot, minY, maxY, log);
      continue;
    }

    const block = candidates[0];
    try {
      await bot.collectBlock.collect(block, { ignoreNoPath: true });
      collected += 1;
      log(`鉱石を採掘しました (${collected}/${targetCount})`);
    } catch (err) {
      log(`採掘に失敗、次の候補へ: ${err.message}`);
    }
  }

  if (collected < targetCount) {
    throw new Error(`目標数まで採掘できませんでした (${collected}/${targetCount})`);
  }
  return collected;
}

module.exports = {
  mineOre, tunnelStep, isDangerousAt, digIfSolid,
};
