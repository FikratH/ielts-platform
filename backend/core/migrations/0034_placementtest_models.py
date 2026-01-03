# Generated manually for Placement Test models

from django.db import migrations, models
from django.contrib.contenttypes.models import ContentType


def create_content_types(apps, schema_editor):
    ContentType = apps.get_model('contenttypes', 'ContentType')
    db_alias = schema_editor.connection.alias
    
    PlacementTestQuestion = apps.get_model('core', 'PlacementTestQuestion')
    PlacementTestSubmission = apps.get_model('core', 'PlacementTestSubmission')
    
    for Model in [PlacementTestQuestion, PlacementTestSubmission]:
        model_name = Model._meta.model_name
        ContentType.objects.using(db_alias).get_or_create(
            app_label='core',
            model=model_name
        )


def create_permissions_safely(apps, schema_editor):
    Permission = apps.get_model('auth', 'Permission')
    ContentType = apps.get_model('contenttypes', 'ContentType')
    db_alias = schema_editor.connection.alias
    
    PlacementTestQuestion = apps.get_model('core', 'PlacementTestQuestion')
    PlacementTestSubmission = apps.get_model('core', 'PlacementTestSubmission')
    
    for Model in [PlacementTestQuestion, PlacementTestSubmission]:
        model_name = Model._meta.model_name
        try:
            content_type = ContentType.objects.using(db_alias).get(
                app_label='core',
                model=model_name
            )
        except ContentType.DoesNotExist:
            continue
        
        permissions_data = [
            ('add', f'Can add {model_name}'),
            ('change', f'Can change {model_name}'),
            ('delete', f'Can delete {model_name}'),
            ('view', f'Can view {model_name}'),
        ]
        
        for codename_suffix, name in permissions_data:
            codename = f'{codename_suffix}_{model_name}'
            Permission.objects.using(db_alias).get_or_create(
                codename=codename,
                content_type=content_type,
                defaults={'name': name}
            )


def reverse_create_content_types(apps, schema_editor):
    pass


def reverse_create_permissions(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0033_writing_session_drafts'),
        ('contenttypes', '0002_remove_content_type_name'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='PlacementTestQuestion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField(unique=True)),
                ('question_text', models.TextField()),
                ('option_a', models.CharField(max_length=255)),
                ('option_b', models.CharField(max_length=255)),
                ('option_c', models.CharField(max_length=255)),
                ('option_d', models.CharField(max_length=255)),
                ('correct_answer', models.CharField(max_length=1, choices=[('A', 'A'), ('B', 'B'), ('C', 'C'), ('D', 'D')])),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['order'],
            },
        ),
        migrations.CreateModel(
            name='PlacementTestSubmission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('full_name', models.CharField(max_length=255)),
                ('email', models.EmailField(max_length=254)),
                ('planned_exam_date', models.CharField(max_length=50)),
                ('answers', models.JSONField(default=dict)),
                ('score', models.IntegerField(default=0)),
                ('recommendation', models.CharField(max_length=50)),
                ('submitted_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-submitted_at'],
            },
        ),
        migrations.RunPython(create_content_types, reverse_create_content_types),
        migrations.RunPython(create_permissions_safely, reverse_create_permissions),
    ]

