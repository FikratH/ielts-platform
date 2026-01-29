# Документация по Batch API эндпоинтам IELTS

## Общая информация
Эти эндпоинты позволяют получить данные сразу по **нескольким студентам** в одном запросе (профиль, последние попытки, история попыток).  
**Base URL:** `https://ieltsapi.mastereducation.kz/api`

## 🔐 Аутентификация
Все batch‑эндпоинты требуют Firebase ID token в заголовке:  
```
Authorization: Bearer <id_token>
```
Доступные роли: `admin`, `curator`. При других ролях вернётся 403.

## 📋 Общий формат запроса
```json
{
  "emails": ["student1@example.com", "student2@example.com"],
  "limit": 50,
  "includeDiagnostics": false
}
```
**Параметры:**
- `emails` (array, обязательно) — список email студентов; регистр игнорируется; дубликаты удаляются.
- `limit` (int, опционально, по умолчанию 50) — сколько email обработать.
- `includeDiagnostics` (bool, опционально, по умолчанию false) — включать ли диагностические попытки (listening/reading/writing).
- `perModuleLimit` (int, опционально, по умолчанию 10) — только для `/test-results`, ограничение количества записей по каждому модулю.

Особенности:
- Если в списке больше, чем `limit`, обрабатываются первые N после дедупликации.
- Для отсутствующих студентов возвращается `error`.

---

## 1️⃣ POST `/api/batch/students/profiles/`
**Описание:** Базовые профили студентов.

### Пример запроса
```bash
curl -X POST "https://ieltsapi.mastereducation.kz/api/batch/students/profiles/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <id_token>" \
  -d '{
    "emails": ["student1@test.com", "student2@test.com"],
    "limit": 10
  }'
```

### Пример ответа
```json
{
  "total": 2,
  "processed": 2,
  "limit": 10,
  "results": [
    {
      "email": "student1@test.com",
      "data": {
        "fullName": "Aruzhan Bek",
        "firstName": "Aruzhan",
        "lastName": "Bek",
        "studentId": "2024001",
        "email": "student1@test.com",
        "group": "IELTS Evening A1",
        "teacher": "John Doe",
        "curatorId": "CUR-12",
        "status": "Active"
      }
    },
    { "email": "student2@test.com", "error": "Student not found" }
  ]
}
```

**Поля ответа:** `total`, `processed`, `limit`, `results[].email`, `results[].data` (или `error`).

---

## 2️⃣ POST `/api/batch/students/latest-test-details/`
**Описание:** Последние завершённые попытки по каждому модулю (Listening, Reading, Writing, Speaking) + средний band.

### Пример запроса
```bash
curl -X POST "https://ieltsapi.mastereducation.kz/api/batch/students/latest-test-details/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <id_token>" \
  -d '{
    "emails": ["student1@test.com"],
    "includeDiagnostics": false
  }'
```

### Пример ответа (усечённый)
```json
{
  "total": 1,
  "processed": 1,
  "limit": 50,
  "results": [
    {
      "email": "student1@test.com",
      "data": {
        "studentId": "2024001",
        "fullName": "Aruzhan Bek",
        "listeningTest": {
          "sessionId": 134,
          "testId": 12,
          "testTitle": "Listening Practice 05",
          "completedAt": "2026-01-18T12:10:00Z",
          "rawScore": 32,
          "bandScore": 7.0,
          "submitted": true
        },
        "readingTest": {
          "sessionId": 88,
          "testId": 9,
          "testTitle": "Reading Practice 04",
          "endTime": "2026-01-16T09:20:00Z",
          "rawScore": 30,
          "bandScore": 6.5,
          "completed": true
        },
        "writing": {
          "essayId": 512,
          "taskType": "task2",
          "submittedAt": "2026-01-17T15:40:00Z",
          "overallBand": 6.5,
          "teacherFeedback": { "published": true, "teacherOverallScore": 6.5 }
        },
        "speaking": {
          "sessionId": 41,
          "conductedAt": "2026-01-15T18:00:00Z",
          "overallBandScore": 6.5,
          "completed": true
        },
        "overallBandApprox": 6.5
      }
    }
  ]
}
```

Особенности:
- Берутся самые свежие завершённые/отправленные попытки по каждому модулю.
- `overallBandApprox` — среднее по доступным band score (IELTS‑округление).
- При `includeDiagnostics=false` диагностические сессии исключаются.

---

## 3️⃣ POST `/api/batch/students/test-results/`
**Описание:** История попыток по модулям с ограничением количества записей.

### Доп. параметры запроса
- `perModuleLimit` (int, default 10) — сколько последних записей вернуть по каждому модулю.

### Пример запроса
```bash
curl -X POST "https://ieltsapi.mastereducation.kz/api/batch/students/test-results/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <id_token>" \
  -d '{
    "emails": ["student1@test.com"],
    "limit": 20,
    "perModuleLimit": 5
  }'
```

### Пример ответа (усечённый)
```json
{
  "total": 1,
  "processed": 1,
  "results": [
    {
      "email": "student1@test.com",
      "data": {
        "listeningSessions": [
          { "sessionId": 134, "testTitle": "Listening Practice 05", "bandScore": 7.0 }
        ],
        "readingSessions": [
          { "sessionId": 88, "testTitle": "Reading Practice 04", "bandScore": 6.5 }
        ],
        "essays": [
          { "essayId": 512, "taskType": "task2", "overallBand": 6.5, "teacherFeedbackPublished": true }
        ],
        "speakingSessions": [
          { "sessionId": 41, "overallBandScore": 6.5, "conductedAt": "2026-01-15T18:00:00Z" }
        ]
      }
    }
  ]
}
```

Особенности:
- Возвращает до `perModuleLimit` последних записей по каждому модулю.
- При `includeDiagnostics=false` диагностические сессии не включаются.

---

## 🔴 Коды ошибок
- **400 Bad Request** — пустой или некорректный `emails`, `limit < 1`, `perModuleLimit < 1`.
- **401 Unauthorized** — отсутствует/некорректный Bearer токен.
- **403 Forbidden** — роль не `admin`/`curator`.
- **404 Not Found** — студент не найден (внутри `results[].error`).
- **429 Too Many Requests** — при необходимости может быть добавлен лимит.

---

## 💡 Пример использования (Fetch API)
```javascript
async function getBatchProfiles(emails, idToken) {
  const res = await fetch('https://ieltsapi.mastereducation.kz/api/batch/students/profiles/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ emails, limit: 100 })
  });
  return res.json();
}
```

## Как получить ID token (два пути)
**Вариант A — сервисный (рекомендуем для внешних сервисов):**
1) Нужны:  
   - `apiKey`: `AIzaSyCGaTlQrpo0EB7H-EP7PYR_QeBHIl0oE-c`  
   - JSON сервисного аккаунта (`firebase-adminsdk-*.json`, не хранить в гите)  
   - `uid` сервисного пользователя с нужной ролью (например `vyr6Jb6ZXUb4hVEeVSDSFi7U9tv2`)
2) Генерируем custom token у себя (Node.js пример):
   ```js
   import admin from "firebase-admin";
   import fs from "fs";
   admin.initializeApp({
     credential: admin.credential.cert(
       JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, "utf8"))
     ),
   });
   const token = await admin.auth().createCustomToken(process.env.SERVICE_UID);
   console.log(token);
   ```
3) Меняем custom token на ID token:
   ```bash
   curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}" \
     -H "Content-Type: application/json" \
     -d "{\"token\":\"$CUSTOM_TOKEN\",\"returnSecureToken\":true}"
   ```
   Из ответа берем `idToken`.
4) Используем его во всех вызовах: `Authorization: Bearer <idToken>`.

**Вариант B — через пользовательский логин (фронт):**
- Авторизуемся как реальный админ/куратор через Firebase (email+password или Google).  
- Берём ID token из ответа Firebase Auth (например через фронт/SDK) и передаём его в `Authorization: Bearer ...`.  
- Подходит для внутренних тулзов и ручных проверок, но для прод‑сервисов лучше Вариант A.

Зачем это нужно: ID token доказывает роль и живёт недолго (TTL), поэтому безопаснее, чем жёсткий API‑ключ.

## Как получить ответы на вопросы (опционально)
- В тело запроса добавьте `includeAnswers: true`.  
- В `/latest-test-details/` и `/test-results/` появится:
  - Listening: `answers` — список `{question_id, answer, flagged, submitted_at}`.  
  - Reading: `answers` — JSON из сессии (`question_id: answer`).  
  - Writing: текст эссе уже включён (`submittedText`).  
Если не нужен объёмный payload, оставьте `includeAnswers` по умолчанию `false`.

## Быстрый чек‑лист интеграции
1) Получите Firebase ID token для админа/куратора.  
2) Передавайте `Authorization: Bearer <token>` в каждый запрос.  
3) Для истории задайте `perModuleLimit` (например 5) и при необходимости `includeDiagnostics=true`.  
4) Обрабатывайте `results[].error` для отсутствующих студентов.
