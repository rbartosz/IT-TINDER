// scraper – pobiera oferty z zewnetrznego api Remotive i zapisuje do oferty.json
// odpalasz: node scraper/job_scraper.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// hack zeby dostac __dirname w ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// strzelam do publicznego api Remotive, kategoria software-dev, max 15 ofert
fetch("https://remotive.com/api/remote-jobs?category=software-dev&limit=15")
  .then((res) => res.json())
  .then((data) => {
    // mapuje response na nasz format (frontend potrzebuje konkretnych pol)
    const jobs = (data.jobs || []).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company_name,
      salary_min: 5000,            // Remotive nie podaje kasy wiec wpisuje na sztywno
      salary_max: 10000,
      technologies: (j.tags || []).slice(0, 3),  // bierze max 3 tagi zeby sie nie rozjezdzalo na karcie
      link: j.url,
    }));

    // upewniam sie ze folder backend istnieje, potem zapisuje JSON
    fs.mkdirSync(path.join(__dirname, "..", "backend"), { recursive: true });
    fs.writeFileSync(
      path.join(__dirname, "..", "backend", "oferty.json"),
      JSON.stringify(jobs, null, 4)
    );

    console.log(`OK, ${jobs.length} ofert`);
  })
  .catch((err) => console.error("blad:", err.message));
