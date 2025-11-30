## Next implementation phase: student detail, missing test signals, dashboard polish

### Context
Curators need actionable views beyond the overview. We already injected time filters and documented gaps. The next critical features are:

1. **Student detail page** — full history per student, missing tests, quick actions.
2. **Missing-tests indicator** — highlight students who didn’t complete mandatory IELTS mock in the selected window.
3. **Dashboard improvements** — surface the missing-tests widget, actionable links to student detail, and wormholes to exports.

### Actions

1. **Backend: add `CuratorStudentDetailView` + helper APIs**
   - Create API view that returns:
     - base student info (group, teacher, email, assigned curators) for curator context.
     - per-module test history (score, band, status) limited to selected time range.
     - list of required tests for the selected period and whether each module/test completed.
   - Add serializer(s) to shape the above; reuse `UserSerializer` & session serializers where possible.
   - Ensure route registered (`curator/student-detail/<int:student_id>/` already mapped).
2. **Frontend: student detail page**
   - Add `CuratorStudentDetailPage` route in `App.js`, with layout:
     - summary cards (name/ID/group/teacher, current completion rates).
     - tabbed sections: Test history per module, diagnostic status, exports.
     - button to download JSON/CSV (reusing existing export endpoints OR new).
     - panel for missing tests (calls missing-tests API).
   - Link from `CuratorStudentsPage` rows or `data.detailed_tests` tables to detail page.
3. **Missing-tests API + widget**
   - Create `CuratorMissingTestsView` returning list of students with zero submissions per module within range.
   - Optionally include counts for each module and earliest missing date.
   - Build `StudentsMissingTestsWidget` component that fetches this API, shows top offenders, and links to detail page.
   - Place widget on dashboard (top right near export button), and optionally add as callout on students page.
4. **Dashboard polish**
   - Rework `CuratorDashboard` layout: introduce cards grouping KPIs, highlight missing-tests widget, add quick actions (export, student detail quick search).
   - Ensure time-range filter sits near actions.
5. **Exports + sorts**
   - Add client-side table sorting/links by wrapping tables in clickable/tr clickable components.
   - Add per-student export (maybe reuse missing-tests API to create CSV).

This doc ties to `docs/curator-audit.md` findings and will serve as a reference while implementing features.

