from flask import request
from flask_restful import Resource
from models import db, User
import bcrypt
import jwt
import datetime
import os
from utils import authenticate, JWT_SECRET

class AuthRegister(Resource):
    def post(self):
        data = request.get_json()
        if not data:
            return {"error": "Missing data"}, 400
        email = data.get('email')
        password = data.get('password')
        name = data.get('name')
        
        if not email or not password:
            return {"error": "Email and password required"}, 400
        
        if User.query.filter_by(email=email).first():
            return {"error": "Email exists"}, 400
        
        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        new_user = User(email=email, password=hashed_pw, role='patient', name=name)
        db.session.add(new_user)
        db.session.commit()
        return {"message": "Registered"}, 201

class AuthLogin(Resource):
    def post(self):
        data = request.get_json()
        if not data:
            return {"error": "Missing data"}, 400
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return {"error": "Email and password required"}, 400
        
        user = User.query.filter_by(email=email).first()
        if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
            return {"error": "Invalid credentials"}, 401
        
        # Explicit check for blacklisted status
        if user.is_blacklisted is True or user.is_blacklisted == 1:
            return {"error": "Your account has been blacklisted"}, 403
        
        token = jwt.encode({
            'id': user.id,
            'role': user.role,
            'name': user.name,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
        }, JWT_SECRET, algorithm='HS256')
        
        return {"token": token, "user": {"id": user.id, "role": user.role, "name": user.name}}, 200

class AuthStatus(Resource):
    def get(self):
        user_data, error = authenticate()
        if error:
            return {"error": error}, 401 if error == "Unauthorized" else 403
        return {"status": "ok", "user": user_data}, 200
