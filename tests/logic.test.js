const assert = require("node:assert/strict");

const {
  createWashingMachineModel,
  createRefrigeratorModel
} = require("../script.js");

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

runTest("washing machine advances through embedded-style FSM stages", () => {
  const washer = createWashingMachineModel();

  washer.start();
  assert.equal(washer.state.status, "洗涤中");

  washer.tick(34);
  assert.equal(washer.state.status, "漂洗中");

  washer.tick(36);
  assert.equal(washer.state.status, "脱水中");

  washer.tick(30);
  assert.equal(washer.state.status, "已完成");
  assert.equal(washer.state.progress, 100);
});

runTest("refrigerator warning flag follows door and temperature conditions", () => {
  const refrigerator = createRefrigeratorModel();

  assert.equal(refrigerator.state.warningFlag, "正常");

  refrigerator.toggleDoor();
  assert.equal(refrigerator.state.warningFlag, "开门提醒");

  refrigerator.toggleDoor();
  refrigerator.setFridgeTemp(9);
  assert.equal(refrigerator.state.warningFlag, "高温提醒");

  refrigerator.setFridgeTemp(4);
  refrigerator.setFreezerTemp(-18);
  assert.equal(refrigerator.state.warningFlag, "正常");
});
