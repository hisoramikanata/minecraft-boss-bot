const { RAW_FOOD_ANIMALS, COOKABLE, anyItemCount } = require('./materials');
const { engageMelee, disengage, nearestHostile } = require('../utils/combat');
const { goto, distanceTo } = require('../utils/navigation');
const { smelt } = require('./smelting');
const { wander } = require('./woodcutting');
const { throwIfCancelled } = require('./cancellation');

function findAnimal(bot) {
  return nearestHostile(bot, (e) => e.name && RAW_FOOD_ANIMALS.includes(e.name), 32);
}

async function huntOne(bot, log = () => {}) {
  const animal = findAnimal(bot);
  if (!animal) return false;

  const start = Date.now();
  while (animal.isValid && Date.now() - start < 15000) {
    const dist = distanceTo(bot, animal.position);
    if (dist > 3) {
      await goto(bot, animal.position, 2).catch(() => {});
    } else {
      engageMelee(bot, animal);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  disengage(bot);
  log(`${animal.name} を確保しました。`);
  return true;
}

async function cookRawFood(bot, log = () => {}) {
  for (const rawName of Object.keys(COOKABLE)) {
    const count = anyItemCount(bot, [rawName]);
    if (count <= 0) continue;
    try {
      await smelt(bot, rawName, count, log);
    } catch (err) {
      log(`${rawName} の調理をスキップ: ${err.message}`);
    }
  }
}

// 調理済み食料が目標数に達するまで狩猟→調理を繰り返す。
async function ensureFood(bot, targetCookedCount, log = () => {}) {
  const cookedNames = Object.values(COOKABLE);
  let attempts = 0;

  while (anyItemCount(bot, cookedNames) < targetCookedCount && attempts < 40) {
    throwIfCancelled();
    attempts += 1;
    const hunted = await huntOne(bot, log);
    if (!hunted) {
      log('付近に狩れる動物がいません。探索します...');
      await wander(bot);
    }
    if (anyItemCount(bot, Object.keys(COOKABLE)) >= 1) {
      await cookRawFood(bot, log);
    }
  }

  const have = anyItemCount(bot, cookedNames);
  if (have < targetCookedCount) {
    log(`調理済み食料が目標に届きませんでした (${have}/${targetCookedCount})。狩猟が難しい環境の可能性があります。`);
  } else {
    log(`調理済み食料を ${have} 個確保しました。`);
  }
}

module.exports = {
  findAnimal, huntOne, cookRawFood, ensureFood,
};
