const { Vec3 } = require('vec3');
const { gotoOrDigDown } = require('../utils/navigation');
const { throwIfCancelled } = require('./cancellation');

function parseCoordinates(text) {
  const match = text.match(/(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/);
  if (!match) return null;
  return new Vec3(Number(match[1]), Number(match[2]), Number(match[3]));
}

// /locate コマンドで構造物の座標を取得する。ワールドでチート(コマンド)が
// 有効になっている必要がある(「LANに公開」でチートONにした場合など)。
function locateStructure(bot, structureId, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let settled = false;
    const onMessage = (jsonMsg) => {
      const text = jsonMsg.toString();
      const pos = parseCoordinates(text);
      if (!pos) return;
      settled = true;
      bot.removeListener('message', onMessage);
      clearTimeout(timer);
      resolve(pos);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      bot.removeListener('message', onMessage);
      resolve(null);
    }, timeoutMs);
    bot.on('message', onMessage);
    bot.chat(`/locate structure ${structureId}`);
  });
}

// 目的地まで、長距離の場合は区切りながら移動する。
async function travelTo(bot, target, log = () => {}, stepDistance = 200) {
  let remaining = bot.entity.position.distanceTo(target);
  let attempts = 0;
  while (remaining > 8 && attempts < 100) {
    throwIfCancelled();
    attempts += 1;
    const dir = target.minus(bot.entity.position).normalize();
    const step = Math.min(stepDistance, remaining);
    const waypoint = bot.entity.position.plus(dir.scale(step));
    log(`目的地へ移動中(残り約${Math.round(remaining)}ブロック)`);
    try {
      await gotoOrDigDown(bot, waypoint, 6);
    } catch (err) {
      log(`移動に失敗、ルートを再検討します: ${err.message}`);
    }
    remaining = bot.entity.position.distanceTo(target);
  }
}

// 構造物を/locateで見つけて、そこまで移動する。
async function travelToStructure(bot, structureId, log = () => {}) {
  log(`${structureId} を検索します...`);
  const pos = await locateStructure(bot, structureId);
  if (!pos) {
    throw new Error(`${structureId} の座標を取得できませんでした(チートが有効か確認してください)`);
  }
  log(`${structureId} の座標: (${pos.x}, ${pos.y}, ${pos.z})`);
  await travelTo(bot, pos, log);
  log(`${structureId} 付近に到着しました。`);
  return pos;
}

module.exports = {
  locateStructure, travelTo, travelToStructure, parseCoordinates,
};
