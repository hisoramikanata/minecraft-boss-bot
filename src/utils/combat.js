const { equipBestArmor, equipBestWeapon, equipBow } = require('./gear');

const LOW_HEALTH = 10; // 5ハート
const CRITICAL_HEALTH = 6; // 3ハート

// 定期的にHPを監視し、閾値を下回ったらコールバックを呼ぶ監視ループ。
// auto-eatプラグインが基本の自動食事を担うため、ここでは戦闘継続可否の判断のみを行う。
function watchHealth(bot, { onLow, onCritical, interval = 500 } = {}) {
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    if (bot.health <= CRITICAL_HEALTH && onCritical) {
      onCritical(bot.health);
    } else if (bot.health <= LOW_HEALTH && onLow) {
      onLow(bot.health);
    }
  }, interval);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

async function prepareForFight(bot) {
  await equipBestArmor(bot);
  await equipBestWeapon(bot);
}

function engageMelee(bot, target) {
  if (!target || !target.isValid) return;
  bot.pvp.attack(target);
}

function disengage(bot) {
  if (bot.pvp) bot.pvp.stop();
}

// 弓/クロスボウで指定エンティティを狙撃する(近接では危険な相手向け)。
async function shootAt(bot, target, chargeMs = 1000) {
  const bow = await equipBow(bot);
  if (!bow) return false;
  await bot.lookAt(target.position.offset(0, target.height * 0.5, 0), true);
  bot.activateItem();
  await new Promise((resolve) => setTimeout(resolve, chargeMs));
  bot.deactivateItem();
  return true;
}

function nearestHostile(bot, predicate, maxDistance = 32) {
  const entities = Object.values(bot.entities);
  let nearest = null;
  let nearestDist = Infinity;
  for (const entity of entities) {
    if (!predicate(entity)) continue;
    const dist = bot.entity.position.distanceTo(entity.position);
    if (dist < nearestDist && dist <= maxDistance) {
      nearest = entity;
      nearestDist = dist;
    }
  }
  return nearest;
}

module.exports = {
  LOW_HEALTH,
  CRITICAL_HEALTH,
  watchHealth,
  prepareForFight,
  engageMelee,
  disengage,
  shootAt,
  nearestHostile,
};
