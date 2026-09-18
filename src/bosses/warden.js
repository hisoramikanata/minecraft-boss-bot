const { retreatFrom, distanceTo, stopMoving } = require('../utils/navigation');
const {
  prepareForFight, watchHealth, disengage, shootAt, nearestHostile,
} = require('../utils/combat');

// ウォーデンは近接攻撃が非常に高威力(装備次第で即死級)なため、
// このBotは原則「回避」を優先し、応戦する場合も近接せず弓のみで距離を取り続ける。
const SAFE_DISTANCE = 20;
const DANGER_DISTANCE = 10;

function findWarden(bot) {
  return nearestHostile(bot, (e) => e.name === 'warden', 40);
}

async function setSneak(bot, enabled) {
  bot.setControlState('sneak', enabled);
}

// 振動/匂いによる感知を避けるため、しゃがみ移動で距離を取り続ける。
async function avoid(bot, log = () => {}) {
  await setSneak(bot, true);
  let warden = findWarden(bot);
  if (!warden) {
    log('付近にウォーデンは検出されませんでした。');
    await setSneak(bot, false);
    return;
  }

  log('ウォーデンを検出。回避行動を開始します(採掘・設置・走行は行いません)。');
  while (warden && warden.isValid) {
    const dist = distanceTo(bot, warden.position);
    if (dist < SAFE_DISTANCE) {
      await retreatFrom(bot, warden.position, SAFE_DISTANCE - dist + 4);
    } else {
      stopMoving(bot);
      log('安全距離を確保しました。待機します。');
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    warden = findWarden(bot);
  }
  await setSneak(bot, false);
}

// 応戦モード: 近接は行わず、弓で牽制しながら距離を維持するキルサイクル。
// WARDEN_AVOID_ONLY=false のときのみ使用可能。極めて危険なため自己責任。
async function fight(bot, log = () => {}) {
  await prepareForFight(bot);
  await setSneak(bot, true);

  let target = findWarden(bot);
  if (!target) {
    throw new Error('ウォーデンが見つかりません。');
  }

  log('ウォーデンへの応戦(遠距離のみ)を開始します。');
  let retreating = false;

  const stopWatch = watchHealth(bot, {
    onLow: async () => {
      if (retreating) return;
      retreating = true;
      log('HP低下。緊急離脱します。');
      await retreatFrom(bot, target.position, SAFE_DISTANCE);
      setTimeout(() => { retreating = false; }, 3000);
    },
    onCritical: async () => {
      log('HP危険域。最大距離まで離脱します。');
      await retreatFrom(bot, target.position, SAFE_DISTANCE + 10);
    },
  });

  try {
    while (target && target.isValid) {
      const dist = distanceTo(bot, target.position);

      if (dist < DANGER_DISTANCE) {
        // 近接圏内は即死級ダメージの危険があるため、攻撃せず離脱を最優先する
        await retreatFrom(bot, target.position, SAFE_DISTANCE - dist);
      } else if (dist <= SAFE_DISTANCE) {
        await shootAt(bot, target, 900);
      } else {
        // 射程外まで離れたら追わず、次の接近を待つ
        stopMoving(bot);
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
      target = findWarden(bot);
    }
    log('ウォーデンとの遭遇が終了しました。');
  } finally {
    stopWatch();
    disengage(bot);
    await setSneak(bot, false);
  }
}

module.exports = { findWarden, avoid, fight };
