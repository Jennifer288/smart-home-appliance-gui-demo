/*
 * appliance_logic.c
 * ------------------------------------------------------------
 * 展示用的嵌入式 C 控制逻辑片段。
 *
 * 该文件不会被浏览器运行时调用。
 * 网页交互由 JavaScript 驱动，C 文件用于展示真实家电项目中
 * 可以如何组织状态机、结构体、周期性任务和告警 bit flag。
 *
 * 面试讲解重点：
 * 1. 洗衣机：有限状态机控制洗涤、漂洗、脱水、暂停、完成阶段
 * 2. 冰箱：温度边界、模式切换、门状态和告警 flag
 * 3. GUI：负责显示状态和接收用户输入
 * 4. C 逻辑：负责设备状态更新和控制决策
 */

#include <stdbool.h>
#include <stdint.h>

#define WASHER_PROGRESS_MAX        100U
#define WASHER_WASH_END_PERCENT     45U
#define WASHER_RINSE_END_PERCENT    75U

#define FRIDGE_TEMP_MIN              2
#define FRIDGE_TEMP_MAX              8
#define FREEZER_TEMP_MIN           -24
#define FREEZER_TEMP_MAX           -12

#define FRIDGE_HIGH_TEMP_LIMIT       8
#define FREEZER_HIGH_TEMP_LIMIT    -12

#define WARNING_NONE                 0x00
#define WARNING_DOOR_OPEN            0x01
#define WARNING_FRIDGE_HIGH_TEMP     0x02
#define WARNING_FREEZER_HIGH_TEMP    0x04
#define WARNING_SENSOR_FAULT         0x08

/*
 * warningFlags 使用 bit flag 管理多个告警：
 * - |=  用于设置某个告警
 * - &= ~ 用于清除某个告警
 * - &   用于判断某个告警是否存在
 *
 * 多个告警可以同时存在，例如开门 + 冷藏高温：
 * warningFlags = WARNING_DOOR_OPEN | WARNING_FRIDGE_HIGH_TEMP;
 */

typedef enum {
    WASHER_IDLE = 0,
    WASHER_WASHING,
    WASHER_RINSING,
    WASHER_SPINNING,
    WASHER_PAUSED,
    WASHER_FINISHED,
    WASHER_ERROR
} WasherState;

typedef enum {
    WASHER_MODE_QUICK = 0,
    WASHER_MODE_COTTON,
    WASHER_MODE_DELICATE,
    WASHER_MODE_HEAVY_DUTY,
    WASHER_MODE_ECO,
    WASHER_MODE_COUNT
} WasherMode;

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
    WasherMode mode;
    uint16_t totalMinutes;
    uint8_t waterLevel;
    WaterTemperature defaultTemp;
    SpinSpeed defaultSpin;
    uint8_t energyLevel;
} WasherProgramConfig;

typedef struct {
    WasherState state;
    WasherState previousState;
    WasherMode mode;
    WaterTemperature temperature;
    SpinSpeed spinSpeed;
    uint16_t totalMinutes;
    uint16_t remainingMinutes;
    uint8_t progressPercent;
    uint8_t waterLevel;
    uint8_t energyLevel;
    bool isRunning;
    bool isDoorLocked;
    uint8_t errorCode;
} WashingMachine;

static const WasherProgramConfig WASHER_PROGRAM_TABLE[WASHER_MODE_COUNT] = {
    { WASHER_MODE_QUICK,      28, 35, WATER_COLD, SPIN_MEDIUM, 2 },
    { WASHER_MODE_COTTON,     52, 55, WATER_WARM, SPIN_HIGH,   3 },
    { WASHER_MODE_DELICATE,   38, 42, WATER_COLD, SPIN_LOW,    2 },
    { WASHER_MODE_HEAVY_DUTY, 72, 70, WATER_HOT,  SPIN_HIGH,   5 },
    { WASHER_MODE_ECO,        60, 45, WATER_COLD, SPIN_MEDIUM, 1 }
};

static const WasherProgramConfig *getWasherProgramConfig(WasherMode mode)
{
    if (mode >= WASHER_MODE_COUNT) {
        return &WASHER_PROGRAM_TABLE[WASHER_MODE_QUICK];
    }
    return &WASHER_PROGRAM_TABLE[mode];
}

static void setWasherState(WashingMachine *washer, WasherState nextState)
{
    if (washer->state != nextState) {
        washer->previousState = washer->state;
        washer->state = nextState;
    }
}

void selectWasherProgram(WashingMachine *washer, WasherMode mode)
{
    const WasherProgramConfig *config;

    if (washer == 0 || washer->isRunning) {
        return;
    }

    config = getWasherProgramConfig(mode);

    washer->mode = config->mode;
    washer->temperature = config->defaultTemp;
    washer->spinSpeed = config->defaultSpin;
    washer->totalMinutes = config->totalMinutes;
    washer->remainingMinutes = config->totalMinutes;
    washer->progressPercent = 0;
    washer->waterLevel = config->waterLevel;
    washer->energyLevel = config->energyLevel;
    washer->errorCode = 0;
    setWasherState(washer, WASHER_IDLE);
}

void initWashingMachine(WashingMachine *washer)
{
    if (washer == 0) {
        return;
    }

    washer->state = WASHER_IDLE;
    washer->previousState = WASHER_IDLE;
    washer->isRunning = false;
    washer->isDoorLocked = false;
    washer->errorCode = 0;

    selectWasherProgram(washer, WASHER_MODE_QUICK);
}

void startWashingMachine(WashingMachine *washer)
{
    if (washer == 0 || washer->isRunning) {
        return;
    }

    if (washer->state == WASHER_IDLE || washer->state == WASHER_FINISHED) {
        if (washer->progressPercent >= WASHER_PROGRESS_MAX) {
            washer->progressPercent = 0;
        }

        if (washer->remainingMinutes == 0) {
            washer->remainingMinutes = washer->totalMinutes;
        }

        washer->state = WASHER_WASHING;
        washer->previousState = WASHER_IDLE;
        washer->isRunning = true;
        washer->isDoorLocked = true;
    }
}

void pauseWashingMachine(WashingMachine *washer)
{
    if (washer == 0 || !washer->isRunning) {
        return;
    }

    washer->previousState = washer->state;
    washer->state = WASHER_PAUSED;
    washer->isRunning = false;
    washer->isDoorLocked = true;
}

void resumeWashingMachine(WashingMachine *washer)
{
    if (washer == 0 || washer->state != WASHER_PAUSED) {
        return;
    }

    washer->state = washer->previousState;
    washer->isRunning = true;
    washer->isDoorLocked = true;
}

void resetWashingMachine(WashingMachine *washer)
{
    if (washer == 0) {
        return;
    }

    washer->state = WASHER_IDLE;
    washer->previousState = WASHER_IDLE;
    washer->progressPercent = 0;
    washer->remainingMinutes = washer->totalMinutes;
    washer->isRunning = false;
    washer->isDoorLocked = false;
    washer->errorCode = 0;
}

/*
 * updateWashingMachineState()
 * ------------------------------------------------------------
 *
 * 真实嵌入式设备中，这类 update 函数通常由定时器中断、RTOS task
 * 或主循环周期性调用。这里每次调用模拟一个控制周期，用进度百分比
 * 表示洗衣流程推进：
 *   0%  - 44%  -> 洗涤
 *   45% - 74%  -> 漂洗
 *   75% - 99%  -> 脱水
 *   100%       -> 完成
 */
void updateWashingMachineState(WashingMachine *washer)
{
    if (washer == 0 || !washer->isRunning) {
        return;
    }

    if (washer->state == WASHER_ERROR || washer->state == WASHER_PAUSED) {
        return;
    }

    if (washer->progressPercent < WASHER_PROGRESS_MAX) {
        washer->progressPercent++;
    }

    if (washer->progressPercent >= WASHER_PROGRESS_MAX) {
        washer->progressPercent = WASHER_PROGRESS_MAX;
        washer->remainingMinutes = 0;
        washer->isRunning = false;
        washer->isDoorLocked = false;
        setWasherState(washer, WASHER_FINISHED);
        return;
    }

    washer->remainingMinutes =
        (uint16_t)((washer->totalMinutes * (WASHER_PROGRESS_MAX - washer->progressPercent)) /
                   WASHER_PROGRESS_MAX);
    if (washer->remainingMinutes == 0) {
        washer->remainingMinutes = 1;
    }

    if (washer->progressPercent < WASHER_WASH_END_PERCENT) {
        setWasherState(washer, WASHER_WASHING);
    } else if (washer->progressPercent < WASHER_RINSE_END_PERCENT) {
        setWasherState(washer, WASHER_RINSING);
    } else {
        setWasherState(washer, WASHER_SPINNING);
    }
}

const char *getWasherStateText(WasherState state)
{
    switch (state) {
    case WASHER_IDLE:
        return "待机";
    case WASHER_WASHING:
        return "洗涤中";
    case WASHER_RINSING:
        return "漂洗中";
    case WASHER_SPINNING:
        return "脱水中";
    case WASHER_PAUSED:
        return "已暂停";
    case WASHER_FINISHED:
        return "已完成";
    case WASHER_ERROR:
    default:
        return "故障";
    }
}

typedef enum {
    FRIDGE_NORMAL = 0,
    FRIDGE_ECO,
    FRIDGE_VACATION,
    FRIDGE_FAST_FREEZE
} RefrigeratorMode;

typedef enum {
    COMPRESSOR_OFF = 0,
    COMPRESSOR_LOW,
    COMPRESSOR_MEDIUM,
    COMPRESSOR_HIGH
} CompressorLevel;

typedef enum {
    ENERGY_STANDARD = 0,
    ENERGY_SAVING,
    ENERGY_HIGH_LOAD
} EnergyStatus;

typedef struct {
    RefrigeratorMode mode;
    int8_t fridgeTemp;
    int8_t freezerTemp;
    int8_t targetFridgeTemp;
    int8_t targetFreezerTemp;
    bool doorOpen;
    bool sensorFault;
    uint8_t warningFlags;
    CompressorLevel compressorLevel;
    EnergyStatus energyStatus;
} Refrigerator;

static int8_t clampTemperature(int8_t value, int8_t minValue, int8_t maxValue)
{
    if (value < minValue) {
        return minValue;
    }
    if (value > maxValue) {
        return maxValue;
    }
    return value;
}

static void setWarningFlag(Refrigerator *fridge, uint8_t flag)
{
    fridge->warningFlags |= flag;
}

static void clearWarningFlag(Refrigerator *fridge, uint8_t flag)
{
    fridge->warningFlags &= (uint8_t)~flag;
}

static bool hasWarningFlag(const Refrigerator *fridge, uint8_t flag)
{
    return (fridge->warningFlags & flag) != 0U;
}

void checkRefrigeratorWarnings(Refrigerator *fridge)
{
    if (fridge == 0) {
        return;
    }

    if (fridge->doorOpen) {
        fridge->warningFlags |= WARNING_DOOR_OPEN;
    } else {
        fridge->warningFlags &= (uint8_t)~WARNING_DOOR_OPEN;
    }

    if (fridge->fridgeTemp >= FRIDGE_HIGH_TEMP_LIMIT) {
        fridge->warningFlags |= WARNING_FRIDGE_HIGH_TEMP;
    } else {
        fridge->warningFlags &= (uint8_t)~WARNING_FRIDGE_HIGH_TEMP;
    }

    if (fridge->freezerTemp >= FREEZER_HIGH_TEMP_LIMIT) {
        fridge->warningFlags |= WARNING_FREEZER_HIGH_TEMP;
    } else {
        fridge->warningFlags &= (uint8_t)~WARNING_FREEZER_HIGH_TEMP;
    }

    if (fridge->sensorFault) {
        setWarningFlag(fridge, WARNING_SENSOR_FAULT);
    } else {
        clearWarningFlag(fridge, WARNING_SENSOR_FAULT);
    }
}

void setRefrigeratorMode(Refrigerator *fridge, RefrigeratorMode mode)
{
    if (fridge == 0) {
        return;
    }

    fridge->mode = mode;

    switch (mode) {
    case FRIDGE_ECO:
        fridge->targetFridgeTemp = 5;
        fridge->targetFreezerTemp = -16;
        fridge->compressorLevel = COMPRESSOR_LOW;
        fridge->energyStatus = ENERGY_SAVING;
        break;
    case FRIDGE_VACATION:
        fridge->targetFridgeTemp = 7;
        fridge->targetFreezerTemp = -15;
        fridge->compressorLevel = COMPRESSOR_LOW;
        fridge->energyStatus = ENERGY_SAVING;
        break;
    case FRIDGE_FAST_FREEZE:
        fridge->targetFridgeTemp = 4;
        fridge->targetFreezerTemp = -24;
        fridge->compressorLevel = COMPRESSOR_HIGH;
        fridge->energyStatus = ENERGY_HIGH_LOAD;
        break;
    case FRIDGE_NORMAL:
    default:
        fridge->targetFridgeTemp = 4;
        fridge->targetFreezerTemp = -18;
        fridge->compressorLevel = COMPRESSOR_MEDIUM;
        fridge->energyStatus = ENERGY_STANDARD;
        break;
    }

    checkRefrigeratorWarnings(fridge);
}

void initRefrigerator(Refrigerator *fridge)
{
    if (fridge == 0) {
        return;
    }

    fridge->fridgeTemp = 4;
    fridge->freezerTemp = -18;
    fridge->doorOpen = false;
    fridge->sensorFault = false;
    fridge->warningFlags = WARNING_NONE;

    setRefrigeratorMode(fridge, FRIDGE_NORMAL);
}

void setFridgeTemperature(Refrigerator *fridge, int8_t temp)
{
    if (fridge == 0) {
        return;
    }

    fridge->targetFridgeTemp = clampTemperature(temp, FRIDGE_TEMP_MIN, FRIDGE_TEMP_MAX);
    checkRefrigeratorWarnings(fridge);
}

void setFreezerTemperature(Refrigerator *fridge, int8_t temp)
{
    if (fridge == 0) {
        return;
    }

    fridge->targetFreezerTemp = clampTemperature(temp, FREEZER_TEMP_MIN, FREEZER_TEMP_MAX);
    checkRefrigeratorWarnings(fridge);
}

void setDoorState(Refrigerator *fridge, bool isOpen)
{
    if (fridge == 0) {
        return;
    }

    fridge->doorOpen = isOpen;
    checkRefrigeratorWarnings(fridge);
}

/*
 * updateRefrigeratorStatus()
 *
 * 真实项目中该函数可由主循环或 RTOS task 周期性调用。
 * GUI 层读取 mode、target temperature、warningFlags、compressorLevel 等字段，
 * 再显示温度、告警标签和节能状态。
 */
void updateRefrigeratorStatus(Refrigerator *fridge)
{
    if (fridge == 0) {
        return;
    }

    checkRefrigeratorWarnings(fridge);

    if (hasWarningFlag(fridge, WARNING_FRIDGE_HIGH_TEMP) ||
        hasWarningFlag(fridge, WARNING_FREEZER_HIGH_TEMP)) {
        fridge->compressorLevel = COMPRESSOR_HIGH;
        fridge->energyStatus = ENERGY_HIGH_LOAD;
    } else if (fridge->mode == FRIDGE_ECO || fridge->mode == FRIDGE_VACATION) {
        fridge->compressorLevel = COMPRESSOR_LOW;
        fridge->energyStatus = ENERGY_SAVING;
    }
}

const char *getRefrigeratorModeText(RefrigeratorMode mode)
{
    switch (mode) {
    case FRIDGE_NORMAL:
        return "标准模式";
    case FRIDGE_ECO:
        return "节能模式";
    case FRIDGE_VACATION:
        return "假日模式";
    case FRIDGE_FAST_FREEZE:
        return "速冻模式";
    default:
        return "未知模式";
    }
}
