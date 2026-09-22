const { goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');
const { waitUntilCombatClear } = require('./combatLock');

// 応戦中(startCombatDefense)は新しい移動ゴールを出さずに待ち、
// 採掘・探索などの移動が戦闘の邪魔をしないようにする。
async function goto(bot, pos, range = 1) {
  await waitUntilCombatClear();
  const goal = new goals.GoalNear(pos.x, pos.y, pos.z, range);
  return bot.pathfinder.goto(goal);
}

async function gotoEntity(bot, entity, range = 3) {
  await waitUntilCombatClear();
  const goal = new goals.GoalFollow(entity, range);
  return bot.pathfinder.goto(goal);
}

async function retreatFrom(bot, threatPos, distance = 12) {
  const me = bot.entity.position;
  const away = me.minus(threatPos).normalize().scale(distance);
  const target = me.plus(away);
  const goal = new goals.GoalNear(target.x, target.y, target.z, 2);
  bot.pathfinder.setGoal(goal);
}

function stopMoving(bot) {
  bot.pathfinder.setGoal(null);
  bot.clearControlStates();
}

function distanceTo(bot, pos) {
  return bot.entity.position.distanceTo(pos);
}

module.exports = {
  Vec3,
  goto,
  gotoEntity,
  retreatFrom,
  stopMoving,
  distanceTo,
};
