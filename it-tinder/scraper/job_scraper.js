// scraper – narzedzie do recznego odswiezenia ofert (opcjonalne)
// oferty sa teraz pobierane na zywo przez /api/oferty, ale to zostaje jako backup
// odpalasz: node scraper/job_scraper.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// pobiera z tych samych kategorii co serwer, parsuje salary
const IT_CATEGORIES = ['software-development', 'devops', 'artificial-intelligence', 'data', 'engineering', 'product'];

function parseSalary(salaryStr) {
  if (!salaryStr) return { min: 5000, max: 10000 };
  const clean = salaryStr.replace(/^(OTE|up to|from)\s+/i, '').trim();
  const nums = clean.match(/\$?([\d,.]+)\s*k?\s*[-\u2013]\s*\$?([\d,.]+)\s*k?/);
  if (!nums) return { min: 5000, max: 10000 };
  let min = parseFloat(nums[1].replace(',', '.'));
  let max = parseFloat(nums[2].replace(',', '.'));
  if (/k/i.test(clean)) { min *= 1000; max *= 1000; }
  if (clean.includes('/hour')) { min *= 160; max *= 160; }
  const isHourly = salaryStr.includes("/hour"); return { min: Math.round(min * 3.8 / (isHourly ? 1 : 12)), max: Math.round(max * 3.8 / (isHourly ? 1 : 12)) };
}

const all = await Promise.all(
  IT_CATEGORIES.map(cat =>
    fetch(`https://remotive.com/api/remote-jobs?category=${cat}&limit=20`)
      .then(r => r.json())
      .then(d => d.jobs || [])
      .catch(() => [])
  )
);

const seen = new Set();
const jobs = all.flat().filter(j => {
  if (seen.has(j.id)) return false;
  seen.add(j.id);
  return true;
}).slice(0, 100).map(j => {
  const salary = parseSalary(j.salary);
  return {
    id: j.id,
    title: j.title,
    company: j.company_name,
    salary_min: salary.min,
    salary_max: salary.max,
    technologies: (j.tags || []).slice(0, 5),
    link: j.url,
  };
});

fs.mkdirSync(path.join(__dirname, "..", "server"), { recursive: true });
fs.writeFileSync(
  path.join(__dirname, "..", "server", "oferty.json"),
  JSON.stringify(jobs, null, 4)
);

const withReal = jobs.filter(j => j.salary_min !== 5000 || j.salary_max !== 10000);
console.log(`OK, ${jobs.length} ofert (${withReal.length} z rzeczywistymi wide\u0142kami) zapisanych do server/oferty.json`);
