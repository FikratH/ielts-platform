import json
import os
from django.utils import timezone
import openai

from .models import (
    ReadingTestSession,
    ListeningTestSession,
    ReadingTestResult,
    ListeningTestResult,
)
from .serializers import create_detailed_breakdown, create_listening_detailed_breakdown

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

AI_FEEDBACK_PROMPT_VERSION = "rl_feedback_v2_en_json"

READING_TYPE_LABELS = {
    'multiple_choice': 'Multiple Choice',
    'multiple_choice_group': 'Multiple Choice (Group)',
    'multiple_response': 'Multiple Response',
    'gap_fill': 'Gap Fill',
    'matching': 'Matching',
    'true_false_not_given': 'True/False/Not Given',
    'table': 'Table Completion',
    'table_completion': 'Table Completion',
    'form': 'Form Completion',
    'short_answer': 'Short Answer',
    'yes_no_not_given': 'Yes/No/Not Given',
    'true_false': 'True/False',
}

LISTENING_TYPE_LABELS = {
    'multiple_choice': 'Multiple Choice',
    'multiple_choice_group': 'Multiple Choice (Group)',
    'multiple_response': 'Multiple Response',
    'gap_fill': 'Gap Fill',
    'matching': 'Matching',
    'true_false': 'True/False',
    'table': 'Table Completion',
    'form': 'Form Completion',
    'short_answer': 'Short Answer',
}


def _normalize_answer(value):
    if value is None:
        return ''
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, dict):
        try:
            return json.dumps(value, ensure_ascii=False)
        except Exception:
            return str(value)
    if isinstance(value, list):
        return ', '.join(str(v) for v in value if v is not None)
    return str(value)


def _is_empty_answer(value):
    if value is None:
        return True
    if isinstance(value, str):
        val = value.strip()
        if not val:
            return True
        if val.lower() in ['(empty)', 'empty', 'нет', 'none']:
            return True
    return False


def _label_question_type(module, q_type):
    if module == 'reading':
        return READING_TYPE_LABELS.get(q_type, q_type or 'unknown')
    return LISTENING_TYPE_LABELS.get(q_type, q_type or 'unknown')


def _summarize_breakdown(breakdown, module, parts_meta=None):
    parts_stats = {}
    type_stats = {}
    error_samples = []
    unanswered_count = 0

    for part in breakdown:
        part_number = part.get('part_number') or 0
        for question in part.get('questions', []):
            q_type = question.get('question_type') or 'unknown'
            correct = question.get('correct_sub_questions', 0) or 0
            total = question.get('total_sub_questions', 0) or 0
            if total == 0 and question.get('sub_questions'):
                total = len(question.get('sub_questions') or [])
                correct = sum(1 for s in question.get('sub_questions', []) if s.get('is_correct'))

            parts_stats.setdefault(part_number, {'correct': 0, 'total': 0})
            parts_stats[part_number]['correct'] += correct
            parts_stats[part_number]['total'] += total

            type_stats.setdefault(q_type, {'correct': 0, 'total': 0})
            type_stats[q_type]['correct'] += correct
            type_stats[q_type]['total'] += total

            question_label = (question.get('header') or question.get('question_text') or '').strip()
            if len(question_label) > 120:
                question_label = question_label[:117] + '...'

            for sub in question.get('sub_questions', []):
                user_answer = _normalize_answer(sub.get('user_answer'))
                correct_answer = _normalize_answer(sub.get('correct_answer'))
                is_correct = sub.get('is_correct')

                if _is_empty_answer(user_answer):
                    unanswered_count += 1

                if is_correct is False:
                    error_samples.append({
                        'qid': question.get('question_id') or question.get('id'),
                        'part': part_number,
                        'type': q_type,
                        'type_label': _label_question_type(module, q_type),
                        'question': question_label,
                        'sub_label': _normalize_answer(sub.get('label') or sub.get('sub_id') or ''),
                        'user_answer': user_answer,
                        'correct_answer': correct_answer,
                    })

    parts_list = []
    for part_number, stats in sorted(parts_stats.items(), key=lambda x: x[0]):
        total = stats['total'] or 0
        correct = stats['correct'] or 0
        accuracy = round((correct / total) * 100, 1) if total > 0 else 0
        title = None
        if parts_meta and part_number in parts_meta:
            title = parts_meta.get(part_number)
        parts_list.append({
            'part': part_number,
            'title': title,
            'correct': correct,
            'total': total,
            'accuracy_pct': accuracy,
        })

    type_list = []
    for q_type, stats in sorted(type_stats.items(), key=lambda x: x[0]):
        total = stats['total'] or 0
        correct = stats['correct'] or 0
        accuracy = round((correct / total) * 100, 1) if total > 0 else 0
        type_list.append({
            'type': q_type,
            'label': _label_question_type(module, q_type),
            'correct': correct,
            'total': total,
            'accuracy_pct': accuracy,
        })

    error_samples_sorted = sorted(
        error_samples,
        key=lambda x: (
            x.get('part') or 0,
            str(x.get('qid') or ''),
            x.get('type') or ''
        )
    )

    return {
        'parts': parts_list,
        'question_types': type_list,
        'unanswered_count': unanswered_count,
        'error_samples': error_samples_sorted,
    }


def _get_previous_reading_session(session):
    qs = ReadingTestSession.objects.filter(user=session.user, completed=True)
    qs = qs.filter(is_diagnostic=session.is_diagnostic)
    if session.end_time:
        qs = qs.filter(end_time__lt=session.end_time)
    qs = qs.exclude(id=session.id)
    return qs.order_by('-end_time', '-start_time').first()


def _get_previous_listening_session(session):
    qs = ListeningTestSession.objects.filter(user=session.user, submitted=True)
    qs = qs.filter(is_diagnostic=session.is_diagnostic)
    if session.completed_at:
        qs = qs.filter(completed_at__lt=session.completed_at)
    qs = qs.exclude(id=session.id)
    return qs.order_by('-completed_at', '-started_at').first()


def build_module_payload(session, module):
    if module == 'reading':
        breakdown_result = create_detailed_breakdown(session, 'reading')
        breakdown = breakdown_result.get('breakdown', [])
        result = ReadingTestResult.objects.filter(session=session).first()
        raw_score = result.raw_score if result else breakdown_result.get('raw_score', 0)
        total_score = result.total_score if result else breakdown_result.get('total_score', 0)
        band_score = result.band_score if result else None
        parts_meta = {}
        for part in session.test.parts.all():
            title = part.title or part.passage_heading or None
            parts_meta[part.part_number] = title
        summary = _summarize_breakdown(breakdown, module, parts_meta)
        accuracy = round((raw_score / total_score) * 100, 1) if total_score else 0
        return {
            'test_title': session.test.title if session.test else None,
            'completed_at': session.end_time.isoformat() if session.end_time else None,
            'raw_score': raw_score,
            'total_score': total_score,
            'band_score': band_score,
            'accuracy_pct': accuracy,
            'parts': summary['parts'],
            'question_types': summary['question_types'],
            'unanswered_count': summary['unanswered_count'],
            'error_samples': summary['error_samples'][:10],
        }

    if module == 'listening':
        results = create_listening_detailed_breakdown(session)
        breakdown = results.get('detailed_breakdown', [])
        result = ListeningTestResult.objects.filter(session=session).first()
        raw_score = result.raw_score if result else results.get('raw_score', 0)
        total_score = results.get('total_score', 0)
        band_score = result.band_score if result else results.get('band_score', None)
        summary = _summarize_breakdown(breakdown, module, None)
        sections = []
        for item in summary['parts']:
            sections.append({
                'section': item.get('part'),
                'title': item.get('title'),
                'correct': item.get('correct'),
                'total': item.get('total'),
                'accuracy_pct': item.get('accuracy_pct'),
            })
        accuracy = round((raw_score / total_score) * 100, 1) if total_score else 0
        return {
            'test_title': session.test.title if session.test else None,
            'completed_at': session.completed_at.isoformat() if session.completed_at else None,
            'raw_score': raw_score,
            'total_score': total_score,
            'band_score': band_score,
            'accuracy_pct': accuracy,
            'sections': sections,
            'question_types': summary['question_types'],
            'unanswered_count': summary['unanswered_count'],
            'error_samples': summary['error_samples'][:10],
        }

    raise ValueError('Unsupported module')


def build_feedback_payload(session, module):
    if module == 'reading':
        previous = _get_previous_reading_session(session)
    else:
        previous = _get_previous_listening_session(session)

    payload = {
        'module': module,
        'current': build_module_payload(session, module),
        'previous': build_module_payload(previous, module) if previous else None,
    }
    return payload


def generate_ai_feedback(module, payload):
    if not OPENAI_API_KEY:
        raise RuntimeError('OPENAI_API_KEY not set in environment')

    openai.api_key = OPENAI_API_KEY

    system_prompt = (
        "You are an IELTS Reading/Listening examiner and coach. "
        "You receive JSON with data for the current test and the previous test of the same module. "
        "Write feedback ONLY in English and ONLY using the provided JSON data. "
        "If previous is null, explicitly state that there is no previous test for comparison. "
        "Do not invent topics or reasons. Use numbers, accuracy, and question types from the JSON.\n\n"
        "Return a SINGLE JSON object. No markdown, no extra text.\n"
        "Schema (all keys required):\n"
        "{\n"
        "  \\\"summary\\\": string,\n"
        "  \\\"comparison\\\": string,\n"
        "  \\\"sections\\\": [string],\n"
        "  \\\"question_types\\\": [string],\n"
        "  \\\"error_patterns\\\": [string],\n"
        "  \\\"error_examples\\\": [string],\n"
        "  \\\"recommendations\\\": [string],\n"
        "  \\\"two_week_plan\\\": [string]\n"
        "}\n\n"
        "Rules:\n"
        "- summary: include current raw/total, accuracy %, and band score if available.\n"
        "- comparison: include deltas vs previous (accuracy %, band, raw/total) if previous exists.\n"
        "- sections: list all parts/sections with accuracy and delta if previous exists.\n"
        "- question_types: list all question types with accuracy and delta if previous exists.\n"
        "- error_patterns: 2-4 items.\n"
        "- error_examples: 5-10 lines, format: \\\"QID / Part: X / Type: Y - user_answer -> correct_answer\\\".\n"
        "- recommendations: 3-5 practical items.\n"
        "- two_week_plan: 5-7 items, include frequency (e.g., 3x/week, daily).\n"
        "- Use only ASCII characters where possible.\n"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}
    ]

    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=1000,
        temperature=0.3,
        response_format={"type": "json_object"},
    )


    text = response.choices[0].message.content or ''
    return text.strip()


def cache_feedback(result_obj, feedback_text):
    if not result_obj:
        return
    result_obj.ai_feedback = feedback_text
    result_obj.ai_feedback_version = AI_FEEDBACK_PROMPT_VERSION
    result_obj.ai_feedback_updated_at = timezone.now()
    result_obj.save(update_fields=['ai_feedback', 'ai_feedback_version', 'ai_feedback_updated_at'])
