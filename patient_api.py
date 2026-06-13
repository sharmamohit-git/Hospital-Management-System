from flask import request, current_app
from flask_restful import Resource
from models import db, User, Appointment, Treatment, DoctorSchedule, Department, Notification
import bcrypt
import threading
import csv
import io
import json
from utils import authenticate, get_cache
from tasks import export_treatment_history

class PatientDoctors(Resource):
    def get(self):
        user, error = authenticate()
        if error: return {"error": error}, 401
        
        doctors = db.session.query(User, Department).join(Department, User.specialization_id == Department.id).filter(User.role == 'doctor', User.is_blacklisted == False).all()
        result = []
        for u, d in doctors:
            result.append({
                "id": u.id,
                "name": u.name,
                "availability": u.availability if hasattr(u, 'availability') else "Not set",
                "specialization": d.name
            })
        return result, 200

class PatientAppointments(Resource):
    def get(self):
        user, error = authenticate('patient')
        if error: return {"error": error}, 403
        
        # Simplified query to avoid join issues
        apps = Appointment.query.filter_by(patient_id=user['id']).order_by(Appointment.date.desc()).all()
        result = []
        for a in apps:
            d = db.session.get(User, a.doctor_id)
            t = Treatment.query.filter_by(appointment_id=a.id).first()
            result.append({
                "id": a.id,
                "doctor_name": d.name if d else "Unknown",
                "date": a.date,
                "time": a.time,
                "status": a.status,
                "diagnosis": t.diagnosis if t else None,
                "treatment": t.treatment if t else None,
                "prescription": t.prescription if t else None
            })
        return result, 200

    def post(self):
        user, error = authenticate('patient')
        if error: return {"error": error}, 403
        
        data = request.get_json()
        if not data or 'doctor_id' not in data or 'slot_id' not in data:
            return {"error": "Missing doctor_id or slot_id"}, 400
            
        try: doc_id = int(data['doctor_id'])
        except: return {"error": "Invalid doctor_id"}, 400
            
        slot = db.session.get(DoctorSchedule, data['slot_id'])
        if not slot or slot.doctor_id != doc_id or slot.is_booked:
            return {"error": "Slot unavailable"}, 400
            
        new_app = Appointment(
            patient_id=user['id'],
            doctor_id=doc_id,
            date=slot.date,
            time=slot.time_slot,
            status='booked'
        )
        slot.is_booked = True
        db.session.add(new_app)
        db.session.commit()
        
        return {"message": "Booked"}, 201

class PatientAppointmentCancel(Resource):
    def post(self, appointment_id):
        user, error = authenticate('patient')
        if error: return {"error": error}, 403
        
        app = db.session.get(Appointment, appointment_id)
        if not app or app.patient_id != user['id']:
            return {"error": "Appointment not found"}, 404
            
        if app.status != 'booked':
            return {"error": "Cannot cancel this appointment"}, 400
            
        app.status = 'cancelled'
        
        # Free up the slot
        slot = DoctorSchedule.query.filter_by(doctor_id=app.doctor_id, date=app.date, time_slot=app.time).first()
        if slot:
            slot.is_booked = False
            
        db.session.commit()
        
        return {"message": "Appointment cancelled"}, 200

class PatientProfile(Resource):
    def get(self):
        user_data, error = authenticate('patient')
        if error: return {"error": error}, 403
        
        user = db.session.get(User, user_data['id'])
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name
        }, 200

    def put(self):
        user_data, error = authenticate('patient')
        if error: return {"error": error}, 403
        
        data = request.get_json()
        user = db.session.get(User, user_data['id'])
        
        if 'email' in data:
            existing = User.query.filter_by(email=data['email']).first()
            if existing and existing.id != user.id:
                return {"error": "Email already in use"}, 400
            user.email = data['email']
            
        if 'name' in data: user.name = data['name']
        if 'password' in data and data['password']:
            user.password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
        db.session.commit()
        
        return {"message": "Profile updated"}, 200

class PatientTreatmentHistory(Resource):
    def get(self):
        user, error = authenticate('patient')
        if error: return {"error": error}, 403
        
        apps = Appointment.query.filter_by(patient_id=user['id']).order_by(Appointment.date.desc()).all()
        result = []
        for a in apps:
            d = db.session.get(User, a.doctor_id)
            t = Treatment.query.filter_by(appointment_id=a.id).first()
            if t:
                result.append({
                    "appointment_id": a.id,
                    "doctor_name": d.name if d else "Unknown",
                    "date": a.date,
                    "time": a.time,
                    "diagnosis": t.diagnosis,
                    "treatment": t.treatment,
                    "prescription": t.prescription,
                    "notes": t.notes
                })
        return result, 200

class PatientNotifications(Resource):
    def get(self):
        user, error = authenticate('patient')
        if error: return {"error": error}, 403
        
        notifs = Notification.query.filter_by(user_id=user['id']).order_by(Notification.created_at.desc()).all()
        return [{
            "id": n.id,
            "message": n.message,
            "type": n.type,
            "data": n.data,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat()
        } for n in notifs], 200

    def put(self, notification_id):
        user, error = authenticate('patient')
        if error: return {"error": error}, 403
        
        notif = db.session.get(Notification, notification_id)
        if not notif or notif.user_id != user['id']:
            return {"error": "Not found"}, 404
            
        notif.is_read = True
        db.session.commit()
        return {"message": "Marked as read"}, 200

class PatientExportHistory(Resource):
    def post(self):
        user, error = authenticate('patient')
        if error: return {"error": error}, 403
        
        # Trigger Celery task
        export_treatment_history.delay(user['id'])
        
        return {"message": "Export started. You will be notified when it's ready."}, 202
