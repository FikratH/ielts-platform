from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField, AdminPasswordChangeForm
from django import forms
from django.contrib import messages
import firebase_admin
from firebase_admin import auth as firebase_auth
from .models import (
    User, WritingPrompt, ListeningTest, ListeningPart, ListeningQuestion, 
    ListeningAnswerOption, ListeningTestSession, ListeningTestResult, 
    ListeningTestClone, TeacherSatisfactionSurvey,
    PlacementTestQuestion, PlacementTestSubmission
)

class UserCreationForm(forms.ModelForm):
    password1 = forms.CharField(label='Password', widget=forms.PasswordInput)
    password2 = forms.CharField(label='Password confirmation', widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ('role', 'email', 'first_name', 'last_name', 'student_id', 'curator_id')

    def clean_password2(self):
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError("Passwords don't match")
        return password2

    def save(self, commit=True):
        password = self.cleaned_data["password1"]
        
        try:
            firebase_user = firebase_auth.create_user(
                email=self.cleaned_data['email'],
                password=password,
                display_name=f"{self.cleaned_data.get('first_name', '') or ''} {self.cleaned_data.get('last_name', '') or ''}".strip(),
            )
        except Exception as e:
            raise forms.ValidationError(f"Failed to create Firebase user: {str(e)}")
        
        user = super().save(commit=False)
        user.uid = firebase_user.uid
        user.set_password(password)
        
        if commit:
            user.save()
        return user

class UserChangeForm(forms.ModelForm):
    password = ReadOnlyPasswordHashField(
        label="Password",
        help_text=(
            "Raw passwords are not stored, so there is no way to see this "
            "user's password, but you can change the password using "
            "<a href=\"../password/\">this form</a>."
        ),
    )

    class Meta:
        model = User
        fields = ('uid', 'role', 'email', 'first_name', 'last_name', 'student_id', 
                  'curator_id', 'group', 'teacher', 'assigned_teacher', 
                  'is_active', 'is_staff', 'is_superuser')

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm

    list_display = ('uid', 'email', 'role', 'first_name', 'last_name', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_superuser', 'is_active')
    search_fields = ('uid', 'email', 'first_name', 'last_name', 'student_id')
    ordering = ('uid',)
    filter_horizontal = ()

    fieldsets = (
        (None, {'fields': ('uid', 'password')}),
        ('Personal info', {'fields': ('email', 'first_name', 'last_name')}),
        ('Role & Assignment', {'fields': ('role', 'student_id', 'curator_id', 'group', 'teacher', 'assigned_teacher')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
    )
    
    readonly_fields = ('uid',)

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('role', 'email', 'password1', 'password2'),
        }),
        ('Personal info', {
            'fields': ('first_name', 'last_name'),
        }),
        ('Role & Assignment', {
            'fields': ('student_id', 'curator_id', 'group', 'teacher', 'assigned_teacher'),
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if change:
            try:
                firebase_auth.update_user(
                    obj.uid,
                    email=obj.email,
                    display_name=f"{obj.first_name or ''} {obj.last_name or ''}".strip(),
                    disabled=not obj.is_active,
                )
            except firebase_admin._auth_utils.UserNotFoundError:
                messages.warning(request, f"User not found in Firebase (UID: {obj.uid}). Only Django database was updated.")
            except Exception as e:
                messages.error(request, f"Failed to sync with Firebase: {str(e)}")
        super().save_model(request, obj, form, change)
    
    def user_change_password(self, request, id, form_url=''):
        user = self.get_object(request, id)
        if request.method == 'POST':
            form = self.change_password_form(user, request.POST)
            if form.is_valid():
                form.save()
                password = form.cleaned_data['password1']
                try:
                    firebase_auth.update_user(
                        user.uid,
                        password=password,
                    )
                    messages.success(request, 'Password changed successfully in both Django and Firebase.')
                except firebase_admin._auth_utils.UserNotFoundError:
                    messages.warning(request, 'Password changed in Django, but user not found in Firebase.')
                except Exception as e:
                    messages.error(request, f'Password changed in Django, but Firebase sync failed: {str(e)}')
                return super().user_change_password(request, id, form_url)
        return super().user_change_password(request, id, form_url)

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
    list_display = ['submitted_at_local', 'full_name', 'grade', 'phone_number', 'email', 'score', 'recommendation', 'planned_exam_date']
    list_filter = ['recommendation', 'grade', 'planned_exam_date', 'submitted_at']
    search_fields = ['full_name', 'email', 'grade', 'phone_number']
    readonly_fields = ['submitted_at', 'answers', 'score', 'recommendation']
    ordering = ['-submitted_at']
    
    fieldsets = (
        ('Personal Info', {
            'fields': ('full_name', 'grade', 'phone_number', 'email', 'planned_exam_date')
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
