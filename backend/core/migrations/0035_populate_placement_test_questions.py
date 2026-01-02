# Generated manually - Populate Placement Test with 20 questions

from django.db import migrations


def populate_placement_questions(apps, schema_editor):
    """Add 20 placement test questions with correct answers"""
    PlacementTestQuestion = apps.get_model('core', 'PlacementTestQuestion')
    
    questions = [
        {
            'order': 1,
            'question_text': "Carl's very ........ . He's never late, and he never forgets to do things.",
            'option_a': 'reliable',
            'option_b': 'patient',
            'option_c': 'strict',
            'option_d': 'nice',
            'correct_answer': 'A'
        },
        {
            'order': 2,
            'question_text': "Not until the 1980s ........ for the average person to own a computer.",
            'option_a': 'it was possible',
            'option_b': 'was it possible',
            'option_c': 'was possible',
            'option_d': 'possible it was',
            'correct_answer': 'B'
        },
        {
            'order': 3,
            'question_text': "Tomorrow's a holiday, so we ........ go to work.",
            'option_a': 'have to',
            'option_b': "mustn't",
            'option_c': "don't have to",
            'option_d': "can't",
            'correct_answer': 'C'
        },
        {
            'order': 4,
            'question_text': "If I ........ well in my exams, I ........ to university.",
            'option_a': 'will do; will go',
            'option_b': 'will do; go',
            'option_c': 'do; will go',
            'option_d': 'do; go',
            'correct_answer': 'C'
        },
        {
            'order': 5,
            'question_text': "Where did you go ........ holiday last year?",
            'option_a': 'for',
            'option_b': 'on',
            'option_c': 'to',
            'option_d': 'from',
            'correct_answer': 'A'
        },
        {
            'order': 6,
            'question_text': "Criminals are people who are guilty of ........ the law.",
            'option_a': 'breaking',
            'option_b': 'cheating',
            'option_c': 'punishing',
            'option_d': 'committing',
            'correct_answer': 'A'
        },
        {
            'order': 7,
            'question_text': "Why on earth isn't Josh here yet? ........ for him for over an hour!",
            'option_a': "I'm waiting",
            'option_b': "I've been waiting",
            'option_c': "I've waited",
            'option_d': "I'd been waiting",
            'correct_answer': 'B'
        },
        {
            'order': 8,
            'question_text': "I've been working here ........ about the last two years.",
            'option_a': 'during',
            'option_b': 'for',
            'option_c': 'since',
            'option_d': '- (no preposition)',
            'correct_answer': 'B'
        },
        {
            'order': 9,
            'question_text': "The report ___ by experts before it was published.",
            'option_a': 'reviews',
            'option_b': 'was reviewed',
            'option_c': 'has reviewed',
            'option_d': 'is reviewing',
            'correct_answer': 'B'
        },
        {
            'order': 10,
            'question_text': "Many people believe that social media ___ an important role in forming public opinion.",
            'option_a': 'play',
            'option_b': 'has played',
            'option_c': 'is playing',
            'option_d': 'plays',
            'correct_answer': 'D'
        },
        {
            'order': 11,
            'question_text': "The number of students who ___ in online courses has increased a lot.",
            'option_a': 'enrolling',
            'option_b': 'enrolled',
            'option_c': 'enroll',
            'option_d': 'enrolls',
            'correct_answer': 'C'
        },
        {
            'order': 12,
            'question_text': "This policy is aimed ___ reducing unemployment among young people.",
            'option_a': 'for',
            'option_b': 'to',
            'option_c': 'at',
            'option_d': 'on',
            'correct_answer': 'C'
        },
        {
            'order': 13,
            'question_text': 'The word "significant" in academic texts most nearly means:',
            'option_a': 'famous',
            'option_b': 'important',
            'option_c': 'large',
            'option_d': 'easy to see',
            'correct_answer': 'B'
        },
        {
            'order': 14,
            'question_text': 'Which word means "to start dealing with a problem"?',
            'option_a': 'impact',
            'option_b': 'address',
            'option_c': 'advance',
            'option_d': 'avoid',
            'correct_answer': 'B'
        },
        {
            'order': 15,
            'question_text': 'In the sentence "Internet access is widespread in many countries", the word "widespread" means:',
            'option_a': 'found in many places',
            'option_b': 'expensive',
            'option_c': 'increasing quickly',
            'option_d': 'difficult to control',
            'correct_answer': 'A'
        },
        {
            'order': 16,
            'question_text': 'Choose the best word to connect the ideas. The policy is expensive. ___ it may bring benefits in the future.',
            'option_a': 'Because',
            'option_b': 'Therefore',
            'option_c': 'However',
            'option_d': 'As a result',
            'correct_answer': 'C'
        },
        {
            'order': 17,
            'question_text': 'In academic texts, the phrase "tends to" most often means:',
            'option_a': 'happens all the time',
            'option_b': 'never happens',
            'option_c': 'is likely to happen',
            'option_d': 'happened only once',
            'correct_answer': 'C'
        },
        {
            'order': 18,
            'question_text': 'If a text says "There is little evidence to support this claim", the writer is most likely:',
            'option_a': 'fully agreeing with the claim',
            'option_b': 'unsure and questioning the claim',
            'option_c': 'strongly opposing the claim',
            'option_d': 'proving the claim is true',
            'correct_answer': 'B'
        },
        {
            'order': 19,
            'question_text': 'Which word is closest in meaning to "decline"?',
            'option_a': 'improve',
            'option_b': 'fall',
            'option_c': 'remain the same',
            'option_d': 'drop',
            'correct_answer': 'B'
        },
        {
            'order': 20,
            'question_text': "When I was a child, I never ........ about the future.",
            'option_a': 'have worried',
            'option_b': 'used to worry',
            'option_c': 'was worrying',
            'option_d': 'were worrying',
            'correct_answer': 'B'
        },
    ]
    
    for q_data in questions:
        PlacementTestQuestion.objects.create(**q_data)
    
    print(f"Successfully created {len(questions)} placement test questions")


def reverse_populate_placement_questions(apps, schema_editor):
    """Remove all placement test questions"""
    PlacementTestQuestion = apps.get_model('core', 'PlacementTestQuestion')
    count = PlacementTestQuestion.objects.all().count()
    PlacementTestQuestion.objects.all().delete()
    print(f"Deleted {count} placement test questions")


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0034_placementtest_models'),
    ]

    operations = [
        migrations.RunPython(
            populate_placement_questions,
            reverse_populate_placement_questions
        ),
    ]

