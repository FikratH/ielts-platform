from django.contrib import admin
from .models import (
    WritingPrompt, ListeningTest, ListeningPart, ListeningQuestion, 
    ListeningAnswerOption, ListeningTestSession, ListeningTestResult, 
    ListeningTestClone
)

admin.site.register(WritingPrompt)
admin.site.register(ListeningTest)
admin.site.register(ListeningPart)
admin.site.register(ListeningQuestion)
admin.site.register(ListeningAnswerOption)
admin.site.register(ListeningTestSession)
admin.site.register(ListeningTestResult)
admin.site.register(ListeningTestClone)
