import os
import logging
import requests

logger = logging.getLogger(__name__)


def _get_frontend_base_url():
    return (os.getenv('FRONTEND_BASE_URL') or 'http://localhost:3000').rstrip('/')


def _build_writing_feedback_link(essay=None, session=None):
    base = _get_frontend_base_url()
    if session is not None:
        return f"{base}/writing/teacher-feedback/session/{session.id}"
    if essay is not None:
        return f"{base}/writing/feedback/{essay.id}"
    return base


def _resend_send_email(to_email, subject, html, text=None):
    api_key = os.getenv('RESEND_API_KEY')
    if not api_key:
        logger.warning("RESEND_API_KEY is not set; skipping email send.")
        return False

    from_email = os.getenv('RESEND_FROM_EMAIL', 'IELTS Platform <no-reply@mail.mastereducation.kz>')

    payload = {
        'from': from_email,
        'to': [to_email],
        'subject': subject,
        'html': html,
    }
    if text:
        payload['text'] = text

    try:
        response = requests.post(
            'https://api.resend.com/emails',
            headers={
                'Authorization': f"Bearer {api_key}",
                'Content-Type': 'application/json',
            },
            json=payload,
            timeout=10,
        )
        if response.status_code >= 400:
            logger.warning("Resend email failed: %s %s", response.status_code, response.text)
            return False
        return True
    except Exception as exc:
        logger.exception("Resend email send failed: %s", exc)
        return False


def send_writing_feedback_published_email(student, teacher, essay=None, session=None, task_type=None):
    if not student or not getattr(student, 'email', None):
        return False

    student_name = f"{student.first_name or ''} {student.last_name or ''}".strip() or student.email
    teacher_name = f"{teacher.first_name or ''} {teacher.last_name or ''}".strip() or teacher.email
    link = _build_writing_feedback_link(essay=essay, session=session)

    task_label = None
    if task_type:
        t = str(task_type).lower()
        if t == 'task1':
            task_label = 'Task 1'
        elif t == 'task2':
            task_label = 'Task 2'

    subject = "IELTS Writing: обратная связь готова"
    title_line = "Фидбек по Writing готов"
    if task_label:
        title_line = f"Фидбек по Writing ({task_label}) готов"

    html = f"""
<p>Здравствуйте, {student_name}!</p>
<p>{teacher_name} опубликовал(а) фидбек по вашему Writing.</p>
<p><strong>{title_line}</strong></p>
<p>Откройте ссылку, чтобы посмотреть детали:</p>
<p><a href="{link}">{link}</a></p>
<p>Если ссылка не открывается, зайдите в платформу и откройте раздел Writing → Feedback.</p>
"""

    text = (
        f"Здравствуйте, {student_name}!\n"
        f"{teacher_name} опубликовал(а) фидбек по вашему Writing.\n"
        f"{title_line}\n"
        f"Ссылка: {link}\n"
        "Если ссылка не открывается, зайдите в платформу и откройте раздел Writing → Feedback.\n"
    )

    return _resend_send_email(student.email, subject, html, text=text)
