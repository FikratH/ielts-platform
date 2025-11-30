import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from core.models import ListeningTest, ListeningPart, ListeningQuestion, ListeningAnswerOption
from core.serializers import ListeningTestSerializer

print("=" * 80)
print("IMPORTING LISTENING TEST FROM DOCX")
print("=" * 80)

test_data = {
    'title': 'IELTS Listening Practice Test',
    'description': 'Complete IELTS Listening test with 40 questions',
    'is_active': True,
    'is_diagnostic_template': False,
    'explanation_url': '',
    'parts': [
        {
            'part_number': 1,
            'title': 'Part 1',
            'audio': '',
            'image': '',
            'questions': [
                {
                    'order': 1,
                    'question_type': 'gap_fill',
                    'question_text': 'Complete the notes below.\nWrite ONE WORD AND/OR A NUMBER for each answer.\n\nAdvice on family visit\n\nAccommodation\n[[1]] Hotel on George Street',
                    'header': 'Questions 1-10',
                    'instruction': 'Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.',
                    'image': '',
                    'correct_answers': ['Kings|King\'s'],
                    'extra_data': {}
                },
                {
                    'order': 2,
                    'question_type': 'gap_fill',
                    'question_text': 'cost of family room per night: £ [[2]] (approx.)',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['125|one hundred and twenty-five'],
                    'extra_data': {}
                },
                {
                    'order': 3,
                    'question_type': 'gap_fill',
                    'question_text': 'Recommended trips\na [[3]] tour of the city centre (starts in Carlton Square)',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['walking'],
                    'extra_data': {}
                },
                {
                    'order': 4,
                    'question_type': 'gap_fill',
                    'question_text': 'a trip by [[4]] to the old fort',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['boat'],
                    'extra_data': {}
                },
                {
                    'order': 5,
                    'question_type': 'gap_fill',
                    'question_text': 'Science Museum\nbest day to visit: [[5]]',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['Tuesday'],
                    'extra_data': {}
                },
                {
                    'order': 6,
                    'question_type': 'gap_fill',
                    'question_text': 'see the exhibition about [[6]] which opens soon',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['space'],
                    'extra_data': {}
                },
                {
                    'order': 7,
                    'question_type': 'gap_fill',
                    'question_text': 'Food\nClacton Market:\ngood for [[7]] food',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['vegetarian'],
                    'extra_data': {}
                },
                {
                    'order': 8,
                    'question_type': 'gap_fill',
                    'question_text': 'need to have lunch before [[8]] p.m.',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['2.30|two thirty'],
                    'extra_data': {}
                },
                {
                    'order': 9,
                    'question_type': 'gap_fill',
                    'question_text': 'Theatre tickets\nsave up to [[9]] % on ticket prices at bargaintickets.com',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['75|seventy-five'],
                    'extra_data': {}
                },
                {
                    'order': 10,
                    'question_type': 'gap_fill',
                    'question_text': 'Free activities\nBlakewell Gardens\nRoots Music Festival\nclimb Telegraph Hill to see a view of the [[10]]',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['port'],
                    'extra_data': {}
                },
            ]
        },
        {
            'part_number': 2,
            'title': 'Part 2',
            'audio': '',
            'image': '',
            'questions': [
                {
                    'order': 11,
                    'question_type': 'multiple_choice',
                    'question_text': 'Which TWO things does the speaker say about visiting the football stadium with children? (First answer)',
                    'header': 'Questions 11 and 12',
                    'instruction': 'Choose TWO letters, A-E.',
                    'image': '',
                    'correct_answers': ['B'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'Children can get their photo taken with a football player.', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': 'There is a competition for children today.', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'Parents must stay with their children at all times.', 'image': ''},
                        {'id': 'D', 'label': 'D', 'text': 'Children will need sunhats and drinks.', 'image': ''},
                        {'id': 'E', 'label': 'E', 'text': 'The café has a special offer on meals for children.', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 12,
                    'question_type': 'multiple_choice',
                    'question_text': 'Which TWO things does the speaker say about visiting the football stadium with children? (Second answer)',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['C'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'Children can get their photo taken with a football player.', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': 'There is a competition for children today.', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'Parents must stay with their children at all times.', 'image': ''},
                        {'id': 'D', 'label': 'D', 'text': 'Children will need sunhats and drinks.', 'image': ''},
                        {'id': 'E', 'label': 'E', 'text': 'The café has a special offer on meals for children.', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 13,
                    'question_type': 'multiple_choice',
                    'question_text': 'Which TWO features of the stadium tour are new this year? (First answer)',
                    'header': 'Questions 13 and 14',
                    'instruction': 'Choose TWO letters, A-E.',
                    'image': '',
                    'correct_answers': ['A'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'VIP tour', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': '360 cinema experience', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'audio guide', 'image': ''},
                        {'id': 'D', 'label': 'D', 'text': 'dressing room tour', 'image': ''},
                        {'id': 'E', 'label': 'E', 'text': 'tours in other languages', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 14,
                    'question_type': 'multiple_choice',
                    'question_text': 'Which TWO features of the stadium tour are new this year? (Second answer)',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['C'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'VIP tour', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': '360 cinema experience', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'audio guide', 'image': ''},
                        {'id': 'D', 'label': 'D', 'text': 'dressing room tour', 'image': ''},
                        {'id': 'E', 'label': 'E', 'text': 'tours in other languages', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 15,
                    'question_type': 'gap_fill',
                    'question_text': 'Which event in the history of football in the UK took place in each of the following years?\nChoose SIX answers from the box and write the correct letter, A-H.\n\nEvents in the history of football\nA the introduction of pay for the players\nB a change to the design of the goal\nC the first use of lights for matches\nD the introduction of goalkeepers\nE the first international match\nF two changes to the rules of the game\nG the introduction of fee for spectators\nH an agreement on the length of a game\n\n15 1870 [[15]]',
                    'header': 'Questions 15-20',
                    'instruction': 'Choose SIX answers from the box and write the correct letter, A-H.',
                    'image': '',
                    'correct_answers': ['D'],
                    'extra_data': {}
                },
                {
                    'order': 16,
                    'question_type': 'gap_fill',
                    'question_text': '16 1874 [[16]]',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['F'],
                    'extra_data': {}
                },
                {
                    'order': 17,
                    'question_type': 'gap_fill',
                    'question_text': '17 1875 [[17]]',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['B'],
                    'extra_data': {}
                },
                {
                    'order': 18,
                    'question_type': 'gap_fill',
                    'question_text': '18 1877 [[18]]',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['H'],
                    'extra_data': {}
                },
                {
                    'order': 19,
                    'question_type': 'gap_fill',
                    'question_text': '19 1878 [[19]]',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['C'],
                    'extra_data': {}
                },
                {
                    'order': 20,
                    'question_type': 'gap_fill',
                    'question_text': '20 1880 [[20]]',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['G'],
                    'extra_data': {}
                },
            ]
        },
        {
            'part_number': 3,
            'title': 'Part 3',
            'audio': '',
            'image': '',
            'questions': [
                {
                    'order': 21,
                    'question_type': 'multiple_choice',
                    'question_text': 'Which TWO benefits of handwriting does the woman mention? (First answer)',
                    'header': 'Questions 21 and 22',
                    'instruction': 'Choose TWO letters, A-E.',
                    'image': '',
                    'correct_answers': ['C'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'improved fine motor skills', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': 'improved memory', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'improved concentration', 'image': ''},
                        {'id': 'D', 'label': 'D', 'text': 'improved imagination', 'image': ''},
                        {'id': 'E', 'label': 'E', 'text': 'improved spatial awareness', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 22,
                    'question_type': 'multiple_choice',
                    'question_text': 'Which TWO benefits of handwriting does the woman mention? (Second answer)',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['E'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'improved fine motor skills', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': 'improved memory', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'improved concentration', 'image': ''},
                        {'id': 'D', 'label': 'D', 'text': 'improved imagination', 'image': ''},
                        {'id': 'E', 'label': 'E', 'text': 'improved spatial awareness', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 23,
                    'question_type': 'multiple_choice',
                    'question_text': 'For children with dyspraxia, which TWO problems with handwriting do the students think are easiest to correct? (First answer)',
                    'header': 'Questions 23 and 24',
                    'instruction': 'Choose TWO letters, A-E.',
                    'image': '',
                    'correct_answers': ['A'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'not spacing letters correctly', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': 'not writing in a straight line', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'applying too much pressure when writing', 'image': ''},
                        {'id': 'D', 'label': 'D', 'text': 'confusing letter shapes', 'image': ''},
                        {'id': 'E', 'label': 'E', 'text': 'writing very slowly', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 24,
                    'question_type': 'multiple_choice',
                    'question_text': 'For children with dyspraxia, which TWO problems with handwriting do the students think are easiest to correct? (Second answer)',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['C'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'not spacing letters correctly', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': 'not writing in a straight line', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'applying too much pressure when writing', 'image': ''},
                        {'id': 'D', 'label': 'D', 'text': 'confusing letter shapes', 'image': ''},
                        {'id': 'E', 'label': 'E', 'text': 'writing very slowly', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 25,
                    'question_type': 'multiple_choice',
                    'question_text': 'What does the woman say about using laptops to teach writing to children with dyslexia?',
                    'header': 'Questions 25-30',
                    'instruction': 'Choose the correct letter, A, B or C.',
                    'image': '',
                    'correct_answers': ['C'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'Children often lack motivation to learn that way.', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': 'Children become fluent relatively quickly.', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'Children react more positively if they make a mistake.', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 26,
                    'question_type': 'multiple_choice',
                    'question_text': 'When discussing whether to teach cursive or print writing, the woman thinks that',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['A'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'cursive writing disadvantages a certain group of children.', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': 'print writing is associated with lower academic performance.', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'most teachers in the UK prefer a traditional approach to handwriting.', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 27,
                    'question_type': 'multiple_choice',
                    'question_text': 'According to the students, what impact does poor handwriting have on exam performance?',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['A'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'There is evidence to suggest grades are affected by poor handwriting.', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': 'Neat handwriting is less important now than it used to be.', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'Candidates write more slowly and produce shorter answers.', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 28,
                    'question_type': 'multiple_choice',
                    'question_text': 'What prediction does the man make about the future of handwriting?',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['B'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'Touch typing will be taught before writing by hand.', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': 'Children will continue to learn to write by hand.', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'People will dislike handwriting on digital devices.', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 29,
                    'question_type': 'multiple_choice',
                    'question_text': 'The woman is concerned that relying on digital devices has made it difficult for her to',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['B'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'take detailed notes.', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': 'spell and punctuate.', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'read old documents.', 'image': ''},
                    ],
                    'extra_data': {}
                },
                {
                    'order': 30,
                    'question_type': 'multiple_choice',
                    'question_text': 'How do the students feel about their own handwriting?',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['C'],
                    'options': [
                        {'id': 'A', 'label': 'A', 'text': 'concerned they are unable to write quickly', 'image': ''},
                        {'id': 'B', 'label': 'B', 'text': 'embarrassed by comments made about it', 'image': ''},
                        {'id': 'C', 'label': 'C', 'text': 'regretful that they have lost the habit', 'image': ''},
                    ],
                    'extra_data': {}
                },
            ]
        },
        {
            'part_number': 4,
            'title': 'Part 4',
            'audio': '',
            'image': '',
            'questions': [
                {
                    'order': 31,
                    'question_type': 'gap_fill',
                    'question_text': 'Complete the notes below.\nWrite ONE WORD ONLY for each answer.\n\nResearch in the area around the Chembe Bird Sanctuary\n\nThe importance of birds of prey to the local communities\nThey destroy [[31]] and other rodents.',
                    'header': 'Questions 31-40',
                    'instruction': 'Complete the notes below. Write ONE WORD ONLY for each answer.',
                    'image': '',
                    'correct_answers': ['rats'],
                    'extra_data': {}
                },
                {
                    'order': 32,
                    'question_type': 'gap_fill',
                    'question_text': 'They help to prevent farmers from being bitten by [[32]]',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['snakes'],
                    'extra_data': {}
                },
                {
                    'order': 33,
                    'question_type': 'gap_fill',
                    'question_text': 'They have been an important part of the local culture for many years.\nThey now support the economy by encouraging [[33]] in the area.',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['tourism'],
                    'extra_data': {}
                },
                {
                    'order': 34,
                    'question_type': 'gap_fill',
                    'question_text': 'Falling numbers of birds of prey\nThe birds may be accidentally killed\nby [[34]] when they are hunting or sleeping',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['traffic'],
                    'extra_data': {}
                },
                {
                    'order': 35,
                    'question_type': 'gap_fill',
                    'question_text': 'by electrocution from contact with power lines, especially at times when there is a lot of [[35]]',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['rain'],
                    'extra_data': {}
                },
                {
                    'order': 36,
                    'question_type': 'gap_fill',
                    'question_text': 'Local farmers may illegally shoot them or [[36]] them.',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['poison'],
                    'extra_data': {}
                },
                {
                    'order': 37,
                    'question_type': 'gap_fill',
                    'question_text': 'Ways of protecting chickens from birds of prey\nclearing away vegetation from the area (unhelpful)\nproviding a [[37]] for chickens (expensive)',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['building'],
                    'extra_data': {}
                },
                {
                    'order': 38,
                    'question_type': 'gap_fill',
                    'question_text': 'frightening birds of prey by\nkeeping a [[38]]',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['dog'],
                    'extra_data': {}
                },
                {
                    'order': 39,
                    'question_type': 'gap_fill',
                    'question_text': 'making a [[39]] - e.g. with metal objects',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['noise'],
                    'extra_data': {}
                },
                {
                    'order': 40,
                    'question_type': 'gap_fill',
                    'question_text': 'A [[40]] of methods is usually most effective.',
                    'header': '',
                    'instruction': '',
                    'image': '',
                    'correct_answers': ['combination'],
                    'extra_data': {}
                },
            ]
        }
    ]
}

print("\nCreating Listening Test...")
print("-" * 80)

serializer = ListeningTestSerializer(data=test_data)
if serializer.is_valid():
    test = serializer.save()
    print(f"[OK] Test created successfully!")
    print(f"  ID: {test.id}")
    print(f"  Title: {test.title}")
    print(f"  Total Parts: {test.parts.count()}")
    
    total_questions = 0
    for part in test.parts.all().order_by('part_number'):
        q_count = part.questions.count()
        total_questions += q_count
        print(f"  Part {part.part_number}: {q_count} questions")
        
        for q in part.questions.all().order_by('order')[:3]:
            print(f"    Q{q.order} ({q.question_type}): correct_answers={q.correct_answers}")
    
    print(f"\n  Total questions: {total_questions} (expected: 40)")
    
    if total_questions == 40:
        print("\n[OK] All 40 questions created successfully!")
    else:
        print(f"\n[WARNING] Expected 40 questions, got {total_questions}")
else:
    print(f"[ERROR] Validation failed:")
    print(serializer.errors)

print("\n" + "=" * 80)
print("Import completed!")
print("=" * 80)

