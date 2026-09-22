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

// 足元のブロックを1つ掘って1段降りる(崖・段差で経路が見つからない時の対処用)。
async function digDownStep(bot) {
  const pos = bot.entity.position.floored();
  const below = bot.blockAt(pos.offset(0, -1, 0));
  if (below && below.boundingBox === 'block' && below.diggable) {
    try {
      await bot.dig(below);
      return true;
    } catch (_) {
      return false;
    }
  }
  return false;
}

// gotoを試し、失敗したら(崖・段差で経路が見つからない可能性があるため)
// 足元を1つ掘ってから再挑戦する。探索・長距離移動用。
async function gotoOrDigDown(bot, pos, range = 1) {
  try {
    await goto(bot, pos, range);
    return;
  } catch (err) {
    const dug = await digDownStep(bot);
    if (!dug) throw err;
  }
  await goto(bot, pos, range);
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
  gotoOrDigDown,
  digDownStep,
  retreatFrom,
  stopMoving,
  distanceTo,
};
