# EcoSure Audit Review

A single-page site for reviewing Kisco Senior Living's EcoSure food safety audits across communities. It replaces the old Python pipeline (`parse.py`, `prep.py`, `merge_caps.py`, ...) that turned PDFs into a static review page. The PDFs are now read in the browser, so adding new files no longer needs anyone to run scripts.

## What it does

| Page | Use it to |
| --- | --- |
| Overview | See average score, kitchens below 70, critical findings and CAPs closed, plus the top of both action lists |
| Action list | See which communities still need an audit this round, and which kitchens need a CAP (not started, late, in progress or past due) |
| Communities | Sort a scorecard by score, change since the last audit, findings, repeats, audit status and CAP status |
| Community page | Review one community: kitchen scores, score history, what to look for on a visit, findings with photos and CAP actions, and a CAP status form |
| Findings | Filter every finding by community, section, theme, criticality, CAP state, repeats, photos or free text, then download a CSV |
| Trends | Compare scores by round and month, points lost by section, a standards by community heat map, repeat findings, and the biggest score changes |
| Import files | Drop EcoSure report PDFs and CAP PDFs, check what was read, and save. A backup can be downloaded or restored here |
| Settings | Edit the community roster, audit rounds, and how many days a CAP or an audit can wait |

## Adding new files

1. Open **Import files** and drop in the PDFs exactly as EcoSure exports them. Reports and CAPs can be mixed.
2. Each file shows what was read: community, kitchen, date, score, findings and photos. Warnings appear when something does not add up. For example, points lost that don't match the score usually means EcoSure changed its layout.
3. Select **Save** (or **Save all**).

A CAP attaches to the report with the same kitchen and audit date (EcoSure's "Announce Date"). If the report hasn't arrived, the CAP's findings stand in for it until it does. Importing the same kitchen and date again replaces the earlier copy.

## Where data lives

- **Published on claude.ai** (the normal case): imports go to the page's shared database and photo store, so everyone with access sees them. Viewers need Contributor access to import.
- **Opened any other way** (a saved file, `npm run dev`): imports stay in that browser. Use **Download backup** on the Import page to move them.
- **Starting data:** the 42 kitchen audits, CAPs and 544 photos from the previous review page are built into the published page. An import for the same kitchen and date replaces the built-in copy. This data is not in git, because the repository is public. To build with it, save the old page (or the published one) as HTML and run `npm run seed -- path/to/EcoSure_Audit_Review.html` before `npm run build`. Without it, the site builds with no starting data.

## Rules the site applies

- **Score bands:** 85 and up is good, 70 to 84 is a warning, below 70 is a community of focus. Critical findings cost 5 points, Major 3, Minor 1.
- **CAP status:**
  - closed when EcoSure shows Approved or Completed
  - past due when an open CAP has an item past its due date
  - late when there is no CAP after the expected window (10 days by default)
- **Audit status:**
  - due when a community has no audit in the current round
  - overdue after 100 days (by default)
  - waiting on report when the roster note says so or only a CAP is on file
- **Rounds:**
  - Q3 2026 covers the first round (Aug 12 to Oct 9, 2026)
  - Q4 2026 starts Oct 10
  - edit or add rounds in Settings
- **Repeat finding:** the same standard is cited at the same kitchen's next audit.

## Development

```bash
cd ecosure
npm install
npm run seed -- path/to/EcoSure_Audit_Review.html   # optional starting data, kept out of git
npm run dev        # http://localhost:5173
npm test           # unit tests for the rules (vitest)
npm run e2e        # import flow in a real browser (Playwright)
npm run build      # dist/index.html (standalone) and dist/artifact.html (for claude.ai)
```

To publish an update, rebuild and republish `dist/artifact.html` to the same artifact URL, keeping the `db`, `assets`, `user` and `downloads` capabilities.

### Layout

| Path | What it is |
| --- | --- |
| `src/parse/pdf.ts` | pdf.js wrapper: text lines with positions, image placements, photo extraction |
| `src/parse/report.ts` | EcoSure report reader (port of `parse.py`, with score and points checks) |
| `src/parse/cap.ts` | CAP reader (port of `parse_cap.py` and the text cleanup in `merge_caps.py`) |
| `src/parse/legacy.ts` | Reads the old review page or `data.json` |
| `src/catalog.ts`, `src/data/standards.json` | The 65 standards with short labels, sections, criticality, client ids and visit themes |
| `src/model.ts` | Joins reports and CAPs into audits and works out every status |
| `src/store.ts` | Shared (claude.ai) or local (IndexedDB) storage |
| `src/views*.ts`, `src/charts.ts` | Pages and charts |
| `scripts/make_fixtures.py` | Builds the synthetic report and CAP PDFs used by the tests |

### Known limits

- The CAP reader was checked against all 20 real CAP PDFs from the old project. Every item and action matched the old pipeline's output.
- The report reader is a direct port of `parse.py`, but no real EcoSure report PDF was available while building it. It was only tested on a synthetic report laid out the way `parse.py` expects. Check the first real reports you import against the PDF. The score and points check will flag a layout mismatch.
- The old Excel workbook and PowerPoint decks are not rebuilt by this site. Use the CSV downloads, or the old scripts, for those.
