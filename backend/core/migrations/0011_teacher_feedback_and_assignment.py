from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_alter_listeningquestion_options'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='assigned_teacher',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='students_assigned', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(choices=[('student', 'Student'), ('teacher', 'Teacher'), ('admin', 'Admin')], max_length=20),
        ),
        migrations.CreateModel(
            name='TeacherFeedback',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('overall_feedback', models.TextField(blank=True, default='')),
                ('annotations', models.JSONField(blank=True, default=list)),
                ('published', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('essay', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='teacher_feedback', to='core.essay')),
                ('teacher', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='given_feedbacks', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]






