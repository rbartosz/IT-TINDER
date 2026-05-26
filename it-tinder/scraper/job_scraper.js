import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

fetch("https://remotive.com/api/remote-jobs?category=software-dev&limit=15")
  .then((res) => res.json())
  .then((data) => {
    const jobs = (data.jobs || []).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company_name,
      salary_min: 5000,
      salary_max: 10000,
      technologies: (j.tags || []).slice(0, 3),
      link: j.url,
    }));

    fs.mkdirSync(path.join(__dirname, "..", "backend"), { recursive: true });
    fs.writeFileSync(
      path.join(__dirname, "..", "backend", "oferty.json"),
      JSON.stringify(jobs, null, 4)
    );

    console.log(`OK, ${jobs.length} ofert`);
  })
  .catch((err) => console.error("błąd:", err.message));
