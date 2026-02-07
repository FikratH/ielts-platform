# IELTS Platform - Complete Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Database Schema](#database-schema)
6. [Authentication & Security](#authentication--security)
7. [API Architecture](#api-architecture)
8. [Key Features & Modules](#key-features--modules)
9. [How to Launch Locally](#how-to-launch-locally)
10. [Deployment](#deployment)
11. [Testing](#testing)
12. [Scripts & Utilities](#scripts--utilities)
13. [Configuration](#configuration)
14. [Troubleshooting](#troubleshooting)

---

## Project Overview

**IELTS Platform** is a comprehensive web-based application for IELTS test preparation and administration. It provides a full suite of testing modules (Listening, Reading, Writing, Speaking) with AI-powered feedback, teacher assessment capabilities, and administrative tools for managing students, tests, and results.

### Key Capabilities
- **Student Portal**: Take practice tests, view results, receive AI and teacher feedback
- **Teacher Portal**: Review student submissions, provide detailed feedback and scoring
- **Curator Portal**: Monitor student progress, analyze performance across groups
- **Admin Portal**: Manage users, create tests, configure system settings
- **Diagnostic Testing**: Initial assessment to determine student level
- **Placement Test**: Public test for prospective students

### Production Deployment
- **Frontend**: https://ielts.mastereducation.kz
- **Backend API**: https://ieltsapi.mastereducation.kz

---

## Architecture

### System Architecture

```
┌─────────────────┐
│   Frontend      │  React SPA (Port 3000 dev)
│   (React 19)    │  
└────────┬────────┘
         │ HTTP/HTTPS
         │ Bearer Token Auth
         ▼
┌─────────────────┐
│   Backend API   │  Django REST (Port 8000)
│   (Django 5.x)  │  
└────────┬────────┘
         │
    ┌────┴─────┬──────────┬──────────┐
    ▼          ▼          ▼          ▼
┌────────┐ ┌──────┐ ┌─────────┐ ┌────────┐
│Firebase│ │ DB   │ │ OpenAI  │ │ Media  │
│  Auth  │ │(PG)  │ │   API   │ │Storage │
└────────┘ └──────┘ └─────────┘ └────────┘
```

### Application Flow

1. **User Authentication**: Firebase handles authentication (email/Google)
2. **Token Validation**: Backend validates Firebase ID tokens
3. **Role-Based Access**: Users assigned roles (student, teacher, curator, admin)
4. **Test Sessions**: Real-time tracking with auto-save
5. **AI Scoring**: OpenAI GPT-4 for Writing essays and test feedback
6. **Teacher Review**: Manual grading and detailed feedback workflow
7. **Analytics**: Comprehensive dashboards for progress tracking

---

## Technology Stack

### Backend (`/backend`)

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | Django | 5.x | Web framework |
| **API** | Django REST Framework | Latest | REST API |
| **Database** | PostgreSQL | Latest | Primary database |
| **Authentication** | Firebase Admin SDK | Latest | Token verification |
| **AI** | OpenAI API | Latest | Essay scoring, feedback |
| **CORS** | django-cors-headers | Latest | Cross-origin requests |
| **Server** | Gunicorn | Latest | WSGI HTTP server |
| **Environment** | python-dotenv | Latest | Config management |

**Key Dependencies** (`backend/requirements.txt`):
- `Django==5.x`
- `djangorestframework`
- `psycopg2-binary` (PostgreSQL adapter)
- `firebase-admin`
- `openai`
- `django-cors-headers`
- `gunicorn`
- `python-dotenv`
- `Pillow` (image processing)

### Frontend (`/frontend`)

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | React | 19.1.0 | UI framework |
| **Router** | React Router | 7.6.1 | Client-side routing |
| **HTTP Client** | Axios | 1.9.0 | API requests |
| **Authentication** | Firebase SDK | 11.8.1 | User auth |
| **UI Library** | Material-UI | 7.1.2 | UI components |
| **Icons** | Lucide React | Latest | Icon library |
| **Styling** | TailwindCSS | 3.4.1 | Utility-first CSS |
| **Drag & Drop** | @dnd-kit | Latest | Sortable interfaces |
| **Charts** | Recharts | 3.3.0 | Data visualization |

**Build Tool**: Create React App (react-scripts 5.0.1)

---

## Project Structure

```
ielts-platform/
├── backend/                    # Django backend
│   ├── core/                  # Main application
│   │   ├── models.py          # Database models (5000+ lines)
│   │   ├── views.py           # API endpoints (36000+ lines)
│   │   ├── serializers.py     # DRF serializers (15000+ lines)
│   │   ├── urls.py            # URL routing
│   │   ├── auth.py            # Firebase authentication
│   │   ├── ai_feedback.py     # AI-powered feedback
│   │   ├── utils.py           # Utility functions
│   │   ├── admin.py           # Django admin config
│   │   ├── permissions.py     # Custom permissions
│   │   ├── bulk_import.py     # CSV import utilities
│   │   ├── email_utils.py     # Email notifications
│   │   ├── firebase_config.py # Firebase initialization
│   │   └── migrations/        # Database migrations (40+)
│   ├── ielts_platform/        # Project settings
│   │   ├── settings.py        # Django configuration
│   │   ├── urls.py            # Root URL config
│   │   └── wsgi.py            # WSGI config
│   ├── scripts/               # Utility scripts
│   │   ├── student_last8_scores.py
│   │   └── update_student_emails.py
│   ├── manage.py              # Django CLI
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile             # Container config
│   ├── entrypoint.sh          # Startup script
│   ├── restore_tests.py       # Test data restoration
│   └── mark_diagnostic_templates.py
│
├── frontend/                   # React frontend
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── components/        # Reusable components (34 items)
│   │   │   ├── AdminReadingTestBuilder.jsx
│   │   │   ├── AdminListeningTestBuilder.jsx
│   │   │   ├── ReadingTestPlayer.jsx
│   │   │   ├── ListeningTestPlayer.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── BottomNavigation.jsx
│   │   │   └── ...
│   │   ├── pages/             # Page components (53 items)
│   │   │   ├── Dashboard.js
│   │   │   ├── LoginPage.js
│   │   │   ├── WritingTestListPage.js
│   │   │   ├── ListeningTestListPage.js
│   │   │   ├── ReadingPage.js
│   │   │   ├── TeacherSpeakingPage.js
│   │   │   ├── CuratorDashboard.js
│   │   │   └── ...
│   │   ├── contexts/          # React contexts
│   │   │   └── SidebarContext.js
│   │   ├── firebase.js        # Firebase config
│   │   ├── api.js             # API client setup
│   │   ├── App.js             # Main app component
│   │   └── index.js           # Entry point
│   ├── package.json           # Node dependencies
│   ├── tailwind.config.js     # Tailwind config
│   └── Dockerfile             # Container config
│
├── media123/                   # Sample media files
├── db.dump                     # Database backup
├── .gitignore                  # Git ignore rules
└── requirements.txt            # Root dependencies file
```

---

## Database Schema

### User Management

#### **User** (Custom user model)
```python
- uid (CharField, unique)              # Firebase UID
- role (CharField)                     # student, teacher, speaking_mentor, admin, curator, placement_viewer
- student_id (CharField, nullable)     # Student identifier
- curator_id (CharField, nullable)     # Curator identifier
- first_name, last_name (CharField)
- email (EmailField, unique)
- group (CharField)                    # Class/group name
- teacher (CharField)                  # Teacher name
- assigned_teacher (ForeignKey)        # Teacher assignment
- is_staff, is_superuser, is_active (Boolean)
```

### Writing Module

#### **WritingTest**
```python
- title, description
- is_active (Boolean)
- explanation_url (URLField)
- is_diagnostic_template (Boolean)     # Used for diagnostic flow
- created_at, updated_at
```

#### **WritingTask**
```python
- test (ForeignKey → WritingTest)
- task_type (CharField)                # 'task1' or 'task2'
- task_text (TextField)
- image (ImageField)
```

#### **WritingTestSession**
```python
- user (ForeignKey → User)
- test (ForeignKey → WritingTest)
- started_at, completed (Boolean)
- band_score (FloatField)
- time_left_seconds (Integer)
- task1_draft, task2_draft (TextField) # Auto-save drafts
- is_diagnostic (Boolean)
```

#### **Essay**
```python
- user (ForeignKey → User)
- task_type ('task1'/'task2')
- question_text, submitted_text
- score_task, score_coherence, score_lexical, score_grammar
- overall_band (FloatField)
- feedback (TextField)                 # AI-generated feedback
- test_session (ForeignKey)
- task, prompt (ForeignKey)
```

#### **TeacherFeedback**
```python
- essay (OneToOneField → Essay)
- teacher (ForeignKey → User)
- overall_feedback (TextField)
- annotations (JSONField)              # Inline annotations
- teacher_task_score, teacher_coherence_score, etc.
- teacher_overall_score (auto-calculated)
- published (Boolean)
- published_at (DateTime)
```

### Listening Module

#### **ListeningTest**
```python
- title, description
- is_active, explanation_url
- is_diagnostic_template
```

#### **ListeningPart**
```python
- test (ForeignKey → ListeningTest)
- part_number (Integer)
- audio (CharField)                    # Audio file path
- audio_duration (Float)
- instructions (TextField)
```

#### **ListeningQuestion**
```python
- part (ForeignKey → ListeningPart)
- order (Integer)
- question_type (CharField)            # multiple_choice, gap_fill, matching, etc.
- question_text (TextField)
- task_prompt (TextField)
- extra_data (JSONField)               # Additional question data
- correct_answers (JSONField)
- header, instruction
- image, image_file
- points (Integer)
- scoring_mode ('total'/'per_correct')
```

#### **ListeningAnswerOption**
```python
- question (ForeignKey → ListeningQuestion)
- label (CharField)                    # A, B, C, D
- text (CharField)
- points (Integer)
```

#### **ListeningTestSession**
```python
- user, test (ForeignKey)
- started_at, completed_at
- timer_seconds, audio_position
- status, state (JSONField)
- submitted (Boolean)
- answers, flagged (JSONField)
- time_left (Integer)                  # 2400 seconds default (40 min)
- score, correct_answers_count
- is_diagnostic (Boolean)
```

#### **ListeningTestResult**
```python
- session (OneToOneField)
- raw_score, band_score
- breakdown (JSONField)                # Per-question details
- ai_feedback (TextField)              # AI-generated feedback
- ai_feedback_version, ai_feedback_updated_at
```

### Reading Module

#### **ReadingTest**
```python
- title, description
- time_limit (Integer)                 # Minutes (default 60)
- total_points (Integer)
- is_active, explanation_url
- is_diagnostic_template
```

#### **ReadingPart**
```python
- test (ForeignKey → ReadingTest)
- part_number, title
- instructions (TextField)
- passage_text (TextField)             # Main reading passage
- passage_heading (CharField)
- passage_image_url (CharField)
- order (Integer)
```

#### **ReadingQuestion**
```python
- part (ForeignKey → ReadingPart)
- order (Integer)
- question_type (CharField)
- header, instruction, task_prompt
- image_url, image_file
- question_text (TextField)
- points (Float)
- correct_answers (JSONField)
- extra_data (JSONField)
- reading_scoring_type                 # 'all_or_nothing' / 'per_correct_option'
```

#### **ReadingAnswerOption**
```python
- question (ForeignKey → ReadingQuestion)
- label (CharField)
- text (TextField)
- image_url (CharField)
- is_correct (Boolean)
- reading_points (Integer)
```

#### **ReadingTestSession**
```python
- user, test (ForeignKey)
- start_time, end_time
- completed (Boolean)
- answers (JSONField)                  # {question_id: answer}
- time_left_seconds (Integer)          # 3600 default (60 min)
- is_diagnostic (Boolean)
```

#### **ReadingTestResult**
```python
- session (OneToOneField)
- raw_score, total_score, band_score
- breakdown (JSONField)
- time_taken (DurationField)
- ai_feedback (TextField)
- ai_feedback_version, ai_feedback_updated_at
```

### Speaking Module

#### **SpeakingSession**
```python
- student, teacher (ForeignKey → User)
- fluency_coherence_score, lexical_resource_score
- grammatical_range_score, pronunciation_score
- overall_band_score (auto-calculated with IELTS rounding)
- fluency_coherence_feedback, lexical_resource_feedback
- grammatical_range_feedback, pronunciation_feedback
- overall_feedback (TextField)
- duration_seconds (Integer)
- time_markers (JSONField)             # Notes with timestamps
- session_notes (TextField)
- completed (Boolean)
- conducted_at, updated_at
```

### Additional Models

#### **TeacherSatisfactionSurvey**
```python
- student (ForeignKey → User)
- is_satisfied (Boolean)
- reason (TextField)
- submitted_at
```

#### **PlacementTestQuestion**
```python
- order (Integer, 1-20)
- question_text, option_a, option_b, option_c, option_d
- correct_answer (CharField)           # A, B, C, or D
- is_active (Boolean)
```

#### **PlacementTestSubmission**
```python
- full_name, grade, phone_number, email
- planned_exam_date (CharField)
- answers (JSONField)                  # {1: 'A', 2: 'B', ...}
- score (Integer)                      # 0-20
- recommendation (CharField)           # 'pre-ielts' or 'ielts'
- submitted_at
```

---

## Authentication & Security

### Firebase Authentication

**Flow:**
1. User logs in via Firebase (email/password or Google)
2. Frontend receives Firebase ID token
3. Token stored in localStorage
4. Token sent with every API request in `Authorization: Bearer <token>` header
5. Backend validates token using Firebase Admin SDK
6. User object retrieved/created based on `uid`

**Implementation:**

**Frontend** (`src/firebase.js`):
```javascript
// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCGaTlQrpo0EB7H-EP7PYR_QeBHIl0oE-c",
  authDomain: "ielts-project-6259a.firebaseapp.com",
  projectId: "ielts-project-6259a",
  // ...
};

// Auto token refresh
onIdTokenChanged(auth, async (user) => {
  if (user) {
    const token = await user.getIdToken();
    localStorage.setItem('token', token);
  }
});
```

**Frontend API Client** (`src/api.js`):
```javascript
// Axios interceptor adds token to all requests
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Auto-retry on 401/403 with refreshed token
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      const newToken = await auth.currentUser.getIdToken(true);
      // Retry request with new token
    }
  }
);
```

**Backend** (`core/auth.py`):
```python
class FirebaseAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        token = auth_header.split(' ')[1]
        decoded_token = verify_firebase_token(token)
        uid = decoded_token['uid']
        
        # Get or create user
        try:
            user = User.objects.get(uid=uid)
        except User.DoesNotExist:
            user = User.objects.create(uid=uid, role='student')
        
        return (user, None)
```

**Backend** (`core/firebase_config.py`):
```python
import firebase_admin
from firebase_admin import credentials, auth

cred = credentials.Certificate('core/firebase_credentials.json')
firebase_admin.initialize_app(cred)

def verify_firebase_token(token):
    decoded_token = auth.verify_id_token(token, check_revoked=False)
    return decoded_token
```

### Role-Based Access Control

**Roles:**
- **student**: Take tests, view own results
- **teacher**: Review/grade writing essays and speaking sessions
- **speaking_mentor**: Conduct and assess speaking sessions
- **curator**: Monitor groups of students, view analytics
- **admin**: Full system access, manage users and tests
- **placement_viewer**: View placement test results only

**Permission Implementation:**
- Custom permissions in `core/permissions.py`
- View-level checks in `core/views.py`
- Frontend route guards based on `localStorage.getItem('role')`

### Security Features

1. **CORS Configuration**: Whitelist specific origins
2. **CSRF Protection**: Django CSRF with trusted origins
3. **Token Expiration**: Firebase tokens auto-refresh
4. **Sensitive Files**: `.gitignore` excludes credentials
5. **Environment Variables**: Secrets in `.env` files (not in repo)
6. **Firebase Credentials**: `core/firebase_credentials.json` (gitignored)

**Required Environment Variables:**
```bash
# Backend (.env)
SECRET_KEY=<django-secret-key>
DEBUG=False
ALLOWED_HOSTS=ieltsapi.mastereducation.kz,localhost
DB_NAME=ielts_platform
DB_USER=postgres
DB_PASSWORD=<password>
DB_HOST=localhost
DB_PORT=5432
OPENAI_API_KEY=<openai-api-key>

# Frontend (.env)
REACT_APP_API_BASE_URL=https://ieltsapi.mastereducation.kz/api
```

---

## API Architecture

### REST API Endpoints

**Base URL**: `/api/`

#### Authentication
- `POST /api/login/` - Firebase login
- `GET /api/user/profile/` - Get user profile

#### Dashboard
- `GET /api/dashboard/summary/` - Student dashboard data
- `GET /api/diagnostic/summary/` - Diagnostic test summary

#### Writing Module
- `GET /api/writing-tests/` - List active tests
- `POST /api/writing-tests/<id>/start/` - Start test session
- `POST /api/submit-task/` - Submit task draft
- `POST /api/finish-writing-session/` - Complete session
- `POST /api/writing-sessions/<id>/sync/` - Auto-save progress
- `GET /api/essays/` - List essays
- `GET /api/essays/<id>/` - Essay detail

#### Teacher Feedback (Writing)
- `GET /api/teacher/writing/essays/` - Essays awaiting feedback
- `GET /api/teacher/writing/essays/<id>/` - Essay for grading
- `POST /api/teacher/writing/essays/<id>/feedback/` - Save feedback
- `POST /api/teacher/writing/essays/<id>/publish/` - Publish feedback
- `GET /api/writing/essays/<id>/teacher-feedback/` - Student view feedback

#### Listening Module
- `GET /api/listening-tests/` - List active tests
- `POST /api/listening-tests/<id>/start/` - Start session
- `POST /api/listening-sessions/<id>/sync/` - Auto-save answers
- `POST /api/listening-sessions/<id>/submit/` - Submit test
- `GET /api/listening-sessions/<id>/result/` - View results
- `GET /api/listening-sessions/<id>/ai-feedback/` - Get AI feedback

#### Reading Module
- `GET /api/reading-tests/` - List active tests
- `POST /api/reading-tests/<id>/start/` - Start session
- `POST /api/reading-sessions/<id>/sync/` - Auto-save answers
- `POST /api/reading-sessions/<id>/submit/` - Submit test
- `GET /api/reading-sessions/<id>/result/` - View results
- `GET /api/reading-sessions/<id>/ai-feedback/` - Get AI feedback

#### Speaking Module
- `GET /api/teacher/speaking/students/` - Students list
- `GET /api/teacher/speaking/sessions/` - Sessions list
- `GET /api/teacher/speaking/sessions/<id>/` - Session detail
- `POST /api/teacher/speaking/sessions/<id>/` - Create/update session
- `GET /api/speaking/sessions/` - Student's speaking sessions
- `GET /api/speaking/sessions/<id>/` - Session result

#### Admin Endpoints
- `GET /api/admin/students/` - List students
- `POST /api/admin/create-student/` - Create student
- `POST /api/admin/bulk-import-students/` - CSV import
- `GET /api/admin/teachers/` - List teachers
- `POST /api/admin/create-teacher/` - Create teacher
- `POST /api/admin/create-curator/` - Create curator
- `GET /api/admin/student-results/` - Student results view
- `GET /api/admin/<test>/export-csv/` - Export results

#### Curator Endpoints
- `GET /api/curator/students/` - Curator's students
- `GET /api/curator/overview/` - Performance overview
- `GET /api/curator/weekly-overview/` - Weekly stats
- `GET /api/curator/writing-overview/` - Writing stats
- `GET /api/curator/listening-overview/` - Listening stats
- `GET /api/curator/reading-overview/` - Reading stats
- `GET /api/curator/speaking-overview/` - Speaking stats
- `GET /api/curator/test-comparison/` - Test comparison
- `GET /api/curator/student-detail/<id>/` - Student detail

#### Placement Test (Public)
- `GET /api/placement-test/questions/` - Get 20 questions
- `POST /api/placement-test/submit/` - Submit answers
- `GET /api/admin/placement-test-results/` - View submissions

#### Batch APIs
- `POST /api/batch/students/profiles/` - Get multiple student profiles
- `POST /api/batch/students/latest-test-details/` - Latest test info
- `POST /api/batch/students/test-results/` - Test results
- `POST /api/batch/students/test-results-week/` - Weekly results

### API Response Format

**Success:**
```json
{
  "status": "success",
  "data": { ... },
  "message": "Operation successful"
}
```

**Error:**
```json
{
  "status": "error",
  "message": "Error description",
  "errors": { ... }
}
```

### API Features

1. **Auto-Save**: Writing/Listening/Reading sessions auto-save every 30 seconds
2. **Pagination**: List endpoints support pagination
3. **Filtering**: Query parameters for filtering (date ranges, groups, etc.)
4. **CSV Export**: Many endpoints support CSV export
5. **Batch Operations**: Bulk endpoints for efficiency
6. **AI Integration**: Seamless OpenAI GPT-4 integration

---

## Key Features & Modules

### 1. Writing Module

**Features:**
- Two-task format (Task 1: 150 words, Task 2: 250 words)
- Visual prompts (charts, graphs for Task 1)
- Auto-save every 30 seconds
- Timer with time warnings
- AI scoring with GPT-4 Vision
- Teacher feedback with inline annotations
- Draft management

**AI Scoring Criteria:**
- Task Achievement/Response (0-9)
- Coherence & Cohesion (0-9)
- Lexical Resource (0-9)
- Grammatical Range & Accuracy (0-9)
- Overall Band (auto-calculated with IELTS rounding)

**Teacher Features:**
- Rich text annotations
- Detailed feedback per criterion
- Manual score overrides
- Publish/unpublish workflow

### 2. Listening Module

**Features:**
- 4 parts with audio files
- Multiple question types:
  - Multiple choice (single/group)
  - Gap fill
  - Matching
  - Form/Table completion
  - True/False
- Audio player with controls
- Question flagging
- 40-minute timer
- Auto-grading
- Band score calculation (raw score → band score)
- AI-powered feedback on strengths/weaknesses

**Question Types:**
- `multiple_choice`: Standard MCQ
- `multiple_choice_group`: Grouped MCQs (Questions 1-3)
- `gap_fill`: Fill-in-the-blank
- `matching`: Match items to options
- `table`/`form`: Complete tables/forms
- `true_false`: T/F statements

### 3. Reading Module

**Features:**
- 3 passages with questions
- Multiple question types (similar to Listening)
- 60-minute timer
- Passage highlighting/navigation
- Auto-grading
- Band score calculation
- AI-powered feedback

**Scoring Modes:**
- `all_or_nothing`: Full points only if all sub-questions correct
- `per_correct_option`: Partial credit for each correct answer

### 4. Speaking Module

**Features:**
- Teacher-student assessment sessions
- IELTS Speaking criteria (4 bands):
  - Fluency & Coherence
  - Lexical Resource
  - Grammatical Range & Accuracy
  - Pronunciation
- Overall band auto-calculation (IELTS rounding)
- Time markers with notes
- Session duration tracking
- Detailed criterion-specific feedback

**IELTS Rounding Logic:**
```python
# Average of 4 scores
average = (fluency + lexical + grammar + pronunciation) / 4

# Rounding rules:
# < 0.25 → round down
# 0.25 - 0.74 → round to 0.5
# ≥ 0.75 → round up
```

### 5. Diagnostic Testing

**Purpose**: Initial assessment to determine student starting level

**Features:**
- Special tests marked as `is_diagnostic_template=True`
- Automatically assigned to new students
- One-time per module (Listening, Reading, Writing)
- Results tracked separately from regular tests
- Curator dashboard shows diagnostic completion

**How It Works:**
1. Admin marks specific tests as diagnostic templates
2. Students see diagnostic tests in their dashboard
3. First completion sets baseline
4. Regular practice tests tracked separately

### 6. Placement Test (Public)

**Features:**
- Public access (no login required)
- 20 multiple-choice questions
- Auto-scoring (0-20)
- Recommendation: 'pre-ielts' or 'ielts' based on score
- Lead capture (name, email, phone, grade)
- Admin view of all submissions
- CSV export

**Scoring Logic:**
```python
if score >= 12:
    recommendation = 'ielts'  # Ready for IELTS prep
else:
    recommendation = 'pre-ielts'  # Need foundation course
```

### 7. Teacher Satisfaction Survey

**Features:**
- Weekly prompt for students to rate their teacher
- Simple yes/no satisfaction question
- Optional reason if not satisfied
- Admin view of survey results
- Prevents multiple submissions per week
- Reminder system with "Don't remind me" option

### 8. Curator Dashboard

**Features:**
- Multi-student monitoring
- Group-level analytics
- Test completion tracking
- Performance trends over time
- Missing tests/speaking sessions alerts
- CSV exports for reporting
- Weekly overview reports
- Test comparison (e.g., Test 1 vs Test 2)
- Groups ranking

**Available Views:**
- Students overview
- Writing overview
- Listening overview
- Reading overview
- Speaking overview
- Diagnostic results
- Test comparison
- Weekly summary

### 9. Admin Panel

**Features:**
- User management (students, teachers, curators)
- Bulk import students from CSV
- Test builder (drag-and-drop, rich editing)
- Test activation/deactivation
- Clone tests
- Media upload (audio, images)
- System configuration
- Analytics and exports
- Placement test results

**Test Builder Features:**
- Visual question editor
- Multiple question types
- Drag-and-drop reordering
- Image/audio upload
- Preview mode
- Validation before activation
- Clone existing tests

---

## How to Launch Locally

### Prerequisites

- **Python**: 3.12+
- **Node.js**: 20+
- **PostgreSQL**: Latest
- **Firebase Project**: For authentication
- **OpenAI API Key**: For AI features

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd ielts-platform
```

### Step 2: Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
SECRET_KEY=your-django-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=ielts_platform
DB_USER=postgres
DB_PASSWORD=your-postgres-password
DB_HOST=localhost
DB_PORT=5432
OPENAI_API_KEY=your-openai-api-key
EOF

# Place Firebase credentials
# Download from Firebase Console → Project Settings → Service Accounts
# Save as: backend/core/firebase_credentials.json
```

### Step 3: Database Setup

```bash
# Create PostgreSQL database
createdb ielts_platform

# Or using psql
psql -U postgres
CREATE DATABASE ielts_platform;
\q

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# (Optional) Load test data
# If you have db.dump:
pg_restore -U postgres -d ielts_platform ../db.dump
```

### Step 4: Start Backend

```bash
# Development server
python manage.py runserver 8000

# Backend will be available at http://localhost:8000
# Admin panel at http://localhost:8000/admin
```

### Step 5: Frontend Setup

```bash
# Open new terminal
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Create .env file
cat > .env << EOF
REACT_APP_API_BASE_URL=http://localhost:8000/api
EOF

# Update firebase config in src/firebase.js
# Use your Firebase project credentials
```

### Step 6: Start Frontend

```bash
npm start

# Frontend will open at http://localhost:3000
```

### Step 7: Initial Data Setup

```bash
# In backend directory with venv activated

# Mark diagnostic templates (if tests exist)
python mark_diagnostic_templates.py

# Or restore test data from backup
python restore_tests.py
```

### Step 8: Test the Application

1. Open http://localhost:3000
2. Click "Login" or navigate to `/login`
3. Create a Firebase user account
4. Login will auto-create a student user in Django
5. Promote to admin in Django admin panel:
   ```bash
   # Access admin panel
   http://localhost:8000/admin
   
   # Login with superuser credentials
   # Find your user, change role to 'admin'
   ```

### Common Development Commands

```bash
# Backend
python manage.py makemigrations    # Create new migrations
python manage.py migrate           # Apply migrations
python manage.py createsuperuser   # Create admin user
python manage.py collectstatic     # Collect static files
python manage.py shell             # Django shell
python manage.py test              # Run tests

# Frontend
npm start                # Development server
npm run build            # Production build
npm test                 # Run tests
npm run eject            # Eject from CRA (one-way)
```

---

## Deployment

### Production Architecture

**Current Deployment:**
- **Frontend**: https://ielts.mastereducation.kz (Static files on Nginx)
- **Backend**: https://ieltsapi.mastereducation.kz (Gunicorn + Nginx)
- **Database**: PostgreSQL on separate server
- **Media**: Served directly from backend

### Docker Deployment

Both frontend and backend include Dockerfiles for containerized deployment.

#### Backend Dockerfile

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential libpq-dev netcat-openbsd

# Install Python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy application
COPY backend /app

# Prepare entrypoint
RUN sed -i 's/\r$//' /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 8000
CMD ["/app/entrypoint.sh"]
```

**Entrypoint Script** (`backend/entrypoint.sh`):
```bash
#!/bin/sh
set -e

# Wait for PostgreSQL
if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
  echo "Waiting for PostgreSQL..."
  for i in $(seq 1 60); do
    nc -z "$DB_HOST" "$DB_PORT" && break
    sleep 2
  done
fi

# Collect static files
python manage.py collectstatic --noinput

# Run migrations
python manage.py migrate --noinput

# Start Gunicorn
exec gunicorn ielts_platform.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 3 \
  --timeout 120
```

#### Frontend Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
ARG REACT_APP_API_BASE_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
RUN npm run build

# Production stage
FROM nginx:1.27-alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose (Example)

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: ielts_platform
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    environment:
      DEBUG: 'False'
      SECRET_KEY: ${SECRET_KEY}
      DB_NAME: ielts_platform
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      DB_HOST: db
      DB_PORT: 5432
      ALLOWED_HOSTS: ${BACKEND_HOST}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    volumes:
      - ./backend/media:/app/media
      - ./backend/staticfiles:/app/staticfiles
    ports:
      - "8000:8000"
    depends_on:
      - db

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
      args:
        REACT_APP_API_BASE_URL: https://${BACKEND_HOST}/api
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### Manual Deployment Steps

#### Backend Deployment

```bash
# On server
cd /path/to/project/backend

# Update code
git pull origin main

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --noinput

# Run migrations
python manage.py migrate --noinput

# Restart Gunicorn (example using systemd)
sudo systemctl restart ielts-backend
```

#### Frontend Deployment

```bash
# Locally or on CI/CD
cd frontend
npm install --legacy-peer-deps
REACT_APP_API_BASE_URL=https://ieltsapi.mastereducation.kz/api npm run build

# Copy build to server
scp -r build/* user@server:/var/www/ielts-frontend/

# On server, Nginx serves from /var/www/ielts-frontend/
```

### Nginx Configuration (Example)

**Backend Nginx Config:**
```nginx
server {
    listen 80;
    server_name ieltsapi.mastereducation.kz;
    
    client_max_body_size 100M;
    
    location /static/ {
        alias /path/to/backend/staticfiles/;
    }
    
    location /media/ {
        alias /path/to/backend/media/;
    }
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Frontend Nginx Config:**
```nginx
server {
    listen 80;
    server_name ielts.mastereducation.kz;
    root /var/www/ielts-frontend;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Environment Variables for Production

**Backend `.env`:**
```bash
SECRET_KEY=<strong-random-key>
DEBUG=False
ALLOWED_HOSTS=ieltsapi.mastereducation.kz
DB_NAME=ielts_platform
DB_USER=postgres
DB_PASSWORD=<secure-password>
DB_HOST=localhost
DB_PORT=5432
OPENAI_API_KEY=<openai-key>
```

**Frontend `.env.production`:**
```bash
REACT_APP_API_BASE_URL=https://ieltsapi.mastereducation.kz/api
```

### SSL/HTTPS Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d ielts.mastereducation.kz -d ieltsapi.mastereducation.kz

# Auto-renewal (Certbot sets up cron job automatically)
```

---

## Testing

### Backend Testing

**Test Framework**: Django TestCase (built-in)

**Current Status**: Minimal tests in `backend/core/tests.py`

```python
# backend/core/tests.py
from django.test import TestCase

# Tests to be implemented
```

**Run Tests:**
```bash
cd backend
python manage.py test core
```

**Recommended Test Coverage:**
1. Model tests (validation, methods, relationships)
2. API endpoint tests (authentication, permissions, CRUD)
3. AI integration tests (mocked OpenAI calls)
4. Scoring logic tests (band calculation, IELTS rounding)
5. Session management tests (auto-save, completion)

### Frontend Testing

**Test Framework**: React Testing Library + Jest

**Current Status**: Basic setup in `src/setupTests.js` and `src/App.test.js`

```javascript
// src/setupTests.js
import '@testing-library/jest-dom';

// src/App.test.js
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
```

**Run Tests:**
```bash
cd frontend
npm test
```

**Recommended Test Coverage:**
1. Component rendering tests
2. User interaction tests (clicking, typing)
3. Form validation tests
4. API mock tests
5. Authentication flow tests
6. Timer functionality tests

### Manual Testing Checklist

**Student Flow:**
- [ ] Login/Register
- [ ] View dashboard
- [ ] Start diagnostic test
- [ ] Complete Listening test
- [ ] Complete Reading test
- [ ] Complete Writing test
- [ ] View results and feedback
- [ ] Submit teacher satisfaction survey

**Teacher Flow:**
- [ ] Login as teacher
- [ ] View pending essays
- [ ] Add annotations and feedback
- [ ] Publish feedback
- [ ] Conduct speaking assessment
- [ ] View student progress

**Curator Flow:**
- [ ] Login as curator
- [ ] View assigned students
- [ ] Check weekly overview
- [ ] Export CSV reports
- [ ] Compare test results
- [ ] Monitor diagnostic completion

**Admin Flow:**
- [ ] Login as admin
- [ ] Create student accounts
- [ ] Bulk import students
- [ ] Create listening test
- [ ] Create reading test
- [ ] Create writing test
- [ ] Activate/deactivate tests
- [ ] View all results
- [ ] Export data

### Integration Testing

Test external integrations:

**Firebase:**
```bash
# Test authentication flow
curl -X POST http://localhost:8000/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"idToken": "valid-firebase-token"}'
```

**OpenAI:**
```bash
# Test AI scoring (requires valid OPENAI_API_KEY)
# Submit an essay and check if AI scores are generated
```

---

## Scripts & Utilities

### Backend Scripts

#### 1. Mark Diagnostic Templates

**File**: `backend/mark_diagnostic_templates.py`

**Purpose**: Mark specific tests as diagnostic templates

**Usage:**
```bash
cd backend
python mark_diagnostic_templates.py

# Interactive prompts to select tests
```

**What it does:**
- Lists all active tests (Listening, Reading, Writing)
- Allows selection of one test per module
- Marks selected tests with `is_diagnostic_template=True`
- Used for diagnostic test flow

#### 2. Restore Tests from Export

**File**: `backend/restore_tests.py`

**Purpose**: Restore Listening and Reading tests from a ZIP export

**Usage:**
```bash
cd backend
# Ensure my_tests_export.zip is present
python restore_tests.py
```

**What it does:**
- Extracts test data from `my_tests_export.zip`
- Restores test structure (tests, parts, questions, options)
- Copies audio files to media directory
- Converts question types (e.g., multiple_choice to multiple_choice_group)

#### 3. Student Score Report

**File**: `backend/scripts/student_last8_scores.py`

**Purpose**: Generate TSV report of student scores (last 8 tests)

**Usage:**
```bash
cd backend
python scripts/student_last8_scores.py > report.tsv

# Configuration options in script:
LIMIT = 8                    # Number of tests per student
INCLUDE_DIAGNOSTIC = False   # Include/exclude diagnostic tests
MODE = "per_module"          # "per_module" or "combined"
```

**Output:**
```
student_id	name	group	module	session_id	test_title	band	raw	total	completed_at
```

#### 4. Update Student Emails

**File**: `backend/scripts/update_student_emails.py`

**Purpose**: Bulk update student emails from CSV

**Usage:**
```bash
cd backend

# Prepare CSV with columns: platform_id, new_email
# Adjust configuration in script:
CSV_PATH = '/app/scripts/platform_emails.csv'
LOOKUP_FIELD = 'student_id'  # or 'id'
DRY_RUN = True               # Test first, then set to False

python scripts/update_student_emails.py
```

**Features:**
- CSV parsing with auto-delimiter detection
- Dry-run mode for safety
- Email validation
- Duplicate detection
- Progress logging

### Database Migrations

**Location**: `backend/core/migrations/`

**Total**: 41 migrations

**Key Migrations:**
- `0001_initial.py`: Initial schema
- `0011_teacher_feedback_and_assignment.py`: Teacher feedback system
- `0016_speakingassessment_*.py`: Speaking module
- `0022_writingtest_writingtask_*.py`: Writing refactor
- `0029_*_is_diagnostic_template.py`: Diagnostic test support
- `0034_placementtest_models.py`: Placement test
- `0041_add_ai_feedback_fields.py`: AI feedback support

**Run All Migrations:**
```bash
python manage.py migrate
```

**Create New Migration:**
```bash
python manage.py makemigrations core
```

**Show Migration Status:**
```bash
python manage.py showmigrations core
```

---

## Configuration

### Django Settings

**File**: `backend/ielts_platform/settings.py`

**Key Configuration:**

```python
# Time zone
TIME_ZONE = 'Asia/Almaty'

# Authentication
AUTH_USER_MODEL = 'core.User'
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'core.auth.FirebaseAuthentication',
    ],
}

# CORS
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'https://ielts.mastereducation.kz',
    'https://ieltsapi.mastereducation.kz',
]

# File Upload
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024

# Media Files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING' if not DEBUG else 'INFO',
    },
}
```

### React Configuration

**File**: `frontend/package.json`

```json
{
  "proxy": "http://localhost:8000",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

**Proxy**: Requests to `/api/*` are proxied to backend during development

### TailwindCSS Configuration

**File**: `frontend/tailwind.config.js`

```javascript
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### Firebase Configuration

**Frontend**: `frontend/src/firebase.js`
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyCGaTlQrpo0EB7H-EP7PYR_QeBHIl0oE-c",
  authDomain: "ielts-project-6259a.firebaseapp.com",
  projectId: "ielts-project-6259a",
  // ...
};
```

**Backend**: `backend/core/firebase_credentials.json` (gitignored)
- Download from Firebase Console
- Project Settings → Service Accounts → Generate new private key

---

## Troubleshooting

### Common Issues

#### 1. Firebase Authentication Errors

**Problem**: "Invalid Firebase token" or 401 errors

**Solutions:**
```bash
# Check Firebase credentials file exists
ls backend/core/firebase_credentials.json

# Verify token in browser console
localStorage.getItem('token')

# Try refreshing token
auth.currentUser.getIdToken(true)

# Check Firebase project settings match frontend config
```

#### 2. Database Connection Errors

**Problem**: "could not connect to server"

**Solutions:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U postgres -d ielts_platform

# Verify .env settings
cat backend/.env | grep DB_

# Check ALLOWED_HOSTS includes your domain
```

#### 3. CORS Errors

**Problem**: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Solutions:**
```python
# In backend/ielts_platform/settings.py
# Add your frontend URL to CORS_ALLOWED_ORIGINS

CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'https://your-frontend-domain.com',
]

# Also add to CSRF_TRUSTED_ORIGINS
```

#### 4. Media Files Not Loading

**Problem**: Images/audio not loading

**Solutions:**
```bash
# Check MEDIA_URL and MEDIA_ROOT in settings.py
# Verify Nginx/Apache serves /media/ correctly
# Check file permissions
chmod -R 755 backend/media/

# For development:
python manage.py runserver  # Django serves media in DEBUG mode
```

#### 5. OpenAI API Errors

**Problem**: "AI scoring failed" or AI feedback not working

**Solutions:**
```bash
# Check API key is set
echo $OPENAI_API_KEY

# Verify in Django shell
python manage.py shell
>>> import os
>>> os.environ.get('OPENAI_API_KEY')

# Check API quota/billing at platform.openai.com
# Try with a simple test essay to verify API connection
```

#### 6. Migration Errors

**Problem**: "No such table" or migration conflicts

**Solutions:**
```bash
# Show current migration status
python manage.py showmigrations core

# If database is corrupted, reset (CAUTION: loses data)
python manage.py migrate core zero
python manage.py migrate core

# Or recreate database
dropdb ielts_platform
createdb ielts_platform
python manage.py migrate
```

#### 7. Frontend Build Errors

**Problem**: npm install or build fails

**Solutions:**
```bash
# Clear node_modules and package-lock
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Clear npm cache
npm cache clean --force

# Try with Node 20 LTS
nvm use 20
npm install --legacy-peer-deps
```

#### 8. Session/Timer Issues

**Problem**: Test sessions not saving or timer not working

**Solutions:**
```javascript
// Check browser console for errors
// Verify localStorage is enabled
// Check auto-save requests in Network tab

// Clear localStorage if corrupted
localStorage.clear()
// Then re-login
```

#### 9. Permission Denied Errors

**Problem**: Users can't access certain pages/endpoints

**Solutions:**
```python
# Check user role in Django admin
# Verify role in localStorage
localStorage.getItem('role')

# Check view permissions in backend/core/views.py
# Ensure user.role matches required permission
```

#### 10. Test Activation Issues

**Problem**: "Test validation failed" when activating

**Solutions:**
```bash
# Check test has all required fields:
# - At least one part
# - Each part has questions
# - Questions have correct_answers
# - Question types are valid

# Use admin panel to review test structure
# Fix validation errors listed in response
```

### Debugging Tips

**Backend Debugging:**
```python
# Add print statements in views
print(f"User: {request.user}, Role: {request.user.role}")

# Use Django shell for queries
python manage.py shell
>>> from core.models import User, Essay
>>> User.objects.filter(role='student').count()

# Enable DEBUG mode temporarily
DEBUG = True  # in settings.py
```

**Frontend Debugging:**
```javascript
// Console log API responses
console.log('API Response:', response.data);

// Check authentication state
console.log('User:', auth.currentUser);
console.log('Token:', localStorage.getItem('token'));

// Use React DevTools for component inspection
```

**Network Debugging:**
```bash
# Monitor backend logs
tail -f /var/log/gunicorn/error.log

# Check Nginx logs
tail -f /var/log/nginx/error.log

# Test API endpoints with curl
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/user/profile/
```

### Getting Help

1. **Check logs**: Backend and frontend console logs
2. **Django admin**: Review data in admin panel
3. **Firebase Console**: Check authentication logs
4. **OpenAI Dashboard**: Verify API usage and errors
5. **Database**: Query PostgreSQL directly to verify data

---

## Summary

This IELTS Platform is a comprehensive, production-ready application with:

✅ **Complete IELTS test suite** (Listening, Reading, Writing, Speaking)  
✅ **AI-powered scoring and feedback** using OpenAI GPT-4  
✅ **Multi-role support** (Student, Teacher, Curator, Admin)  
✅ **Firebase authentication** with auto user creation  
✅ **Real-time test sessions** with auto-save  
✅ **Diagnostic testing** for student placement  
✅ **Public placement test** for lead generation  
✅ **Teacher feedback workflow** with inline annotations  
✅ **Speaking assessment** with IELTS criteria  
✅ **Curator analytics** with CSV exports  
✅ **Admin test builder** with drag-and-drop interface  
✅ **Dockerized deployment** ready for production  
✅ **Mobile-responsive** design with TailwindCSS  

### Architecture Highlights

- **Backend**: Django 5 + DRF + PostgreSQL + Firebase Auth + OpenAI
- **Frontend**: React 19 + Material-UI + TailwindCSS + Axios
- **Deployment**: Docker + Gunicorn + Nginx
- **Production**: https://ielts.mastereducation.kz

### Next Steps for New Maintainer

1. **Set up local environment** following [How to Launch Locally](#how-to-launch-locally)
2. **Review database schema** to understand data model
3. **Explore API endpoints** in Postman or curl
4. **Test key user flows** manually
5. **Add automated tests** for critical features
6. **Review security** (secrets, permissions, CORS)
7. **Monitor production** logs and performance
8. **Plan improvements** based on user feedback

### Important Files to Know

- `backend/core/models.py` - All database models
- `backend/core/views.py` - All API endpoints (36k lines!)
- `backend/core/serializers.py` - Data serialization
- `backend/ielts_platform/settings.py` - Configuration
- `frontend/src/App.js` - Route definitions
- `frontend/src/api.js` - API client
- `frontend/src/firebase.js` - Auth configuration

### Maintenance Tasks

**Regular:**
- Monitor server logs
- Check disk space (media files grow)
- Review AI API costs (OpenAI)
- Backup database regularly

**Periodic:**
- Update dependencies (security patches)
- Review and archive old test sessions
- Export analytics for reporting
- Clean up unused media files

**As Needed:**
- Create new test content
- Add new question types
- Adjust band score calculations
- Improve AI prompts
- Enhance UI/UX based on feedback

---

**Document Version**: 1.0  
**Last Updated**: February 7, 2026  
**Maintained By**: Development Team  
**Contact**: [Your contact information]
