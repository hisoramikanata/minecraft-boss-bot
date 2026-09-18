const { gatherWood } = require('./woodcutting');
const { ensureCraftingTable } = require('./craftingHelper');
const { craftToolSet, craftArmorSet } = require('./toolProgression');
const { mineOre } = require('./mining');
const { smelt } = require('./smelting');
const { ensureFood } = require('./food');
const {
  COAL_ORE, IRON_ORE, DIAMOND_ORE, findItem, itemCount,
} = require('./materials');
const { buildAndEnterPortal } = require('./netherPortal');
const {
  locateFortress, collectSoulSand, collectBlazeRods, collectWitherSkulls,
} = require('./fortress');
const { collectEnderPearls, craftEyesOfEnder } = require('./enderPrep');
const { locateAndActivateEndPortal } = require('./stronghold');
const { goto } = require('../utils/navigation');
const wither = require('../bosses/wither');
const enderDragon = require('../bosses/enderDragon');

async function returnThroughPortal(bot, log = () => {}) {
  const startDim = bot.game.dimension;
  const portalBlock = bot.findBlock({
    matching: (b) => b && b.name === 'nether_portal',
    maxDistance: 64,
  });
  if (!portalBlock) throw new Error('帰還用のポータルが見つかりません');

  log('元の次元に戻ります...');
  const start = Date.now();
  while (bot.game.dimension === startDim && Date.now() - start < 20000) {
    await goto(bot, portalBlock.position, 0).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (bot.game.dimension === startDim) {
    throw new Error('次元移動を検出できませんでした');
  }
  log(`戻りました: ${bot.game.dimension}`);
}

function buildPhases(bot, log) {
  return [
    {
      name: '木材確保・初期装備',
      required: true,
      run: async () => {
        await gatherWood(bot, 16, log);
        await ensureCraftingTable(bot, log);
        await craftToolSet(bot, 'wooden', log);
      },
    },
    {
      name: '石材採掘・石器化',
      required: true,
      run: async () => {
        await mineOre(bot, ['stone', 'cobblestone', 'deepslate'], 24, { minY: 0, maxY: 64 }, log);
        await craftToolSet(bot, 'stone', log);
      },
    },
    {
      name: '食料確保(序盤)',
      required: false,
      run: async () => { await ensureFood(bot, 6, log); },
    },
    {
      name: '石炭・鉄採掘',
      required: true,
      run: async () => {
        await mineOre(bot, COAL_ORE, 8, { minY: -16, maxY: 96 }, log);
        await mineOre(bot, IRON_ORE, 16, { minY: -16, maxY: 64 }, log);
      },
    },
    {
      name: '鉄の精錬・鉄器化',
      required: true,
      run: async () => {
        const rawName = findItem(bot, ['raw_iron', 'iron_ore']);
        if (!rawName) throw new Error('精錬する鉄鉱石がありません');
        await smelt(bot, rawName.name, itemCount(bot, rawName.name), log);
        await craftToolSet(bot, 'iron', log);
        await craftArmorSet(bot, 'iron', log);
      },
    },
    {
      name: 'ダイヤモンド採掘・装備強化',
      required: true,
      run: async () => {
        await mineOre(bot, DIAMOND_ORE, 10, { minY: -64, maxY: -8 }, log);
        await craftToolSet(bot, 'diamond', log);
        await craftArmorSet(bot, 'diamond', log);
      },
    },
    {
      name: 'ネザーポータル建築・突入',
      required: true,
      run: async () => { await buildAndEnterPortal(bot, log); },
    },
    {
      name: 'ネザー要塞探索・資材収集',
      required: true,
      run: async () => {
        await locateFortress(bot, log);
        await collectSoulSand(bot, 4, log);
        await collectBlazeRods(bot, 8, log);
        await collectWitherSkulls(bot, 3, log);
      },
    },
    {
      name: 'ウィザー討伐',
      required: false,
      run: async () => { await wither.fight(bot, log); },
    },
    {
      name: 'オーバーワールドへ帰還',
      required: true,
      run: async () => { await returnThroughPortal(bot, log); },
    },
    {
      name: 'エンダーパール収集',
      required: true,
      run: async () => { await collectEnderPearls(bot, 14, log); },
    },
    {
      name: 'エンダーの目 作成',
      required: true,
      run: async () => { await craftEyesOfEnder(bot, 14, log); },
    },
    {
      name: 'ストロングホールド到達・エンド突入',
      required: true,
      run: async () => { await locateAndActivateEndPortal(bot, log); },
    },
    {
      name: 'エンダードラゴン討伐',
      required: true,
      run: async () => { await enderDragon.fight(bot, log); },
    },
  ];
}

// サバイバル1からボス討伐までを一括で実行する。各フェーズは順番に実行され、
// requiredなフェーズで失敗すると全体を停止する。
async function runFullProgression(bot, log = () => {}, isCancelled = () => false) {
  const phases = buildPhases(bot, log);

  for (const phase of phases) {
    if (isCancelled()) {
      log('進行が中断されました。');
      return;
    }
    log(`=== フェーズ開始: ${phase.name} ===`);
    try {
      await phase.run();
      log(`=== フェーズ完了: ${phase.name} ===`);
    } catch (err) {
      log(`フェーズ失敗「${phase.name}」: ${err.message}`);
      if (phase.required) {
        log('必須フェーズが失敗したため、自動進行を停止します。手動での介入が必要です。');
        return;
      }
      log('このフェーズは任意のためスキップして続行します。');
    }
  }

  log('全フェーズが完了しました(達成できなかった任意フェーズがある可能性があります)。');
}

module.exports = { runFullProgression, returnThroughPortal };
