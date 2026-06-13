from flask import request
import jwt
import os
from models import db, User

JWT_SECRET = os.environ.get('JWT_SECRET', 'hms-secret-key')

def get_cache():
    from app import cache
    return cache

def authenticate(role=None):
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None, "Unauthorized"
    try:
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return None, "Invalid token format"
        token = parts[1]
        decoded = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        
        # Check if user is blacklisted
        user = db.session.get(User, decoded.get('id'))
        if not user:
            return None, "User not found"
        if user.is_blacklisted:
            return None, "Account blacklisted"
            
        if role and decoded.get('role') != role:
            return None, "Forbidden"
        return decoded, None
    except jwt.ExpiredSignatureError:
        return None, "Token expired"
    except jwt.InvalidTokenError:
        return None, "Invalid token"
    except Exception as e:
        return None, str(e)
