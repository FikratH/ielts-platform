from django.contrib import admin
from .models import (
    WritingPrompt, ListeningTest, ListeningPart, ListeningQuestion, 
    ListeningAnswerOption, ListeningTestSession, ListeningTestResult, 
    ListeningTestClone, TeacherSatisfactionSurvey,
    PlacementTestQuestion, PlacementTestSubmission
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


@admin.register(PlacementTestQuestion)
class PlacementTestQuestionAdmin(admin.ModelAdmin):
    list_display = ['order', 'question_preview', 'correct_answer', 'is_active', 'created_at']
    list_filter = ['is_active', 'correct_answer']
    search_fields = ['question_text', 'option_a', 'option_b', 'option_c', 'option_d']
    ordering = ['order']
    list_editable = ['is_active']
    
    fieldsets = (
        ('Question Info', {
            'fields': ('order', 'question_text', 'is_active')
        }),
        ('Options', {
            'fields': ('option_a', 'option_b', 'option_c', 'option_d')
        }),
        ('Answer', {
            'fields': ('correct_answer',)
        }),
    )
    
    def question_preview(self, obj):
        return obj.question_text[:60] + '...' if len(obj.question_text) > 60 else obj.question_text
    question_preview.short_description = 'Question'


@admin.register(PlacementTestSubmission)
class PlacementTestSubmissionAdmin(admin.ModelAdmin):
    list_display = ['submitted_at_local', 'full_name', 'email', 'score', 'recommendation', 'planned_exam_date']
    list_filter = ['recommendation', 'planned_exam_date', 'submitted_at']
    search_fields = ['full_name', 'email']
    readonly_fields = ['submitted_at', 'answers', 'score', 'recommendation']
    ordering = ['-submitted_at']
    
    fieldsets = (
        ('Personal Info', {
            'fields': ('full_name', 'email', 'planned_exam_date')
        }),
        ('Test Results', {
            'fields': ('score', 'recommendation', 'submitted_at')
        }),
        ('Answers', {
            'fields': ('answers',),
            'classes': ('collapse',)
        }),
    )
    
    def submitted_at_local(self, obj):
        from django.utils import timezone
        local_time = timezone.localtime(obj.submitted_at)
        return local_time.strftime('%Y-%m-%d %H:%M')
    submitted_at_local.short_description = 'Submitted'
    submitted_at_local.admin_order_field = 'submitted_at'
