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

  const WASHER_LOGIC_MAP = {
    [WASHER_STATUS.IDLE]: ["washer-idle"],
    [WASHER_STATUS.WASHING]: ["washer-washing", "washer-branch-washing"],
    [WASHER_STATUS.RINSING]: ["washer-rinsing", "washer-branch-rinsing"],
    [WASHER_STATUS.SPINNING]: ["washer-spinning", "washer-branch-spinning"],
    [WASHER_STATUS.FINISHED]: ["washer-finished", "washer-branch-finished"]
  };

  const FRIDGE_LOGIC_MAP = {
    [WARNING_FLAGS.NORMAL]: ["warning-none"],
    [WARNING_FLAGS.DOOR_OPEN]: ["warning-door-open", "warning-door-branch"],
    [WARNING_FLAGS.HIGH_TEMP]: ["warning-fridge-high", "warning-freezer-high", "warning-high-temp-branch"]
  };

  const WASHER_LOGIC_PREFIXES = ["washer-"];
  const FRIDGE_LOGIC_PREFIXES = ["warning-", "fridge-"];
  let currentLogicWasherStatus = WASHER_STATUS.IDLE;
  let currentLogicFridgeWarning = WARNING_FLAGS.NORMAL;

  const reducedMotionQuery =
    typeof globalScope !== "undefined" && typeof globalScope.matchMedia === "function"
      ? globalScope.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

  function prefersReducedMotion() {
    return Boolean(reducedMotionQuery && reducedMotionQuery.matches);
  }

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

  function readDisplayedNumber(element, fallbackValue) {
    if (!element) {
      return fallbackValue;
    }
    const value = Number.parseInt(element.textContent.replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(value) ? value : fallbackValue;
  }

  function countUp(element, toValue, options = {}) {
    if (!element) {
      return;
    }

    const suffix = options.suffix || "";
    const duration = Math.min(options.duration || 420, 820);
    const target = Math.round(toValue);
    const currentTarget = Number(element.dataset.countTarget);

    if (currentTarget === target && !element._countFrame) {
      element.textContent = `${target}${suffix}`;
      element._countValue = target;
      return;
    }

    if (element._countFrame) {
      globalScope.cancelAnimationFrame(element._countFrame);
      element._countFrame = null;
    }

    if (prefersReducedMotion() || typeof globalScope.requestAnimationFrame !== "function") {
      element.textContent = `${target}${suffix}`;
      element.dataset.countTarget = String(target);
      element._countValue = target;
      return;
    }

    const fromValue = Number.isFinite(element._countValue)
      ? element._countValue
      : readDisplayedNumber(element, target);
    const startTime = globalScope.performance.now();

    element.dataset.countTarget = String(target);

    function step(now) {
      const elapsed = now - startTime;
      const ratio = clamp(elapsed / duration, 0, 1);
      const eased = 1 - Math.pow(1 - ratio, 3);
      const nextValue = Math.round(fromValue + (target - fromValue) * eased);

      element._countValue = nextValue;
      element.textContent = `${nextValue}${suffix}`;

      if (ratio < 1) {
        element._countFrame = globalScope.requestAnimationFrame(step);
      } else {
        element._countFrame = null;
        element._countValue = target;
        element.textContent = `${target}${suffix}`;
      }
    }

    element._countFrame = globalScope.requestAnimationFrame(step);
  }

  function triggerOnce(element, className) {
    if (!element || prefersReducedMotion()) {
      return;
    }

    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    window.setTimeout(() => {
      element.classList.remove(className);
    }, 850);
  }

  function showToast(message, type = "info") {
    if (typeof document === "undefined") {
      return;
    }

    const region = document.getElementById("toastRegion");
    if (!region) {
      return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    region.appendChild(toast);

    const show = () => toast.classList.add("show");
    if (typeof globalScope.requestAnimationFrame === "function") {
      globalScope.requestAnimationFrame(show);
    } else {
      show();
    }

    const removeDelay = prefersReducedMotion() ? 2200 : 2600;
    window.setTimeout(() => {
      toast.classList.add("removing");
      window.setTimeout(() => {
        toast.remove();
      }, prefersReducedMotion() ? 20 : 240);
    }, removeDelay);
  }

  function addRipple(event) {
    const target = event.currentTarget;
    if (!target || prefersReducedMotion()) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.className = "ripple";
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    target.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
  }

  function initRipples() {
    if (typeof document === "undefined") {
      return;
    }

    document
      .querySelectorAll(".action, .mini-action, .stepper button, .button, .segmented button")
      .forEach((element) => {
        element.addEventListener("click", addRipple);
      });
  }

  function initScrollReveal() {
    if (typeof document === "undefined") {
      return;
    }

    const revealItems = Array.from(document.querySelectorAll(".section, .info-card, .device-card, .code-block"));

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      revealItems.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    revealItems.forEach((element, index) => {
      element.classList.add("reveal-ready");
      element.style.setProperty("--reveal-delay", `${(index % 4) * 70}ms`);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px"
      }
    );

    revealItems.forEach((element) => observer.observe(element));
  }

  function clearLogicHighlights(prefixes) {
    if (typeof document === "undefined") {
      return;
    }

    const selector = prefixes
      .map((prefix) => `[data-logic-key^="${prefix}"].is-active`)
      .join(",");

    if (!selector) {
      return;
    }

    document.querySelectorAll(selector).forEach((line) => {
      line.classList.remove("is-active", "warning", "success");
    });
  }

  function activateLogicKeys(keys, options = {}) {
    if (typeof document === "undefined") {
      return;
    }

    keys.forEach((key) => {
      document.querySelectorAll(`[data-logic-key="${key}"]`).forEach((line) => {
        line.classList.add("is-active");
        if (options.type) {
          line.classList.add(options.type);
        }
      });
    });
  }

  function updateLogicHighlightStatus() {
    if (typeof document === "undefined") {
      return;
    }

    const status = document.getElementById("logicHighlightStatus");
    if (!status) {
      return;
    }

    status.textContent = `当前高亮：洗衣机${currentLogicWasherStatus} / 冰箱${currentLogicFridgeWarning}`;
  }

  function logLogicHighlight(status, keys) {
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug("[logic-highlight]", status, keys.join(", "));
    }
  }

  function syncWasherLogicHighlight(status) {
    const keys = WASHER_LOGIC_MAP[status] || [];
    currentLogicWasherStatus = status;
    clearLogicHighlights(WASHER_LOGIC_PREFIXES);
    activateLogicKeys(keys, {
      type: status === WASHER_STATUS.FINISHED ? "success" : ""
    });
    updateLogicHighlightStatus();
    logLogicHighlight(status, keys);
  }

  function syncFridgeLogicHighlight(warningFlag) {
    const keys = FRIDGE_LOGIC_MAP[warningFlag] || [];
    currentLogicFridgeWarning = warningFlag;
    clearLogicHighlights(FRIDGE_LOGIC_PREFIXES);
    activateLogicKeys(keys, {
      type: warningFlag === WARNING_FLAGS.NORMAL ? "success" : "warning"
    });
    updateLogicHighlightStatus();
    logLogicHighlight(warningFlag, keys);
  }

  function syncInitialLogicHighlights() {
    syncWasherLogicHighlight(WASHER_STATUS.IDLE);
    syncFridgeLogicHighlight(WARNING_FLAGS.NORMAL);
  }

  function updateSegmentPill(segmented) {
    if (!segmented) {
      return;
    }

    let pill = segmented.querySelector(".segment-pill");
    if (!pill) {
      pill = document.createElement("span");
      pill.className = "segment-pill";
      pill.setAttribute("aria-hidden", "true");
      segmented.prepend(pill);
    }
    segmented.classList.add("has-pill");

    const active = segmented.querySelector("button.active");
    if (!active) {
      pill.classList.remove("is-ready");
      return;
    }

    pill.style.width = `${active.offsetWidth}px`;
    pill.style.height = `${active.offsetHeight}px`;
    pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    pill.classList.add("is-ready");
  }

  function updateSegmentPills() {
    if (typeof document === "undefined") {
      return;
    }

    document.querySelectorAll(".segmented").forEach(updateSegmentPill);
  }

  function setupSegmentPills() {
    if (typeof document === "undefined") {
      return;
    }

    let resizeFrame = null;
    updateSegmentPills();

    window.addEventListener("resize", () => {
      if (resizeFrame) {
        globalScope.cancelAnimationFrame(resizeFrame);
      }

      resizeFrame = globalScope.requestAnimationFrame(() => {
        resizeFrame = null;
        updateSegmentPills();
      });
    });
  }

  function initWasherUI() {
    const washer = createWashingMachineModel();
    const elements = {
      card: document.querySelector(".washer-card"),
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
    let previousWasherStatus = washer.state.status;

    function render() {
      const state = washer.state;
      const progressDegree = Math.round(state.progress * 3.6);
      const stageOrder = [
        WASHER_STATUS.WASHING,
        WASHER_STATUS.RINSING,
        WASHER_STATUS.SPINNING,
        WASHER_STATUS.FINISHED
      ];
      const currentStageIndex = stageOrder.indexOf(state.status);
      const enteredWashing =
        previousWasherStatus !== WASHER_STATUS.WASHING &&
        state.status === WASHER_STATUS.WASHING &&
        state.isRunning;
      const enteredFinished =
        previousWasherStatus !== WASHER_STATUS.FINISHED &&
        state.status === WASHER_STATUS.FINISHED;

      elements.state.textContent = state.status;
      countUp(elements.time, state.remainingTime, { suffix: " 分钟", duration: 420 });
      countUp(elements.progressLabel, state.progress, { suffix: "%", duration: 420 });
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
        const stageIndex = stageOrder.indexOf(stage.dataset.stage);
        const isFinishedCycle = state.status === WASHER_STATUS.FINISHED;
        stage.classList.toggle("active", stage.dataset.stage === state.status);
        stage.classList.toggle("completed", isFinishedCycle || (stageIndex >= 0 && stageIndex < currentStageIndex));
      });

      setActiveButton(elements.modeButtons, "button", state.mode, "data-washer-mode");
      setActiveButton(elements.tempButtons, "button", state.temperature, "data-washer-temp");
      setActiveButton(elements.spinButtons, "button", state.spinSpeed, "data-washer-spin");
      updateSegmentPills();
      syncWasherLogicHighlight(state.status);

      if (enteredWashing) {
        showToast("开始洗涤", "info");
      }

      if (enteredFinished) {
        triggerOnce(elements.progressRing, "complete-pulse");
        triggerOnce(elements.card, "complete-pulse");
        showToast("洗衣完成", "success");
      }

      previousWasherStatus = state.status;
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
      warningReadout: document.querySelector(".warning-readout"),
      modeLabel: document.getElementById("fridgeModeLabel"),
      energyChip: document.getElementById("fridgeEnergyChip"),
      energySavingLabel: document.getElementById("energySavingLabel"),
      fridgeBar: document.getElementById("fridgeTempBar"),
      freezerBar: document.getElementById("freezerTempBar")
    };
    let previousWarningFlag = refrigerator.state.warningFlag;

    function render() {
      const state = refrigerator.state;
      const enteredWarning =
        previousWarningFlag === WARNING_FLAGS.NORMAL &&
        state.warningFlag !== WARNING_FLAGS.NORMAL;

      countUp(elements.fridgeTemp, state.fridgeTemp, { suffix: "°C", duration: 380 });
      countUp(elements.freezerTemp, state.freezerTemp, { suffix: "°C", duration: 380 });
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
      updateSegmentPills();
      syncFridgeLogicHighlight(state.warningFlag);

      if (enteredWarning) {
        triggerOnce(elements.warningLamp, "shake");
        triggerOnce(elements.warningReadout, "shake");
        showToast(state.warningFlag === WARNING_FLAGS.DOOR_OPEN ? "出现开门提醒" : "出现高温提醒", "warning");
      }

      previousWarningFlag = state.warningFlag;
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
    initRipples();
    initScrollReveal();
    setupSegmentPills();
    syncInitialLogicHighlights();
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
