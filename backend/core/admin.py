from django.contrib import admin
from .models import (
    WritingPrompt, ListeningTest, ListeningPart, ListeningQuestion, 
    ListeningAnswerOption, ListeningTestSession, ListeningTestResult, 
    ListeningTestClone, TeacherSatisfactionSurvey
)

@admin.register(TeacherSatisfactionSurvey)
class TeacherSatisfactionSurveyAdmin(admin.ModelAdmin):
    list_display = ['student', 'is_satisfied', 'reason_preview', 'submitted_at_local', 'student_email']
    list_filter = ['is_satisfied', 'submitted_at']
    search_fields = ['student__email', 'student__first_name', 'student__last_name', 'reason']
    readonly_fields = ['submitted_at']
    ordering = ['-submitted_at']
    
    def student_email(self, obj):
        return obj.student.email
    student_email.short_description = 'Email'
    
    def reason_preview(self, obj):
        if obj.reason:
            return obj.reason[:50] + '...' if len(obj.reason) > 50 else obj.reason
        return 'N/A'
    reason_preview.short_description = 'Reason'
    
    def submitted_at_local(self, obj):
        from django.utils import timezone
        local_time = timezone.localtime(obj.submitted_at)
        return local_time.strftime('%Y-%m-%d %H:%M')
    submitted_at_local.short_description = 'Submitted (Local Time)'

admin.site.register(WritingPrompt)
admin.site.register(ListeningTest)
admin.site.register(ListeningPart)
admin.site.register(ListeningQuestion)
admin.site.register(ListeningAnswerOption)
admin.site.register(ListeningTestSession)
admin.site.register(ListeningTestResult)
admin.site.register(ListeningTestClone)
