from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0038_placementtestsubmission_phone_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="listeningtestsession",
            name="last_updated",
            field=models.DateTimeField(
                auto_now=True,
                default=django.utils.timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="readingtestsession",
            name="last_updated",
            field=models.DateTimeField(
                auto_now=True,
                default=django.utils.timezone.now,
            ),
            preserve_default=False,
        ),
    ]
