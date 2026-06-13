from flask import request
from flask_restful import Resource
from models import db, User, Department, Appointment, Treatment, Notification
import bcrypt
from utils import authenticate, get_cache

class AdminStats(Resource):
    def get(self):
        user, error = authenticate('admin')
        if error: return {"error": error}, 401 if error == "Unauthorized" else 403
        
        try:
            doctors = User.query.filter_by(role='doctor').count()
            patients = User.query.filter_by(role='patient').count()
            appointments = Appointment.query.count()
            
            data = {
                "doctors": doctors, 
                "patients": patients, 
                "appointments": appointments
            }
            return data, 200
        except Exception as e:
            print(f"Error in AdminStats: {e}")
            return {
                "doctors": 0,
                "patients": 0,
                "appointments": 0
            }, 200

class AdminDoctors(Resource):
    def get(self):
        user, error = authenticate('admin')
        if error: return {"error": error}, 401 if error == "Unauthorized" else 403
        
        try:
            doctors = db.session.query(User, Department).outerjoin(Department, User.specialization_id == Department.id).filter(User.role == 'doctor').all()
            result = []
            for u, d in doctors:
                result.append({
                    "id": u.id,
                    "email": u.email,
                    "name": u.name,
                    "specialization": d.name if d else "None",
                    "specialization_id": u.specialization_id,
                    "is_blacklisted": u.is_blacklisted,
                    "role": "doctor"
                })
            return result, 200
        except Exception as e:
            print(f"Error in AdminDoctors: {e}")
            return [], 200

    def post(self):
        user, error = authenticate('admin')
        if error: return {"error": error}, 401 if error == "Unauthorized" else 403
        
        data = request.get_json()
        if not data or 'password' not in data or 'email' not in data:
            return {"error": "Missing required fields"}, 400
            
        # Check if email already exists
        if User.query.filter_by(email=data['email']).first():
            return {"error": "Email already in use"}, 400
            
        try:
            hashed_pw = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            spec_id = data.get('specialization_id')
            if spec_id == '': spec_id = None
            else:
                try: spec_id = int(spec_id)
                except: spec_id = None

            new_doc = User(
                email=data['email'],
                password=hashed_pw,
                role='doctor',
                name=data.get('name', 'Unknown'),
                specialization_id=spec_id
            )
            db.session.add(new_doc)
            db.session.commit()
            
            return {"message": "Doctor added"}, 201
        except Exception as e:
            db.session.rollback()
            print(f"Error adding doctor: {e}")
            return {"error": "Failed to add doctor"}, 500

class AdminDoctorDetail(Resource):
    def put(self, doctor_id):
        user, error = authenticate('admin')
        if error: return {"error": error}, 401 if error == "Unauthorized" else 403
        
        data = request.get_json()
        doc = db.session.get(User, doctor_id)
        if not doc or doc.role != 'doctor':
            return {"error": "Doctor not found"}, 404
            
        if 'email' in data:
            existing = User.query.filter_by(email=data['email']).first()
            if existing and existing.id != doctor_id:
                return {"error": "Email already in use"}, 400
            doc.email = data['email']
            
        if 'name' in data: doc.name = data['name']
        if 'specialization_id' in data:
            spec_id = data['specialization_id']
            if spec_id == '': doc.specialization_id = None
            else:
                try: doc.specialization_id = int(spec_id)
                except: pass
        
        if 'password' in data and data['password']:
            doc.password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        if 'is_blacklisted' in data:
            doc.is_blacklisted = bool(data['is_blacklisted'])
            
        db.session.commit()
        
        return {"message": "Doctor updated"}, 200

    def delete(self, doctor_id):
        user, error = authenticate('admin')
        if error: return {"error": error}, 401 if error == "Unauthorized" else 403
        
        doc = db.session.get(User, doctor_id)
        if not doc or doc.role != 'doctor':
            return {"error": "Doctor not found"}, 404
        
        # Delete related records
        from models import DoctorSchedule
        apps = Appointment.query.filter_by(doctor_id=doctor_id).all()
        app_ids = [a.id for a in apps]
        Treatment.query.filter(Treatment.appointment_id.in_(app_ids)).delete(synchronize_session=False)
        Appointment.query.filter_by(doctor_id=doctor_id).delete()
        DoctorSchedule.query.filter_by(doctor_id=doctor_id).delete()
        Notification.query.filter_by(user_id=doctor_id).delete()
        
        db.session.delete(doc)
        db.session.commit()
        
        return {"message": "Doctor deleted"}, 200

class AdminAppointments(Resource):
    def get(self):
        user, error = authenticate('admin')
        if error: return {"error": error}, 401 if error == "Unauthorized" else 403
        
        apps = Appointment.query.order_by(Appointment.date.desc()).all()
        result = []
        for a in apps:
            p = db.session.get(User, a.patient_id)
            d = db.session.get(User, a.doctor_id)
            t = Treatment.query.filter_by(appointment_id=a.id).first()
            result.append({
                "id": a.id,
                "patient_name": p.name if p else "Unknown",
                "doctor_name": d.name if d else "Unknown",
                "date": a.date,
                "time": a.time,
                "status": a.status,
                "treatment": {
                    "diagnosis": t.diagnosis,
                    "treatment": t.treatment,
                    "prescription": t.prescription,
                    "notes": t.notes
                } if t else None
            })
        return result, 200

class AdminPatients(Resource):
    def get(self):
        user, error = authenticate('admin')
        if error: return {"error": error}, 401 if error == "Unauthorized" else 403
        
        try:
            patients = User.query.filter_by(role='patient').all()
            result = []
            for p in patients:
                result.append({
                    "id": p.id,
                    "email": p.email,
                    "name": p.name,
                    "is_blacklisted": p.is_blacklisted,
                    "role": "patient"
                })
            return result, 200
        except Exception as e:
            print(f"Error in AdminPatients: {e}")
            return [], 200

class AdminPatientDetail(Resource):
    def put(self, patient_id):
        user, error = authenticate('admin')
        if error: return {"error": error}, 401 if error == "Unauthorized" else 403
        
        data = request.get_json()
        patient = db.session.get(User, patient_id)
        if not patient or patient.role != 'patient':
            return {"error": "Patient not found"}, 404
            
        if 'email' in data:
            existing = User.query.filter_by(email=data['email']).first()
            if existing and existing.id != patient_id:
                return {"error": "Email already in use"}, 400
            patient.email = data['email']
            
        if 'name' in data: patient.name = data['name']
        if 'is_blacklisted' in data: patient.is_blacklisted = bool(data['is_blacklisted'])
        
        if 'password' in data and data['password']:
            patient.password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
        db.session.commit()
        
        return {"message": "Patient updated"}, 200

    def delete(self, patient_id):
        user, error = authenticate('admin')
        if error: return {"error": error}, 401 if error == "Unauthorized" else 403
        
        patient = db.session.get(User, patient_id)
        if not patient or patient.role != 'patient':
            return {"error": "Patient not found"}, 404
            
        # Delete related records
        apps = Appointment.query.filter_by(patient_id=patient_id).all()
        app_ids = [a.id for a in apps]
        Treatment.query.filter(Treatment.appointment_id.in_(app_ids)).delete(synchronize_session=False)
        Appointment.query.filter_by(patient_id=patient_id).delete()
        Notification.query.filter_by(user_id=patient_id).delete()
        
        db.session.delete(patient)
        db.session.commit()
        
        return {"message": "Patient deleted"}, 200

class AdminPatientTreatmentHistory(Resource):
    def get(self, patient_id):
        user, error = authenticate('admin')
        if error: return {"error": error}, 403
        
        apps = Appointment.query.filter_by(patient_id=patient_id).order_by(Appointment.date.desc()).all()
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
