import axios from "axios";
import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = "https://www.gamejob.co.kr";
const START_URL = process.env.GAMEJOB_LIST_URL || `${BASE}/Recruit/joblist?menucode=duty&duty=18`;
const OUT = path.resolve("data/jobs.json");
const MAX_PAGES = Number(process.env.MAX_PAGES || 30);
const DELAY_MS = Number(process.env.CRAWL_DELAY_MS || 900);

const client = axios.create({
  timeout: 25000,
  headers: {
    "User-Agent": process.env.CRAWLER_USER_AGENT || "Mozilla/5.0 (compatible; GameJobCareerRadar/1.1; +local-use)",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7"
  }
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => (s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const cleanMultiline = s => (s || "").replace(/[ \t\u00a0]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
const extractFormattedText = ($, el) => {
  const clone = $.load($.html(el));
  clone("style, script").remove();
  clone("br").replaceWith("\n");
  clone("p, div, li, dt, dd, tr, h1, h2, h3, h4").each((_, e) => clone(e).append("\n"));
  return cleanMultiline(clone.text());
};
const abs = href => href ? new URL(href, BASE).href : null;

function inferEngine(text) {
  const t = text.toLowerCase();
  if (/\bunreal\s*engine\s*5\b|ue5|언리얼\s*5/.test(t)) return "Unreal Engine 5";
  if (/언리얼|unreal/.test(t)) return "Unreal Engine";
  if (/godot|고도엔진/.test(t)) return "Godot";
  if (/unity|유니티/.test(t)) return "Unity";
  if (/자체\s*엔진|in[- ]house engine|proprietary engine/.test(t)) return "자체 엔진";
  return "미기재";
}

function inferRole(text) {
  const t = text.toLowerCase();
  const engine = /엔진\s*(프로그래머|개발)|engine\s*(programmer|engineer)|engine/.test(t);
  const server = /서버|server|backend|백엔드/.test(t);
  const client = /클라이언트|client|gameplay|게임\s*프로그래머/.test(t);
  if (engine) return "엔진";
  if (server && !client) return "서버";
  if (client) return "클라이언트";
  return "기타";
}

function inferCareer(text) {
  const t = clean(text);
  if (/경력\s*무관|신입\s*\/\s*경력무관|신입/.test(t)) return "신입/경력무관";
  const range = t.match(/경력\s*(\d+)\s*[~\-]\s*(\d+)\s*년/);
  if (range) return `${range[1]}~${range[2]}년`;
  const plus = t.match(/경력\s*(\d+)\s*년\s*(이상|↑|~?)/);
  if (plus) return `${plus[1]}년+`;
  return "미기재";
}

function inferEmployment(text) {
  const t = clean(text);
  if (/정규직/.test(t)) return "정규직";
  if (/인턴/.test(t)) return "인턴";
  if (/계약직/.test(t)) return "계약직";
  return "미기재";
}

function inferCompanySize(text) {
  const t = clean(text);
  if (/대기업\s*계열|대기업\s*자회사/.test(t)) return "대기업 계열/자회사";
  if (/대기업/.test(t)) return "대기업";
  if (/중견/.test(t)) return "중견";
  if (/벤처/.test(t)) return "벤처";
  if (/중소/.test(t)) return "중소";
  return "미기재";
}

function parseSalary(text) {
  const t = clean(text).replace(/,/g, "");
  const nums = [...t.matchAll(/(\d{3,5})\s*만원/g)].map(x => Number(x[1])).filter(n => n >= 1000 && n <= 100000);
  if (!nums.length) return { raw: "미공개", min: null, max: null };
  const min = Math.min(...nums), max = Math.max(...nums);
  return { raw: min === max ? `${min}만원` : `${min}~${max}만원`, min, max };
}

function extractBetween(text, start, ends, max = 700) {
  const escaped = ends.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`${start}\\s*[:：]?\\s*([\\s\\S]{3,${max}}?)(?=\\s*(?:${escaped})|$)`, "i");
  return clean(text.match(re)?.[1] || "");
}

function extractBetweenMultiline(text, start, ends, max = 2000) {
  const escaped = ends.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`${start}\\s*[:：]?\\s*([\\s\\S]{3,${max}}?)(?=\\s*(?:${escaped})|$)`, "i");
  return cleanMultiline(text.match(re)?.[1] || "");
}

async function fetchHtml(url, method = 'get', postData = null) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (method === 'post') {
        return (await client.post(url, postData, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
          }
        })).data;
      }
      return (await client.get(url)).data;
    }
    catch (e) {
      if (attempt === 3) throw e;
      await sleep(1200 * attempt);
    }
  }
}

function detailLinks($) {
  const links = new Set();
  $('a[href*="/Recruit/GI_Read/"], a[href*="/Recruit/GI_READ/"]').each((_, a) => {
    const href = abs($(a).attr("href"));
    if (href) links.add(href);
  });
  return links;
}

function nextPageUrl($, currentUrl) {
  const candidates = [];
  $('a[href]').each((_, a) => {
    const text = clean($(a).text());
    const href = abs($(a).attr("href"));
    if (!href || !/gamejob\.co\.kr/.test(href)) return;
    if (/^(다음|next|›|>|다음페이지)$/i.test(text)) candidates.push(href);
    if (/^2$/.test(text) && /_GI_Job_List|joblist/i.test(href)) candidates.push(href);
  });
  return candidates.find(x => x !== currentUrl) || null;
}

async function crawl() {
  console.log(`GameJob crawl start: ${START_URL}`);
  const seen = new Map();
  const visitedPages = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      let html;
      let pageUrl = START_URL;
      
      if (page > 1) {
        pageUrl = `${BASE}/Recruit/_GI_Job_List`;
        const u = new URL(START_URL);
        const params = new URLSearchParams(u.search);
        params.set("Page", page);
        html = await fetchHtml(pageUrl, 'post', params.toString());
      } else {
        html = await fetchHtml(pageUrl);
      }

      const $ = cheerio.load(html);
      const links = detailLinks($);
      console.log(`page ${page}: ${links.size} detail links → ${pageUrl}`);

      if (!links.size) break;

      let linkCount = 0;
      for (const url of links) {
        if (seen.has(url)) continue;
        linkCount++;
        if (linkCount % 10 === 0) console.log(`  fetching details ${linkCount}/${links.size}...`);
        try {
          const dhtml = await fetchHtml(url);
          const d$ = cheerio.load(dhtml);
          
          const getData = (keyword) => {
            let res = "";
            d$(".recruit-data-item dt").each((_, dt) => {
              if (clean(d$(dt).text()).includes(keyword)) res = clean(d$(dt).next("dd").text());
            });
            return res;
          };

          const title = clean(d$("#GI_Title").val()) || clean(d$(".corp-title h1").first().text()) || clean(d$("h1").first().text()) || clean(d$("h2").first().text());
          const company = clean(d$("#C_Name").val()) || clean(d$(".corp-name a").first().text()) || clean(d$(".company_name, .corp_name, [class*='company']").first().text()) || clean(dhtml.match(/(?:기업명|회사명)\s*[:：]?\s*([^|]{2,80})/)?.[1]);
          const reqRegion = clean(d$("#Want_Area_C").val()) || extractBetween(clean(d$("body").text()), "근무지역", ["복리후생", "접수안내", "담당업무", "전형절차"], 120);
          
          const iframes = d$("iframe").map((_, f) => abs(d$(f).attr("src"))).get().filter(x => x && x.includes("GI_Read"));
          let jdText = "";
          for (const ifurl of iframes) {
            try {
              const ihtml = await fetchHtml(ifurl);
              const i$ = cheerio.load(ihtml);
              jdText += "\n" + extractFormattedText(i$, i$("body"));
            } catch(e) { }
          }
          
          let fullJd = cleanMultiline(jdText);
          const fmtBody = extractFormattedText(d$, d$("body"));
          if (!fullJd || fullJd.length < 50) {
            fullJd = extractBetweenMultiline(fmtBody, "담당업무", ["자격조건", "자격요건", "우대사항", "근무지역", "전형절차", "제출서류", "복리후생", "접수안내"], 2000) || fmtBody.substring(0, 2000);
          }
          
          const bodyText = clean(d$("body").text());
          const keywords = d$("a,span,li,dt,dd").map((_, e) => clean(d$(e).text())).get().filter(x => x.length < 80).slice(0, 160).join(" ");
          const allText = `${d$("#GA_Part").val() || ""} ${getData("경력")} ${getData("고용형태")} ${bodyText} ${keywords} ${fullJd}`;
          
          const item = {
            id: (url.match(/GI_No=(\d+)/i) || [])[1] || url,
            url,
            title,
            company,
            role: inferRole(allText),
            engine: inferEngine(allText),
            career: inferCareer(getData("경력") + " " + allText),
            employment: inferEmployment(getData("고용형태") + " " + allText),
            companySize: inferCompanySize(allText),
            salary: parseSalary(getData("급여") + " " + bodyText),
            region: reqRegion,
            period: getData("마감일") || extractBetween(bodyText, "접수기간|모집기간", ["지원방법", "전형절차", "제출서류"], 120),
            process: extractBetween(fmtBody, "전형절차", ["제출서류", "담당자", "접수기간", "근무지역"], 300) || extractBetween(bodyText, "전형절차", ["제출서류", "담당자", "접수기간", "근무지역"], 300),
            jd: fullJd.substring(0, 2000),
            fetchedAt: new Date().toISOString()
          };

          if (/\bC\+\+|\bC\/C\+\+|Visual\s*C\+\+|언리얼|Unreal|엔진\s*(프로그래|개발)|클라이언트\s*프로그래|서버\s*프로그래/i.test(allText)) {
            seen.set(url, item);
          }
          await sleep(DELAY_MS);
        } catch (e) {
          console.warn("detail failed", url, e.message);
        }
      }

      await sleep(DELAY_MS);
    } catch (e) {
      console.warn("page failed", page, e.message);
      break;
    }
  }

  const jobs = [...seen.values()];
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), count: jobs.length, jobs }, null, 2));
  console.log(`saved ${jobs.length} relevant jobs -> ${OUT}`);
}

crawl().catch(e => { console.error(e); process.exit(1); });
