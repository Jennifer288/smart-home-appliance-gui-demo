# 智能家电图形界面演示项目

一个面向作品集 / 简历展示的家电行业图形化界面开发项目。项目使用原生 HTML、CSS、JavaScript 模拟洗衣机和冰箱的智能触控屏 GUI，并通过 `appliance_logic.c` 展示嵌入式 C 项目中的状态机、结构体、告警 flag 和周期性 update 函数设计思路。

## 1. 项目简介

本项目将网页做成响应式作品集展示页，同时在局部设备卡片中模拟真实智能家电控制屏。洗衣机模块强调运行阶段、剩余时间、模式选择和进度反馈；冰箱模块强调温度控制、门状态、节能状态和告警提醒。

## 2. 项目背景

在家电行业中，嵌入式 GUI 常用于洗衣机、冰箱、空调、厨电等智能设备。真实产品通常由 MCU/SoC、触控屏、传感器、执行器和底层控制程序组成。这个 demo 用浏览器复现触控屏交互，并把控制逻辑抽象成状态机、配置结构体和告警判断，便于面试官快速理解候选人对 HMI / Embedded GUI / 控制逻辑可视化的掌握。

## 3. 功能概览

- 洗衣机状态：`待机 / 洗涤中 / 漂洗中 / 脱水中 / 已完成`
- 洗衣模式：`快洗 / 棉织物 / 轻柔洗 / 强力洗 / 节能模式`
- 水温选择：`冷水 / 温水 / 热水`
- 转速选择：`低速 / 中速 / 高速`
- 洗衣机进度环、进度条、阶段高亮、状态灯、剩余时间、开始/暂停/重置
- 冰箱冷藏室和冷冻室温度调节
- 冰箱模式：`标准模式 / 节能模式 / 假日模式 / 速冻模式`
- 门状态模拟：`已关闭 / 已开门`
- 告警状态：`正常 / 开门提醒 / 高温提醒`
- 节能标签和温度可视化条

## 4. 技术栈

- HTML5：页面结构、设备卡片、语义化内容
- CSS3：响应式布局、卡片式仪表盘、状态灯、进度环、温度条、柔和阴影
- JavaScript：状态 model、有限状态机、事件处理、UI 渲染、温度阈值与告警逻辑
- C：展示用 `appliance_logic.c`，用于说明嵌入式控制逻辑组织方式

## 5. 界面设计思路

- 使用冷色调是为了贴近家电行业中“清洁、可信赖、科技感”的视觉语言。
- 主色使用科技蓝 `#2563EB` 和辅助青色 `#06B6D4`，传达智能触控屏和低温清洁感。
- 背景使用浅灰白 `#F8FAFC` 和白色卡片，避免过暗、过艳或游戏化的赛博风。
- 卡片式仪表盘便于把状态、模式、控制按钮和数据展示分组，适合作品集阅读和面试讲解。
- 洗衣机视觉对应水、清洁、流动感，因此加入进度环、流动进度条和青蓝色运行状态。
- 冰箱视觉对应冷冽、低温、保鲜，因此温度卡片使用大字号数字、冷青色和冰蓝色反馈。
- 绿色 `#10B981` 表示正常、节能、运行良好。
- 橙色 `#F59E0B` 表示提醒、告警和需要用户关注的状态。

## 6. C 语言逻辑说明

`appliance_logic.c` 是展示用嵌入式逻辑片段，不是网页运行时真正调用的代码。网页交互由 `script.js` 驱动，C 文件用于模拟真实家电设备中可能采用的底层控制逻辑组织方式。

该文件包含：

- `WasherState`、`WasherMode`、`WaterTemperature`、`SpinSpeed` 等 enum，用于表达设备状态和运行模式
- `WasherProgramConfig` 配置表，用于管理快洗、棉织物、轻柔洗、强力洗、节能模式等不同洗衣程序
- `WashingMachine` struct，用于保存状态、上一状态、模式、水温、转速、剩余时间、进度、水位、能耗等级、门锁和错误码
- `startWashingMachine()`、`pauseWashingMachine()`、`resumeWashingMachine()`、`resetWashingMachine()`，用于表达真实控制面板输入对应的底层控制动作
- `updateWashingMachineState()` 周期性状态更新函数，用于模拟嵌入式主循环 / RTOS task 中的洗衣机 FSM
- `RefrigeratorMode`、`CompressorLevel`、`EnergyStatus` 等 enum，用于表达冰箱模式、压缩机档位和能耗状态
- `Refrigerator` struct，用于保存当前温度、目标温度、门状态、压缩机状态、能耗状态和 warning flags
- `checkRefrigeratorWarnings()` 使用 bit flag 统一管理开门提醒、冷藏高温、冷冻高温、传感器故障等告警

## 7. C 语言逻辑亮点

- 使用 `enum` 表达设备状态和运行模式，避免用零散数字或字符串驱动控制逻辑。
- 使用 `struct` 管理设备配置和运行数据，使 GUI 层可以稳定读取状态、进度、温度、告警等字段。
- 使用 `startWashingMachine()` 表示从待机进入运行流程，并在启动时锁门。
- `startWashingMachine()` 支持从完成状态再次开始；当 `progressPercent` 已到 100 或 `remainingMinutes` 为 0 时，会恢复进度和剩余时间。
- 使用 `pauseWashingMachine()` 和 `resumeWashingMachine()` 通过 `previousState` 实现暂停 / 恢复。
- 使用 `resetWashingMachine()` 模拟用户点击重置后的设备复位逻辑，并清除运行状态回到待机。
- 使用 `updateWashingMachineState()` 模拟嵌入式主循环、定时器任务或 RTOS task，并对进度做 100% 上限保护。
- 使用 `remainingMinutes` 和 `progressPercent` 同步运行进度、剩余时间和 GUI 显示。
- 洗衣机适合讲有限状态机：`IDLE -> WASHING -> RINSING -> SPINNING -> FINISHED`，并支持暂停、恢复、重置和错误状态。
- 冰箱适合讲温度边界、模式参数、门状态和 warning bit flag。
- 冰箱告警使用 `warningFlags` 统一管理，便于 GUI 层通过位运算判断当前应该显示哪些提醒。
- 使用宏定义统一管理冷藏 / 冷冻温度范围和高温告警阈值，避免在逻辑中散落魔法数字。
- `checkRefrigeratorWarnings()` 加入空指针保护，体现 C 代码安全性。
- 关键函数都加入空指针保护，体现嵌入式 C 代码的安全边界意识。

## 8. JavaScript 与 C 逻辑的关系

JavaScript 负责网页中的真实交互：按钮点击、模式切换、状态更新和 DOM 渲染。浏览器不能直接运行普通 C 文件，因此 JavaScript 是为了让作品集 demo 能在浏览器里交互展示。

`appliance_logic.c` 不参与网页运行。C 文件用于讲解“如果这是一个真实嵌入式家电项目，底层逻辑可以如何组织”。两者表达的是同一类控制思想：状态集中管理，周期性更新，UI 根据状态刷新，而不是把逻辑散落在界面代码里。

## 9. 面试讲解思路

1. 先说明项目是一个网页可视化展示版，用于模拟智能家电触控屏 GUI。
2. 再说明网页交互由 JavaScript 驱动，因为浏览器不能直接运行普通 C 文件。
3. 然后重点讲 `appliance_logic.c`，说明它是展示用 C 逻辑片段，不被浏览器运行时调用。
4. 洗衣机部分重点讲有限状态机：待机、洗涤、漂洗、脱水、暂停、恢复、完成、重置。
5. 冰箱部分重点讲温度阈值、门状态、warning bit flag，以及多个告警可以同时存在。
6. 最后说明 GUI 与底层 C 逻辑的映射关系：GUI 接收输入并显示状态，C 逻辑负责设备状态更新和控制决策。

## 10. GUI 与 C 逻辑映射表

| 页面交互 / GUI 元素 | C 语言逻辑对应 |
| --- | --- |
| 点击开始 | `startWashingMachine()` |
| 点击暂停 | `pauseWashingMachine()` |
| 点击恢复 | `resumeWashingMachine()` |
| 点击重置 | `resetWashingMachine()` |
| 洗衣阶段变化 | `updateWashingMachineState()` |
| 剩余时间显示 | `remainingMinutes` |
| 洗衣进度条 | `progressPercent` |
| 洗衣模式选择 | `selectWasherProgram()` |
| 冰箱模式切换 | `setRefrigeratorMode()` |
| 冷藏温度调节 | `setFridgeTemperature()` |
| 冷冻温度调节 | `setFreezerTemperature()` |
| 冰箱开门提醒 | `WARNING_DOOR_OPEN` |
| 冷藏高温提醒 | `WARNING_FRIDGE_HIGH_TEMP` |
| 冷冻高温提醒 | `WARNING_FREEZER_HIGH_TEMP` |
| 告警标签显示 | `warningFlags` |

## 11. 页面交互说明

1. 直接双击或用浏览器打开 `index.html`
2. 在洗衣机控制面板中选择洗衣模式、水温和转速
3. 点击 `开始` 后，状态从 `洗涤中` 逐步切换到 `漂洗中`、`脱水中` 和 `已完成`
4. 点击 `暂停` 可暂停运行，点击 `重置` 可恢复到 `待机`
5. 在冰箱控制面板中点击 `+ / -` 调节冷藏室和冷冻室温度
6. 切换 `节能模式`、`假日模式`、`速冻模式` 可观察温度与节能状态变化
7. 点击 `模拟开门` 会触发 `开门提醒`，再次点击可恢复关闭状态
8. 冷藏室温度达到 8°C 或更高，或冷冻室温度达到 -12°C 或更高，会触发 `高温提醒`

## 12. 项目亮点

- 纯原生前端实现，不依赖 React、Vue、Tailwind、Bootstrap 或构建工具
- 响应式作品集网页，宽屏双设备并排，手机端自动堆叠
- 局部设备卡片模拟真实智能家电触控屏，而不是普通网页模板
- 洗衣机模块体现有限状态机、运行阶段和倒计时逻辑
- 冰箱模块体现温度阈值、门状态、warning flag 和节能状态
- C 文件清楚说明嵌入式控制逻辑如何映射到 GUI 状态展示

## 13. 本地运行方式

无需安装依赖，直接打开：

```text
index.html
```

可选逻辑测试：

```bash
node tests/logic.test.js
```

可选 C 语法检查：

```bash
clang -fsyntax-only appliance_logic.c
```

## 14. 简历项目描述 Bullet Points

- 设计并开发智能家电图形界面演示项目，模拟洗衣机和冰箱嵌入式触控屏 GUI。
- 使用原生 HTML、CSS、JavaScript 实现响应式家电控制台，无需框架和构建工具即可运行。
- 基于有限状态机实现洗衣机运行流程，覆盖模式选择、温度选择、转速选择、倒计时、进度反馈和完成状态。
- 设计冰箱温控逻辑，支持冷藏/冷冻温度调节、模式切换、门状态模拟、开门提醒、高温提醒和节能指示。
- 编写展示用 C 语言逻辑文件，通过 enum、struct、warning bit flag 和周期性 update 函数体现嵌入式项目思维。
