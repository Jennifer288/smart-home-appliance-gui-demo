(function (globalScope) {
  "use strict";

  const WASH_DURATIONS = {
    "快洗": 28,
    "棉织物": 52,
    "轻柔洗": 38,
    "强力洗": 72,
    "节能模式": 60
  };

  const WASHER_STATUS = {
    IDLE: "待机",
    WASHING: "洗涤中",
    RINSING: "漂洗中",
    SPINNING: "脱水中",
    FINISHED: "已完成"
  };

  const FRIDGE_MODES = {
    NORMAL: "标准模式",
    ECO: "节能模式",
    VACATION: "假日模式",
    FAST_FREEZE: "速冻模式"
  };

  const WARNING_FLAGS = {
    NORMAL: "正常",
    DOOR_OPEN: "开门提醒",
    HIGH_TEMP: "高温提醒"
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getWasherStage(progress) {
    if (progress >= 100) {
      return WASHER_STATUS.FINISHED;
    }
    if (progress >= 70) {
      return WASHER_STATUS.SPINNING;
    }
    if (progress >= 34) {
      return WASHER_STATUS.RINSING;
    }
    return WASHER_STATUS.WASHING;
  }

  function createWashingMachineModel() {
    const state = {
      status: WASHER_STATUS.IDLE,
      mode: "快洗",
      temperature: "冷水",
      spinSpeed: "中速",
      duration: WASH_DURATIONS["快洗"],
      remainingTime: WASH_DURATIONS["快洗"],
      progress: 0,
      isRunning: false
    };

    function refreshRemainingTime() {
      const remaining = Math.ceil(state.duration * (1 - state.progress / 100));
      state.remainingTime = state.status === WASHER_STATUS.FINISHED ? 0 : Math.max(1, remaining);
      if (state.status === WASHER_STATUS.IDLE && state.progress === 0) {
        state.remainingTime = state.duration;
      }
    }

    function setMode(mode) {
      if (!WASH_DURATIONS[mode] || state.isRunning) {
        return;
      }
      state.mode = mode;
      state.duration = WASH_DURATIONS[mode];
      refreshRemainingTime();
    }

    function setTemperature(temperature) {
      if (!state.isRunning) {
        state.temperature = temperature;
      }
    }

    function setSpinSpeed(spinSpeed) {
      if (!state.isRunning) {
        state.spinSpeed = spinSpeed;
      }
    }

    function start() {
      if (state.status === WASHER_STATUS.FINISHED) {
        state.progress = 0;
      }
      state.isRunning = true;
      state.status = getWasherStage(state.progress);
      refreshRemainingTime();
    }

    function pause() {
      if (state.status !== WASHER_STATUS.FINISHED) {
        state.isRunning = false;
      }
    }

    function reset() {
      state.status = WASHER_STATUS.IDLE;
      state.progress = 0;
      state.isRunning = false;
      refreshRemainingTime();
    }

    /*
      这里的 tick() 对应嵌入式 C 项目中的周期性任务：
      先更新设备状态机，再由渲染层把状态同步到触控屏 UI。
      真实固件中通常会由定时器、RTOS task 或主循环调用类似逻辑。
    */
    function tick(progressStep) {
      if (!state.isRunning) {
        return;
      }

      state.progress = clamp(state.progress + progressStep, 0, 100);
      state.status = getWasherStage(state.progress);
      if (state.progress >= 100) {
        state.isRunning = false;
      }
      refreshRemainingTime();
    }

    refreshRemainingTime();

    return {
      state,
      setMode,
      setTemperature,
      setSpinSpeed,
      start,
      pause,
      reset,
      tick
    };
  }

  function calculateEnergyScore(state) {
    let score = 82;

    if (state.mode === FRIDGE_MODES.ECO) {
      score += 12;
    }
    if (state.mode === FRIDGE_MODES.VACATION) {
      score += 7;
    }
    if (state.mode === FRIDGE_MODES.FAST_FREEZE) {
      score -= 18;
    }
    if (state.fridgeTemp <= 2 || state.freezerTemp <= -23) {
      score -= 7;
    }
    if (state.doorOpen) {
      score -= 14;
    }

    return clamp(score, 35, 98);
  }

  function getEnergyLabel(score) {
    if (score >= 90) {
      return "节能状态：优秀";
    }
    if (score >= 72) {
      return "节能状态：均衡";
    }
    return "节能状态：制冷优先";
  }

  function createRefrigeratorModel() {
    const state = {
      mode: FRIDGE_MODES.NORMAL,
      fridgeTemp: 4,
      freezerTemp: -18,
      doorOpen: false,
      warningFlag: WARNING_FLAGS.NORMAL,
      energyScore: 82,
      energyLabel: "节能状态：均衡"
    };

    function updateWarnings() {
      if (state.doorOpen) {
        state.warningFlag = WARNING_FLAGS.DOOR_OPEN;
      } else if (state.fridgeTemp >= 8 || state.freezerTemp >= -12) {
        state.warningFlag = WARNING_FLAGS.HIGH_TEMP;
      } else {
        state.warningFlag = WARNING_FLAGS.NORMAL;
      }

      state.energyScore = calculateEnergyScore(state);
      state.energyLabel = getEnergyLabel(state.energyScore);
    }

    function setMode(mode) {
      state.mode = mode;
      if (mode === FRIDGE_MODES.ECO) {
        state.fridgeTemp = 5;
        state.freezerTemp = -17;
      } else if (mode === FRIDGE_MODES.VACATION) {
        state.fridgeTemp = 7;
        state.freezerTemp = -15;
      } else if (mode === FRIDGE_MODES.FAST_FREEZE) {
        state.fridgeTemp = 3;
        state.freezerTemp = -24;
      } else {
        state.fridgeTemp = 4;
        state.freezerTemp = -18;
      }
      updateWarnings();
    }

    function setFridgeTemp(value) {
      state.fridgeTemp = clamp(value, 1, 10);
      updateWarnings();
    }

    function setFreezerTemp(value) {
      state.freezerTemp = clamp(value, -26, -10);
      updateWarnings();
    }

    function toggleDoor() {
      state.doorOpen = !state.doorOpen;
      updateWarnings();
    }

    updateWarnings();

    return {
      state,
      setMode,
      setFridgeTemp,
      setFreezerTemp,
      toggleDoor
    };
  }

  function setActiveButton(container, selector, activeValue, attributeName) {
    container.querySelectorAll(selector).forEach((button) => {
      button.classList.toggle("active", button.getAttribute(attributeName) === activeValue);
    });
  }

  function percentFromRange(value, min, max) {
    return clamp(((value - min) / (max - min)) * 100, 6, 100);
  }

  function initWasherUI() {
    const washer = createWashingMachineModel();
    const elements = {
      statusChip: document.getElementById("washerStatusChip"),
      state: document.getElementById("washerState"),
      time: document.getElementById("washerTime"),
      progressLabel: document.getElementById("washerProgressLabel"),
      progressFill: document.getElementById("washerProgressFill"),
      progressRing: document.getElementById("washerProgressRing"),
      progressTrack: document.querySelector(".washer-card .progress-track"),
      runLamp: document.getElementById("washerRunLamp"),
      runLabel: document.getElementById("washerRunLabel"),
      stages: document.querySelectorAll("[data-stage]"),
      modeButtons: document.getElementById("washerModeButtons"),
      tempButtons: document.getElementById("washerTempButtons"),
      spinButtons: document.getElementById("washerSpinButtons"),
      start: document.getElementById("washerStart"),
      pause: document.getElementById("washerPause"),
      reset: document.getElementById("washerReset")
    };

    function render() {
      const state = washer.state;
      const progressDegree = Math.round(state.progress * 3.6);
      elements.state.textContent = state.status;
      elements.time.textContent = `${state.remainingTime} 分钟`;
      elements.progressLabel.textContent = `${Math.round(state.progress)}%`;
      elements.progressFill.style.width = `${state.progress}%`;
      elements.progressRing.style.setProperty("--progress", `${progressDegree}deg`);
      elements.progressRing.classList.toggle("running", state.isRunning);
      elements.progressTrack.classList.toggle("running", state.isRunning);
      elements.start.textContent = state.status === WASHER_STATUS.FINISHED ? "再次开始" : "开始";
      elements.runLabel.textContent = state.isRunning ? "运行中" : state.status === WASHER_STATUS.FINISHED ? "洗涤完成" : "待机状态";

      elements.statusChip.querySelector("span:last-child").textContent = state.status;
      elements.statusChip.className = `status-pill ${state.status === WASHER_STATUS.FINISHED ? "success" : state.isRunning ? "success" : ""}`;
      elements.statusChip.querySelector(".status-dot").className = `status-dot ${state.isRunning ? "running" : state.status === WASHER_STATUS.FINISHED ? "success" : ""}`;
      elements.runLamp.className = `status-dot ${state.isRunning ? "running" : state.status === WASHER_STATUS.FINISHED ? "success" : ""}`;

      elements.stages.forEach((stage) => {
        stage.classList.toggle("active", stage.dataset.stage === state.status);
      });

      setActiveButton(elements.modeButtons, "button", state.mode, "data-washer-mode");
      setActiveButton(elements.tempButtons, "button", state.temperature, "data-washer-temp");
      setActiveButton(elements.spinButtons, "button", state.spinSpeed, "data-washer-spin");
    }

    elements.modeButtons.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-washer-mode]");
      if (!button) {
        return;
      }
      washer.setMode(button.dataset.washerMode);
      render();
    });

    elements.tempButtons.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-washer-temp]");
      if (!button) {
        return;
      }
      washer.setTemperature(button.dataset.washerTemp);
      render();
    });

    elements.spinButtons.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-washer-spin]");
      if (!button) {
        return;
      }
      washer.setSpinSpeed(button.dataset.washerSpin);
      render();
    });

    elements.start.addEventListener("click", () => {
      washer.start();
      render();
    });

    elements.pause.addEventListener("click", () => {
      washer.pause();
      render();
    });

    elements.reset.addEventListener("click", () => {
      washer.reset();
      render();
    });

    window.setInterval(() => {
      washer.tick(1);
      render();
    }, 850);

    render();
  }

  function initRefrigeratorUI() {
    const refrigerator = createRefrigeratorModel();
    const elements = {
      card: document.querySelector(".fridge-card"),
      fridgeTemp: document.getElementById("fridgeTemp"),
      freezerTemp: document.getElementById("freezerTemp"),
      doorState: document.getElementById("doorState"),
      warningState: document.getElementById("warningState"),
      warningCopy: document.getElementById("warningCopy"),
      doorToggle: document.getElementById("doorToggle"),
      modeButtons: document.getElementById("fridgeModeButtons"),
      warningLamp: document.getElementById("fridgeWarningLamp"),
      modeLabel: document.getElementById("fridgeModeLabel"),
      energyChip: document.getElementById("fridgeEnergyChip"),
      energySavingLabel: document.getElementById("energySavingLabel"),
      fridgeBar: document.getElementById("fridgeTempBar"),
      freezerBar: document.getElementById("freezerTempBar")
    };

    function render() {
      const state = refrigerator.state;
      elements.fridgeTemp.innerHTML = `${state.fridgeTemp}&deg;C`;
      elements.freezerTemp.innerHTML = `${state.freezerTemp}&deg;C`;
      elements.doorState.textContent = state.doorOpen ? "已开门" : "已关闭";
      elements.warningState.textContent = state.warningFlag;
      elements.doorToggle.textContent = state.doorOpen ? "模拟关门" : "模拟开门";
      elements.modeLabel.textContent = state.mode;
      elements.energyChip.querySelector("span:last-child").textContent = `节能 ${state.energyScore}%`;
      elements.energySavingLabel.textContent = state.energyLabel;
      elements.fridgeBar.style.width = `${percentFromRange(state.fridgeTemp, 1, 10)}%`;
      elements.freezerBar.style.width = `${percentFromRange(state.freezerTemp, -26, -10)}%`;
      elements.card.classList.toggle("fast-freeze", state.mode === FRIDGE_MODES.FAST_FREEZE);

      if (state.warningFlag === WARNING_FLAGS.DOOR_OPEN) {
        elements.warningCopy.textContent = "门体传感器检测到开门状态，请关闭冰箱门以恢复节能运行。";
        elements.warningLamp.textContent = "开门提醒";
        elements.warningLamp.className = "warning-badge warning";
        elements.energyChip.className = "status-pill warning";
        elements.energyChip.querySelector(".status-dot").className = "status-dot warning";
      } else if (state.warningFlag === WARNING_FLAGS.HIGH_TEMP) {
        elements.warningCopy.textContent = "温度超过安全阈值，建议降低设定温度或切换速冻模式。";
        elements.warningLamp.textContent = "高温提醒";
        elements.warningLamp.className = "warning-badge warning";
        elements.energyChip.className = "status-pill warning";
        elements.energyChip.querySelector(".status-dot").className = "status-dot warning";
      } else {
        elements.warningCopy.textContent = "门状态与温度均处于安全范围。";
        elements.warningLamp.textContent = "运行正常";
        elements.warningLamp.className = "warning-badge success";
        elements.energyChip.className = "status-pill success";
        elements.energyChip.querySelector(".status-dot").className = "status-dot success";
      }

      setActiveButton(elements.modeButtons, "button", state.mode, "data-fridge-mode");
    }

    document.querySelectorAll("[data-temp-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const delta = Number(button.dataset.tempDelta);
        if (button.dataset.tempTarget === "fridge") {
          refrigerator.setFridgeTemp(refrigerator.state.fridgeTemp + delta);
        } else {
          refrigerator.setFreezerTemp(refrigerator.state.freezerTemp + delta);
        }
        render();
      });
    });

    elements.modeButtons.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-fridge-mode]");
      if (!button) {
        return;
      }
      refrigerator.setMode(button.dataset.fridgeMode);
      render();
    });

    elements.doorToggle.addEventListener("click", () => {
      refrigerator.toggleDoor();
      render();
    });

    render();
  }

  function initApp() {
    initWasherUI();
    initRefrigeratorUI();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      createWashingMachineModel,
      createRefrigeratorModel
    };
  }

  if (typeof globalScope !== "undefined") {
    globalScope.SmartApplianceLogic = {
      createWashingMachineModel,
      createRefrigeratorModel
    };
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", initApp);
  }
})(typeof window !== "undefined" ? window : globalThis);
