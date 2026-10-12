# EcoSure Audit Review

A single-page site for reviewing Kisco Senior Living's EcoSure food safety audits across communities. It replaces the old Python pipeline (`parse.py`, `prep.py`, `merge_caps.py`, ...) that turned PDFs into a static review page. The PDFs are now read in the browser, so adding new files no longer needs anyone to run scripts.

## What it does

Every screen starts with its top 5 and lets the reader expand ("Show all") or open folded sections for more. The site opens on a **Briefing** written as an executive summary that can be read cold, without anyone there to explain it. Every line is built from the data:

1. **Context:** one line on what EcoSure is and what the scores mean.
2. **The bottom line:** three sentences covering the overall result, the biggest issue, and corrective action plans.
3. **Four key numbers:** average score, kitchens below 70, critical findings, and plans closed.
4. **What to fix:** the top 5 issues with a photo each. Expand one for why it matters, the fix, and more photos.
5. **Who needs help and Follow-through:** the top 5 communities and the top 5 overdue plans, each expandable.
6. **By region:** average score, kitchens below 70 and plans closed for each region, lowest first. Expand a region to see its communities. Regions are set per community in Settings.
7. **Program impact** (sits right after the key numbers):
   - total infractions, filterable by severity
   - how many are remediated (on a CAP EcoSure shows as approved or completed), in progress, or have no CAP yet
   - a tile for each severity
   - the score baseline or change since the last round
   - a folded "Found and fixed" set of critical examples with photos
8. **Next steps:** three asks for regional and community teams.

**Copy as email** produces a complete email (subject, context, every section and a link back) for executives who read it without the page.

Each **community page** opens with talking points (score, biggest issues in plain words, repeats, CAP status, what to check on the next visit) and up to 8 photos. A fix-first list, score history and every finding follow below.

Under **More detail**:

| Page | Use it to |
| --- | --- |
| Priorities | Rank every cited standard by points lost and the score gain from fixing it everywhere |
| Findings and photos | Filter every finding by community, section, theme, criticality, CAP state, repeats, photos or text, then download a CSV |
| Trends | See the portfolio by theme grid, scores by round and month, points lost by section, a standards heat map, repeat findings and the biggest score changes |
| Readiness playbook | Review every cited standard: what EcoSure checks, what to have in place, a 30-second check, and the most common misses |
| Self-audits | Track each community's monthly walk-through against the playbook. Readiness is the points-weighted pass rate |

Also available: **Action list** (who needs an audit or a CAP), **Communities** (sortable scorecard), **Import files** and **Settings**.

Plain-language titles and "why it matters" lines live in `src/plain.ts`; the playbook text lives in `src/playbook.ts`. Edit either file to match Kisco's own wording.

### Sharing with the wider team

- Share the page from claude.ai's Share menu.
- Give **Viewer** access to people who only read it.
- Give **Contributor** access to anyone who imports files, updates CAP status, or submits self-audits.
- Links to a community or a playbook entry (for example `#c-balfour-riverfront`) open straight to that page.

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
- **CAP missing:** a kitchen with findings and no CAP on file. It shows as a red **CAP** tag in the sidebar, a banner on the community page, "CAP missing · due Oct 17" or "CAP missing · 6 days late" in lists, and a CAPs missing count on the briefing.
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
VITE_SHARE_URL=https://claude.ai/artifact/<id> npm run build   # dist/index.html and dist/artifact.html; the URL makes copied links point at the published page
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
| `src/views-brief.ts` | The briefing and community talking points |
| `src/views-roles.ts` | Communities of focus, priorities, playbook and self-audit pages |
| `src/plain.ts` | Plain-language title and why it matters for each standard |
| `src/playbook.ts` | What to have in place and a quick check for each standard |
| `src/views*.ts`, `src/charts.ts` | Other pages and charts |
| `scripts/make_fixtures.py` | Builds the synthetic report and CAP PDFs used by the tests |

### Known limits

- The CAP reader was checked against all 20 real CAP PDFs from the old project. Every item and action matched the old pipeline's output.
- The report reader is a direct port of `parse.py`, but no real EcoSure report PDF was available while building it. It was only tested on a synthetic report laid out the way `parse.py` expects. Check the first real reports you import against the PDF. The score and points check will flag a layout mismatch.
- The old Excel workbook and PowerPoint decks are not rebuilt by this site. Use the CSV downloads, or the old scripts, for those.
