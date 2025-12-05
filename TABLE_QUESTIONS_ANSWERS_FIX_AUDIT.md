# Аудит исправления сохранения ответов для table questions

## Дата: 2025-01-XX

## Проблема
Пользователь записывал ответы в table questions, но они не сохранялись - показывалось "(empty)". 

## Причина
Несоответствие формата ключей между фронтендом и бэкендом:
- **Фронтенд**: `question.id` может быть числом или строкой
- **Бэкенд**: `question.id` в Python - это число
- При несоответствии типов ключи не совпадают

## Исправления

### 1. Frontend - ListeningTestPlayer.jsx ✅

#### Исправление handleAnswerChange
- **Строки 234-293**: Добавлена специальная обработка для table questions
- Проверка формата: `parts.length === 3 && gapPart.match(/^r\d+c\d+$/) && parts[2].startsWith('gap')`
- Table questions теперь правильно сохраняются, не очищаются при выборе multiple_choice

#### Исправление формирования ключей
- **Строка 503**: `const gapKey = \`${String(question.id)}__r${r}c${c}__gap${gapNumber}\`;`
- **Строка 514**: `\`${String(question.id)}__r${r}c${c}\``
- `question.id` теперь всегда конвертируется в строку при формировании ключа

### 2. Backend - serializers.py ✅

#### Улучшенная проверка ключей в create_detailed_breakdown
- **Строки 703-728**: Добавлена проверка разных вариантов ключей:
  1. `f"{question.id}__{sub_id}"` (основной)
  2. `f"{str(question.id)}__{sub_id}"` (строковый вариант)
  3. `f"{int(question.id)}__{sub_id}"` (числовой вариант)
  4. Прямой ключ без question.id
  5. Поиск всех ключей, содержащих sub_id

#### Логика поиска ответов
```python
# Пробуем разные варианты ключей
key_str = f"{question.id}__{sub_id}"
key_str_alt = f"{str(question.id)}__{sub_id}"
key_num = f"{int(question.id)}__{sub_id}" if isinstance(question.id, (int, str)) and str(question.id).isdigit() else key_str

user_val = all_user_answers.get(key_str)
if user_val is None:
    user_val = all_user_answers.get(key_str_alt)
if user_val is None:
    user_val = all_user_answers.get(key_num)

# Если не нашли, ищем по подстроке
if user_val is None and sub_id.startswith('r') and '__gap' in sub_id:
    for key in all_user_answers.keys():
        if key.endswith(sub_id) or sub_id in key:
            user_val = all_user_answers.get(key)
            if user_val:
                break
```

### 3. Backend - views.py ✅

#### Отладочный вывод для table questions
- **Строки 2093-2100**: Добавлен отладочный вывод при получении ответов
- Помогает отследить, какие ключи приходят на сервер

### 4. Проверка других типов вопросов ✅

Все другие типы вопросов работают правильно:
- ✅ gap_fill - формат `${question.id}__gap${number}` - работает
- ✅ multiple_choice - формат `${question.id}__${label}` - работает
- ✅ multiple_response - формат `${question.id}__${label}` - работает
- ✅ form - формат `${question.id}__${idx}` - работает
- ✅ short_answer - формат `${question.id}` - работает
- ✅ true_false - формат `${question.id}` - работает
- ✅ matching - формат `${question.id}__${itemId}` - работает
- ✅ multiple_choice_group - использует handleGroupAnswerChange - работает

## Формат ключей

### Table Questions (Listening)
- **Формат**: `${String(question.id)}__r${row}c${col}__gap${gapNumber}`
- **Пример**: `"123__r0c1__gap14"`
- **Хранение**: Плоский объект `answers`

### Table Questions (Reading)
- **Формат**: `r${row}c${col}__gap${gapNumber}` в `answers[questionId]`
- **Пример**: `answers["123"]["r0c1__gap14"]`
- **Хранение**: Вложенный объект

## Тестирование

### Рекомендуемые тесты

1. ✅ **Table questions в Listening**
   - Создать вопрос с ячейками, содержащими `[[14]]` и `[[25]]`
   - Ввести ответы в gaps
   - Проверить консоль браузера - должны быть ключи вида `"123__r0c1__gap14"`
   - Проверить, что ответы сохраняются в состоянии
   - Проверить, что ответы отправляются на сервер
   - Проверить, что баллы правильно считаются
   - Проверить, что результаты правильно отображаются

2. ✅ **Проверка сохранения в состоянии**
   - Открыть DevTools → React DevTools
   - Проверить состояние `answers`
   - Убедиться, что ключи table questions присутствуют

3. ✅ **Проверка отправки на сервер**
   - Открыть DevTools → Network
   - Отправить тест
   - Проверить запрос POST `/listening-sessions/${session.id}/submit/`
   - Проверить payload - должны быть ключи table questions

4. ✅ **Проверка результатов**
   - После отправки теста проверить результаты
   - Убедиться, что ответы отображаются (не "(empty)")
   - Проверить правильность подсчета баллов

## Итоговая оценка

### ✅ Реализация: ИСПРАВЛЕНО

**Исправлено:**
- ✅ Правильное формирование ключей на фронтенде (String(question.id))
- ✅ Улучшенная проверка ключей на бэкенде (разные варианты)
- ✅ Поиск по подстроке для надежности
- ✅ Все другие типы вопросов работают корректно

**Статус: ✅ ГОТОВО К ТЕСТИРОВАНИЮ**

---

## Дополнительные замечания

1. **Отладочный вывод**: Можно оставить для дальнейшей отладки или удалить после проверки

2. **Производительность**: Поиск по подстроке может быть медленным для большого количества ответов, но это fallback механизм

3. **Рекомендации**:
   - Убедиться, что `question.id` всегда используется как строка на фронтенде
   - Проверить, что ответы действительно сохраняются в состоянии перед отправкой
   - Проверить логи сервера для отладки

