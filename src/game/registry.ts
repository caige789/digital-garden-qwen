/* 29 款游戏注册表 —— 只含元数据；游戏实现全部按需动态加载（首屏 0 游戏代码） */
import React from "react";
import { GameCtx, GameDef, GameHandle } from "./engine";

/* 懒加载工厂：进入某款游戏时才下载对应代码块 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (loader: () => Promise<any>, name: string) =>
  (g: GameCtx): Promise<GameHandle> => loader().then((m) => m[name](g));

/* 角色选择面板（游戏菜单扩展位） */
const SurvivorPanel = React.lazy(() => import("./hero_panels").then((m) => ({ default: m.SurvivorHeroPanel })));
const DungeonPanel = React.lazy(() => import("./hero_panels").then((m) => ({ default: m.DungeonHeroPanel })));

export const CATEGORIES = ["割草生存", "肉鸽狂潮", "像素冒险", "经典街机", "休闲益智", "动作跑酷", "空战射击", "塔防布阵", "对弈棋类", "通勤轻游", "悬疑解谜"] as const;
export const CAT_TONE: Record<string, string> = {
  割草生存: "#c94f4f", 肉鸽狂潮: "#b8860b", 像素冒险: "#8a6fbf", 经典街机: "#d95d39", 休闲益智: "#3e8e52",
  动作跑酷: "#efa32c", 空战射击: "#6f9fd8", 塔防布阵: "#7b4b94", 对弈棋类: "#2e8f83",
  通勤轻游: "#4a90a4", 悬疑解谜: "#5d5a8f",
};
export const SCENES = [
  { key: "commute", label: "🚇 通勤" },
  { key: "单手", label: "🖐 单手" },
  { key: "短局", label: "⏱ 短局" },
  { key: "烧脑", label: "🧠 烧脑" },
  { key: "反应", label: "⚡ 反应" },
];

export const GAMES: GameDef[] = [
  {
    id: "survivor", name: "地下城幸存者", emoji: "⚔️", category: "割草生存",
    desc: "怪潮围城，觉醒神装，血月求生。",
    tags: ["割草", "觉醒进化", "血月狂潮", "冲刺"], scene: ["反应", "长线"], W: 480, H: 820, hot: true,
    tips: ["按住拖动移动，武器全自动攻击", "武器满级后再抽到可「觉醒」，威力翻倍", "点右侧 ⚡ 冲刺（短无敌），精英掉宝箱", "菜单可选英雄：移速/生命/伤害/经验各不同"],
    help: { kb: "WASD 移动，空格冲刺，武器全自动。", touch: "按住拖动出摇杆移动，点 ⚡ 冲刺，攻击全自动。" },
    create: L(() => import("./games7"), "createSurvivor"),
    menuExtra: SurvivorPanel,
  },
  {
    id: "pixeldungeon", name: "像素地牢", emoji: "🗝️", category: "像素冒险",
    desc: "Roguelike，每 5 层一个 Boss。",
    tags: ["Roguelike", "随机地图", "Boss"], scene: ["反应", "长线"], W: 480, H: 640, hot: true,
    tips: ["左下滑动移动，右下 ⚔ 键攻击（可按住）", "吃剑加攻击、心加血、靴子加速、盾抵挡", "击败 Boss 解锁楼梯，换层 2.5 秒无敌", "底部 🛒 商店：花园金币买装备买复活", "菜单可选人物：攻击/血量/速度/范围各不同"],
    help: { kb: "WASD 移动，空格攻击。", touch: "滑动移动，⚔ 键攻击（可按住连击）。" },
    create: L(() => import("./games8"), "createPixelDungeon"),
    menuExtra: DungeonPanel,
  },
  {
    id: "contra", name: "魂斗勇者", emoji: "🎖️", category: "像素冒险",
    desc: "横版突突突，干翻军团机甲。",
    tags: ["魂斗罗", "自动开火", "机甲 Boss"], scene: ["反应", "长线"], W: 640, H: 400, landscape: true, hot: true,
    keys: [{ label: "◀", key: "ArrowLeft" }, { label: "跳", key: "Space" }, { label: "▶", key: "ArrowRight" }],
    tips: ["◀▶ 移动，右侧跳键跳跃", "靠近敌人自动开火，捡 S/M 强化武器", "一路向右，终点有军团机甲"],
    help: { kb: "←→ 跑，空格跳，自动开火，↑ 斜上瞄。", touch: "◀▶ 移动，跳键跳跃，自动开火。" },
    create: L(() => import("./games8"), "createContra"),
  },
  {
    id: "snake", name: "贪吃蛇", emoji: "🐍", category: "经典街机",
    desc: "吞果实，别咬到自己。",
    tags: ["经典", "滑动转向"], scene: ["单手", "短局", "反应"], commute: true, W: 480, H: 640,
    help: { kb: "方向键 / WASD 控制方向。", touch: "在画面上滑动转向。" },
    create: L(() => import("./games1"), "createSnake"),
  },
  {
    id: "2048", name: "2048", emoji: "🔢", category: "休闲益智",
    desc: "滑动合并，冲向 2048。",
    tags: ["数字", "合并"], scene: ["单手", "烧脑", "短局"], commute: true, savable: true, W: 480, H: 640,
    help: { kb: "方向键滑动棋盘。", touch: "朝任意方向滑动。" },
    create: L(() => import("./games1"), "create2048"),
  },
  {
    id: "tetris", name: "俄罗斯方块", emoji: "🧱", category: "经典街机",
    desc: "七种方块消行，越来越快。",
    tags: ["消行", "手速"], scene: ["烧脑", "反应"], W: 480, H: 640,
    keys: [{ label: "◀", key: "ArrowLeft" }, { label: "⟳", key: "ArrowUp" }, { label: "▶", key: "ArrowRight" }, { label: "⤓", key: "Space" }],
    help: { kb: "←→ 移动，↑ 旋转，↓ 加速，空格直落。", touch: "点按旋转，左右滑移动，下滑直落；也可点底部按键。" },
    create: L(() => import("./games1"), "createTetris"),
  },
  {
    id: "flappy", name: "Flappy Bird", emoji: "🐤", category: "经典街机",
    desc: "点一下飞一下，穿过管道。",
    tags: ["反应", "一键"], scene: ["单手", "短局", "反应"], commute: true, W: 480, H: 640,
    help: { kb: "空格键扇动翅膀。", touch: "点击屏幕任意位置起飞。" },
    create: L(() => import("./games1"), "createFlappy"),
  },
  {
    id: "breakout", name: "打砖块", emoji: "🧨", category: "动作跑酷",
    desc: "弹球清空砖墙。",
    tags: ["弹球", "关卡"], scene: ["反应"], W: 480, H: 640,
    keys: [{ label: "◀", key: "ArrowLeft" }, { label: "发射", key: "Space" }, { label: "▶", key: "ArrowRight" }],
    help: { kb: "←→ 移动，空格发射。", touch: "滑动挡板跟随，点按发射。" },
    create: L(() => import("./games2"), "createBreakout"),
  },
  {
    id: "plane", name: "飞机大战", emoji: "✈️", category: "空战射击",
    desc: "机库养成，10 关 5 Boss。",
    tags: ["机库养成", "5 种 Boss", "道具掉落"], scene: ["反应", "长线"], W: 480, H: 700, hot: true,
    tips: ["先在菜单机库选战机、做升级", "按住拖动战机，自动开火", "吃 F/S/H/B 道具，捡金币回机库买飞机"],
    help: { kb: "方向键 / WASD 移动，自动开火。", touch: "按住拖动战机（战机在手指上方），自动开火。" },
    create: L(() => import("./games_plane"), "createPlane"),
    menuExtra: React.lazy(() => import("./games_plane").then((m) => ({ default: m.HangarPanel }))),
  },
  {
    id: "adventure", name: "冒险勇士", emoji: "🗡️", category: "动作跑酷",
    desc: "二段跳闯关，踩怪夺旗。",
    tags: ["横版", "二段跳"], scene: ["反应", "长线"], W: 640, H: 420, landscape: true,
    keys: [{ label: "◀", key: "ArrowLeft" }, { label: "跳", key: "Space" }, { label: "▶", key: "ArrowRight" }],
    tips: ["◀▶ 按键移动，点空白处跳跃", "可以二段跳，踩怪不伤血", "小心尖刺，冲向终点旗"],
    help: { kb: "←→ 移动，空格跳（可二段）。", touch: "◀▶ 键移动，点按空白处跳跃（可二段）。" },
    create: L(() => import("./games2"), "createAdventure"),
  },
  {
    id: "runner", name: "跑酷达人", emoji: "🏃", category: "动作跑酷",
    desc: "狂奔、二段跳、滑铲。",
    tags: ["自动跑", "4 种道具"], scene: ["单手", "反应", "短局"], commute: true, W: 640, H: 420, landscape: true,
    help: { kb: "空格跳，↓ 滑铲。", touch: "点击跳，下滑滑铲。" },
    create: L(() => import("./games2"), "createRunner"),
  },
  {
    id: "race", name: "赛车", emoji: "🏎️", category: "动作跑酷",
    desc: "超车躲车捡金币。",
    tags: ["竞速", "加速"], scene: ["单手", "反应", "短局"], commute: true, W: 480, H: 640,
    keys: [{ label: "◀", key: "ArrowLeft" }, { label: "加速", key: "ArrowUp" }, { label: "▶", key: "ArrowRight" }],
    help: { kb: "←→ 转向，↑ 加速。", touch: "按住拖动赛车。" },
    create: L(() => import("./games2"), "createRace"),
  },
  {
    id: "memory", name: "记忆翻牌", emoji: "🎴", category: "休闲益智",
    desc: "翻牌配对，拼记忆。",
    tags: ["记忆", "配对"], scene: ["单手", "烧脑", "短局"], commute: true, W: 480, H: 640,
    help: { kb: "鼠标点击翻牌。", touch: "点击卡片翻开，记住位置。" },
    create: L(() => import("./games1"), "createMemory"),
  },
  {
    id: "minesweeper", name: "扫雷", emoji: "💣", category: "休闲益智",
    desc: "首点安全，长按标旗。",
    tags: ["推理", "标旗"], scene: ["烧脑"], savable: true, W: 480, H: 640,
    help: { kb: "左键翻开，右键标旗。", touch: "轻点翻开，长按 0.4 秒标旗；或用「标旗模式」。" },
    create: L(() => import("./games1"), "createMinesweeper"),
  },
  {
    id: "maze", name: "迷宫", emoji: "🌀", category: "休闲益智",
    desc: "随机迷宫找出口。",
    tags: ["随机", "寻路"], scene: ["烧脑", "短局"], commute: true, savable: true, W: 480, H: 640,
    keys: [{ label: "◀", key: "ArrowLeft" }, { label: "▲", key: "ArrowUp" }, { label: "▼", key: "ArrowDown" }, { label: "▶", key: "ArrowRight" }],
    help: { kb: "方向键 / WASD 移动。", touch: "朝目标方向拖动小球持续行走。" },
    create: L(() => import("./games1"), "createMaze"),
  },
  {
    id: "fruitmatch", name: "消消乐", emoji: "🍓", category: "休闲益智",
    desc: "交换水果凑三连。",
    tags: ["三消", "连锁"], scene: ["单手", "烧脑", "短局"], commute: true, W: 480, H: 640,
    help: { kb: "点选两个相邻水果交换。", touch: "先点一个再点相邻的，或直接拖动。" },
    create: L(() => import("./games3"), "createFruitMatch"),
  },
  {
    id: "gemmatch", name: "宝石迷阵", emoji: "💎", category: "休闲益智",
    desc: "30 步刷最高连锁。",
    tags: ["三消", "宝石"], scene: ["单手", "烧脑", "短局"], commute: true, W: 480, H: 640,
    help: { kb: "点选两个相邻宝石交换。", touch: "点选相邻宝石或直接拖动。" },
    create: L(() => import("./games3"), "createGemMatch"),
  },
  {
    id: "gomoku", name: "五子棋", emoji: "⚫", category: "对弈棋类",
    desc: "双人对弈，先连五子。",
    tags: ["双人", "策略"], scene: ["烧脑"], savable: true, W: 480, H: 640,
    help: { kb: "点击落子。", touch: "点击交叉点落子，黑先白后。" },
    create: L(() => import("./games1"), "createGomoku"),
  },
  {
    id: "xiangqi", name: "中国象棋", emoji: "🀄", category: "对弈棋类",
    desc: "完整规则，将军困毙。",
    tags: ["双人", "完整规则"], scene: ["烧脑", "长线"], W: 540, H: 700,
    help: { kb: "点选棋子，绿点为可走位置。", touch: "点棋子查看走法，点目标落子；可悔棋。" },
    create: L(() => import("./games3"), "createXiangqi"),
  },
  {
    id: "pvz", name: "植物大战僵尸", emoji: "🌻", category: "塔防布阵",
    desc: "7 植物守 5 波。",
    tags: ["塔防", "阳光经济"], scene: ["烧脑", "长线"], W: 960, H: 600, landscape: true,
    tips: ["先点顶部植物卡片，再点草坪种植", "天上掉的阳光记得点一点收集", "坚果挡路、樱桃炸场、土豆雷要预热"],
    help: { kb: "点卡片 → 点草坪种植。", touch: "选卡片点草坪种植，点阳光收集。" },
    create: L(() => import("./games3"), "createPvZ"),
  },
  {
    id: "carrot", name: "保卫萝卜", emoji: "🥕", category: "塔防布阵",
    desc: "5 塔 3 级，守 15 波。",
    tags: ["塔防", "升级"], scene: ["烧脑", "长线"], W: 960, H: 700, landscape: true,
    tips: ["底栏选塔，点空地建造", "点已有的塔可升级（最高 3 级）", "每 5 波有 Boss，留好火力"],
    help: { kb: "选塔点空地建造，点塔升级。", touch: "底栏选塔，点空地建造，点塔升级。" },
    create: L(() => import("./games3"), "createCarrot"),
  },
  {
    id: "watermelon", name: "合成大西瓜", emoji: "🍉", category: "通勤轻游",
    desc: "物理合成，越合越大。",
    tags: ["合成", "物理"], scene: ["单手", "短局"], commute: true, W: 480, H: 640, hot: true,
    help: { kb: "鼠标移动瞄准，点击落下。", touch: "滑动瞄准，松手落下。" },
    create: L(() => import("./games4"), "createWatermelon"),
  },
  {
    id: "oneatwob", name: "1A2B 破译", emoji: "🔐", category: "通勤轻游",
    desc: "十次机会破译密码。",
    tags: ["推理", "数字"], scene: ["单手", "烧脑", "短局"], commute: true, W: 480, H: 640,
    help: { kb: "数字键输入，回车提交。", touch: "点数字键输入，✓ 提交。" },
    create: L(() => import("./games4"), "createOneATwoB"),
  },
  {
    id: "lightsout", name: "灯光谜题", emoji: "💡", category: "通勤轻游",
    desc: "把灯全部熄灭。",
    tags: ["逻辑", "极简"], scene: ["单手", "烧脑", "短局"], commute: true, W: 480, H: 640,
    help: { kb: "鼠标点击格子。", touch: "点格子翻转自己和四周的灯。" },
    create: L(() => import("./games4"), "createLightsOut"),
  },
  {
    id: "calc24", name: "24 点", emoji: "🧮", category: "通勤轻游",
    desc: "四张牌凑出 24。",
    tags: ["心算", "限时"], scene: ["烧脑", "短局"], commute: true, W: 480, H: 640,
    help: { kb: "鼠标点牌与运算符。", touch: "点牌点运算符，从左到右计算。" },
    create: L(() => import("./games4"), "createCalc24"),
  },
  {
    id: "sudoku", name: "数独", emoji: "🔢", category: "休闲益智",
    desc: "唯一解，三档难度。",
    tags: ["推理", "经典"], scene: ["烧脑", "长线"], commute: true, W: 480, H: 640,
    help: { kb: "点格子后按数字键。", touch: "点格子 → 点数字填入。" },
    create: L(() => import("./games5"), "createSudoku"),
  },
  {
    id: "guesspoem", name: "猜诗", emoji: "📜", category: "通勤轻游",
    desc: "补全诗句，连对加分。",
    tags: ["诗词", "填空"], scene: ["单手", "烧脑", "短局"], commute: true, W: 480, H: 640,
    help: { kb: "鼠标点字块。", touch: "点字块补全诗句空缺。" },
    create: L(() => import("./games5"), "createGuessPoem"),
  },
  {
    id: "turtlesoup", name: "海龟汤", emoji: "🐢", category: "悬疑解谜",
    desc: "提问推理，还原真相。",
    tags: ["悬疑", "推理"], scene: ["烧脑"], W: 480, H: 640,
    help: { kb: "鼠标点问题。", touch: "点问题获得「是/不是/无关」，集齐线索揭盅。" },
    create: L(() => import("./games6"), "createTurtleSoup"),
  },
  {
    id: "greenhouse", name: "温室逃脱", emoji: "🌿", category: "悬疑解谜",
    desc: "五道机关逃出生天。",
    tags: ["密室", "连环谜题"], scene: ["烧脑"], W: 480, H: 640,
    help: { kb: "鼠标操作。", touch: "灯光记忆 → 滑块 → 花盆 → 密码 → 宝石门，线索前后呼应。" },
    create: L(() => import("./games6"), "createGreenhouse"),
  },
  {
    id: "dawn", name: "黎明前 20 分钟", emoji: "🔦", category: "肉鸽狂潮",
    desc: "提灯割草：黑暗里的怪看不见也打不着，撑到黎明。",
    tags: ["黑暗恐惧", "灯光机制", "限时生存"], scene: ["反应", "长线"], W: 480, H: 640,
    help: { kb: "WASD/方向键移动，自动瞄准开火。", touch: "按住拖动移动，自动瞄准最近的亮处敌人；升级优先点「强光」照得更远。" },
    create: L(() => import("./games_dawn"), "createDawn"),
  },
  {
    id: "torment", name: "痛苦之厅", emoji: "💀", category: "肉鸽狂潮",
    desc: "暗黑哥特割草：完成契约目标，掉落带词条的装备。",
    tags: ["暗黑风", "装备词条", "契约目标"], scene: ["反应", "长线"], W: 480, H: 640,
    help: { kb: "WASD 移动自动射击，空格放烈焰新星。", touch: "左半屏拖动移动，右半屏拖动瞄准射击（自动/手动皆可）；完成击杀契约领装备词条。" },
    create: L(() => import("./games_torment"), "createTorment"),
  },
  {
    id: "rock", name: "深岩·幸存者", emoji: "⛏️", category: "肉鸽狂潮",
    desc: "可以挖矿改地形的割草：炸出护城河，让虫子绕路。",
    tags: ["挖矿改地形", "炮塔", "爆破"], scene: ["反应", "长线", "烧脑"], W: 480, H: 640,
    help: { kb: "WASD 移动，Shift 冲刺掘进，空格爆破。", touch: "拖动移动，子弹会自动挖开岩石；左下角冲刺可撞穿岩层，有爆破时点右下角炸出一圈空地。" },
    create: L(() => import("./games_rock"), "createRock"),
  },
];

export const GAME_NAME_MAP: Record<string, string> = Object.fromEntries(GAMES.map((g) => [g.id, g.name]));
export const GAME_EMOJI_MAP: Record<string, string> = Object.fromEntries(GAMES.map((g) => [g.id, g.emoji]));
export const getGame = (id: string) => GAMES.find((g) => g.id === id);
