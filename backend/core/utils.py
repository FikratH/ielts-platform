# core/utils.py

# -------------------------------------
# AI Scoring and Utility Functions
# -------------------------------------
import openai
import os

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

# IELTS Writing AI scoring (GPT-4 Vision)
def ai_score_essay(question_text, essay_text, task_type, image_url=None):
    if not OPENAI_API_KEY:
        raise RuntimeError('OPENAI_API_KEY not set in environment')
    openai.api_key = OPENAI_API_KEY



    # Проверяем минимальную длину текста
    min_words = 50 if task_type == 'task1' else 100
    word_count = len(essay_text.split())
    
    if word_count < min_words:
        return {
            'task_response': 1.0,
            'coherence': 1.0,
            'lexical': 1.0,
            'grammar': 1.0,
            'feedback': f'Essay is too short ({word_count} words). Minimum required: {min_words} words for Task {task_type.upper()}. Please write a longer response.'
        }

    # Формируем промпт в зависимости от типа задания
    if task_type == 'task1':
        system_prompt = (
            "You are an expert IELTS Writing Task 1 examiner with 10+ years of experience. "
            "Task 1 requires describing data, charts, graphs, or processes in 150+ words. "
            "You will be given a writing task and a student's essay. "
            "Evaluate the essay according to official IELTS Task 1 criteria:\n\n"
            "1. TASK ACHIEVEMENT (0-9):\n"
            "- Band 9: Fully satisfies all requirements, clearly presents key features\n"
            "- Band 7: Covers key features, some detail may be missing\n"
            "- Band 5: Addresses task but format may be inappropriate, key features missing\n"
            "- Band 3: Fails to address task, no clear overview\n\n"
            "2. COHERENCE & COHESION (0-9):\n"
            "- Band 9: Logical organization, clear progression, excellent linking\n"
            "- Band 7: Clear overall progression, good use of cohesive devices\n"
            "- Band 5: Some organization but may lack progression, limited linking\n"
            "- Band 3: No clear organization, minimal linking\n\n"
            "3. LEXICAL RESOURCE (0-9):\n"
            "- Band 9: Wide range of vocabulary, precise and natural\n"
            "- Band 7: Sufficient range, some flexibility and precision\n"
            "- Band 5: Limited range, some errors in word choice\n"
            "- Band 3: Very limited range, frequent errors\n\n"
            "4. GRAMMATICAL RANGE & ACCURACY (0-9):\n"
            "- Band 9: Wide range of structures, very few errors\n"
            "- Band 7: Variety of complex structures, some errors\n"
            "- Band 5: Mix of simple and complex structures, frequent errors\n"
            "- Band 3: Limited range, many errors\n\n"
            "OVERALL BAND: Average of the four criteria, rounded to nearest 0.5\n\n"
            "FEEDBACK REQUIREMENTS:\n"
            "- Write 4-6 sentences of detailed feedback\n"
            "- Start with overall impression and main strength\n"
            "- Identify 2-3 specific areas for improvement\n"
            "- Provide concrete, actionable suggestions\n"
            "- Mention vocabulary and grammar improvements\n"
            "- Be encouraging but honest about weaknesses\n"
            "- Use specific examples from the essay\n"
            "- End with a positive note and encouragement\n\n"
            "Respond ONLY with valid JSON, no explanations, no extra text, no markdown, no comments. "
            "Do NOT include any text before or after the JSON. "
            "Format: {\"task_achievement\":..., \"coherence\":..., \"lexical\":..., \"grammar\":..., \"feedback\":...}"
        )
        user_prompt = (
            f"TASK 1 INSTRUCTIONS: {question_text}\n\n"
            f"STUDENT'S ESSAY:\n{essay_text}\n\n"
            f"Evaluate this Task 1 response according to IELTS criteria."
        )
    else:  # task_type == 'task2'
        system_prompt = (
            "You are an expert IELTS Writing Task 2 examiner with 10+ years of experience. "
            "Task 2 requires writing an argumentative essay of 250+ words on a given topic. "
            "You will be given a writing task and a student's essay. "
            "Evaluate the essay according to official IELTS Task 2 criteria:\n\n"
            "1. TASK RESPONSE (0-9):\n"
            "- Band 9: Fully addresses all parts, presents clear position, develops ideas fully\n"
            "- Band 7: Addresses all parts, presents clear position, develops ideas\n"
            "- Band 5: Addresses task but may not cover all parts, position unclear\n"
            "- Band 3: Does not address task, no clear position\n\n"
            "2. COHERENCE & COHESION (0-9):\n"
            "- Band 9: Logical organization, clear progression, excellent linking\n"
            "- Band 7: Clear overall progression, good use of cohesive devices\n"
            "- Band 5: Some organization but may lack progression, limited linking\n"
            "- Band 3: No clear organization, minimal linking\n\n"
            "3. LEXICAL RESOURCE (0-9):\n"
            "- Band 9: Wide range of vocabulary, precise and natural\n"
            "- Band 7: Sufficient range, some flexibility and precision\n"
            "- Band 5: Limited range, some errors in word choice\n"
            "- Band 3: Very limited range, frequent errors\n\n"
            "4. GRAMMATICAL RANGE & ACCURACY (0-9):\n"
            "- Band 9: Wide range of structures, very few errors\n"
            "- Band 7: Variety of complex structures, some errors\n"
            "- Band 5: Mix of simple and complex structures, frequent errors\n"
            "- Band 3: Limited range, many errors\n\n"
            "OVERALL BAND: Average of the four criteria, rounded to nearest 0.5\n\n"
            "FEEDBACK REQUIREMENTS:\n"
            "- Write 4-6 sentences of detailed feedback\n"
            "- Start with overall impression and main strength\n"
            "- Identify 2-3 specific areas for improvement\n"
            "- Provide concrete, actionable suggestions\n"
            "- Mention argument development and structure\n"
            "- Comment on vocabulary and grammar improvements\n"
            "- Be encouraging but honest about weaknesses\n"
            "- Use specific examples from the essay\n"
            "- End with a positive note and encouragement\n\n"
            "Respond ONLY with valid JSON, no explanations, no extra text, no markdown, no comments. "
            "Do NOT include any text before or after the JSON. "
            "Format: {\"task_response\":..., \"coherence\":..., \"lexical\":..., \"grammar\":..., \"feedback\":...}"
        )
        user_prompt = (
            f"TASK 2 INSTRUCTIONS: {question_text}\n\n"
            f"STUDENT'S ESSAY:\n{essay_text}\n\n"
            f"Evaluate this Task 2 response according to IELTS criteria."
        )



    # Формируем messages для Vision (если есть картинка)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": []}
    ]
    
    # Если это Task 1 и есть картинка, используем Vision API
    if task_type == 'task1' and image_url:
        messages[1]["content"] = [
            {"type": "text", "text": f"Task: {question_text}"},
            {"type": "image_url", "image_url": {"url": image_url, "detail": "high"}},
            {"type": "text", "text": f"Essay: {essay_text}"}
        ]
    else:
        messages[1]["content"] = user_prompt
    
    # Используем gpt-4o для всех случаев (поддерживает и текст, и изображения)
    model = "gpt-4o"

    try:
        # Вызываем OpenAI
        response = openai.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=512,
            temperature=0.2,
        )
        text = response.choices[0].message.content
        
        # Парсим JSON из ответа (более устойчиво)
        import re, json
        # Вырезаем JSON даже из markdown-блока
        match = re.search(r'\{[\s\S]*\}', text)
        if not match:
            raise ValueError('AI did not return valid JSON')
        
        json_text = match.group(0)
        
        try:
            data = json.loads(json_text)
            
            # Проверяем, что все поля присутствуют
            if task_type == 'task1':
                required_fields = ['task_achievement', 'coherence', 'lexical', 'grammar', 'feedback']
            else:
                required_fields = ['task_response', 'coherence', 'lexical', 'grammar', 'feedback']
            
            for field in required_fields:
                if field not in data:
                    data[field] = None
            
            # Приводим к единому формату независимо от того, что вернул GPT
            return {
                'task_response': data.get('task_achievement') or data.get('task_response') or data.get('score_task'),
                'coherence': data.get('coherence') or data.get('score_coherence'),
                'lexical': data.get('lexical') or data.get('score_lexical'),
                'grammar': data.get('grammar') or data.get('score_grammar'),
                'feedback': data.get('feedback', '')
            }
            
        except Exception as e:
            raise ValueError('AI did not return valid JSON')
            
    except Exception as e:
        # Возвращаем пустой результат вместо исключения
        if task_type == 'task1':
            return {
                'task_response': None,
                'coherence': None,
                'lexical': None,
                'grammar': None,
                'feedback': f'AI scoring failed: {str(e)}'
            }
        else:
            return {
                'task_response': None,
                'coherence': None,
                'lexical': None,
                'grammar': None,
                'feedback': f'AI scoring failed: {str(e)}'
            }


def validate_reading_test(test):
    """
    Проверяет целостность Reading теста перед активацией.
    Возвращает (is_valid, errors_list).
    """
    errors = []
    
    # Проверяем базовые поля
    if not test.title:
        errors.append("Test title is required")
    if not test.time_limit or test.time_limit <= 0:
        errors.append("Valid time limit is required")
    
    # Проверяем части
    parts = test.parts.all().order_by('part_number')
    if not parts.exists():
        errors.append("Test must have at least one part")
        return False, errors
    
    total_questions = 0
    total_sub_questions = 0
    
    for part in parts:
        questions = part.questions.all().order_by('order')
        if not questions.exists():
            errors.append(f"Part {part.part_number} has no questions")
            continue
            
        total_questions += questions.count()
        
        for q in questions:
            if not q.question_type:
                errors.append(f"Question {q.id} has no type")
                continue
                
            # … (ваша логика проверки по типам вопросов)
            # то же самое, что было у вас
            
    # Общие проверки
    if total_questions == 0:
        errors.append("Test has no questions")
    elif total_questions < 3:
        errors.append(f"Test has only {total_questions} questions (too few for IELTS)")
        
    if total_sub_questions == 0:
        errors.append("Test has no scoreable sub-questions")
    elif total_sub_questions < 10:
        errors.append(f"Test has only {total_sub_questions} sub-questions (low for IELTS Reading)")
    
    return len(errors) == 0, errors


def auto_fix_reading_test(test):
    """
    Автоматически исправляет некоторые проблемы в Reading тесте.
    """
    fixes_applied = []
    
    # Исправляем порядок вопросов
    for part in test.parts.all().order_by('part_number'):
        questions = list(part.questions.all().order_by('order'))
        for idx, q in enumerate(questions):
            if q.order != idx + 1:
                q.order = idx + 1
                q.save()
                fixes_applied.append(f"Fixed order for question {q.id}")
    
    # Добавляем недостающие инструкции
    for part in test.parts.all().order_by('part_number'):
        for q in part.questions.all().order_by('order'):
            if not q.header and not q.instruction:
                if q.question_type == 'gap_fill':
                    q.instruction = "Complete the text by filling in the gaps."
                elif q.question_type == 'true_false_not_given':
                    q.instruction = "Choose TRUE, FALSE, or NOT GIVEN for each statement."
                elif q.question_type == 'matching':
                    q.instruction = "Match each item with the correct option."
                elif q.question_type == 'table':
                    q.instruction = "Complete the table by filling in the missing information."
                elif q.question_type in ['multiple_choice', 'multiple_response']:
                    q.instruction = "Choose the correct answer(s)."
                
                if q.instruction:
                    q.save()
                    fixes_applied.append(f"Added instruction for question {q.id}")
    
    return fixes_applied
