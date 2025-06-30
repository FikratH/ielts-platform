from core.models import ListeningTest, ListeningAudio, ListeningSection, ListeningQuestionV2, ListeningAnswerOptionV2
from django.core.files import File

# Создание ListeningTest
listening_test = ListeningTest.objects.create(title="Demo Listening Test", description="Тест для проверки", is_active=True)

# Добавление аудиофайла
with open("media/listening_audio/ielts_listening_section_3__rec_41_www.lightaudio.ru.mp3", "rb") as f:
    ListeningAudio.objects.create(test=listening_test, audio_file=File(f, name="ielts_listening_section_3__rec_41_www.lightaudio.ru.mp3"))

# Создание секции
section = ListeningSection.objects.create(test=listening_test, part_number=1, instructions="Listen and answer the questions.", start_time=0, end_time=60)

# Создание вопроса
question = ListeningQuestionV2.objects.create(
    block=block,
    question_type="MULTIPLE_CHOICE",
    question_text="What is the main topic?",
    order=1,
    correct_answer="A",
    extra_data={}
)

# Добавление вариантов ответа
ListeningAnswerOptionV2.objects.create(question=question, label="A", text="Music")
ListeningAnswerOptionV2.objects.create(question=question, label="B", text="Art")
ListeningAnswerOptionV2.objects.create(question=question, label="C", text="Science")

print("Listening test created!") 