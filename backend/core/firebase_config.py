import firebase_admin
from firebase_admin import credentials, auth
import os

cred_path = os.path.join(os.path.dirname(__file__), 'firebase_credentials.json')

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

def verify_firebase_token(token):
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except auth.InvalidIdTokenError as e:
        return None
