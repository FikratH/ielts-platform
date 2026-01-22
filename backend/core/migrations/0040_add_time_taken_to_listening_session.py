from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0039_add_last_updated_to_sessions"),
    ]

    operations = [
        migrations.AddField(
            model_name="listeningtestsession",
            name="time_taken",
            field=models.FloatField(blank=True, null=True),
        ),
    ]
