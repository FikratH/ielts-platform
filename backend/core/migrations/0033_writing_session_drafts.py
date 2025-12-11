from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0032_listeningquestion_task_prompt_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='writingtestsession',
            name='task1_draft',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='writingtestsession',
            name='task2_draft',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='writingtestsession',
            name='time_left_seconds',
            field=models.PositiveIntegerField(default=3600),
        ),
    ]

