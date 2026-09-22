// 応戦中は採掘・移動などのpathfinderゴールが競合しないよう、
// 他のタスクが新しい移動を始める前にここで待たせるための共有フラグ。
let inCombat = false;

function setInCombat(value) {
  inCombat = value;
}

function isInCombat() {
  return inCombat;
}

function waitUntilCombatClear() {
  return new Promise((resolve) => {
    if (!inCombat) {
      resolve();
      return;
    }
    const check = () => {
      if (!inCombat) {
        resolve();
      } else {
        setTimeout(check, 300);
      }
    };
    check();
  });
}

module.exports = { setInCombat, isInCombat, waitUntilCombatClear };
