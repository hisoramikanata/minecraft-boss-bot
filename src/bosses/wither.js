const { Vec3 } = require('vec3');
const { goto, retreatFrom, distanceTo } = require('../utils/navigation');
const {
  prepareForFight, watchHealth, engageMelee, disengage, shootAt, nearestHostile,
} = require('../utils/combat');

const SOUL_ITEMS = ['soul_sand', 'soul_soil'];
const SKULL_ITEM = 'wither_skeleton_skull';

function findWither(bot) {
  return nearestHostile(bot, (e) => e.name === 'wither', 128);
}

function findItem(bot, names) {
  return bot.inventory.items().find((item) => names.includes(item.name));
}

async function placeOn(bot, refBlock, faceVector, itemName) {
  const item = findItem(bot, [itemName]);
  if (!item) throw new Error(`${itemName} がインベントリに見つかりません`);
  await bot.equip(item, 'hand');
  await bot.placeBlock(refBlock, faceVector);
}

// 召喚に必要な資材(ソウルサンド/ソウルソイル4個、ウィザースケルトンの頭3個)が揃っているか確認する
function hasSummonMaterials(bot) {
  const soul = bot.inventory.items()
    .filter((i) => SOUL_ITEMS.includes(i.name))
    .reduce((sum, i) => sum + i.count, 0);
  const skulls = bot.inventory.items()
    .filter((i) => i.name === SKULL_ITEM)
    .reduce((sum, i) => sum + i.count, 0);
  return soul >= 4 && skulls >= 3;
}

// 足元の1マス北隣を起点に、T字型にソウルサンド4個+頭骨3個を設置してウィザーを召喚する。
// 平坦で3x2x3程度の空間が空いている場所であることが前提(建築が密集した場所では失敗しやすい)。
async function summonWither(bot, log = () => {}) {
  if (!hasSummonMaterials(bot)) {
    throw new Error('ソウルサンド/ソウルソイル4個とウィザースケルトンの頭3個が必要です');
  }

  const feet = bot.entity.position.floored();
  const stemPos = feet.offset(1, 0, 0);
  const groundBelowStem = bot.blockAt(stemPos.offset(0, -1, 0));
  if (!groundBelowStem || groundBelowStem.boundingBox !== 'block') {
    throw new Error('召喚地点の足場が見つかりません');
  }

  log('ソウルサンドを設置中...');
  const soulName = findItem(bot, SOUL_ITEMS).name;
  await placeOn(bot, groundBelowStem, new Vec3(0, 1, 0), soulName);

  const stemBlock = bot.blockAt(stemPos);
  await placeOn(bot, stemBlock, new Vec3(0, 1, 0), soulName);

  const centerBlock = bot.blockAt(stemPos.offset(0, 1, 0));
  await placeOn(bot, centerBlock, new Vec3(-1, 0, 0), soulName);
  await placeOn(bot, centerBlock, new Vec3(1, 0, 0), soulName);

  const westBlock = bot.blockAt(stemPos.offset(-1, 1, 0));
  const eastBlock = bot.blockAt(stemPos.offset(1, 1, 0));

  log('頭骨を設置中(最後の1個で召喚されます)...');
  await placeOn(bot, centerBlock, new Vec3(0, 1, 0), SKULL_ITEM);
  await placeOn(bot, westBlock, new Vec3(0, 1, 0), SKULL_ITEM);

  // 爆発/召喚の衝撃に備え、最後の頭骨を置く前に少し距離を取る
  await retreatFrom(bot, stemPos, 6);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await placeOn(bot, eastBlock, new Vec3(0, 1, 0), SKULL_ITEM);

  log('ウィザーの召喚シーケンス完了。出現を待機します...');
}

async function fight(bot, log = () => {}) {
  await prepareForFight(bot);

  let target = findWither(bot);
  if (!target) {
    log('付近にウィザーが見つかりません。召喚を試みます...');
    await summonWither(bot, log);
    const start = Date.now();
    while (!target && Date.now() - start < 15000) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      target = findWither(bot);
    }
  }

  if (!target) {
    throw new Error('ウィザーが出現しませんでした');
  }

  log('ウィザー戦を開始します。');
  const spawnTime = Date.now();
  let retreating = false;

  const stopWatch = watchHealth(bot, {
    onLow: async () => {
      if (retreating) return;
      retreating = true;
      log('HPが低下。距離を取ります。');
      disengage(bot);
      await retreatFrom(bot, target.position, 10);
      setTimeout(() => { retreating = false; }, 3000);
    },
    onCritical: async () => {
      log('HP危険域。撤退を継続します。');
      disengage(bot);
      await retreatFrom(bot, target.position, 16);
    },
  });

  try {
    while (target && target.isValid) {
      if (retreating) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }

      const invulnerable = Date.now() - spawnTime < 10000; // 出現直後は無敵時間がある
      const dist = distanceTo(bot, target.position);

      if (invulnerable) {
        await retreatFrom(bot, target.position, 10);
      } else if (dist > 6) {
        await shootAt(bot, target, 800);
        await goto(bot, target.position, 4);
      } else {
        engageMelee(bot, target);
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
      target = findWither(bot);
    }
    log('ウィザーを討伐しました。');
  } finally {
    stopWatch();
    disengage(bot);
  }
}

module.exports = { fight, findWither, summonWither, hasSummonMaterials };
