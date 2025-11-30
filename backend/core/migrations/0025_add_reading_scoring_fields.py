# Generated manually for Reading multiple response scoring fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0024_remove_essay_teacher_feedback_published_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='readingquestion',
            name='reading_scoring_type',
            field=models.CharField(
                choices=[
                    ('all_or_nothing', 'All or Nothing (1 балл за весь вопрос)'),
                    ('per_correct_option', 'Per Correct Option (баллы за каждый правильный)')
                ],
                default='all_or_nothing',
                help_text='Режим подсчета баллов для Reading multiple_response',
                max_length=20
            ),
        ),
        migrations.AddField(
            model_name='readingansweroption',
            name='reading_points',
            field=models.PositiveIntegerField(
                default=1,
                help_text='Баллы за эту опцию в режиме per_correct_option'
            ),
        ),
    ]
