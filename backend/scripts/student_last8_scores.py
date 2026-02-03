from core.models import User, ReadingTestSession, ListeningTestSession

LIMIT = 8
INCLUDE_DIAGNOSTIC = False
MODE = "per_module"  # "per_module" or "combined"


def fmt(val):
    return "-" if val is None else val


students = User.objects.filter(role='student', is_active=True).order_by('group', 'student_id', 'first_name', 'last_name')

print("student_id\tname\tgroup\tmodule\tsession_id\ttest_title\tband\traw\ttotal\tcompleted_at")

for student in students:
    name = f"{student.first_name or ''} {student.last_name or ''}".strip()
    group = student.group or ''

    reading_qs = ReadingTestSession.objects.filter(user=student, completed=True)
    if not INCLUDE_DIAGNOSTIC:
        reading_qs = reading_qs.filter(is_diagnostic=False)
    reading_qs = reading_qs.select_related('result', 'test').order_by('-end_time')[:LIMIT]

    listening_qs = ListeningTestSession.objects.filter(user=student, submitted=True)
    if not INCLUDE_DIAGNOSTIC:
        listening_qs = listening_qs.filter(is_diagnostic=False)
    listening_qs = listening_qs.select_related('test', 'listeningtestresult').order_by('-completed_at')[:LIMIT]

    if MODE == "per_module":
        for s in reading_qs:
            result = getattr(s, 'result', None)
            print(f"{fmt(student.student_id)}\t{name}\t{group}\treading\t{s.id}\t{fmt(s.test.title if s.test else None)}\t{fmt(result.band_score if result else None)}\t{fmt(result.raw_score if result else None)}\t{fmt(result.total_score if result else None)}\t{fmt(s.end_time)}")
        for s in listening_qs:
            result = getattr(s, 'listeningtestresult', None)
            print(f"{fmt(student.student_id)}\t{name}\t{group}\tlistening\t{s.id}\t{fmt(s.test.title if s.test else None)}\t{fmt(result.band_score if result else None)}\t{fmt(result.raw_score if result else None)}\t{fmt(s.total_questions_count)}\t{fmt(s.completed_at)}")
    else:
        combined = []
        for s in reading_qs:
            result = getattr(s, 'result', None)
            combined.append({
                'module': 'reading',
                'session_id': s.id,
                'test_title': s.test.title if s.test else None,
                'band': result.band_score if result else None,
                'raw': result.raw_score if result else None,
                'total': result.total_score if result else None,
                'completed_at': s.end_time,
            })
        for s in listening_qs:
            result = getattr(s, 'listeningtestresult', None)
            combined.append({
                'module': 'listening',
                'session_id': s.id,
                'test_title': s.test.title if s.test else None,
                'band': result.band_score if result else None,
                'raw': result.raw_score if result else None,
                'total': s.total_questions_count,
                'completed_at': s.completed_at,
            })

        combined = sorted(combined, key=lambda x: x['completed_at'] or 0, reverse=True)[:LIMIT]
        for row in combined:
            print(f"{fmt(student.student_id)}\t{name}\t{group}\t{row['module']}\t{row['session_id']}\t{fmt(row['test_title'])}\t{fmt(row['band'])}\t{fmt(row['raw'])}\t{fmt(row['total'])}\t{fmt(row['completed_at'])}")
