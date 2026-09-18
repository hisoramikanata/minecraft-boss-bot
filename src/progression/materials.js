const LOG_NAMES = [
  'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log',
  'dark_oak_log', 'mangrove_log', 'cherry_log',
];

const PLANK_NAMES = [
  'oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks',
  'acacia_planks', 'dark_oak_planks', 'mangrove_planks', 'cherry_planks',
];

const COAL_ORE = ['coal_ore', 'deepslate_coal_ore'];
const IRON_ORE = ['iron_ore', 'deepslate_iron_ore'];
const DIAMOND_ORE = ['diamond_ore', 'deepslate_diamond_ore'];
const STONE_LIKE = ['stone', 'cobblestone', 'diorite', 'andesite', 'granite', 'deepslate', 'tuff'];

const RAW_FOOD_ANIMALS = ['cow', 'pig', 'chicken', 'sheep', 'rabbit'];

const COOKABLE = {
  beef: 'cooked_beef',
  porkchop: 'cooked_porkchop',
  chicken: 'cooked_chicken',
  mutton: 'cooked_mutton',
  rabbit: 'cooked_rabbit',
};

const FUEL_NAMES = ['coal', 'charcoal', 'coal_block'];

function itemCount(bot, name) {
  return bot.inventory.items()
    .filter((item) => item.name === name)
    .reduce((sum, item) => sum + item.count, 0);
}

function anyItemCount(bot, names) {
  return names.reduce((sum, name) => sum + itemCount(bot, name), 0);
}

function findItem(bot, names) {
  const list = Array.isArray(names) ? names : [names];
  return bot.inventory.items().find((item) => list.includes(item.name)) || null;
}

module.exports = {
  LOG_NAMES,
  PLANK_NAMES,
  COAL_ORE,
  IRON_ORE,
  DIAMOND_ORE,
  STONE_LIKE,
  RAW_FOOD_ANIMALS,
  COOKABLE,
  FUEL_NAMES,
  itemCount,
  anyItemCount,
  findItem,
};
