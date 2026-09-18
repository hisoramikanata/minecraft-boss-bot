const { goto, retreatFrom, distanceTo } = require('../utils/navigation');
const {
  prepareForFight, watchHealth, engageMelee, disengage, shootAt, nearestHostile,
} = require('../utils/combat');

function findDragon(bot) {
  return nearestHostile(bot, (e) => e.name === 'ender_dragon', 256);
}

function findCrystals(bot) {
  return Object.values(bot.entities).filter((e) => e.name === 'end_crystal');
}

function isInTheEnd(bot) {
  const dim = bot.game && bot.game.dimension;
  return dim === 'the_end' || dim === 'end';
}

// エンドクリスタルは近接破壊すると大爆発するため、離れた位置から弓で狙撃して破壊する。
async function destroyCrystals(bot, log = () => {}) {
  let crystals = findCrystals(bot);
  log(`エンドクリスタル ${crystals.length} 個を検出。破壊します。`);

  for (const crystal of crystals) {
    if (!crystal.isValid) continue;
    const start = Date.now();
    while (crystal.isValid && Date.now() - start < 20000) {
      const dist = distanceTo(bot, crystal.position);
      if (dist > 20) {
        await goto(bot, crystal.position, 15);
      } else if (dist < 8) {
        await retreatFrom(bot, crystal.position, 10);
      } else {
        await shootAt(bot, crystal, 900);
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  crystals = findCrystals(bot);
  if (crystals.length > 0) {
    log(`未破壊のクリスタルが ${crystals.length} 個残っています。`);
  } else {
    log('エンドクリスタルを全て破壊しました。');
  }
}

async function fight(bot, log = () => {}) {
  if (!isInTheEnd(bot)) {
    throw new Error('ジ・エンドにいません。先にエンドポータルを通過してください。');
  }

  await prepareForFight(bot);
  await destroyCrystals(bot, log);

  let target = findDragon(bot);
  if (!target) {
    throw new Error('エンダードラゴンが見つかりません。');
  }

  log('エンダードラゴン戦を開始します。');
  let retreating = false;

  const stopWatch = watchHealth(bot, {
    onLow: async () => {
      if (retreating) return;
      retreating = true;
      log('HPが低下。距離を取ります。');
      disengage(bot);
      await retreatFrom(bot, target.position, 12);
      setTimeout(() => { retreating = false; }, 3000);
    },
    onCritical: async () => {
      log('HP危険域。撤退を継続します。');
      disengage(bot);
      await retreatFrom(bot, target.position, 18);
    },
  });

  try {
    while (target && target.isValid) {
      if (retreating) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }

      const dist = distanceTo(bot, target.position);
      const speed = target.velocity ? target.velocity.norm() : 0;
      const isPerched = speed < 0.15; // ポータル上に着地している間はほぼ静止する

      if (isPerched && dist < 6) {
        engageMelee(bot, target);
      } else if (dist < 25) {
        await shootAt(bot, target, 700);
        await goto(bot, target.position, 6);
      } else {
        await goto(bot, target.position, 10);
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
      target = findDragon(bot);
    }
    log('エンダードラゴンを討伐しました。');
  } finally {
    stopWatch();
    disengage(bot);
  }
}

module.exports = {
  fight, findDragon, findCrystals, destroyCrystals, isInTheEnd,
};
