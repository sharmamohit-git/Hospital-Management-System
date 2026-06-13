from flask import request
from flask_restful import Resource
from models import db, User, Appointment, Treatment, DoctorSchedule
from utils import authenticate

class DoctorStats(Resource):
    def get(self):
        user, error = authenticate('doctor')
        if error: return {"error": error}, 401 if error == "Unauthorized" else 403
        
        return {"message": "Stats removed"}, 200

class DoctorAppointments(Resource):
    def get(self):
        user, error = authenticate('doctor')
        if error: return {"error": error}, 403
        
        apps = Appointment.query.filter_by(doctor_id=user['id']).order_by(Appointment.date.asc()).all()
        result = []
        for a in apps:
            p = db.session.get(User, a.patient_id)
            t = Treatment.query.filter_by(appointment_id=a.id).first()
            result.append({
                "id": a.id,
                "patient_name": p.name if p else "Unknown",
                "date": a.date,
                "time": a.time,
                "status": a.status,
                "diagnosis": t.diagnosis if t else None,
                "treatment": t.treatment if t else None,
                "prescription": t.prescription if t else None
            })
        return result, 200

class DoctorCompleteAppointment(Resource):
    def post(self, appointment_id):
        user, error = authenticate('doctor')
        if error: return {"error": error}, 401 if error == "Unauthorized" else 403
        
        data = request.get_json()
        if not data:
            return {"error": "Missing data"}, 400
            
        app = db.session.get(Appointment, appointment_id)
        if not app or app.doctor_id != user['id']: return {"error": "Not found"}, 404
        
        app.status = 'completed'
        treatment = Treatment(
            appointment_id=appointment_id,
            diagnosis=data.get('diagnosis', ''),
            treatment=data.get('treatment', ''),
            prescription=data.get('prescription', ''),
            notes=data.get('notes', '')
        )
        db.session.add(treatment)
        db.session.commit()
        return {"message": "Completed"}, 200

class DoctorUpdateAppointmentStatus(Resource):
    def put(self, appointment_id):
        user, error = authenticate('doctor')
        if error: return {"error": error}, 403
        
        data = request.get_json()
        status = data.get('status')
        if status not in ['completed', 'cancelled']:
            return {"error": "Invalid status"}, 400
            
        app = db.session.get(Appointment, appointment_id)
        if not app or app.doctor_id != user['id']:
            return {"error": "Appointment not found"}, 404
            
        if app.status == 'completed':
            return {"error": "Cannot change status of a completed appointment"}, 400

        app.status = status
        
        # If cancelled, free up the slot
        if status == 'cancelled':
            slot = DoctorSchedule.query.filter_by(doctor_id=app.doctor_id, date=app.date, time_slot=app.time).first()
            if slot:
                slot.is_booked = False
                
        db.session.commit()
        return {"message": f"Appointment {status}"}, 200

class DoctorAssignedPatients(Resource):
    def get(self):
        user_data, error = authenticate('doctor')
        if error: return {"error": error}, 403
        
        # Get all unique patients who have appointments with this doctor
        patient_ids = db.session.query(Appointment.patient_id).filter_by(doctor_id=user_data['id']).distinct().all()
        patient_ids = [p[0] for p in patient_ids]
        
        patients = User.query.filter(User.id.in_(patient_ids)).all()
        
        result = []
        for p in patients:
            # Get latest appointment/treatment for some info
            latest_app = Appointment.query.filter_by(doctor_id=user_data['id'], patient_id=p.id).order_by(Appointment.date.desc()).first()
            treatment = Treatment.query.filter_by(appointment_id=latest_app.id).first() if latest_app else None
            
            result.append({
                "id": p.id,
                "name": p.name,
                "email": p.email,
                "last_visit": latest_app.date if latest_app else "N/A",
                "last_diagnosis": treatment.diagnosis if treatment else "N/A",
                "last_treatment": treatment.treatment if treatment else "N/A",
                "last_prescription": treatment.prescription if treatment else "N/A"
            })
        return result, 200

class DoctorScheduleResource(Resource):
    def get(self):
        user, error = authenticate('doctor')
        if error: return {"error": error}, 403
        
        schedules = DoctorSchedule.query.filter_by(doctor_id=user['id']).order_by(DoctorSchedule.date.asc(), DoctorSchedule.time_slot.asc()).all()
        return [{
            "id": s.id,
            "date": s.date,
            "time_slot": s.time_slot,
            "is_booked": s.is_booked
        } for s in schedules], 200

    def post(self):
        user, error = authenticate('doctor')
        if error: return {"error": error}, 403
        
        data = request.get_json()
        if not data or 'date' not in data or 'time_slot' not in data:
            return {"error": "Missing date or time_slot"}, 400
            
        # Check if slot already exists
        existing = DoctorSchedule.query.filter_by(doctor_id=user['id'], date=data['date'], time_slot=data['time_slot']).first()
        if existing:
            return {"error": "Slot already exists"}, 400
            
        new_slot = DoctorSchedule(
            doctor_id=user['id'],
            date=data['date'],
            time_slot=data['time_slot']
        )
        db.session.add(new_slot)
        db.session.commit()
        return {"message": "Slot added"}, 201

    def delete(self, slot_id):
        user, error = authenticate('doctor')
        if error: return {"error": error}, 403
        
        slot = db.session.get(DoctorSchedule, slot_id)
        if not slot or slot.doctor_id != user['id']:
            return {"error": "Slot not found"}, 404
            
        if slot.is_booked:
            return {"error": "Cannot delete a booked slot"}, 400
            
        db.session.delete(slot)
        db.session.commit()
        return {"message": "Slot deleted"}, 200

class DoctorConsultedPatients(Resource):
    def get(self):
        user_data, error = authenticate('doctor')
        if error: return {"error": error}, 403
        
        # Get all completed appointments for this doctor
        apps = Appointment.query.filter_by(doctor_id=user_data['id'], status='completed').order_by(Appointment.date.desc()).all()
        
        result = []
        for a in apps:
            p = db.session.get(User, a.patient_id)
            t = Treatment.query.filter_by(appointment_id=a.id).first()
            result.append({
                "appointment_id": a.id,
                "patient_name": p.name if p else "Unknown",
                "date": a.date,
                "time": a.time,
                "diagnosis": t.diagnosis if t else "N/A",
                "treatment": t.treatment if t else "N/A",
                "prescription": t.prescription if t else "N/A",
                "notes": t.notes if t else "N/A"
            })
        return result, 200

class DoctorPatientTreatmentHistory(Resource):
    def get(self, patient_id):
        user, error = authenticate('doctor')
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
