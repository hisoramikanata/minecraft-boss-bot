const SWORD_RANK = [
  'wooden_sword',
  'golden_sword',
  'stone_sword',
  'iron_sword',
  'diamond_sword',
  'netherite_sword',
];

const AXE_RANK = [
  'wooden_axe',
  'golden_axe',
  'stone_axe',
  'iron_axe',
  'diamond_axe',
  'netherite_axe',
];

const BOW_NAMES = ['bow', 'crossbow'];

function bestByRank(bot, rankList) {
  let best = null;
  let bestIndex = -1;
  for (const item of bot.inventory.items()) {
    const idx = rankList.indexOf(item.name);
    if (idx > bestIndex) {
      bestIndex = idx;
      best = item;
    }
  }
  return best;
}

async function equipBestWeapon(bot) {
  const sword = bestByRank(bot, SWORD_RANK);
  const axe = bestByRank(bot, AXE_RANK);
  const weapon = sword || axe;
  if (weapon) {
    await bot.equip(weapon, 'hand');
  }
  return weapon || null;
}

async function equipBestArmor(bot) {
  if (bot.armorManager) {
    await bot.armorManager.equipAll();
  }
}

function findBow(bot) {
  return bot.inventory.items().find((item) => BOW_NAMES.includes(item.name)) || null;
}

async function equipBow(bot) {
  const bow = findBow(bot);
  if (bow) {
    await bot.equip(bow, 'hand');
  }
  return bow;
}

function hasFood(bot) {
  return bot.inventory.items().some((item) => item.name.includes('bread')
    || item.name.includes('cooked')
    || item.name.includes('apple')
    || item.name.includes('carrot')
    || item.name.includes('potato')
    || item.name.includes('stew'));
}

module.exports = {
  equipBestWeapon,
  equipBestArmor,
  equipBow,
  findBow,
  hasFood,
};
