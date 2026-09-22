const { Vec3 } = require('vec3');
const { goals } = require('mineflayer-pathfinder');

const NEIGHBOR_OFFSETS = [
  [0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
];

function isReplaceable(block) {
  return !block || block.boundingBox !== 'block';
}

function hasSolidNeighbor(bot, pos) {
  return NEIGHBOR_OFFSETS.some(([dx, dy, dz]) => {
    const refBlock = bot.blockAt(pos.offset(dx, dy, dz));
    return refBlock && refBlock.boundingBox === 'block';
  });
}

// 指定座標に隣接する既存の固体ブロックを基準として、itemNameのブロックを設置する。
// 建築物を「地面や既に置いたブロックに繋げて」段階的に組み上げる用途向け。
async function placeAt(bot, pos, itemName) {
  const existing = bot.blockAt(pos);
  if (existing && existing.name === itemName) return; // 既に設置済み
  if (!isReplaceable(existing)) throw new Error(`${pos} には既にブロックがあり設置できません`);

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

// bot周辺の複数候補地点から、設置可能な(空いていて隣接ブロックがある)場所を探して設置する。
// 採掘直後などで足元が掘り返されている場合に備え、まず「今立っている足場」を直接の
// 設置基準にする方式を優先する(最も確実)。それでもダメなら周辺の候補地点を試す。
// 失敗のたびにチャットへログを送るとスパム判定でキックされるため、途中経過はコンソール
// のみに出し、チャットには最終結果だけ流す。
async function placeNearBot(bot, itemName, log = () => {}) {
  const standingBlock = bot.blockAt(bot.entity.position.floored().offset(0, -1, 0));

  if (standingBlock && standingBlock.boundingBox === 'block') {
    const faces = [
      new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 0, -1), new Vec3(0, 1, 0),
    ];
    const item = bot.inventory.items().find((i) => i.name === itemName);
    if (item) {
      for (const face of faces) {
        const destPos = standingBlock.position.plus(face);
        const destBlock = bot.blockAt(destPos);
        if (!isReplaceable(destBlock)) continue;
        try {
          await bot.pathfinder.goto(new goals.GoalNear(destPos.x, destPos.y, destPos.z, 3));
          await bot.equip(item, 'hand');
          await bot.placeBlock(standingBlock, face);
          return bot.blockAt(destPos);
        } catch (err) {
          console.log(`[placeNearBot] ${destPos} への設置に失敗: ${err.message}`);
        }
      }
    }
  }

  const feet = bot.entity.position.floored();
  const candidates = [
    feet.offset(1, 0, 0), feet.offset(-1, 0, 0), feet.offset(0, 0, 1), feet.offset(0, 0, -1),
    feet.offset(1, 0, 1), feet.offset(1, 0, -1), feet.offset(-1, 0, 1), feet.offset(-1, 0, -1),
    feet.offset(2, 0, 0), feet.offset(0, 0, 2), feet.offset(-2, 0, 0), feet.offset(0, 0, -2),
  ];

  for (const pos of candidates) {
    const block = bot.blockAt(pos);
    if (!isReplaceable(block)) continue;
    if (!hasSolidNeighbor(bot, pos)) continue;
    try {
      await placeAt(bot, pos, itemName);
      return bot.blockAt(pos);
    } catch (err) {
      console.log(`[placeNearBot] ${pos} への設置に失敗: ${err.message}`);
    }
  }
  log(`${itemName} を設置できる場所が周囲に見つかりません`);
  throw new Error(`${itemName} を設置できる場所が周囲に見つかりません`);
}

async function clearIfSolid(bot, pos) {
  const block = bot.blockAt(pos);
  if (block && block.boundingBox === 'block' && block.diggable) {
    await bot.dig(block);
  }
}

module.exports = {
  placeAt, placeNearBot, clearIfSolid, NEIGHBOR_OFFSETS,
};
