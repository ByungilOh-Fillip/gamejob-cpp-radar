import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();
let crawlRunning = false;

app.use(express.json());
app.use(express.static(path.join(ROOT, "public")));

async function load() {
  try { return JSON.parse(await fs.readFile(path.join(ROOT, "data/jobs.json"), "utf8")); }
  catch { return { updatedAt: null, count: 0, jobs: [] }; }
}

app.get("/api/jobs", async (_, res) => res.json(await load()));
app.get("/api/status", (_, res) => res.json({ crawlRunning }));

app.post("/api/crawl", (_, res) => {
  if (crawlRunning) return res.status(409).json({ ok: false, message: "이미 크롤링 중입니다." });
  crawlRunning = true;
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(npm, ["run", "crawl:once"], { cwd: ROOT, stdio: "inherit", shell: false });
  child.on("close", code => { crawlRunning = false; });
  res.json({ ok: true, message: "크롤링을 시작했습니다." });
});

app.listen(PORT, () => console.log(`GameJob Career Radar → http://localhost:${PORT}`));
