from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0040_add_time_taken_to_listening_session'),
    ]

    operations = [
        migrations.AddField(
            model_name='listeningtestresult',
            name='ai_feedback',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='listeningtestresult',
            name='ai_feedback_version',
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
        migrations.AddField(
            model_name='listeningtestresult',
            name='ai_feedback_updated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='readingtestresult',
            name='ai_feedback',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='readingtestresult',
            name='ai_feedback_version',
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
        migrations.AddField(
            model_name='readingtestresult',
            name='ai_feedback_updated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
