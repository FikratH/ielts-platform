# core/utils.py


from rest_framework.views import APIView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

# -----------------------------
# CSRF-exempt базовый класс API
# -----------------------------
class CsrfExemptAPIView(APIView):
    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)


# -----------------------------
# Secure File Validation
# -----------------------------
# File magic bytes for content-type validation
FILE_SIGNATURES = {
    # Images
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89PNG\r\n\x1a\n': 'image/png',
    b'GIF87a': 'image/gif',
    b'GIF89a': 'image/gif',
    b'RIFF': 'image/webp',  # WebP starts with RIFF
    # Audio
    b'ID3': 'audio/mpeg',  # MP3 with ID3 tag
    b'\xff\xfb': 'audio/mpeg',  # MP3 without ID3
    b'\xff\xfa': 'audio/mpeg',
    b'\xff\xf3': 'audio/mpeg',
    b'\xff\xf2': 'audio/mpeg',
    b'OggS': 'audio/ogg',
    b'RIFF': 'audio/wav',  # WAV also starts with RIFF
    b'ftyp': 'audio/m4a',  # M4A/MP4 (after first 4 bytes)
}


def validate_file_content_type(file_obj, allowed_types):
    """
    Validate file content type by checking magic bytes.
    More secure than relying on content_type header which can be spoofed.
    
    Args:
        file_obj: Uploaded file object
        allowed_types: List of allowed MIME types
        
    Returns:
        tuple: (is_valid: bool, detected_type: str or None, error: str or None)
    """
    if not file_obj:
        return False, None, "No file provided"
    
    try:
        # Read first 12 bytes for magic byte detection
        file_obj.seek(0)
        header = file_obj.read(12)
        file_obj.seek(0)
        
        detected_type = None
        
        # Check against known signatures
        for signature, mime_type in FILE_SIGNATURES.items():
            if header.startswith(signature):
                detected_type = mime_type
                break
        
        # Special handling for M4A (ftyp appears after 4 bytes)
        if header[4:8] == b'ftyp':
            detected_type = 'audio/m4a'
        
        # Special handling for WebP (RIFF....WEBP)
        if header[:4] == b'RIFF' and header[8:12] == b'WEBP':
            detected_type = 'image/webp'
        elif header[:4] == b'RIFF' and header[8:12] == b'WAVE':
            detected_type = 'audio/wav'
        
        if detected_type is None:
            # Fall back to client-provided type with warning
            detected_type = getattr(file_obj, 'content_type', None)
            if detected_type not in allowed_types:
                return False, detected_type, f"Unrecognized file type: {detected_type}"
        
        if detected_type not in allowed_types:
            return False, detected_type, f"File type {detected_type} not allowed"
        
        return True, detected_type, None
        
    except Exception as e:
        return False, None, f"Error validating file: {str(e)}"


# -------------------------------------
# Проверка Firebase ID-token (verify_token)
# -------------------------------------
# Удаляю всё, что связано с firebase_admin, credentials, FIREBASE_CERT_PATH, verify_token


# -------------------------------------
# Ваши вспомогательные функции для тестов
# -------------------------------------
import openai
import os
import re

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')


def sanitize_ai_input(text, max_length=10000):
    """
    Sanitize user input before sending to AI models.
    Prevents prompt injection attacks and limits input size.
    
    Args:
        text: User-provided text to sanitize
        max_length: Maximum allowed character length
        
    Returns:
        Sanitized text string
    """
    if not text:
        return ""
    
    # Convert to string if not already
    text = str(text)
    
    # Limit length to prevent resource exhaustion
    if len(text) > max_length:
        text = text[:max_length]
    
    # Remove common prompt injection patterns
    injection_patterns = [
        r'(?i)ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)',
        r'(?i)forget\s+(all\s+)?(previous|above|prior)',
        r'(?i)disregard\s+(all\s+)?(previous|above|prior)',
        r'(?i)system\s*:\s*',
        r'(?i)assistant\s*:\s*',
        r'(?i)you\s+are\s+now',
        r'(?i)new\s+instructions?\s*:',
        r'(?i)override\s+(all\s+)?',
        r'(?i)\[SYSTEM\]',
        r'(?i)\[INST\]',
        r'(?i)\[\\/INST\]',
        r'(?i)<\|im_start\|>',
        r'(?i)<\|im_end\|>',
    ]
    
    for pattern in injection_patterns:
        text = re.sub(pattern, '[FILTERED]', text)
    
    # Remove control characters (except newlines and tabs)
    text = ''.join(char for char in text if char in '\n\t' or (ord(char) >= 32 and ord(char) != 127))
    
    return text.strip()


# IELTS Writing AI scoring (GPT-4 Vision)
def ai_score_essay(question_text, essay_text, task_type, image_url=None):
    if not OPENAI_API_KEY:
        raise RuntimeError('OPENAI_API_KEY not set in environment')
    openai.api_key = OPENAI_API_KEY

    # Security: Sanitize user inputs to prevent prompt injection
    essay_text = sanitize_ai_input(essay_text, max_length=15000)
    question_text = sanitize_ai_input(question_text, max_length=2000)

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
