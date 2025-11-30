import json
import os
from pathlib import Path

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from django.db import transaction

from core.models import ListeningAnswerOption, ListeningPart, ListeningQuestion, ListeningTest

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "diagnostic_listening_test.json"


def load_data():
    with DATA_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def create_option(question, option_data, fallback_index):
    label = option_data.get("label") or option_data.get("id") or chr(65 + fallback_index)
    ListeningAnswerOption.objects.create(
        question=question,
        label=label,
        text=option_data.get("text", ""),
        points=option_data.get("points") or 1,
    )


def restore_test(data):
    parts = sorted(data.get("parts", []), key=lambda p: p.get("part_number", 0))

    ListeningTest.objects.filter(
        title=data["title"],
        is_diagnostic_template=True,
    ).delete()

    test = ListeningTest.objects.create(
        title=data["title"],
        description=data.get("description", ""),
        is_active=data.get("is_active", False),
        is_diagnostic_template=data.get("is_diagnostic_template", True),
        explanation_url=data.get("explanation_url", ""),
    )

    for part_data in parts:
        part = ListeningPart.objects.create(
            test=test,
            part_number=part_data.get("part_number", 0),
            instructions=part_data.get("instructions", ""),
            audio=part_data.get("audio"),
            audio_duration=part_data.get("audio_duration", 0.0),
        )

        for order, question_data in enumerate(part_data.get("questions", []), start=1):
            question = ListeningQuestion.objects.create(
                part=part,
                order=order,
                question_type=question_data.get("question_type"),
                question_text=question_data.get("question_text") or "",
                header=question_data.get("header", ""),
                instruction=question_data.get("instruction", ""),
                image=question_data.get("image") or "",
                extra_data=question_data.get("extra_data") or {},
                correct_answers=question_data.get("correct_answers") or [],
                points=question_data.get("points"),
                scoring_mode=question_data.get("scoring_mode", "total"),
            )

            for idx, option in enumerate(question_data.get("options") or []):
                create_option(question, option, idx)

    return test


def main():
    data = load_data()
    with transaction.atomic():
        test = restore_test(data)
    print(f"Listening diagnostic test restored (id={test.id}, title='{test.title}')")


if __name__ == "__main__":
    main()

