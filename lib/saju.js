// Server-side saju chart: the same calculation the page does, so the reading
// is always written from the birth details the customer paid for.
const { Solar } = require("lunar-javascript");

const EL_NAME = { wood: "Wood", fire: "Fire", earth: "Earth", metal: "Metal", water: "Water" };
const STEM = {
  "甲": { ro: "Gap", el: "wood", yy: "Yang", name: "The Pine" },
  "乙": { ro: "Eul", el: "wood", yy: "Yin", name: "The Vine" },
  "丙": { ro: "Byeong", el: "fire", yy: "Yang", name: "The Sun" },
  "丁": { ro: "Jeong", el: "fire", yy: "Yin", name: "The Candle" },
  "戊": { ro: "Mu", el: "earth", yy: "Yang", name: "The Mountain" },
  "己": { ro: "Gi", el: "earth", yy: "Yin", name: "The Garden" },
  "庚": { ro: "Gyeong", el: "metal", yy: "Yang", name: "The Sword" },
  "辛": { ro: "Sin", el: "metal", yy: "Yin", name: "The Jewel" },
  "壬": { ro: "Im", el: "water", yy: "Yang", name: "The Ocean" },
  "癸": { ro: "Gye", el: "water", yy: "Yin", name: "The Rain" }
};
const BRANCH_EL = {
  "子": "water", "丑": "earth", "寅": "wood", "卯": "wood", "辰": "earth", "巳": "fire",
  "午": "fire", "未": "earth", "申": "metal", "酉": "metal", "戌": "earth", "亥": "water"
};

// Validate and normalise what the browser sends. Returns null when invalid.
function cleanInput(raw) {
  if (!raw || typeof raw !== "object") return null;
  const date = String(raw.date || "");
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1901 || y > 2099 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1) return null;
  const noTime = raw.noTime === true || raw.noTime === "true" || !raw.time;
  let time = "";
  if (!noTime) {
    const t = /^(\d{2}):(\d{2})$/.exec(String(raw.time));
    if (!t || +t[1] > 23 || +t[2] > 59) return null;
    time = `${t[1]}:${t[2]}`;
  }
  const sex = String(raw.sex) === "1" ? 1 : 0;
  return { date, time, noTime, sex };
}

function compute(input) {
  const [y, m, d] = input.date.split("-").map(Number);
  let hh = 12, mm = 0;
  if (!input.noTime) [hh, mm] = input.time.split(":").map(Number);
  const ec = Solar.fromYmdHms(y, m, d, hh, mm, 0).getLunar().getEightChar();
  const pillars = {
    hour: input.noTime ? null : ec.getTime(),
    day: ec.getDay(),
    month: ec.getMonth(),
    year: ec.getYear()
  };
  const counts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  Object.values(pillars).forEach((gz) => {
    if (!gz) return;
    counts[STEM[gz[0]].el]++;
    counts[BRANCH_EL[gz[1]]]++;
  });
  const luck = ec.getYun(input.sex).getDaYun().slice(1, 9).map((dy) => ({
    gz: dy.getGanZhi(), age: dy.getStartAge(), start: dy.getStartYear()
  }));
  return { pillars, counts, luck, dayStem: pillars.day[0], total: input.noTime ? 6 : 8 };
}

function buildPrompt(input, chart) {
  const s = STEM[chart.dayStem];
  const year = new Date().getFullYear();
  return `You are a warm, modern Korean saju reader writing for an English-speaking reader who loves Korean culture. Write their full saju reading.

Chart (Korean four pillars, solar-term based):
- Hour: ${chart.pillars.hour || "unknown"}, Day: ${chart.pillars.day}, Month: ${chart.pillars.month}, Year: ${chart.pillars.year}
- Day Master: ${chart.dayStem} (${s.ro}), ${s.yy} ${EL_NAME[s.el]}, archetype "${s.name}"
- Element counts: ${Object.entries(chart.counts).map(([k, v]) => `${EL_NAME[k]} ${v}`).join(", ")} (out of ${chart.total})
- Sex: ${input.sex ? "male" : "female"}
- 10-year luck pillars: ${chart.luck.map((l) => `${l.gz} from age ${l.age} (${l.start})`).join("; ")}
- Current year: ${year}${year === 2026 ? ", 丙午 (Fire Horse)" : ""}

Write about 900 words in plain text (no markdown symbols, no asterisks, no #). Use these section titles, each on its own line: Who you are, Love and compatibility, Career and money, Your current luck pillar, ${year} month by month (a short note for each month, using the Korean solar months), What to lean into. Use a few Korean terms with romanization and a short gloss. Be specific to this chart, kind, and honest about challenges. Present it as reflection, not certainty. Never give medical, legal or financial instructions.`;
}

module.exports = { cleanInput, compute, buildPrompt };
