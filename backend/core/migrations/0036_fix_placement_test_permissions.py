# Fix duplicate permissions for Placement Test models

from django.db import migrations


def fix_placement_test_permissions(apps, schema_editor):
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
        
        Permission.objects.using(db_alias).filter(
            content_type=content_type
        ).delete()
        
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


def reverse_fix_permissions(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0035_populate_placement_test_questions'),
        ('contenttypes', '0002_remove_content_type_name'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(fix_placement_test_permissions, reverse_fix_permissions),
    ]

