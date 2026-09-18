const { Vec3 } = require('vec3');
const { goals } = require('mineflayer-pathfinder');

const NEIGHBOR_OFFSETS = [
  [0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
];

// 指定座標に隣接する既存の固体ブロックを基準として、itemNameのブロックを設置する。
// 建築物を「地面や既に置いたブロックに繋げて」段階的に組み上げる用途向け。
async function placeAt(bot, pos, itemName) {
  const existing = bot.blockAt(pos);
  if (existing && existing.name === itemName) return; // 既に設置済み

  const item = bot.inventory.items().find((i) => i.name === itemName);
  if (!item) throw new Error(`${itemName} がインベントリにありません`);

  for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
    const refPos = pos.offset(dx, dy, dz);
    const refBlock = bot.blockAt(refPos);
    if (!refBlock || refBlock.boundingBox !== 'block') continue;

    const goal = new goals.GoalNear(pos.x, pos.y, pos.z, 3);
    await bot.pathfinder.goto(goal);
    await bot.equip(item, 'hand');
    const face = new Vec3(-dx, -dy, -dz);
    await bot.placeBlock(refBlock, face);
    return;
  }
  throw new Error(`設置基準になるブロックが ${pos} の周囲に見つかりません`);
}

async function clearIfSolid(bot, pos) {
  const block = bot.blockAt(pos);
  if (block && block.boundingBox === 'block' && block.diggable) {
    await bot.dig(block);
  }
}

module.exports = { placeAt, clearIfSolid, NEIGHBOR_OFFSETS };
