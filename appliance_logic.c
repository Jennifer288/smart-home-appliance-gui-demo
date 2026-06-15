/*
 * 智能家电图形界面演示项目
 * C Logic Simulation for Portfolio / Interview
 *
 * 重要说明：
 * - 本文件是展示用的嵌入式控制逻辑片段，用于说明真实家电设备的底层逻辑可以如何组织。
 * - 网页运行时并不会调用本 C 文件；浏览器交互由 script.js 中的 JavaScript model 驱动。
 * - 这里保留 enum、struct、warning bit flag 和周期性 update 函数，便于面试时讲解 C 语言项目思维、
 *   有限状态机、设备配置结构体、告警标志位和 GUI 状态同步方式。
 */

#include <stdint.h>

typedef enum {
    WASHER_IDLE = 0,
    WASHER_WASHING,
    WASHER_RINSING,
    WASHER_SPINNING,
    WASHER_FINISHED
} WasherState;

typedef enum {
    WASH_MODE_QUICK = 0,
    WASH_MODE_COTTON,
    WASH_MODE_DELICATE,
    WASH_MODE_HEAVY_DUTY,
    WASH_MODE_ECO
} WashMode;

typedef enum {
    WATER_COLD = 0,
    WATER_WARM,
    WATER_HOT
} WaterTemperature;

typedef enum {
    SPIN_LOW = 0,
    SPIN_MEDIUM,
    SPIN_HIGH
} SpinSpeed;

typedef struct {
    WasherState state;
    WashMode mode;
    WaterTemperature temperature;
    SpinSpeed spinSpeed;
    uint16_t totalTimeMinutes;
    uint16_t remainingTimeMinutes;
    uint8_t progressPercent;
    uint8_t isRunning;
} WashingMachineConfig;

static uint16_t getWashDurationMinutes(WashMode mode)
{
    switch (mode) {
    case WASH_MODE_COTTON:
        return 52;
    case WASH_MODE_DELICATE:
        return 38;
    case WASH_MODE_HEAVY_DUTY:
        return 72;
    case WASH_MODE_ECO:
        return 60;
    case WASH_MODE_QUICK:
    default:
        return 28;
    }
}

static WasherState getWasherStateFromProgress(uint8_t progressPercent)
{
    if (progressPercent >= 100) {
        return WASHER_FINISHED;
    }
    if (progressPercent >= 70) {
        return WASHER_SPINNING;
    }
    if (progressPercent >= 34) {
        return WASHER_RINSING;
    }
    return WASHER_WASHING;
}

void initWashingMachine(WashingMachineConfig *washer)
{
    washer->state = WASHER_IDLE;
    washer->mode = WASH_MODE_QUICK;
    washer->temperature = WATER_COLD;
    washer->spinSpeed = SPIN_MEDIUM;
    washer->totalTimeMinutes = getWashDurationMinutes(washer->mode);
    washer->remainingTimeMinutes = washer->totalTimeMinutes;
    washer->progressPercent = 0;
    washer->isRunning = 0;
}

/*
 * updateWashingMachineState()
 *
 * 模拟真实固件中的周期性任务：
 * 1. 处理按键 / 触控命令
 * 2. 更新洗衣机有限状态机
 * 3. 计算剩余时间和进度
 * 4. 将最新状态交给 GUI 层刷新显示
 */
void updateWashingMachineState(WashingMachineConfig *washer,
                               uint8_t startCommand,
                               uint8_t pauseCommand,
                               uint8_t resetCommand,
                               uint16_t elapsedSeconds)
{
    if (resetCommand) {
        washer->state = WASHER_IDLE;
        washer->progressPercent = 0;
        washer->remainingTimeMinutes = washer->totalTimeMinutes;
        washer->isRunning = 0;
        return;
    }

    if (pauseCommand && washer->state != WASHER_FINISHED) {
        washer->isRunning = 0;
        return;
    }

    if (startCommand) {
        if (washer->state == WASHER_FINISHED) {
            washer->progressPercent = 0;
        }
        washer->isRunning = 1;
        washer->state = getWasherStateFromProgress(washer->progressPercent);
    }

    if (!washer->isRunning) {
        return;
    }

    /*
     * Demo 中每 30 秒推进 1% 进度。
     * 真实设备会根据电机、进水阀、排水泵、加热器等执行器时序计算阶段。
     */
    washer->progressPercent += (uint8_t)(elapsedSeconds / 30U);
    if (washer->progressPercent > 100) {
        washer->progressPercent = 100;
    }

    washer->state = getWasherStateFromProgress(washer->progressPercent);

    if (washer->state == WASHER_FINISHED) {
        washer->isRunning = 0;
        washer->remainingTimeMinutes = 0;
    } else {
        washer->remainingTimeMinutes =
            (uint16_t)((washer->totalTimeMinutes * (100U - washer->progressPercent)) / 100U);
        if (washer->remainingTimeMinutes == 0) {
            washer->remainingTimeMinutes = 1;
        }
    }
}

typedef enum {
    FRIDGE_MODE_NORMAL = 0,
    FRIDGE_MODE_ECO,
    FRIDGE_MODE_VACATION,
    FRIDGE_MODE_FAST_FREEZE
} RefrigeratorMode;

typedef enum {
    WARNING_NONE = 0,
    WARNING_DOOR_OPEN = 1 << 0,
    WARNING_HIGH_TEMP = 1 << 1
} WarningFlag;

typedef struct {
    RefrigeratorMode mode;
    int8_t fridgeTempC;
    int8_t freezerTempC;
    uint8_t doorOpen;
    uint8_t warningFlag;
    uint8_t energySavingPercent;
} RefrigeratorConfig;

void initRefrigerator(RefrigeratorConfig *fridge)
{
    fridge->mode = FRIDGE_MODE_NORMAL;
    fridge->fridgeTempC = 4;
    fridge->freezerTempC = -18;
    fridge->doorOpen = 0;
    fridge->warningFlag = WARNING_NONE;
    fridge->energySavingPercent = 82;
}

static uint8_t calculateEnergySavingPercent(const RefrigeratorConfig *fridge)
{
    int16_t score = 82;

    if (fridge->mode == FRIDGE_MODE_ECO) {
        score += 12;
    } else if (fridge->mode == FRIDGE_MODE_VACATION) {
        score += 7;
    } else if (fridge->mode == FRIDGE_MODE_FAST_FREEZE) {
        score -= 18;
    }

    if (fridge->fridgeTempC <= 2 || fridge->freezerTempC <= -23) {
        score -= 7;
    }

    if (fridge->doorOpen) {
        score -= 14;
    }

    if (score < 35) {
        return 35;
    }
    if (score > 98) {
        return 98;
    }
    return (uint8_t)score;
}

/*
 * updateRefrigeratorStatus()
 *
 * 模拟传感器状态评估：
 * - doorOpen 可理解为门磁 / 门开关输入
 * - fridgeTempC / freezerTempC 可理解为温度传感器采样值
 * - warningFlag 使用 bit flag，便于同时表达多个告警条件
 */
void updateRefrigeratorStatus(RefrigeratorConfig *fridge)
{
    fridge->warningFlag = WARNING_NONE;

    if (fridge->doorOpen) {
        fridge->warningFlag |= WARNING_DOOR_OPEN;
    }

    if (fridge->fridgeTempC >= 8 || fridge->freezerTempC >= -12) {
        fridge->warningFlag |= WARNING_HIGH_TEMP;
    }

    fridge->energySavingPercent = calculateEnergySavingPercent(fridge);
}

void applyRefrigeratorMode(RefrigeratorConfig *fridge, RefrigeratorMode mode)
{
    fridge->mode = mode;

    switch (mode) {
    case FRIDGE_MODE_ECO:
        fridge->fridgeTempC = 5;
        fridge->freezerTempC = -17;
        break;
    case FRIDGE_MODE_VACATION:
        fridge->fridgeTempC = 7;
        fridge->freezerTempC = -15;
        break;
    case FRIDGE_MODE_FAST_FREEZE:
        fridge->fridgeTempC = 3;
        fridge->freezerTempC = -24;
        break;
    case FRIDGE_MODE_NORMAL:
    default:
        fridge->fridgeTempC = 4;
        fridge->freezerTempC = -18;
        break;
    }

    updateRefrigeratorStatus(fridge);
}
