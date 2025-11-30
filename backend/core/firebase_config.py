import firebase_admin
from firebase_admin import credentials, auth
import os

cred_path = os.path.join(os.path.dirname(__file__), 'firebase_credentials.json')

if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    except Exception as e:
        raise

def verify_firebase_token(token):
    try:
        decoded_token = auth.verify_id_token(token, check_revoked=False, clock_skew_seconds=10)
        return decoded_token
    except Exception as e:
        return None




