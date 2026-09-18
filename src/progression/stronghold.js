const { findItem, itemCount } = require('./materials');
const { goto } = require('../utils/navigation');
const { digIfSolid, isDangerousAt } = require('./mining');

const EYE_ENTITY_NAMES = ['ender_eye', 'eye_of_ender', 'thrown_ender_eye'];
const STRONGHOLD_BLOCKS = ['stone_bricks', 'cracked_stone_bricks', 'mossy_stone_bricks', 'chiseled_stone_bricks', 'stone_brick_stairs'];

// エンダーの目を投げ、直後に出現するエンティティの移動から大まかな方向・距離を推定する(実験的)。
async function throwEyeAndTrack(bot, log = () => {}) {
  const eye = findItem(bot, 'ender_eye');
  if (!eye) throw new Error('エンダーの目がありません');

  const before = new Set(Object.keys(bot.entities));
  const originPos = bot.entity.position.clone();

  await bot.equip(eye, 'hand');
  await bot.look(bot.entity.yaw, 0, true);
  bot.activateItem();

  let tracked = null;
  const start = Date.now();
  while (Date.now() - start < 4000) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (!tracked) {
      const newEntity = Object.entries(bot.entities).find(
        ([id, e]) => !before.has(id) && e.name && EYE_ENTITY_NAMES.includes(e.name),
      );
      if (newEntity) tracked = newEntity[1];
    } else if (!tracked.isValid) {
      break;
    }
  }

  if (!tracked) {
    log('投げたエンダーの目を検出できませんでした(推定方向を維持します)。');
    return null;
  }

  const last = tracked.position;
  const dx = last.x - originPos.x;
  const dz = last.z - originPos.z;
  const horizontalDist = Math.hypot(dx, dz);
  if (horizontalDist < 1) return null;

  return { dx: dx / horizontalDist, dz: dz / horizontalDist, distance: horizontalDist };
}

// エンダーの目を繰り返し投げながら方向へ進み、着地距離が短くなったら「直下」と判断する。
async function approachStronghold(bot, log = () => {}) {
  let lastHeading = null;
  let attempts = 0;

  while (attempts < 40) {
    attempts += 1;
    if (itemCount(bot, 'ender_eye') < 1) {
      throw new Error('エンダーの目を使い切りました。ストロングホールドに到達できませんでした。');
    }

    const result = await throwEyeAndTrack(bot, log);
    if (result) {
      lastHeading = result;
      log(`目の方向を検出 (距離目安 ${result.distance.toFixed(1)})`);
      if (result.distance < 12) {
        log('目の落下距離が短くなりました。この付近を掘り下げます。');
        return;
      }
    }

    const heading = lastHeading || { dx: Math.cos(bot.entity.yaw), dz: Math.sin(bot.entity.yaw) };
    const step = Math.min(30, Math.max(8, (result?.distance || 30) * 0.6));
    const dest = bot.entity.position.offset(heading.dx * step, 0, heading.dz * step);
    try {
      await goto(bot, dest, 4);
    } catch (_) { /* 到達不能な場合は次のスローで再調整 */ }
  }

  log('規定回数の探索で近づけませんでした。現在地から掘り下げを試みます。');
}

// 現在地から下方向へ、ストロングホールドの建材(石レンガ等)が見つかるまで掘り進める。
async function digDownToStronghold(bot, log = () => {}) {
  const floorLimit = (bot.game.minY ?? -64) + 5;
  let pos = bot.entity.position.floored();

  while (pos.y > floorLimit) {
    const hit = bot.findBlock({
      matching: (b) => b && STRONGHOLD_BLOCKS.includes(b.name),
      maxDistance: 6,
    });
    if (hit) {
      log('ストロングホールドの建材を検出しました。');
      return;
    }

    const below = pos.offset(0, -2, 0);
    if (isDangerousAt(bot, below)) {
      log('直下に溶岩/水。少し横にずれます。');
      pos = pos.offset(1, 0, 0);
      continue;
    }
    await digIfSolid(bot, pos.offset(0, -1, 0));
    await goto(bot, pos.offset(0, -1, 0), 0).catch(() => {});
    pos = bot.entity.position.floored();
  }

  throw new Error('ストロングホールドの建材が見つからないまま掘削限界に達しました');
}

function findPortalFrame(bot, maxDistance = 24) {
  return bot.findBlock({
    matching: (b) => b && b.name === 'end_portal_frame',
    maxDistance,
  });
}

// ポータルフレームが見つかるまで、石レンガの通路をランダムに掘り進んで探索する。
async function exploreForPortalRoom(bot, log = () => {}) {
  let frame = findPortalFrame(bot);
  let attempts = 0;
  while (!frame && attempts < 80) {
    attempts += 1;
    const corridorBlock = bot.findBlock({
      matching: (b) => b && STRONGHOLD_BLOCKS.includes(b.name),
      maxDistance: 16,
    });
    if (corridorBlock) {
      const dir = corridorBlock.position.minus(bot.entity.position).normalize();
      const dest = bot.entity.position.offset(dir.x * 4, 0, dir.z * 4);
      await digIfSolid(bot, dest.floored());
      await digIfSolid(bot, dest.floored().offset(0, 1, 0));
      await goto(bot, dest, 1).catch(() => {});
    } else {
      log('通路が見当たりません。行き止まりの可能性があります。');
      break;
    }
    frame = findPortalFrame(bot);
  }
  if (!frame) throw new Error('ポータルの部屋が見つかりませんでした');
  log('エンドポータルの部屋を発見しました。');
  return frame;
}

function isFrameFilled(block) {
  try {
    const props = block.getProperties ? block.getProperties() : {};
    return props && props.eye === 'true';
  } catch (_) {
    return false;
  }
}

// ポータル周囲の空のフレームすべてにエンダーの目をはめ込む。
async function fillPortalFrames(bot, anchorFrame, log = () => {}) {
  const positions = bot.findBlocks({
    matching: (b) => b && b.name === 'end_portal_frame',
    point: anchorFrame.position,
    maxDistance: 6,
    count: 20,
  });

  for (const pos of positions) {
    const block = bot.blockAt(pos);
    if (!block || isFrameFilled(block)) continue;
    const eye = findItem(bot, 'ender_eye');
    if (!eye) throw new Error('エンダーの目が不足し、フレームを埋めきれません');

    await goto(bot, pos, 3).catch(() => {});
    await bot.equip(eye, 'hand');
    await bot.lookAt(pos.offset(0.5, 0.8, 0.5), true);
    await bot.activateBlock(block);
    log(`フレームにエンダーの目を設置 (${pos})`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

async function enterEndPortal(bot, anchorFrame, log = () => {}) {
  const startDim = bot.game.dimension;
  const target = anchorFrame.position.offset(0, 1, 0);
  log('エンドポータルに入ります...');
  const start = Date.now();
  while (bot.game.dimension === startDim && Date.now() - start < 20000) {
    await goto(bot, target, 0).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (bot.game.dimension === startDim) {
    throw new Error('ジ・エンドへの次元移動を検出できませんでした');
  }
  log('ジ・エンドに到達しました。');
}

// ストロングホールド探索〜ポータル起動〜突入までを一括実行する(最も実験的なフェーズ)。
async function locateAndActivateEndPortal(bot, log = () => {}) {
  await approachStronghold(bot, log);
  await digDownToStronghold(bot, log);
  const frame = await exploreForPortalRoom(bot, log);
  await fillPortalFrames(bot, frame, log);
  await enterEndPortal(bot, frame, log);
}

module.exports = {
  throwEyeAndTrack,
  approachStronghold,
  digDownToStronghold,
  exploreForPortalRoom,
  fillPortalFrames,
  enterEndPortal,
  locateAndActivateEndPortal,
};
