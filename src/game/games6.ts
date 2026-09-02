/* 游戏实现 · 第六辑：海龟汤 / 温室逃脱（悬疑解谜） */
import { GameCtx, GameHandle, rr } from "./engine";

const FONT = '"Noto Sans SC", sans-serif';
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", bold = true) {
  ctx.fillStyle = color; ctx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, size: number, color: string): number {
  ctx.fillStyle = color; ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  let line = "", yy = y;
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW) { ctx.fillText(line, x, yy); line = ch; yy += lineH; }
    else line += ch;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy + lineH;
}
const GOLD = "#efa32c", BERRY = "#d95d39";

/* ============ 海龟汤 ============ */
type Q = { q: string; a: "是" | "不是" | "无关"; key?: boolean };
type Soup = { title: string; surface: string; truth: string; questions: Q[] };
const SOUPS: Soup[] = [
  {
    title: "一碗汤",
    surface: "男人在餐厅喝下一碗海龟汤，问服务员：「这真的是海龟汤吗？」得到肯定答复后，他走出餐厅，跳进了海里。",
    truth: "男人曾与同伴遭遇海难流落荒岛，同伴给他喝「海龟汤」让他活了下来。直到今天喝到真正的海龟汤，他才发现当年喝下的其实是去世同伴的肉。",
    questions: [
      { q: "他是因为汤难喝吗？", a: "不是" },
      { q: "他以前喝过海龟汤吗？", a: "是", key: true },
      { q: "这和他认识的人有关吗？", a: "是", key: true },
      { q: "他曾经遭遇过事故吗？", a: "是", key: true },
      { q: "当年的汤里是海龟吗？", a: "不是", key: true },
      { q: "他是自杀的吗？", a: "是" },
      { q: "服务员有恶意吗？", a: "无关" },
      { q: "他是厨师吗？", a: "无关" },
      { q: "真相和味道有关吗？", a: "是" },
      { q: "他的同伴还活着吗？", a: "不是", key: true },
    ],
  },
  {
    title: "半根火柴",
    surface: "一个人被发现死在沙漠里，身上没有衣服，手里紧紧攥着半根火柴。周围没有任何脚印。",
    truth: "他和同伴乘坐热气球穿越沙漠，气球漏气不断下坠。扔掉所有行李后仍不够轻，大家抽签决定谁跳下去——他抽到了被折断的那半根火柴。",
    questions: [
      { q: "他是被谋杀的吗？", a: "不是" },
      { q: "半根火柴是关键吗？", a: "是", key: true },
      { q: "他从天上来的吗？", a: "是", key: true },
      { q: "当时有交通工具吗？", a: "是", key: true },
      { q: "没有脚印说明没人走近过他吗？", a: "是" },
      { q: "衣服是自己脱的吗？", a: "是" },
      { q: "有其他人参与这件事吗？", a: "是", key: true },
      { q: "是抽签决定的吗？", a: "是" },
      { q: "他死于坠落吗？", a: "是" },
      { q: "当时是白天吗？", a: "无关" },
    ],
  },
  {
    title: "水草",
    surface: "男孩在河里游泳，抓了一把「水草」爬上岸。岸边老人说：「这条河里从来没有水草。」男孩听完，转身跳进河里，再也没有上来。",
    truth: "几年前，男孩的女友在同一条河里溺水。他曾拼命去抓她，却以为只抓到了一把水草。老人一句话让他明白：当年他抓住的其实是女友的长发——他本可以救她。",
    questions: [
      { q: "水草是关键吗？", a: "是", key: true },
      { q: "他认识这条河吗？", a: "是", key: true },
      { q: "这件事和一个人有关吗？", a: "是", key: true },
      { q: "那个人还活着吗？", a: "不是", key: true },
      { q: "他是因为内疚吗？", a: "是" },
      { q: "老人认识男孩吗？", a: "无关" },
      { q: "他当年也在河里吗？", a: "是" },
      { q: "他抓到的真的是水草吗？", a: "不是", key: true },
      { q: "有人推他下水吗？", a: "不是" },
      { q: "和爱情有关吗？", a: "是" },
    ],
  },
  {
    title: "灯塔",
    surface: "深夜，男人在屋里看新闻，突然停电了。他摸黑走到窗边看了一眼大海，然后失声痛哭。第二天，海面上漂着许多船骸。",
    truth: "男人是灯塔看守人。新闻里正在播风暴预警，而他值班的灯塔因停电熄灭了整夜——失去指引的船只在黑暗中触礁沉没。",
    questions: [
      { q: "停电是事故原因吗？", a: "是", key: true },
      { q: "男人的职业重要吗？", a: "是", key: true },
      { q: "他住在海边吗？", a: "是" },
      { q: "船骸和他的工作有关吗？", a: "是", key: true },
      { q: "他哭了是因为害怕吗？", a: "不是" },
      { q: "他是灯塔看守人吗？", a: "是" },
      { q: "船是被风暴直接击沉的吗？", a: "不是" },
      { q: "有人故意停电吗？", a: "无关" },
      { q: "他看的是自己负责的灯塔吗？", a: "是", key: true },
      { q: "和天气有关吗？", a: "是" },
    ],
  },
  {
    title: "电梯",
    surface: "男人住在 13 楼。每天早上他坐电梯直达 1 楼；傍晚回家时，如果电梯里有别人或外面下雨，他就直接坐到 13 楼，否则只坐到 10 楼，再走三层楼梯上去。",
    truth: "男人个子非常矮，够不到 13 楼的按钮。电梯里有别人时可以请人帮忙；下雨时他带着伞，可以用伞柄去按。",
    questions: [
      { q: "他不想让人知道他住 13 楼吗？", a: "不是" },
      { q: "他的身体特征是重点吗？", a: "是", key: true },
      { q: "他个子矮吗？", a: "是", key: true },
      { q: "下雨时有工具帮忙吗？", a: "是", key: true },
      { q: "电梯坏了吗？", a: "不是" },
      { q: "10 楼有什么特别的吗？", a: "不是" },
      { q: "他是为了锻炼走楼梯吗？", a: "不是" },
      { q: "有其他人在场就能到 13 楼吗？", a: "是" },
      { q: "他在躲什么人吗？", a: "无关" },
      { q: "电梯按钮的位置是关键吗？", a: "是", key: true },
    ],
  },
  {
    title: "一杯水",
    surface: "男人走进酒吧，向酒保要了一杯水。酒保突然掏出一把枪指着他。男人愣了一下，说了声「谢谢」，转身离开了。",
    truth: "男人一直打嗝停不下来，想喝水压一压。酒保看出他的状况，用枪吓了他一跳——惊吓治好了打嗝，于是男人真心道谢。",
    questions: [
      { q: "酒保想伤害他吗？", a: "不是", key: true },
      { q: "男人要水是因为渴吗？", a: "不是", key: true },
      { q: "男人身体有不舒服吗？", a: "是", key: true },
      { q: "枪治好了他的问题吗？", a: "是", key: true },
      { q: "他在打嗝吗？", a: "是" },
      { q: "两人是仇人吗？", a: "不是" },
      { q: "枪是真的吗？", a: "无关" },
      { q: "男人是被吓好的吗？", a: "是" },
      { q: "酒吧是关键地点吗？", a: "不是" },
      { q: "他说谢谢是真心的吗？", a: "是" },
    ],
  },
  {
    title: "隧道",
    surface: "火车驶进隧道，车厢里一片漆黑。男人突然绝望地大叫起来，周围人赶紧安抚他。几秒后火车驶出隧道，男人羞愧地道了歉。",
    truth: "男人刚做完复明手术，重见光明不到一天。隧道里的黑暗让他误以为自己又失明了，崩溃大叫；出了隧道才发现只是虚惊一场。",
    questions: [
      { q: "男人有危险吗？", a: "不是" },
      { q: "黑暗是关键吗？", a: "是", key: true },
      { q: "他看不见东西吗？", a: "是" },
      { q: "他是盲人吗？", a: "不是" },
      { q: "他刚治好眼睛吗？", a: "是", key: true },
      { q: "他以为自己又瞎了吗？", a: "是", key: true },
      { q: "车上发生案件了吗？", a: "不是" },
      { q: "出了隧道他明白了吗？", a: "是" },
      { q: "别人也在大叫吗？", a: "无关" },
      { q: "和他的健康有关吗？", a: "是", key: true },
    ],
  },
  {
    title: "生日蜡烛",
    surface: "女孩过 18 岁生日，吹灭蛋糕上的蜡烛后，全家人鼓起掌来。女孩却盯着窗外哭了起来。第二天，全家搬走了。",
    truth: "女孩家对面是一栋烂尾楼，一个被困在里面的流浪者曾和她约定：「如果你生日那天蜡烛的光能照到我，我就有救了。」女孩吹灭蜡烛的瞬间，对面最后一点微光也熄灭了。",
    questions: [
      { q: "蜡烛是关键吗？", a: "是", key: true },
      { q: "有人死了或消失了是吗？", a: "是", key: true },
      { q: "女孩认识那个人吗？", a: "是", key: true },
      { q: "全家搬家是因为害怕吗？", a: "不是" },
      { q: "窗外有重要的人吗？", a: "是", key: true },
      { q: "吹蜡烛是一个信号吗？", a: "是" },
      { q: "家人知道这件事吗？", a: "是" },
      { q: "和生日愿望有关吗？", a: "无关" },
      { q: "那个人得救了吗？", a: "不是" },
      { q: "光有关系吗？", a: "是", key: true },
    ],
  },
];
export function createTurtleSoup(g: GameCtx): GameHandle {
  const story = SOUPS[g.rnd(SOUPS.length)];
  const asked: (null | "是" | "不是" | "无关")[] = story.questions.map(() => null);
  let revealed = false, startT = Date.now(), overFlag = false;
  const totalKeys = story.questions.filter((q) => q.key).length;
  const found = () => story.questions.reduce((n, q, i) => n + (q.key && asked[i] === "是" ? 1 : 0), 0);
  function finish() {
    if (overFlag) return; overFlag = true;
    const sec = (Date.now() - startT) / 1000;
    const askN = asked.filter(Boolean).length;
    const score = Math.round(Math.max(400, 500 + (found() / totalKeys) * 2800 + Math.max(0, 700 - sec * 3) - askN * 40));
    setTimeout(() => g.over(score), 1200);
  }
  const qW = 220, qH = 60, qY0 = 172, qStepX = 230, qStepY = 66;
  const cellXY = (i: number) => ({ x: 20 + (i % 2) * qStepX, y: qY0 + Math.floor(i / 2) * qStepY });
  const BY = 512; // 揭盅按钮 y
  return {
    tick(dt) { g.juice.update(dt); },
    draw(ctx) {
      ctx.fillStyle = "#0d1520"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, `🐢 海龟汤 · ${story.title}`, g.W / 2, 28, 22, "#cfe3c2");
      rr(ctx, 16, 46, g.W - 32, 100, 12); ctx.fillStyle = "#152232"; ctx.fill();
      ctx.strokeStyle = "rgba(159,216,120,.25)"; ctx.stroke();
      wrap(ctx, story.surface, 30, 60, g.W - 60, 24, 15, "#d8e4d0");
      txt(ctx, "🕵️ 点击卡片提问", 26, 158, 14, "#8fae93", "left");
      txt(ctx, `🔑 关键线索 ${found()}/${totalKeys}`, g.W - 26, 158, 14, GOLD, "right");
      story.questions.forEach((q, i) => {
        const { x, y } = cellXY(i);
        rr(ctx, x, y, qW, qH, 11);
        ctx.fillStyle = asked[i] ? "#12202e" : "#1d3247"; ctx.fill();
        if (!asked[i]) { ctx.strokeStyle = "rgba(159,216,120,.18)"; ctx.stroke(); }
        const label = q.q.length > 12 ? q.q.slice(0, 11) + "…" : q.q;
        txt(ctx, label, x + qW / 2, y + 24, 15, asked[i] ? "#5f7a68" : "#e4eedd");
        if (asked[i]) {
          const a = asked[i]!;
          const ac = a === "是" ? "#9fd878" : a === "不是" ? BERRY : "#5f7a68";
          txt(ctx, (q.key && a === "是" ? "🔑 " : "") + a, x + qW / 2, y + 45, 14, ac);
        } else txt(ctx, "点击提问", x + qW / 2, y + 45, 11, "rgba(216,228,208,.35)");
      });
      rr(ctx, g.W / 2 - 110, BY, 220, 56, 28);
      ctx.fillStyle = revealed ? "#33415a" : found() >= Math.ceil(totalKeys * 0.6) ? BERRY : "#22303f";
      ctx.fill();
      txt(ctx, revealed ? "已揭盅" : "🥣 揭盅看汤底", g.W / 2, BY + 28, 18, "#f3f5ea");
      if (revealed) {
        ctx.fillStyle = "rgba(8,14,22,.94)"; ctx.fillRect(0, 0, g.W, g.H);
        txt(ctx, "🥣 汤底", g.W / 2, 88, 26, GOLD);
        wrap(ctx, story.truth, 40, 136, g.W - 80, 31, 18, "#e9f2e4");
        txt(ctx, "真相只有一个，分数已结算", g.W / 2, g.H - 58, 14, "#8fae93");
      }
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t !== "down" || overFlag || revealed) return;
      if (x > g.W / 2 - 110 && x < g.W / 2 + 110 && y > BY && y < BY + 56) {
        revealed = true; g.sfx.boom(); g.juice.shake(8); finish(); return;
      }
      story.questions.forEach((q, i) => {
        if (asked[i]) return;
        const { x: qx, y: qy } = cellXY(i);
        if (x >= qx && x <= qx + qW && y >= qy && y <= qy + qH) {
          asked[i] = q.a;
          if (q.a === "是") { g.sfx.score(); g.juice.float(qx + qW / 2, qy, q.key ? "🔑 关键线索!" : "是", q.key ? GOLD : "#9fd878", q.key ? 17 : 14); }
          else g.sfx.click();
        }
      });
    },
  };
}

/* ============ 温室逃脱 ============ */
export function createGreenhouse(g: GameCtx): GameHandle {
  let scene = 0; // 0灯光 1滑块 2花盆 3密码 4大门
  let wrong = 0, startT = Date.now(), overFlag = false, note = "温室的门锁着，想办法逃出去。";
  const COLORS = ["#d95d39", "#3e8e52", "#efa32c", "#2e8f83"];
  const CNAMES = ["红", "绿", "黄", "青"];
  const seq = [0, 1, 2, 3].map(() => g.rnd(4));
  let simonPhase: "watch" | "input" = "watch", simonT = 0, simonIdx = 0, inputIdx = 0;
  let tiles = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  for (let i = 0; i < 150; i++) {
    const empty = tiles.indexOf(0);
    const moves = [empty % 3 !== 0 ? empty - 1 : -1, empty % 3 !== 2 ? empty + 1 : -1, empty >= 3 ? empty - 3 : -1, empty < 6 ? empty + 3 : -1].filter((m) => m >= 0);
    const m = moves[g.rnd(moves.length)];
    [tiles[empty], tiles[m]] = [tiles[m], tiles[empty]];
  }
  const flowers = ["梅", "兰", "竹", "菊"];
  const flowerPos = [...flowers];
  for (let i = flowerPos.length - 1; i > 0; i--) { const j = g.rnd(i + 1); [flowerPos[i], flowerPos[j]] = [flowerPos[j], flowerPos[i]]; }
  let flowerPick = 0;
  let code = "";
  let gemPick: number[] = [];
  const panelXY = (i: number) => ({ x: 40 + (i % 2) * 210, y: 210 + Math.floor(i / 2) * 170 });
  return {
    tick(dt) {
      g.juice.update(dt);
      if (scene === 0 && simonPhase === "watch") {
        simonT += dt;
        if (simonT > 800) { simonT = 0; simonIdx++; if (simonIdx > seq.length) { simonPhase = "input"; simonIdx = -1; } }
      }
    },
    draw(ctx) {
      ctx.fillStyle = "#101f14"; ctx.fillRect(0, 0, g.W, g.H);
      g.juice.pre(ctx);
      txt(ctx, "🌿 温室逃脱", g.W / 2, 26, 20, "#cfe3c2");
      txt(ctx, `⏱ ${Math.floor((Date.now() - startT) / 1000)}s · 失误 ${wrong}`, g.W / 2, 54, 13, "#8fae93");
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < scene ? "#3e8e52" : i === scene ? GOLD : "#2a4634";
        rr(ctx, g.W / 2 - 78 + i * 34, 74, 26, 8, 4); ctx.fill();
      }
      wrap(ctx, note, 30, 104, g.W - 60, 24, 14, "#d8e4d0");
      if (scene === 0) {
        for (let i = 0; i < 4; i++) {
          const { x, y } = panelXY(i);
          const lit = simonPhase === "watch" && simonIdx < seq.length && seq[simonIdx] === i && simonT < 500;
          rr(ctx, x, y, 190, 150, 14);
          ctx.fillStyle = lit ? COLORS[i] : "#1c3626"; ctx.fill();
          ctx.strokeStyle = COLORS[i] + "66"; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
          txt(ctx, CNAMES[i], x + 95, y + 75, 22, lit ? "#fff" : COLORS[i]);
        }
        txt(ctx, simonPhase === "watch" ? "记住灯光亮起的顺序…" : `你的回合：${inputIdx}/4`, g.W / 2, 580, 15, GOLD);
      } else if (scene === 1) {
        const CS = 106, ox = (g.W - CS * 3) / 2, oy = 200;
        tiles.forEach((v, i) => {
          if (!v) return;
          const x = ox + (i % 3) * CS, y = oy + Math.floor(i / 3) * CS;
          rr(ctx, x + 3, y + 3, CS - 6, CS - 6, 12);
          ctx.fillStyle = "#223c2a"; ctx.fill();
          txt(ctx, String(v), x + CS / 2, y + CS / 2, 30, "#e9f2e4");
        });
        txt(ctx, "滑动拼图：把 1-8 按顺序排好", g.W / 2, 560, 14, "#8fae93");
      } else if (scene === 2) {
        txt(ctx, "花匠日记：先梅，次兰，再竹，最后菊", g.W / 2, 240, 15, GOLD);
        flowerPos.forEach((f, i) => {
          const x = 30 + i * 112, y = 280;
          rr(ctx, x, y, 96, 130, 12);
          ctx.fillStyle = i < flowerPick ? "#2c4a35" : "#1c3626"; ctx.fill();
          ctx.strokeStyle = i < flowerPick ? "#3e8e52" : "rgba(233,242,228,.2)"; ctx.stroke();
          txt(ctx, "🪴", x + 48, y + 88, 34, "#000");
          txt(ctx, f, x + 48, y + 32, 22, i < flowerPick ? "#3e8e52" : "#e9f2e4");
        });
      } else if (scene === 3) {
        txt(ctx, "桌上有张便条：「我的密码倒过来写是 1086」", g.W / 2, 210, 14, GOLD);
        for (let i = 0; i < 4; i++) {
          rr(ctx, g.W / 2 - 118 + i * 62, 250, 54, 54, 10);
          ctx.fillStyle = "#1c3626"; ctx.fill();
          ctx.strokeStyle = i === code.length ? GOLD : "rgba(233,242,228,.2)"; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
          if (code[i]) txt(ctx, code[i], g.W / 2 - 91 + i * 62, 278, 24, "#e9f2e4");
        }
        for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
          const labels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];
          const x = g.W / 2 - 141 + col * 96, y = 330 + row * 60;
          rr(ctx, x, y, 88, 52, 10);
          ctx.fillStyle = labels[row * 3 + col] === "✓" ? "#3e8e52" : labels[row * 3 + col] === "⌫" ? "#5a3a30" : "#223c2a";
          ctx.fill();
          txt(ctx, labels[row * 3 + col], x + 44, y + 26, 18, "#e9f2e4");
        }
      } else if (scene === 4) {
        txt(ctx, "大门上有 4 个宝石槽，按「灯光的顺序」嵌入", g.W / 2, 210, 14, GOLD);
        for (let i = 0; i < 4; i++) {
          rr(ctx, 60 + i * 96, 250, 76, 76, 38);
          ctx.fillStyle = gemPick[i] !== undefined ? COLORS[gemPick[i]] : "#12241a"; ctx.fill();
          ctx.strokeStyle = "rgba(233,242,228,.3)"; ctx.stroke();
        }
        COLORS.forEach((c, i) => {
          rr(ctx, 60 + i * 96, 420, 76, 76, 16);
          ctx.fillStyle = c; ctx.fill();
          txt(ctx, CNAMES[i], 98 + i * 96, 458, 18, "#fff");
        });
      }
      g.juice.draw(ctx);
      g.juice.post(ctx);
    },
    onPointer(t, x, y) {
      if (t !== "down" || overFlag) return;
      if (scene === 0 && simonPhase === "input") {
        for (let i = 0; i < 4; i++) {
          const { x: px, y: py } = panelXY(i);
          if (x >= px && x <= px + 190 && y >= py && y <= py + 150) {
            if (i === seq[inputIdx]) {
              inputIdx++; g.sfx.click(); g.juice.burst(px + 95, py + 75, COLORS[i], 6);
              if (inputIdx >= 4) { scene = 1; note = "灯光熄灭前，你记住了顺序（大门会用到）。花坛里好像埋着什么。"; g.sfx.win(); }
            } else { wrong++; inputIdx = 0; simonPhase = "watch"; simonIdx = 0; simonT = 0; g.sfx.hit(); g.juice.shake(6); note = "顺序错了，灯光重新亮起，再看一遍。"; }
            return;
          }
        }
      } else if (scene === 1) {
        const CS = 106, ox = (g.W - CS * 3) / 2, oy = 200;
        const col = Math.floor((x - ox) / CS), row = Math.floor((y - oy) / CS);
        if (col < 0 || row < 0 || col > 2 || row > 2) return;
        const i = row * 3 + col, empty = tiles.indexOf(0);
        if ((Math.abs(i - empty) === 1 && Math.floor(i / 3) === Math.floor(empty / 3)) || Math.abs(i - empty) === 3) {
          [tiles[i], tiles[empty]] = [tiles[empty], tiles[i]]; g.sfx.click();
          if (tiles.every((v, k) => v === (k + 1) % 9)) {
            scene = 2; note = "泥土下挖出一把钥匙碎片！墙角有四盆花，贴着标签。"; g.sfx.win(); g.juice.shake(4);
          }
        }
      } else if (scene === 2) {
        for (let i = 0; i < 4; i++) {
          const x0 = 30 + i * 112;
          if (x >= x0 && x <= x0 + 96 && y >= 280 && y <= 410) {
            if (flowerPos[i] === flowers[flowerPick]) {
              flowerPick++; g.sfx.click(); g.juice.burst(x0 + 48, 320, "#8fc176", 7);
              if (flowerPick >= 4) { scene = 3; note = "花盆底座弹开，又是一块碎片！桌上有张便条。"; g.sfx.win(); }
            } else { wrong++; flowerPick = 0; g.sfx.hit(); g.juice.shake(6); note = "顺序不对，花朵重新合拢。记住：梅、兰、竹、菊。"; }
            return;
          }
        }
      } else if (scene === 3) {
        for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
          const bx = g.W / 2 - 141 + col * 96, by2 = 330 + row * 60;
          if (x >= bx && x <= bx + 88 && y >= by2 && y <= by2 + 52) {
            const labels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];
            const label = labels[row * 3 + col];
            if (label === "⌫") { code = code.slice(0, -1); g.sfx.click(); }
            else if (label === "✓") {
              if (code === "9801") { scene = 4; note = "箱子开了，最后一块碎片！大门需要 4 颗宝石，按最初灯光的顺序。"; g.sfx.win(); g.juice.shake(4); }
              else { wrong++; code = ""; g.sfx.hit(); g.juice.shake(6); note = "密码不对。想想：倒过来是 1086，正着是什么？"; }
            }
            else if (code.length < 4) { code += label; g.sfx.click(); }
            return;
          }
        }
      } else if (scene === 4) {
        for (let i = 0; i < 4; i++) {
          const bx = 60 + i * 96;
          if (x >= bx && x <= bx + 76 && y >= 420 && y <= 496) {
            if (i === seq[gemPick.length]) {
              gemPick.push(i); g.sfx.click(); g.juice.burst(bx + 38, 288, COLORS[i], 8);
              if (gemPick.length >= 4) {
                g.sfx.win(); note = "大门缓缓打开——你逃出来了！";
                if (!overFlag) {
                  overFlag = true;
                  const sec = (Date.now() - startT) / 1000;
                  setTimeout(() => g.over(Math.round(Math.max(800, 9000 - sec * 8 - wrong * 250))), 1300);
                }
              }
            } else { wrong++; gemPick = []; g.sfx.hit(); g.juice.shake(6); note = "宝石被弹开了。回想第一间屋子里灯光亮起的顺序。"; }
            return;
          }
        }
      }
    },
  };
}
