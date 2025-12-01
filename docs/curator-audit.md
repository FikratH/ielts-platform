# Curator Experience Audit

## 1. Curator UI surface

| Page | Filters / Actions | Notes |
| --- | --- | --- |
| `CuratorDashboard` (`frontend/src/pages/CuratorDashboard.js`) | Group, teacher, per-module test selectors, time-range presets (new `TimeRangeFilter`), compare button, export summary to CSV, tabs for statistics, score distributions, group/teacher tables, detailed per-test tables | Overview page is dense; lacks focused “students behind schedule” widget, student drill-down links, and highlights for missing tests. |
| `CuratorStudentsPage` | Group, teacher, listening/reading test filters, search field, time-range filter, student table with last activity, filters | Displays counts per module but no badge for missing tests or quick detail link; only pagination-less table. |
| Module overviews (`CuratorWritingPage`, `CuratorListeningPage`, `CuratorReadingPage`, `CuratorSpeakingPage`) | Per-module filters (group, teacher), writing has pagination + export, all have time-range filter injected. Tables show KPIs/score distributions, but no quick access to a student's full history or missing-test status. |
| `CuratorTestComparisonPage` | Select category, choose ≥2 tests, group/teacher/date filters, comparison/export buttons; uses backend comparison API. | Requires manual test selection; no templated presets or indications which tests most relevant. |
| `CuratorDiagnosticPage` | Dashboard-style cards, students table with bands/progress, analytics summary. | Good for diagnostics but lacks linking back to module pages or quick action to assign tests.

Shared components:
- `TimeRangeFilter`: new reusable component; consistent across curator pages.
- `Sidebar`: still includes curator nav but no quick alerts indicator.

## 2. Backend coverage

| View | API | Time filters | Metrics |
| --- | --- | --- | --- |
| `CuratorStudentsView` | `GET /curator/students/` | Added `date_from`/`date_to` via `apply_date_range_filter` on essays/sessions, returns groups/teachers options and per-student last activity counts | Student counts for writing/listening/reading, latest activity timestamp, no explicit missing test flag. |
| `CuratorOverviewView` | `GET /curator/overview/` | Date filters propagate to sessions/essays/speaking via helper; also filters by test IDs | KPI cards (completion rates, average scores, score distributions) + detailed test breakdowns with per-student stats. |
| `CuratorWritingOverviewView` | `GET /curator/writing-overview/` | Date filter on writing sessions/essays | Stats, teacher/group analytics, recent sessions (paginated). |
| `CuratorListeningOverviewView` | `GET /curator/listening-overview/` | Date filter on listening sessions | Stats, accuracy/performance distributions, recent sessions. |
| `CuratorReadingOverviewView` | `GET /curator/reading-overview/` | Date filter on reading sessions | Stats, accuracy, trends, paginated recent sessions. |
| `CuratorSpeakingOverviewView` | `GET /curator/speaking-overview/` | Date filter on speaking sessions | Stats, performance distributions, per-student summary, pagination. |
| `CuratorTestComparisonView` | `GET /curator/test-comparison/` | Accepts `date_from`/`date_to`, filters per test | Aggregated metrics/comparisons for selected writing/listening/reading tests. |
| Routes registered + CSV exports exist for writing/listening/overview.

## 3. Gaps vs. curator workflow

1. **Student progress for bi-weekly cadences**: every page now time-aware, but no explicit “progress per student” or trend line; dashboards show averages only.
2. **Missing tests / overdue assignments**: no API or UI indicator highlighting students who skipped tests in the selected window (counts only, no callout).
3. **Navigation to student detail**: no dedicated detail page yet (route placeholder added but no implementation); students tables lack clickable rows.
4. **Exports**: available at module level (writing export, overview export) but not for students directly or missing-test lists.
5. **Alerts/automation**: dashboard lacks alert banners or quick “compare tests” context beyond manual selection; no callouts about API health/rescheduling.
6. **Consistency with backend filters**: now consistent due to helper, but some pagination/performance concerns remain (per-view pagination uses simple slicing).
7. **UX/structure**: sections are dense, need better grouping (e.g., highlight top/bottom performing groups).

## 4. Recommended improvements

1. **Student detail page (high priority)**: implement `CuratorStudentDetailPage` + `CuratorStudentDetailView` to show full history, missing tests, quick actions (message teacher, export report).
2. **Missing-tests widget (high)**: introduce `StudentsMissingTestsWidget` on dashboard; backend `CuratorMissingTestsView` returning students without required submissions in window.
3. **Dashboard redesign (medium)**: restructure into tabs (overview/alerts/actions), add quick actions (export, compare, contact teacher), surface missing-tests widget.
4. **Clickable students + table sorting (medium)**: allow clicking student name to go to detail, enable sorting by completion/last activity, add “missing tests” column.
5. **Backend support for alerts (low)**: add API to fetch students failing to submit per module/test, feed into frontend widget and exports.
6. **Breadcrumbs / quick filters**: add breadcrumbs or context navigation and saved filter presets (“Last 2 weeks diagnostic”, “Current week”) for faster reuse.

## 5. Action plan

- Task 1: Implement `CuratorStudentDetailView` + frontend route/page + summary cards (existing todo in plan).  
- Task 2: Build `StudentsMissingTestsWidget` & API, display on dashboard near exports.  
- Task 3: Redesign `CuratorDashboard` layout to show key alerts + actions (tabs or cards).  
- Task 4: Enhance students table (clickable rows, missing-test column, sorting) + update module pages with links/backlinks as needed.  
- Task 5: Review exports for missing tests, possibly add per-student CSV.

Document will evolve as implementations land. Revisit after Tasks 1–3 to adjust priorities.






