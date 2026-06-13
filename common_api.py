from flask import request
from flask_restful import Resource
from models import db, User, Department, DoctorSchedule
from utils import authenticate, get_cache


class DepartmentsList(Resource):
    def get(self):
        depts = Department.query.all()
        result = [{"id": d.id, "name": d.name} for d in depts]
        return result, 200

class SearchDoctors(Resource):
    def get(self):
        q = request.args.get('q', '').lower()
        if not q:
            return [], 200
            
        cache = get_cache()
        cache_key = f'search_doctors_{q}'
        cached_data = cache.get(cache_key)
        if cached_data:
            return cached_data, 200
            
        user, error = authenticate()
        if error: return {"error": error}, 403
        
        if user['role'] not in ['admin', 'patient']:
            return {"error": "Forbidden"}, 403
            
        doctors = db.session.query(User, Department).join(Department, User.specialization_id == Department.id).filter(
            User.role == 'doctor',
            db.or_(
                User.name.ilike(f'%{q}%'),
                Department.name.ilike(f'%{q}%')
            )
        ).all()
        
        result = []
        for u, d in doctors:
            result.append({
                "id": u.id,
                "name": u.name,
                "specialization": d.name,
                "specialization_id": u.specialization_id
            })
        cache.set(cache_key, result, timeout=300)
        return result, 200

class DoctorAvailableSlots(Resource):
    def get(self, doctor_id):
        slots = DoctorSchedule.query.filter_by(doctor_id=doctor_id, is_booked=False).order_by(DoctorSchedule.date.asc(), DoctorSchedule.time_slot.asc()).all()
        return [{
            "id": s.id,
            "date": s.date,
            "time_slot": s.time_slot
        } for s in slots], 200
