const { nearestHostile, fightMob } = require('../utils/combat');
const { goto } = require('../utils/navigation');
const { craftItem } = require('./craftingHelper');
const { itemCount } = require('./materials');

function findEnderman(bot, maxDistance = 32) {
  return nearestHostile(bot, (e) => e.name === 'enderman', maxDistance);
}

// エンダーマンを討伐してエンダーパールを収集する(夜間の平原/砂漠などで遭遇しやすい)。
async function collectEnderPearls(bot, count, log = () => {}) {
  let attempts = 0;
  while (itemCount(bot, 'ender_pearl') < count && attempts < 150) {
    attempts += 1;
    const target = findEnderman(bot);
    if (target) {
      await goto(bot, target.position, 3).catch(() => {});
      await fightMob(bot, target, { log });
    } else {
      const angle = Math.random() * Math.PI * 2;
      const dest = bot.entity.position.offset(Math.cos(angle) * 30, 0, Math.sin(angle) * 30);
      await goto(bot, dest, 4).catch(() => {});
    }
    log(`エンダーパール: ${itemCount(bot, 'ender_pearl')}/${count}`);
  }
  if (itemCount(bot, 'ender_pearl') < count) {
    throw new Error(`エンダーパールが不足 (${itemCount(bot, 'ender_pearl')}/${count})`);
  }
}

// ブレイズロッドからブレイズパウダーを精製する。
async function craftBlazePowder(bot, count, log = () => {}) {
  const rodsNeeded = Math.ceil(count / 2);
  if (itemCount(bot, 'blaze_rod') < rodsNeeded) {
    throw new Error(`ブレイズロッドが不足 (blaze_powder x${count} には ${rodsNeeded}本必要)`);
  }
  await craftItem(bot, 'blaze_powder', rodsNeeded, log);
}

// エンダーの目(ブレイズパウダー+エンダーパール)を作成する。
async function craftEyesOfEnder(bot, count, log = () => {}) {
  if (itemCount(bot, 'ender_pearl') < count) {
    await collectEnderPearls(bot, count, log);
  }
  if (itemCount(bot, 'blaze_powder') < count) {
    await craftBlazePowder(bot, count - itemCount(bot, 'blaze_powder'), log);
  }
  await craftItem(bot, 'ender_eye', count, log);
}

module.exports = { collectEnderPearls, craftBlazePowder, craftEyesOfEnder, findEnderman };
