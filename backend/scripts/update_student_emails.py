import csv
from core.models import User

CSV_PATH = '/app/scripts/platform_emails.csv'
KEY_COLUMN = 'platform_id'  # column in your file
EMAIL_COLUMN = 'new_email'

# Which field to match in DB:
# 'student_id' if platform_id = student login
# 'id' if platform_id = User.id
LOOKUP_FIELD = 'student_id'

DRY_RUN = True  # сначала True, потом False


def fmt(val):
    return "-" if val is None else val


def is_valid_email(email):
    if not email:
        return False
    email = email.strip().lower()
    return '@' in email and '.' in email.split('@')[-1]


def open_csv(path):
    with open(path, 'r', encoding='utf-8-sig', newline='') as f:
        sample = f.read(4096)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except Exception:
            dialect = csv.excel
        return list(csv.DictReader(f, dialect=dialect))


rows = open_csv(CSV_PATH)

updated = 0
skipped = 0
not_found = 0
errors = 0

for row in rows:
    platform_id = (row.get(KEY_COLUMN) or '').strip()
    new_email = (row.get(EMAIL_COLUMN) or '').strip().lower()

    if not platform_id or not new_email or not is_valid_email(new_email):
        skipped += 1
        continue

    try:
        if LOOKUP_FIELD == 'id':
            user_qs = User.objects.filter(id=int(platform_id))
        else:
            user_qs = User.objects.filter(student_id=platform_id)

        if user_qs.count() == 0:
            not_found += 1
            print(f"[NOT FOUND] {LOOKUP_FIELD}={platform_id}")
            continue
        if user_qs.count() > 1:
            errors += 1
            print(f"[DUPLICATE] {LOOKUP_FIELD}={platform_id} -> {user_qs.count()} rows")
            continue

        user = user_qs.first()
        if (user.email or '').lower() == new_email:
            skipped += 1
            continue

        if DRY_RUN:
            print(f"[DRY] {LOOKUP_FIELD}={platform_id} {fmt(user.email)} -> {new_email}")
        else:
            old_email = user.email
            user.email = new_email
            user.save(update_fields=['email'])
            print(f"[OK] {LOOKUP_FIELD}={platform_id} {fmt(old_email)} -> {new_email}")
        updated += 1
    except Exception as e:
        errors += 1
        print(f"[ERROR] {LOOKUP_FIELD}={platform_id}: {e}")

print(f"\nDone. updated={updated}, skipped={skipped}, not_found={not_found}, errors={errors}")
