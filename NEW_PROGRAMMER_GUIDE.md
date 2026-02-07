# New Programmer Guide - IELTS Platform

**Updated**: February 7, 2026  
**Status**: Critical security fixes applied, refactoring needed

---

## 🚀 Quick Start (First Hour)

### 1. Clone and Setup Backend
```bash
cd ielts-platform/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (REQUIRED!)
cp .env.example .env
# Edit .env and set:
# - SECRET_KEY (generate with command in .env.example)
# - DB_PASSWORD
# - OPENAI_API_KEY

# Setup database
createdb ielts_platform  # or use existing db.dump
python manage.py migrate
python manage.py createsuperuser

# Run server
python manage.py runserver 8000
```

### 2. Setup Frontend
```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Create .env file
cp .env.example .env

# Start development server
npm start  # Opens http://localhost:3000
```

### 3. Firebase Setup
- Download `firebase_credentials.json` from Firebase Console
- Place in `backend/core/firebase_credentials.json`
- Update `frontend/src/firebase.js` with your Firebase config if needed

---

## 🔴 CRITICAL: What Was Just Fixed (Feb 7, 2026)

### Security Vulnerabilities Resolved

#### 1. **SECRET_KEY Security** ✅ FIXED
- **Before**: Hardcoded insecure default key
- **After**: MUST be set in environment or app won't start
- **Impact**: Prevents session forgery

#### 2. **Authentication Bypass** ✅ FIXED
- **Before**: 60+ endpoints had `permission_classes = [AllowAny]`
- **After**: Default `IsAuthenticated` required for all endpoints
- **Only exceptions**: 
  - `/api/login/` (obviously must be public)
  - `/api/placement-test/*` (public lead generation)
- **Impact**: Cannot access API without valid Firebase token

#### 3. **CSRF Protection** ✅ FIXED
- **Before**: `CsrfExemptAPIView` disabled CSRF protection
- **After**: CSRF protection fully enabled
- **Impact**: Prevents cross-site request forgery attacks

#### 4. **Environment Security** ✅ FIXED
- **Before**: No .env.example, secrets unclear
- **After**: Clear .env.example files for both backend/frontend
- **Impact**: Developers know exactly what secrets are needed

---

## ⚠️ REMAINING ISSUES (Prioritized)

### HIGH PRIORITY - Code Quality

#### 1. **Monolithic Files** (1-2 weeks effort)
```
backend/core/views.py        7,950 lines  ❌ TOO LARGE
backend/core/serializers.py  2,883 lines  ❌ TOO LARGE
```

**Problem**: Impossible to maintain, slow IDE, merge conflicts

**Solution**: Split into modules:
```
backend/core/views/
├── __init__.py
├── auth.py           # Login, profile
├── writing.py        # Writing test views
├── listening.py      # Listening test views
├── reading.py        # Reading test views
├── speaking.py       # Speaking views
├── teacher.py        # Teacher feedback views
├── curator.py        # Curator dashboard
├── admin.py          # Admin management
└── placement.py      # Placement test
```

#### 2. **No Tests** (1 week effort)
- **Current**: 0% test coverage
- **Risk**: Cannot refactor safely, bugs go undetected
- **Priority**: Write tests BEFORE splitting views.py

**Recommended tests**:
```python
# tests/test_auth.py
def test_firebase_token_required()
def test_invalid_token_rejected()
def test_user_role_permissions()

# tests/test_writing_api.py
def test_start_writing_session()
def test_submit_essay()
def test_ai_scoring()

# tests/test_security.py
def test_secret_key_required()
def test_csrf_protection()
def test_file_upload_validation()
```

#### 3. **Firebase API Key in Source Code** (30 min effort)
**File**: `frontend/src/firebase.js:5`
```javascript
apiKey: "AIzaSyCGaTlQrpo0EB7H-EP7PYR_QeBHIl0oE-c",  // ⚠️ In source code
```

**Note**: Firebase API keys are meant to be public for client-side SDKs, BUT:
- **Action Required**: Verify Firebase security rules are restrictive
- **Better**: Move to environment variables anyway
- **Critical**: Enable Firebase App Check for additional security

### MEDIUM PRIORITY

#### 4. **Input Validation** (3 days)
- No validation on essay submissions (can send 100MB of text)
- No sanitization of HTML in feedback
- File upload validation is basic (extension only)

**Fix**:
```python
# In serializers
class EssaySerializer(serializers.ModelSerializer):
    submitted_text = serializers.CharField(max_length=5000)  # Add limits
    
    def validate_submitted_text(self, value):
        if len(value) < 50:
            raise ValidationError("Essay too short")
        return value
```

#### 5. **Error Handling** (2 days)
**Current**: 30+ bare `except Exception:` clauses

**Fix**:
```python
# Bad
try:
    result = process_data()
except Exception:
    pass  # ❌ Hides all errors

# Good
import logging
logger = logging.getLogger(__name__)

try:
    result = process_data()
except SpecificException as e:
    logger.error(f"Processing failed: {e}", exc_info=True)
    return Response({"error": "Processing failed"}, status=500)
```

#### 6. **Print Statements** (1 hour)
Found 2 debug print statements in production code:
```python
# backend/core/views.py:7164-7166
print(f"Reading session found: completed={session.completed}")
print(f"Session has result: {has_result}")
```

**Fix**: Replace with proper logging

---

## 📊 Project Structure

### Backend (Django REST Framework)
```
backend/
├── core/                    # Main application
│   ├── models.py           # 496 lines - Data models (User, Tests, Sessions)
│   ├── views.py            # 7,950 lines - ALL API endpoints ⚠️
│   ├── serializers.py      # 2,883 lines - DRF serializers ⚠️
│   ├── urls.py             # 272 lines - URL routing
│   ├── auth.py             # 24 lines - Firebase authentication
│   ├── permissions.py      # 22 lines - Role permissions
│   ├── utils.py            # 316 lines - AI scoring utilities
│   ├── ai_feedback.py      # 326 lines - OpenAI integration
│   └── migrations/         # 41 migration files
├── ielts_platform/
│   └── settings.py         # Django configuration
├── manage.py
└── requirements.txt
```

### Frontend (React 19)
```
frontend/
├── src/
│   ├── pages/             # 53 page components
│   ├── components/        # 34 reusable components
│   ├── firebase.js        # Firebase auth setup
│   ├── api.js             # Axios API client
│   └── App.js             # Main routing
├── package.json
└── tailwind.config.js
```

---

## 🔑 Key Concepts

### Authentication Flow
1. User logs in via Firebase (email/Google)
2. Frontend receives Firebase ID token
3. Token sent in `Authorization: Bearer <token>` header
4. Backend validates token using Firebase Admin SDK
5. User retrieved/created in Django based on `uid`
6. Request proceeds with `request.user` available

### User Roles
- `student` - Take tests, view results
- `teacher` - Grade essays, provide feedback
- `speaking_mentor` - Speaking assessments only
- `curator` - Monitor student groups
- `admin` - Full system access
- `placement_viewer` - View placement results only

### Test Modules
1. **Writing** - 2 tasks (Task 1: 150 words, Task 2: 250 words)
   - AI scoring with GPT-4 Vision
   - Teacher feedback with inline annotations
   
2. **Listening** - 4 parts, 40 minutes
   - Multiple question types (MCQ, gap fill, matching)
   - Auto-graded with band score calculation
   - AI-powered feedback

3. **Reading** - 3 passages, 60 minutes
   - Similar to Listening (auto-graded)
   - Band score calculation
   - AI feedback

4. **Speaking** - Teacher-student assessment
   - 4 IELTS criteria (Fluency, Lexical, Grammar, Pronunciation)
   - Manual scoring with IELTS rounding

5. **Placement Test** - Public test for prospective students
   - 20 multiple-choice questions
   - Auto-scored, generates recommendation
   - Lead capture (name, email, phone)

---

## 🛠️ Development Workflow

### Making Changes

1. **Create feature branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make changes**
- Follow existing code style
- Update relevant serializers
- Add proper permissions

3. **Test locally**
```bash
# Backend
python manage.py test core

# Frontend
npm test
```

4. **Commit and push**
```bash
git add .
git commit -m "feat: description of changes"
git push origin feature/your-feature-name
```

### Adding a New API Endpoint

```python
# 1. Add view in core/views.py (or better: in a new module)
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsTeacher

class MyNewView(APIView):
    permission_classes = [IsAuthenticated, IsTeacher]
    
    def get(self, request):
        # Your logic
        return Response({"data": "..."})

# 2. Add URL in core/urls.py
urlpatterns = [
    path('my-endpoint/', MyNewView.as_view(), name='my-endpoint'),
]

# 3. Test with curl
curl -H "Authorization: Bearer <firebase-token>" \
  http://localhost:8000/api/my-endpoint/
```

---

## 🔒 Security Checklist (For Every Change)

- [ ] **Authentication**: Does endpoint require login?
- [ ] **Authorization**: Is user role checked?
- [ ] **Input Validation**: Are inputs validated?
- [ ] **Output Sanitization**: Is HTML/JS escaped?
- [ ] **File Uploads**: Are files validated (type, size, content)?
- [ ] **Error Messages**: Do errors expose sensitive info?
- [ ] **Logging**: Are security events logged?

---

## 🐛 Common Issues & Solutions

### Issue: "SECRET_KEY environment variable must be set"
**Solution**: Create backend/.env and add SECRET_KEY
```bash
cd backend
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
# Copy output to .env as SECRET_KEY=...
```

### Issue: "Invalid Firebase token" (401 errors)
**Solution**: 
1. Check `firebase_credentials.json` exists
2. Verify Firebase project matches frontend config
3. Try refreshing token: `auth.currentUser.getIdToken(true)`

### Issue: "CORS policy" errors
**Solution**: Add your frontend URL to `settings.py`:
```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',  # Your frontend URL
]
```

### Issue: Database connection errors
**Solution**: 
1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Verify .env database credentials
3. Test connection: `psql -U postgres -d ielts_platform`

---

## 📈 Performance Tips

### Database Queries
```python
# Bad - N+1 queries
for session in sessions:
    print(session.user.name)  # Each user fetched separately

# Good - Single query
sessions = sessions.select_related('user')
for session in sessions:
    print(session.user.name)
```

### API Pagination
```python
# For large lists, always paginate
class MyViewSet(viewsets.ModelViewSet):
    pagination_class = PageNumberPagination
```

---

## 🎯 Refactoring Roadmap (Next 6 Weeks)

### Week 1-2: Foundation
- [ ] Write critical tests (auth, permissions, key endpoints)
- [ ] Set up CI/CD with automated testing
- [ ] Document all API endpoints (OpenAPI/Swagger)

### Week 3-4: Code Quality
- [ ] Split views.py into modules
- [ ] Split serializers.py into modules  
- [ ] Remove code duplication (manual token parsing)
- [ ] Fix error handling (replace bare except)

### Week 5: Security & Validation
- [ ] Add input validation to all serializers
- [ ] Implement file upload validation (MIME types, virus scanning)
- [ ] Add rate limiting
- [ ] Security audit & penetration testing

### Week 6: Polish
- [ ] Performance optimization
- [ ] Add monitoring (Sentry)
- [ ] Documentation updates
- [ ] Production deployment prep

---

## 📚 Resources

### Django & DRF
- [Django Documentation](https://docs.djangoproject.com/)
- [DRF Documentation](https://www.django-rest-framework.org/)
- [Django Security Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)

### Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Django Security Best Practices](https://docs.djangoproject.com/en/stable/topics/security/)

### Firebase
- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

### Testing
- [Django Testing](https://docs.djangoproject.com/en/stable/topics/testing/)
- [pytest-django](https://pytest-django.readthedocs.io/)

---

## 🚨 CRITICAL: Before Going to Production

1. **Environment Variables**
   - [ ] All secrets in environment (not code)
   - [ ] Strong SECRET_KEY generated
   - [ ] DEBUG=False
   - [ ] ALLOWED_HOSTS configured

2. **Security**
   - [ ] HTTPS enabled
   - [ ] Firebase security rules verified
   - [ ] CORS origins restricted to production domains
   - [ ] Rate limiting enabled
   - [ ] File upload validation complete

3. **Database**
   - [ ] Backups automated
   - [ ] Database credentials secured
   - [ ] Connection pooling configured

4. **Monitoring**
   - [ ] Error tracking (Sentry/similar)
   - [ ] Performance monitoring
   - [ ] Security monitoring
   - [ ] Uptime monitoring

5. **Testing**
   - [ ] Unit tests passing
   - [ ] Integration tests passing
   - [ ] Security scan completed
   - [ ] Load testing done

---

## 💬 Getting Help

### Current Issues
- **Monolithic views.py**: Makes everything harder. Top priority to split.
- **No tests**: Dangerous to refactor without tests. Write tests first.
- **Manual auth everywhere**: Fixed by DRF defaults, but check edge cases.

### Questions to Ask Previous Developer (if available)
1. Why was CSRF protection disabled originally?
2. Are there any undocumented features or workarounds?
3. What's the backup/restore procedure for production?
4. Any known bugs or limitations?

### When You're Stuck
1. Check Django/DRF documentation first
2. Search error messages in GitHub issues
3. Review existing similar endpoints in codebase
4. Ask for code review before merging large changes

---

## 🎓 Learning Path

### Week 1: Basics
- [ ] Understand Django models and migrations
- [ ] Learn DRF serializers and views
- [ ] Study Firebase authentication flow
- [ ] Set up local development environment

### Week 2: Architecture
- [ ] Map out all user flows
- [ ] Understand test modules (Writing, Listening, etc.)
- [ ] Study AI scoring integration
- [ ] Review role-based permissions

### Week 3: Advanced
- [ ] Learn OpenAI API integration
- [ ] Understand IELTS scoring algorithms
- [ ] Study teacher feedback system
- [ ] Master Django ORM optimization

### Week 4: Production Ready
- [ ] Security best practices
- [ ] Performance optimization
- [ ] Monitoring and logging
- [ ] Deployment procedures

---

**Status**: ✅ Critical security fixes applied (Feb 7, 2026)  
**Next Steps**: Write tests, then split views.py into modules  
**Estimated Full Refactor**: 6 weeks (1 developer)

**Good luck! The foundation is solid - just needs proper organization.**
