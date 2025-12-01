# Cursor Agent Development Logs

This file tracks all actions performed by the agent during development to provide context for future conversations.

## 2025-12-01 - Curator Weekly Overview filters (search, period, missing-tests widget)

- Added handling of the `search` query parameter in `CuratorWeeklyOverviewView` so curators can filter students by first name, last name, student ID, or email.
- Updated `CuratorWeeklyOverviewPage` to send a trimmed `search` value and include it in the data-loading dependencies so typing in the search box immediately reloads filtered data.
- When a date range (`date_from` / `date_to`) is applied in the weekly overview, only students who have at least one Listening/Reading/Writing activity in that window are included in `students`, group/teacher aggregates, and summary counts.
- Changed `StudentsMissingTestsWidget` so it only refetches when `group`, `teacher`, or the selected `timeRange` change, and not on every student search, while still applying the same group/teacher/date filters on the backend.
- Updated `TimeRangeFilter` to include an `All time` preset and made it the default; when `All time` is selected no `date_from`/`date_to` are sent, so the backend returns full-history data.
- Updated `CuratorWeeklyOverviewPage` so the default period is `All time` (`label: 'all_time'`), matching the new UX requirement.

## 2025-12-01 - Speaking overview UX tweaks

- Updated `CuratorSpeakingPage` to use `All time` as the default period, consistent with the weekly overview filters.
- Reordered the layout so the main students table appears above the KPI statistic cards, making the detailed data primary and high-level stats secondary at the bottom of the page.

## 2025-12-01 - Speaking overview filters aligned with curator dashboard

- Updated `CuratorSpeakingPage` to use the same filter layout as the weekly curator dashboard: Group, Teacher, and Search student on the first row, with a Period selector (TimeRangeFilter) on the right using `All time` by default.
- Extended `CuratorSpeakingOverviewView` to support a `search` query parameter that filters students by name, email, or student ID while still honoring group/teacher and date range filters.
- Updated `CuratorSpeakingExportCSVView` so CSV exports respect the same group/teacher/search and period filters as the on-page overview.

## 2025-12-01 - Speaking overview: only students with sessions

- Adjusted `CuratorSpeakingOverviewView` so the students queryset is intersected with the set of students who actually have SpeakingSession records in the selected period.
- As a result, the speaking results table now shows only students with at least one speaking session (submission) in the current filters, instead of listing all students with assigned teachers and marking many as "No submission".

## 2025-12-01 - Speaking overview: show all submissions per student

- Changed `CuratorSpeakingOverviewView` pagination from per-student to per-session so every SpeakingSession in the filtered range becomes its own row in the API response (`sessions`), ordered by `conducted_at` desc.
- Updated `CuratorSpeakingPage` to render `data.sessions` instead of `data.students`, showing one table row per submission (with student, scores, date), so if a student has 5 speaking submits in the period, all 5 are visible with pagination.

### Fix: speaking overview teacher serialization

- Fixed a backend bug where `CuratorSpeakingOverviewView` was returning a raw `User` object in the `teacher` field of each session, causing `TypeError: Object of type User is not JSON serializable`.
- Now the `teacher` field is always a plain string (teacher's full name or email), which is safe for JSON and matches what the frontend expects.

### Update: speaking overview only lists completed sessions

- Adjusted `CuratorSpeakingOverviewView` to build the table from `completed=True` sessions only, while still using all sessions (completed + pending) for the high-level stats where appropriate.
- The table and pagination now show one row per **completed** speaking submission in the selected period, including those without scores yet, and exclude sessions that were started but never marked as completed.

### Update: speaking overview UI – removed KPI stats

- Simplified `CuratorSpeakingPage` UI by removing all KPI/stat blocks under the table so curators focus purely on the per-session list of speaking submissions.

## 2025-12-01 - Curator diagnostic page period filter

- Updated `CuratorDiagnosticPage` to include the shared `TimeRangeFilter` with `All time` as the default, and to send `date_from`/`date_to` when loading curator diagnostic data.
- Extended `CuratorDiagnosticResultsView` to respect `date_from`/`date_to` by applying `apply_date_range_filter` to diagnostic Listening/Reading/Writing sessions and deriving the student set and latest sessions only from that window.
- As a result, both the diagnostic summary stats and the per-student table now reflect only diagnostic activity within the selected period.

## 2025-11-23 - Fixed Listening Test Score Display in Dashboard

### Problem
Students were submitting listening tests and receiving scores of 7-8, but the dashboard was showing 2.5 or 0 instead of the correct scores.

### Root Cause
**Verified on production (session 784):**
- `session.answers` = `{}` (empty!)
- `ListeningTestResult` contained correct data: `raw_score=31`, `band_score=7.0`
- `session.score=31.0`, `correct_answers_count=31`, `total_questions_count=40` - all correct

`ListeningTestSessionHistorySerializer` and `ListeningTestSessionResultSerializer` were always recalculating results via `create_listening_detailed_breakdown(instance)` instead of using saved data from `ListeningTestResult`.

**Issue:** When `session.answers` were empty (which happens after submission or due to other reasons), `create_listening_detailed_breakdown` returned 0 or 2.5, even though the real results (7.0) were already saved in `ListeningTestResult`.

### Solution Implemented

#### 1. Fixed ListeningTestSessionHistorySerializer
**File:** `backend/core/serializers.py` (line 1527-1548)

Changed `to_representation` to:
- First check if `ListeningTestResult` exists for the session
- If `ListeningTestResult` exists → use saved `raw_score`, `total_score` (from `session.total_questions_count`), `band_score`
- If not → fallback to recalculate via `create_listening_detailed_breakdown`

**Used in:**
- `/listening/sessions/` → Dashboard (Recent Tests, charts)
- `ListeningTestSessionListView` → session list for dashboard

#### 2. Fixed ListeningTestSessionResultSerializer
**File:** `backend/core/serializers.py` (line 1270-1308)

Changed `to_representation` to:
- First check if `ListeningTestResult` exists for the session
- If `ListeningTestResult` exists → use saved `raw_score`, `total_score`, `band_score`, `breakdown` (as `detailed_breakdown`)
- If not → fallback to recalculate via `create_listening_detailed_breakdown`
- Properly handles `breakdown` format (list or dict)

**Used in:**
- `/listening-sessions/${sessionId}/result/` → ListeningResultPage (details with breakdown)
- `ListeningTestResultView` → detailed results page

#### 3. Added Prefetch for Optimization
**File:** `backend/core/views.py`

Added `.prefetch_related('listeningtestresult')` to:
- `ListeningTestSessionListView.get_queryset()` (line 2113)
- `ListeningTestSessionDetailView.get_queryset()` (line 2135)

This optimizes database queries by loading related `ListeningTestResult` objects in a single query instead of N+1 queries.

### Files Modified
- `backend/core/serializers.py` - Fixed both serializers to use `ListeningTestResult`
- `backend/core/views.py` - Added prefetch optimization

### Safety Guarantees

1. **Backward Compatibility:**
   - If `ListeningTestResult` doesn't exist → fallback to recalculation
   - Old sessions without results continue to work

2. **Data Compatibility:**
   - All existing `ListeningTestResult` objects are used
   - No migrations required

3. **Performance:**
   - Added `prefetch_related('listeningtestresult')` for optimization
   - Removed unnecessary recalculation for each session in list

### Result
- ✅ Dashboard shows correct scores from saved results
- ✅ Breakdown appears in test details
- ✅ Charts show correct data
- ✅ No recalculation on every list request
- ✅ Fallback to recalculation only if results not saved
- ✅ Fixed issue with displaying 0 or 2.5 instead of real 7-8 scores
- ✅ All existing components continue to work
- ✅ Backward compatibility with old sessions

### Technical Details
- `ListeningTestResult` doesn't contain `total_score`, so we use `session.total_questions_count` (always saved)
- `breakdown` in `ListeningTestResult` is a list (verified on production: 4 elements = 4 parts)
- Proper error handling with try/except for safety
- Maintains context caching for `ListeningTestSessionResultSerializer` when results are already calculated

### Full Audit Report
- Complete audit report saved to `LISTENING_FIX_AUDIT_REPORT.md`
- Comprehensive audit report saved to `LISTENING_FIX_COMPREHENSIVE_AUDIT.md`
- All edge cases verified and handled
- Backward compatibility confirmed
- Performance improvements verified
- All related components checked and confirmed safe
- Ready for production deployment

### Critical Fix: Dashboard Statistics Calculation
**Problem Found:** In `Dashboard.js` line 313, `getStats()` was using `l.score` (raw_score = 31) instead of `l.band_score` (band_score = 7.0) for calculating average score.

**Impact:**
- Average score showed incorrect values (31 instead of 7.0)
- Inconsistency with other modules (Reading, Writing, Speaking all use band_score)
- Statistics were misleading for students

**Fix Applied:**
- `Dashboard.js` line 313: Changed `l.score` → `l.band_score`
- `AdminStudentResultsPage.js` line 135: Changed `l.score` → `l.band_score`
- Now all modules consistently use band_score for statistics

**Verification:**
- ✅ Dashboard statistics now use correct band_score
- ✅ All modules (Listening, Reading, Writing, Speaking) use consistent scoring
- ✅ Average and max scores calculated correctly

## 2025-11-21 - Time filters and curator overviews

### Summary
- Added the reusable `TimeRangeFilter` component that exposes presets plus a custom range, and wired it into every curator-facing page.
- Each curator page now sends `date_from`/`date_to` when fetching data, ensuring the UI controls consistent time spans.
- Extended every Curator* API view to honor the new filter parameters (`started_at`, `completed_at`, `end_time`, `conducted_at`) through a shared helper.

### Outcome
- Curators can focus on the last two weeks, a month, or any custom window and see that reflected immediately across dashboards, deep dives, and student lists.
- Backend queries stay efficient thanks to the centralized date helper; no more mismatched date ranges between pages.

## 2025-11-21 - Student detail, missing tests, and dashboard planning

### Summary
- Documented plan for the next phase: student detail page, missing-tests widget, dashboard redesign, improved students/module pages, and better table interactions.
- Logged todo items and started wiring backend routes (student detail).
 - Added backend route placeholder for the new `CuratorStudentDetailView`.

## 2025-11-14 - Complete Audit & Fix: Listening Test Sorting Issues

### Full Audit Results

### Problem
Listening tests had severe sorting problems causing parts and questions to constantly change order:
- Parts and questions would randomly reorder even without saving
- Order would change unpredictably when saving tests
- Questions would disappear or get mixed up during updates
- Inconsistent sorting between GET requests and test results

### Root Causes Found

#### 1. ListeningPartSerializer missing question sorting
- `ListeningPartSerializer` (read-only) had no `to_representation` method to sort questions
- Questions returned in random database order on GET requests
- `ListeningPartWriteSerializer` had sorting, but read serializer didn't

#### 2. get_test_render_structure sorting by ID instead of order
- Line 872: `part.questions.all().order_by('id')` for listening
- Should use `order_by('order')` for consistent sorting
- Caused wrong question order in test results

#### 3. get_test_render_structure trying to sort by non-existent field
- Line 860: `test.parts.all().order_by('order', 'part_number')` for all tests
- `ListeningPart` model has NO `order` field (only `ReadingPart` has it)
- Sorting failed silently, returning random order

#### 4. CRITICAL BUG in update() method - wrong dictionary key
- Line 1790: `existing_questions = {q.order: q for q in part.questions.all()}`
- Line 1831: `question = existing_questions.get(str(question_id))`
- Dictionary keyed by `order` but searched by `question_id`
- If two questions had same `order`, one would overwrite the other
- Questions would be lost or incorrectly updated during saves

#### 5. ListeningTestReadSerializer missing part sorting
- No `to_representation` method to sort parts
- Parts returned in random database order on GET requests
- `ListeningTestSerializer` (write) had sorting, but read serializer didn't

### Solution Implemented

#### 1. Added question sorting to ListeningPartSerializer
**File:** `backend/core/serializers.py` (line 1643-1650)
```python
def to_representation(self, instance):
    representation = super().to_representation(instance)
    if 'questions' in representation and representation['questions']:
        representation['questions'] = sorted(
            representation['questions'],
            key=lambda x: x.get('order', 0)
        )
    return representation
```

#### 2. Added part sorting to ListeningTestReadSerializer
**File:** `backend/core/serializers.py` (line 1712-1719)
```python
def to_representation(self, instance):
    representation = super().to_representation(instance)
    if 'parts' in representation and representation['parts']:
        representation['parts'] = sorted(
            representation['parts'],
            key=lambda x: x.get('part_number', 0)
        )
    return representation
```

#### 3. Fixed get_test_render_structure sorting
**File:** `backend/core/serializers.py` (lines 860-875)
- Changed parts sorting: `order_by('order', 'part_number')` → conditional based on module
- For listening: `order_by('part_number')` (no order field exists)
- For reading: `order_by('order', 'part_number')` (has order field)
- Changed questions sorting: `order_by('id')` → `order_by('order')` for listening
- Updated docstring to reflect correct behavior

#### 4. Fixed critical update() method bug
**File:** `backend/core/serializers.py` (lines 1811-1864)
- Changed `existing_questions` dictionary: `{q.order: q}` → `{q.id: q}`
- Changed search logic: `existing_questions.get(str(question_id))` → `existing_questions.get(question_id)`
- Changed tracking: `sent_question_orders` → `sent_question_ids`
- Fixed deletion logic: iterate by `question_id` instead of `order`
- Now correctly identifies questions by ID, preventing data loss

### Files Modified
- `backend/core/serializers.py` - Fixed 5 critical sorting issues

### Result
- ✅ Parts always sorted by `part_number` in correct order
- ✅ Questions always sorted by `order` field consistently
- ✅ No more random reordering on GET requests
- ✅ Questions correctly identified and updated during saves
- ✅ No data loss when saving tests
- ✅ Consistent sorting between GET requests and test results
- ✅ All serializers now have proper sorting logic

### Additional Fixes Found During Full Audit

#### 6. ListeningQuestionViewSet missing order in queryset
**File:** `backend/core/views.py` (line 2256)
- Changed: `order_by('part')` → `order_by('part', 'order')`
- Ensures questions are sorted when accessed via ViewSet

#### 7. Clone methods missing sorting
**File:** `backend/core/views.py` (lines 2208, 2218, 2428, 2438)
- Added `.order_by('part_number')` when cloning parts
- Added `.order_by('order')` when cloning questions
- Ensures cloned tests maintain correct order

#### 8. Utils functions missing sorting
**File:** `backend/core/utils.py` (lines 243, 252, 288, 289, 297, 298)
- Added `.order_by('part_number')` for parts iteration
- Added `.order_by('order')` for questions iteration
- Changed `order_by('id')` → `order_by('order')` in auto_fix_reading_test
- Ensures validation and auto-fix functions work with correct order

### Files Modified
- `backend/core/serializers.py` - Fixed 5 critical sorting issues
- `backend/core/views.py` - Fixed 3 sorting issues in ViewSets and clone methods
- `backend/core/utils.py` - Fixed 4 sorting issues in utility functions

### Complete Verification Checklist

✅ **Models:**
- `ListeningQuestion` has `ordering = ['order']` in Meta (line 226)
- `ListeningPart` uses `part_number` for ordering (no order field)

✅ **Serializers:**
- `ListeningPartSerializer` - has `to_representation` with question sorting
- `ListeningPartWriteSerializer` - has `to_representation` with question sorting
- `ListeningTestReadSerializer` - has `to_representation` with part sorting
- `ListeningTestSerializer` - has `to_representation` with part sorting
- `get_test_render_structure` - correctly sorts parts and questions for listening

✅ **Views:**
- `ListeningPartViewSet` - queryset sorted by `('test', 'part_number')`
- `ListeningQuestionViewSet` - queryset sorted by `('part', 'order')`
- Clone methods - sort parts and questions during cloning

✅ **Utils:**
- All validation functions sort parts and questions
- Auto-fix functions use correct sorting

✅ **Update Logic:**
- `existing_questions` dictionary uses `q.id` as key (not `q.order`)
- Question lookup uses `question_id` correctly
- Deletion logic uses `question_id` tracking

### Technical Details
- All `.all()` queries now have explicit `.order_by()` clauses
- Dictionary keys match search criteria (ID for ID-based lookups)
- Read and write serializers both have sorting for consistency
- Model differences between ListeningPart (no order) and ReadingPart (has order) properly handled
- All clone operations maintain correct order
- All utility functions respect ordering

## 2025-11-14 - Documented User Schema for Centralized Auth

### Context
- Reviewed `backend/core/models.py` to capture the authoritative structure of the custom `User` model for sharing with the centralized auth/database team.
- Confirmed with user that the provided field list represents the full schema definition currently in production.
- Compared our schema with an external sample `Student` model shared by another platform to clarify differences in identifiers, relationships, and required fields.
- Discussed central auth high-level design (shared Postgres, webhook sync) and mapped which user fields we can provide so their reference_id/group_id pipeline stays aligned with our `uid`, `student_id`, `group`, and `assigned_teacher`.
- Clarified that we can simply share the raw Django `User` model snippet with the central team if they only need the schema definition.
- Noted other platform engineers are sharing full database ER diagrams, so we may need to prepare an equivalent or at least document all related tables (sessions, results, feedback) if requested.
- Confirmed feasibility of generating an ER-style export (e.g., via `graph_models` or manual summary) and asked user what level of detail/format they expect so we can match the other team's deliverable.
- User prefers a comprehensive textual description of all relevant models/relations that can be fed into another AI to construct the diagram externally; need to prepare a structured list of tables, key fields, and FK relations.
- Need to provide Russian-language summary plus guidance on the best format (Markdown/JSON) for other AI to generate ER diagram.
- Delivered JSON schema covering all core models (User, Writing, Listening, Reading, Speaking, Surveys) so another AI can build ER diagram visually.
- Expanded JSON spec to include every model from `backend/core/models.py` (Writing, Listening, Reading, Speaking, surveys, prompts, options, sessions) and saved it to `docs/user_schema.json` for sharing with the central auth team.
- Added `docs/diagnostic_listening_test.json` plus `backend/restore_listening_diagnostic.py` to quickly recreate the Listening diagnostic template from a saved snapshot (script loads JSON, wipes existing template with same title, and seeds parts/questions/options in correct order). Also duplicated the JSON into `backend/diagnostic_listening_test.json` and updated the script path so Docker’s `./backend:/app/backend` volume sees the file when running `docker compose exec web python backend/restore_listening_diagnostic.py`.
- Documented how to export schema via `pg_dump`/dbdiagram; need to add pgAdmin instructions for schema-only export.

### Notes
- Highlighted authentication identifiers (`uid`, `email`) and role enumerations.
- Captured profile metadata (student/curator IDs, names, group, teacher fields) and linkage via `assigned_teacher`.
- Mentioned staff/superuser flags to clarify permission controls.

## 2025-11-03 - Fixed Listening Diagnostic Tests Showing in Regular Test List

### Problem
Diagnostic Listening tests were incorrectly appearing in the regular test list (/listening page) instead of being exclusive to the /diagnostic page. The frontend filter `!test.is_diagnostic_template` was not working because the backend was not returning this field.

### Root Cause
**Critical Bug:** `ListeningTestReadSerializer` was missing the `is_diagnostic_template` field in its response, while `ReadingTestReadSerializer` had this field. This inconsistency caused:
1. Frontend unable to filter out diagnostic tests from regular list
2. Diagnostic tests appearing in both /listening and /diagnostic pages
3. Confusion for users who marked tests as diagnostic templates

**Secondary Issue:** Session serializers were missing `is_diagnostic` field:
- `ListeningTestSessionSerializer`
- `ListeningTestSessionResultSerializer`
- `ListeningTestSessionHistorySerializer`

This made debugging difficult and prevented frontend from checking session type.

### Solution Implemented

#### 1. Added `is_diagnostic_template` to ListeningTestReadSerializer (line 1575)
```python
fields = [
    'id', 'title', 'description', 'is_active', 'is_diagnostic_template', 
    'explanation_url', 'parts', 'created_at', 'updated_at'
]
```

#### 2. Added `is_diagnostic` to ListeningTestSessionSerializer (line 150)
```python
fields = ['id', 'test', 'test_title', 'user', 'student_id', 'started_at', 
          'status', 'answers', 'flagged', 'time_left', 'submitted', 'is_diagnostic']
```

#### 3. Added `is_diagnostic` to ListeningTestSessionResultSerializer (line 1167-1171)
```python
fields = [
    'id', 'test', 'test_title', 'explanation_url', 'student_id', 'started_at', 
    'completed_at', 'time_taken', 'band_score', 'raw_score', 'total_score', 
    'submitted', 'answers', 'detailed_breakdown', 'is_diagnostic'
]
```

#### 4. Added `is_diagnostic` to ListeningTestSessionHistorySerializer (line 1426-1429)
```python
fields = [
    'id', 'test_title', 'band_score', 'raw_score', 'total_score',
    'submitted', 'completed_at', 'time_taken', 'is_diagnostic'
]
```

### Files Modified
- `backend/core/serializers.py` - Added missing fields to 4 serializers

### Result
- Diagnostic Listening tests no longer appear in /listening page
- Diagnostic tests are exclusive to /diagnostic page
- Frontend filter `tests.filter(test => test.is_active && !test.is_diagnostic_template)` now works correctly
- API responses now consistent with Reading/Writing modules
- Session type can be identified on frontend for debugging

### Technical Details
- Frontend already had correct filter logic in `ListeningTestListPage.js` (line 62)
- Backend validation logic for diagnostic tests was already correct (views.py lines 2259-2273)
- Only issue was missing serializer fields preventing frontend from filtering

## 2025-10-27 - Added Teacher Access to Curator Pages with Grouped Navigation

### Problem
Teachers needed access to curator pages (student overview, analytics, etc.) but adding all curator menu items to the teacher navbar would create an overloaded UI with too many navigation items.

### Solution Implemented
Implemented a grouped navigation menu with hover-based submenus for teachers, organizing menu items into three logical groups:

1. **Mock Tests** - Personal student pages (Listening, Reading, Writing)
2. **Assessment** - Teacher work pages (Writing Tasks, Speaking Assessment)  
3. **Student Overview** - All 8 curator pages (Dashboard, Students, Writing, Listening, Reading, Speaking, Comparison, Diagnostic)

### Backend Changes

#### 1. Permissions (`backend/core/permissions.py`)
- Added new `IsTeacherOrCurator` permission class that allows access to both teacher and curator roles
- This enables sharing curator endpoints with teachers

#### 2. Views (`backend/core/views.py`)
Updated `permission_classes` from `[IsCurator]` to `[IsTeacherOrCurator]` in the following views:
- `CuratorStudentsView`
- `CuratorWritingOverviewView`
- `CuratorListeningOverviewView`
- `CuratorReadingOverviewView`
- `CuratorSpeakingOverviewView`
- `CuratorOverviewView`
- `CuratorActiveTestsView`
- `CuratorTestComparisonView`
- `CuratorSpeakingExportCSVView`
- `CuratorOverviewExportCSVView`
- `CuratorWritingExportCSVView`
- `CuratorTestComparisonExportCSVView`

Also updated `CuratorDiagnosticResultsView` manual role check from `user.role != 'curator'` to `user.role not in ['teacher', 'curator']`

### Frontend Changes

#### 3. Desktop Sidebar (`frontend/src/components/Sidebar.jsx`)
- Added `ChevronDown` icon import from lucide-react
- Added `openGroups` state to manage group expansion
- Restructured `teacherLinks` from flat list to grouped structure with three groups
- Implemented vertical accordion-style dropdown menu that expands downward on click
- Groups show active state (blue background) when any child item is active
- Added curator paths support to `isActivePage` function
- Sub-items are indented and styled with smaller text for visual hierarchy

#### 4. Mobile Navbar (`frontend/src/components/Navbar.js`)
- Added `ChevronDown` icon import and `openGroups` state
- Implemented click-based expandable groups for mobile (no hover)
- Groups expand/collapse with chevron icon rotation animation
- Same three-group structure as desktop sidebar

#### 5. Redirects (`frontend/src/App.js`)
- Changed teacher default redirect from `/teacher/writing` to `/curator/dashboard`
- Updated logo link in navbar to redirect teachers to `/curator/dashboard`

### Files Modified
- `backend/core/permissions.py` - Added `IsTeacherOrCurator` class
- `backend/core/views.py` - Updated permission classes in 13 curator views
- `frontend/src/components/Sidebar.jsx` - Implemented grouped navigation with accordion-style vertical expansion
- `frontend/src/components/Navbar.js` - Implemented grouped navigation for mobile
- `frontend/src/App.js` - Updated teacher redirect route
- `cursor-logs.md` - Documented all changes

### UI/UX Details
- Desktop: Click on group header to expand/collapse items vertically (accordion style)
- Mobile: Click on group header to expand/collapse items
- Active items are highlighted in blue with left border
- Groups with active items show blue background
- Smooth transitions and animations for better user experience
- Sub-items are indented and use smaller text size
- Chevron icon rotates 180° when group is expanded
- Maintains consistent styling with existing design system

## 2025-10-24 - Fixed Listening Test Save Error

### Problem
When saving a listening test in the admin builder, encountered error:
```
TypeError: 'RelatedManager' object is not iterable
```

The error occurred in the serialization process when Django REST Framework attempted to serialize the response after updating a listening test. The traceback showed the error at `/api/listening-tests/26/` endpoint during a PUT/PATCH request.

### Root Cause
- `ListeningQuestionWriteSerializer` (line 1528 in `backend/core/serializers.py`) had `options` field defined as `serializers.ListField(child=serializers.DictField())`
- This field is used for accepting incoming data (list of dictionaries)
- When Django REST Framework tried to serialize the response, it attempted to iterate over `question.options`, which is a Django `RelatedManager` object
- The `ListField` doesn't know how to handle RelatedManager objects, causing the TypeError

### Solution Implemented
Added a `to_representation` method to `ListeningQuestionWriteSerializer` class to properly handle serialization of the `options` RelatedManager:

```python
def to_representation(self, instance):
    representation = super().to_representation(instance)
    if hasattr(instance, 'options'):
        options_qs = instance.options.all()
        representation['options'] = [
            {
                'id': opt.id,
                'label': opt.label,
                'text': opt.text,
                'points': opt.points
            }
            for opt in options_qs
        ]
    return representation
```

### Files Modified
- `backend/core/serializers.py` - Added `to_representation` method to `ListeningQuestionWriteSerializer` (lines 1537-1550)

### Technical Details
- The method converts the RelatedManager to a list of dictionaries during serialization
- Preserves all essential option fields: id, label, text, points
- Works as a fallback even though `ListeningTestViewSet` has a custom update method that uses `ListeningTestReadSerializer`

## 2025-10-25 - Fixed Parts and Questions Sorting Order

### Problem
After saving a listening test, the parts were returned in incorrect order:
- Part 1 was appearing as Part 3
- Part 2 was appearing as Part 4
- Part 3 was appearing as Part 1
- Part 4 was appearing as Part 2

The serializers were not sorting the data properly, causing parts and questions to be returned in database order rather than logical order.

### Root Cause
- `ListeningTestSerializer` and `ListeningPartWriteSerializer` did not have `to_representation` methods to sort the nested data
- Parts were not being sorted by `part_number`
- Questions within parts were not being sorted by `order`

### Solution Implemented
Added `to_representation` methods to both serializers:

1. **ListeningPartWriteSerializer** (lines 1560-1567):
```python
def to_representation(self, instance):
    representation = super().to_representation(instance)
    if 'questions' in representation and representation['questions']:
        representation['questions'] = sorted(
            representation['questions'],
            key=lambda x: x.get('order', 0)
        )
    return representation
```

2. **ListeningTestSerializer** (lines 1702-1709):
```python
def to_representation(self, instance):
    representation = super().to_representation(instance)
    if 'parts' in representation and representation['parts']:
        representation['parts'] = sorted(
            representation['parts'],
            key=lambda x: x.get('part_number', 0)
        )
    return representation
```

### Files Modified
- `backend/core/serializers.py` - Added `to_representation` to `ListeningPartWriteSerializer` and `ListeningTestSerializer`

### Technical Details
- Parts are now sorted by `part_number` field
- Questions within each part are sorted by `order` field
- This ensures consistent ordering regardless of database insertion order
- The sorting happens during serialization, so it doesn't affect the update logic
## 2025-11-10 - Added Speaking Mentor Role

### Problem
Needed a dedicated role that can conduct speaking assessments for every student without being limited by group assignments while keeping other teacher-only features restricted.

### Solution Implemented
- Added `speaking_mentor` to `User.role` choices.
- Updated `get_teacher_from_request` to accept allowed roles and attach the authenticated user to the request for serializer checks.
- Relaxed speaking views to allow mentors to list all students and sessions, create sessions for any student, and open/update session details that belong to other teachers.
- Allowed `SpeakingSessionCreateSerializer` to skip the ownership validation when the requester is a mentor.
- Updated React routing and navigation to recognize the new role, redirect mentors to the speaking dashboard, format the role label, and show “All Students” on the speaking page for mentors.

### Files Modified
- `backend/core/models.py`
- `backend/core/views.py`
- `backend/core/serializers.py`
- `frontend/src/App.js`
- `frontend/src/components/Navbar.js`
- `frontend/src/components/Navbar — копия.js`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/components/SidebarUpdated.jsx`
- `frontend/src/components/SidebarOld.jsx`
- `frontend/src/pages/TeacherSpeakingPage.js`
- `frontend/src/pages/LoginPage.js`

### Result
Speaking mentors can log in, view every student and speaking session, start new assessments for any student, and manage session data while standard teachers remain limited to their assigned cohorts.

## 2025-11-10 - Speaking Mentor Test Account Guidance

### Context
The user asked for instructions to create a test `speaking_mentor` account to verify the new role’s capabilities.

### Notes Shared
- Suggested using Django shell (or any user management flow) to create a `User` with `role='speaking_mentor'`, for example:
  ```python
  from core.models import User
  mentor, created = User.objects.get_or_create(
      uid='speaking-mentor-demo',
      defaults={
          'role': 'speaking_mentor',
          'email': 'mentor-demo@ielts.local',
          'first_name': 'Speaking',
          'last_name': 'Mentor',
          'password': 'hashed-via-set_password'
      }
  )
  if created:
      mentor.set_password('TempPass123!')
      mentor.save()
  ```
- Reminded to register corresponding Firebase auth (if required) and map the same UID so login works.
- After login, the mentor should see all speaking students/sessions and be able to manage any session.

## 2025-11-10 - Mentor Login Troubleshooting

### Problem
User could not log into `speaking-mentor-demo`; initial attempt failed because `student_id` was missing, then Firebase returned `INVALID_LOGIN_CREDENTIALS`.

### Guidance Provided
- Set `student_id`, `first_name`, `last_name` for the user so `/get-email-by-sid/` resolves correctly.
- Explained that Firebase still needs a user with matching UID/email/password; otherwise Firebase login will fail even if Django user exists.
- Suggested creating a user (e.g., `speakingtest` / `123123`) via Firebase first, then in Django create/update a `User` using the same `uid`/email so the frontend flow succeeds.

## 2025-11-10 - Scripted Mentor Account Creation

### Scenario
User requested a one-shot Python-shell recipe that creates the Firebase auth record and the Django user simultaneously, so no manual work in Firebase Console is required.

### Script Shared
```python
from firebase_admin import auth as firebase_auth
from core.models import User

uid = 'speakingtest'
email = 'speakingtest@ielts.local'
password = '123123'

try:
    firebase_auth.get_user(uid)
except firebase_auth.UserNotFoundError:
    firebase_auth.create_user(uid=uid, email=email, password=password)

mentor, _ = User.objects.update_or_create(
    uid=uid,
    defaults={
        'role': 'speaking_mentor',
        'student_id': 'speakingtest',
        'email': email,
        'first_name': 'Speaking',
        'last_name': 'Mentor',
        'is_active': True,
    },
)
mentor.set_password(password)
mentor.save()
```

### Notes
- Script is idempotent; rerun safely.
- Removes manual Firebase console dependency.
- After running, logging in with `speakingtest` / `123123` lands on the Speaking mentor dashboard.

## 2025-11-10 - Server Mentor Account (Aitole / 103106)

### Request
Create a new speaking mentor account on the server with login `Aitole`, password `103106`.

### Steps Shared
```python
import core.firebase_config
from firebase_admin import auth as firebase_auth
from core.models import User

uid = 'aitole'
email = 'aitole@ielts.local'
password = '103106'

try:
    existing = firebase_auth.get_user_by_email(email)
    firebase_auth.delete_user(existing.uid)
except firebase_auth.UserNotFoundError:
    pass

firebase_auth.create_user(uid=uid, email=email, password=password)

User.objects.exclude(uid=uid).filter(email=email).delete()
mentor, _ = User.objects.update_or_create(
    uid=uid,
    defaults={
        'role': 'speaking_mentor',
        'student_id': 'aitole',
        'email': email,
        'first_name': 'Aitole',
        'last_name': '',
        'is_active': True,
    },
)
mentor.set_password(password)
mentor.save()
print('Mentor ready:', mentor.id, mentor.role)
```

### Outcome
Account logs in with Student ID `aitole`, password `103106`, lands on Speaking Assessment with mentor permissions.

## 2025-11-10 - Question-Level Image Upload Adjustments

### Problem
Listening and Reading admin builders allowed managing images for sections, passages, and individual answer options, while the updated requirement was to support a single optional image per question only.

### Solution Implemented
- **Backend (`backend/core/models.py`, `backend/core/serializers.py`):** Removed ImageField columns from listening/reading answer options and reading passages, kept question-level ImageField support, and simplified serializers to accept only per-question images via `image_base64`/`image_remove` flags.
- **Listening Admin Builder (`frontend/src/components/AdminListeningTestBuilder.jsx`):** Pruned option-level upload UI, ensured payload only carries question-level image metadata, and kept existing audio handling untouched.
- **Reading Admin Builder (`frontend/src/components/AdminReadingTestBuilder.jsx`):** Added base64 upload workflow for a single question image with preview/removal controls, normalized question state on load/open, and transformed payloads to send only `image_url`/`image_base64` for questions.

### Result
Admin tools now align with the requirement of one optional image per question across Listening and Reading without persisting or exposing image slots for passages or answer options.

### Follow-up
- 2025-11-10: Added `image_base64` to `ListeningQuestionSerializer.fields` to fix `/api/listening-tests/` list assertion after question-only image change.

### 2025-11-10 - Listening/Reading Task Prompts and Gap Fill HTML
- добавил поле `task_prompt` в `ListeningQuestion`/`ReadingQuestion`, обновил сериализаторы и миграции
- в админ-билдерах Listening/Reading появилась форма для сабхедера, состояние/трансформации передают новое поле
- игроки Listening/Reading выводят сабхедер и рендерят текст gap fill с HTML-тегами, inputs остаются интерактивными

## 2025-11-15 - Fixed Listening Question Image Upload Not Saving

### Problem
Images uploaded to Listening questions were not being saved properly. The error showed a 404 with double `media/media/` in the URL path, indicating either:
- Files were not being saved to disk
- URL generation was incorrect (double MEDIA_URL prefix)

### Root Causes
1. **URL generation issue**: `to_representation` methods in `ListeningQuestionSerializer` and `ListeningQuestionWriteSerializer` used `instance.image_file.url` directly without checking if URL already contains MEDIA_URL, potentially causing double prefix
2. **File save logic**: In `ListeningTestSerializer.update()`, image_file was set after initial `question.save()`, but the logic didn't properly handle all cases (create vs update, base64 vs file upload, removal)

### Solution Implemented
1. **Fixed URL generation in to_representation**:
   - Added check to prevent double MEDIA_URL prefix
   - Used `default_storage.url()` as fallback if `image_file.url` doesn't start with MEDIA_URL
   - Applied to both `ListeningQuestionSerializer` and `ListeningQuestionWriteSerializer`

2. **Fixed file save logic in update() method**:
   - Introduced `should_update_image` flag to track when image needs updating
   - Properly handle all cases: base64 upload, file upload, removal (None), and no change (serializers.empty)
   - Set `image_file` before or during `save()` to ensure file is persisted

3. **Fixed file save logic in create() method**:
   - Applied same logic improvements as update() method
   - Ensure new questions get their image_file set correctly on creation

### Files Modified
- `backend/core/serializers.py` - Fixed URL generation and file save logic in ListeningQuestion serializers

### Result
- ✅ Images are now properly saved to disk when uploaded via base64
- ✅ URLs are correctly generated without double MEDIA_URL prefix
- ✅ Image removal works correctly (sets image_file to None)
- ✅ Both create and update operations handle images correctly

### 2025-11-10 - Multiple Choice Blocks for Listening/Reading
- бэкенд: в `create_detailed_breakdown` добавлен тип `multiple_choice_group`, каждая подпозиция использует `extra_data.group_items`, учитываем индивидуальные баллы и поддерживаем как вложенные ответы, так и ключи `questionId__itemId`
- админ-билдеры Listening/Reading: тип вопросов `Multiple Choice (Group)` с редактором блоков (подзадания, опции, баллы, правильные ответы), трансформация теста суммирует баллы и отправляет `extra_data.group_items`
- плееры Listening/Reading: выводят новый блок радиокнопок по подпунктам, сохраняют ответы в nested структуре и отображают выбранные варианты студенту

## 2025-11-15 - Restoring Listening Diagnostic via Docker

### Context
- User restored server access and needed to reimport `restore_listening_diagnostic.py` plus its JSON payload into the running `web` container.
- Guided them to copy files with `docker compose cp backend/restore_listening_diagnostic.py web:/app/backend/` and the JSON companion file.
- Clarified the JSON lives under `docs/diagnostic_listening_test.json` locally, so the copy command must reference that path (or move the file under `backend/` first).
- Instructed to run the script with `docker compose exec -w /app/backend web python restore_listening_diagnostic.py` (or provide an absolute path) so Django picks up `DJANGO_SETTINGS_MODULE=ielts_platform.settings`.
- Explained the `ModuleNotFoundError: No module named 'ielts_platform'` happens when running from the wrong working directory or missing PYTHONPATH, and how `-w /app/backend` fixes it.
- Recommended adding `- ./backend:/app/backend` to the `web` service volumes to avoid manual copies in future and keep server code hot-reloadable.

### Follow-up
- After several attempts with direct `python` invocations failing due to settings not loading, ran the restore logic inside `manage.py shell` to guarantee Django config.
- Command used:
  ```
  docker compose exec -T -w /app web python manage.py shell <<'PY'
  ...restore script...
  PY
  ```
- Shell reported `Done 28`, confirming the diagnostic test rebuilt successfully inside the container.

## 2025-11-15 - Fixed Listening Test Save/Update Logic and Removed Manual Reordering

### Problem
After the initial sorting fixes, additional issues were discovered:
- Frontend was not sending `part.id` when saving tests, causing backend to incorrectly identify existing parts
- Backend `update()` method was using `part_number` for identification instead of `part.id`
- Backend was not updating `part_number` when parts were reordered (line 1809: `if attr != 'part_number':`)
- Manual reordering buttons (`moveQuestionUp`, `moveQuestionDown`, `moveQuestionToSection`) were causing confusion and problems

### Root Causes

#### 1. Frontend not sending part.id
**File:** `frontend/src/components/AdminListeningTestBuilder.jsx` (line 1686-1687)
- `transformTestForAPI` was only sending `part_number: partIdx + 1` based on array index
- Did not include `part.id` for existing parts
- Result: Backend couldn't identify which parts were being updated vs created

#### 2. Backend using part_number for identification
**File:** `backend/core/serializers.py` (line 1799-1806)
- `existing_parts = {p.part_number: p for p in instance.parts.all()}`
- Used `get_or_create(part_number=part_number, ...)` to find existing parts
- Problem: If parts were reordered, `part_number` would change, causing backend to create duplicates instead of updating

#### 3. Backend not updating part_number
**File:** `backend/core/serializers.py` (line 1809)
- `if attr != 'part_number':` - explicitly skipped updating `part_number`
- Result: When parts were reordered in frontend, their `part_number` remained old

#### 4. Manual reordering buttons causing issues
**File:** `frontend/src/components/AdminListeningTestBuilder.jsx` (lines 2253-2281)
- Functions `moveQuestionUp`, `moveQuestionDown`, `moveQuestionToSection` allowed manual reordering
- These functions manipulated local state but didn't align with save logic
- User reported these buttons were causing problems and requested removal

### Solution Implemented

#### 1. Frontend: Added part.id to transformTestForAPI
**File:** `frontend/src/components/AdminListeningTestBuilder.jsx` (line 1687)
```javascript
parts: test.parts.map((part, partIdx) => ({
  ...(part.id ? { id: part.id } : {}),
  part_number: partIdx + 1,
  // ... other fields
}))
```
- Now sends `part.id` for existing parts
- New parts (without `id`) will be created by backend

#### 2. Backend: Changed to use part.id for identification
**File:** `backend/core/serializers.py` (lines 1799-1816)
- Changed `existing_parts` dictionary: `{p.part_number: p}` → `{p.id: p}`
- Changed lookup logic: Use `part_id = part_data.get('id')` to find existing parts
- If `part_id` exists and found in `existing_parts`, update the part
- If not found or no `part_id`, create new part
- Now updates `part_number` correctly when parts are reordered

#### 3. Backend: Removed part_number update restriction
**File:** `backend/core/serializers.py` (line 1811-1812)
- Removed `if attr != 'part_number':` check
- Now updates all fields including `part_number` when part is found by ID
- Ensures `part_number` reflects the order in the array sent from frontend

#### 4. Frontend: Removed manual reordering functions and buttons
**File:** `frontend/src/components/AdminListeningTestBuilder.jsx`
- Removed `moveQuestionUp`, `moveQuestionDown`, `moveQuestionToSection` functions (lines 2253-2281)
- Removed up/down arrow buttons and section dropdown from question list UI (lines 2410-2423)
- Order is now determined solely by array position when saving

### Files Modified
- `frontend/src/components/AdminListeningTestBuilder.jsx` - Added `part.id` to API payload, removed reordering functions and UI
- `backend/core/serializers.py` - Changed part identification from `part_number` to `part.id`, removed `part_number` update restriction

### Result
- ✅ Parts correctly identified by `id` during updates
- ✅ `part_number` correctly updated when parts are reordered
- ✅ No duplicate parts created when saving reordered tests
- ✅ Manual reordering buttons removed, preventing user confusion
- ✅ Order determined by array position in frontend, correctly saved to backend
- ✅ Simplified logic: drag-and-drop or array manipulation determines order, not manual buttons

### Technical Details
- Frontend sends `part.id` when it exists (existing parts)
- Backend uses `part.id` as primary identifier for finding existing parts
- `part_number` is always updated to match array index from frontend
- New parts (without `id`) are created with correct `part_number`
- Deletion logic uses `sent_part_ids` set to track which parts should remain

## 2025-11-15 - Complete Audit: Listening Test Sorting (Student & Admin)

### Audit Scope
Comprehensive audit of all Listening test functionality for both student and admin interfaces to verify correct sorting and ordering of parts and questions.

### Areas Audited

#### 1. Backend Serializers ✅
- **ListeningTestReadSerializer** (line 1708-1723): ✅ Has `to_representation` sorting parts by `part_number`
- **ListeningPartSerializer** (line 1627-1654): ✅ Has `to_representation` sorting questions by `order`
- **ListeningTestSerializer** (line 1726-1874): ✅ Has `to_representation` sorting parts by `part_number`
- **ListeningPartWriteSerializer** (line 1690-1705): ✅ Has `to_representation` sorting questions by `order`
- **get_test_render_structure** (line 850-877): ✅ Correctly sorts parts by `part_number` and questions by `order` for listening
- **create_detailed_breakdown** (line 270-290): ✅ Correctly sorts parts by `part_number` and questions by `order`

#### 2. Backend Views ✅
- **ListeningTestViewSet** (line 2124-2157): ✅ Uses `ListeningTestReadSerializer` for list/retrieve
- **ListeningPartViewSet** (line 2249-2252): ✅ Queryset sorted by `('test', 'part_number')`
- **ListeningQuestionViewSet** (line 2255-2258): ✅ Queryset sorted by `('part', 'order')`
- **StartListeningTestView** (line 1979-2026): ✅ **FIXED** - Changed from non-existent `ListeningTestFullSerializer` to `ListeningTestReadSerializer`
- **ListeningTestDetailView** (line 1968-1976): ✅ Uses `ListeningTestSerializer` (which uses read serializer for GET)

#### 3. Frontend Admin Builder ✅
- **AdminListeningTestBuilder** (line 94-176): ✅ `normalizeTestFromAPI` preserves array order (uses `.map()` which maintains order)
- **transformTestForAPI** (line 1682-1918): ✅ Sends `part.id` for existing parts, `part_number` based on array index
- **loadExistingTest** (line 202-213): ✅ Uses `ListeningTestReadSerializer` via GET `/listening-tests/{id}/`

#### 4. Frontend Student Player ✅
- **ListeningTestPlayer** (line 127-144): ✅ `loadTest` uses GET `/listening-tests/{id}/` which returns sorted data
- **normalizeQuestions** (line 106-125): ✅ Preserves array order (uses `.map()`)
- **Question rendering** (line 400-766): ✅ Renders questions in order received from API

#### 5. Frontend Results Page ✅
- **ListeningResultPage** (line 81-101): ✅ Renders breakdown in order received from API
- **renderBreakdown** (line 86-100): ✅ Uses `detailed_breakdown` array order from backend

### Issues Found and Fixed

#### Issue 1: Non-existent Serializer Used
**File:** `backend/core/views.py` (line 2007)
- **Problem:** `StartListeningTestView` was importing and using `ListeningTestFullSerializer` which doesn't exist
- **Impact:** Would cause `ImportError` when starting a listening test session
- **Fix:** Changed to use `ListeningTestReadSerializer` which is the correct serializer for reading test data
- **Status:** ✅ Fixed

### Verification Results

✅ **Backend Sorting:**
- All serializers have proper `to_representation` methods with sorting
- All querysets have explicit `.order_by()` clauses
- `get_test_render_structure` correctly handles listening vs reading differences
- `create_detailed_breakdown` correctly sorts parts and questions

✅ **Frontend Data Handling:**
- Admin builder preserves order when loading and saving
- Student player receives and displays data in correct order
- Results page displays breakdown in correct order
- All `.map()` operations preserve array order

✅ **API Endpoints:**
- GET `/listening-tests/` - Returns sorted tests
- GET `/listening-tests/{id}/` - Returns sorted test with sorted parts and questions
- POST `/listening-tests/{id}/start/` - Returns sorted test data
- All endpoints use correct serializers with sorting

### Files Verified
- `backend/core/serializers.py` - All serializers checked
- `backend/core/views.py` - All views checked
- `frontend/src/components/AdminListeningTestBuilder.jsx` - Admin interface checked
- `frontend/src/components/ListeningTestPlayer.jsx` - Student player checked
- `frontend/src/pages/ListeningResultPage.js` - Results page checked

### Conclusion
All sorting and ordering logic is correctly implemented throughout the Listening test system. The only issue found was the non-existent serializer import, which has been fixed. All parts and questions are consistently sorted by `part_number` and `order` respectively at all levels (database queries, serialization, and frontend rendering).

## 2025-11-23 - Curator weekly overview refactor

### Summary
- Added backend endpoint `CuratorWeeklyOverviewView` with `/api/curator/weekly-overview/` that aggregates Listening/Reading/Writing results per student and then by group or teacher, using only teacher_overall_score for Writing.
- The endpoint supports filters for group, teacher, specific test IDs, and date range, and returns per-student module statuses plus an overall band calculated from available L/R/W bands.
- Implemented new React page `CuratorWeeklyOverviewPage` that calls this endpoint, shows unified weekly results on a single screen with mode toggle (groups/teachers), summary cards, and expandable rows revealing students with L/R/W/overall bands; Writing cells show “ещё не выставлен” when teacher score is pending.
- Updated `CuratorDashboard` to render `CuratorWeeklyOverviewPage` so existing `/curator/dashboard` navigation now opens the new unified weekly view without changing routes.

### Follow-up
- Fixed Django URL config error by adding `CuratorStudentDetailView` to the imports list in `backend/core/urls.py` so the existing `curator/student-detail/<int:student_id>/` route resolves correctly when running the server.
- Fixed subsequent URL config error by importing `CuratorMissingTestsView` into `backend/core/urls.py` to match the existing `curator/missing-tests/` route.
- Updated `CuratorMissingTestsView` to consider only writing/listening/reading modules (speaking removed) and wired `StudentsMissingTestsWidget` into the new `CuratorWeeklyOverviewPage` so curators see missing tests directly on the main dashboard.
- Extended `CuratorWeeklyOverviewView` to expose per-student latest writing session/essay IDs and added a “By students” mode plus clickable writing cells in `CuratorWeeklyOverviewPage` that navigate to `/writing-result/<sessionId>` for quick essay inspection.
- Refined curator dashboard UX/UI: `CuratorWeeklyOverviewPage` now has a compact header with mode pills (By students/groups/teachers), a two-row filter card (Group/Teacher/Writing and Listening/Reading/Period), summary cards plus a side `StudentsMissingTestsWidget`, a clean main student table with L/R/W/overall columns, and simplified group/teacher views without nested expanders. Restored `Speaking` link in curator sidebar and mobile navbar.

## 2025-11-21 - Listening task prompt size question

### Summary
- Reviewed `ListeningTestPlayer.jsx` to understand how the `task_prompt` (subheader) is rendered.
- Confirmed the block uses `font-semibold text-gray-900` without an explicitly larger text size.
- Increased the `task_prompt` block to use `text-xl text-black font-semibold text-center` so it matches the question header height-wise, centers within the card, and uses solid black for stronger contrast.
- Applied identical styling (`font-semibold text-xl text-black text-center`) to the `task_prompt` in `ReadingTestPlayer.jsx` so the Reading subheader matches Listening.
- Added `whitespace-pre-line` to the gap-fill container in `ReadingTestPlayer.jsx` so spaces/line breaks in question text remain visible instead of being collapsed into a single line.
