from celery import Celery, shared_task, Task
from models import db, User, Appointment, Treatment, Notification
import csv
import os
import json
import datetime
from flask import current_app
from jinja2 import Template

from mail import send_mail

broker_url = 'redis://localhost:6379/0'
result_backend = 'redis://localhost:6379/1'
Timezone =  'Asia/Kolkata'

def celery_init(app):
    class FlaskTask(Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
            
    celery_app =  Celery(app.name, task_cls=FlaskTask)
    celery_app.set_default()
    celery_app.conf.update(
        broker_url=broker_url,
        result_backend=result_backend,
        timezone=Timezone
    )
    app.extensions["celery"] = celery_app

    return celery_app

@shared_task(name='download_treatment_history')
def export_treatment_history(user_id):
    user = User.query.get(user_id)
    if not user:
        return "User not found"

    # CSV format: user_id, username, consulting doctor, appointment date, diagnosis, treatment, next visit suggested
    file_name = f"treatment_history_{user_id}_{int(datetime.datetime.now().timestamp())}.csv"
    file_path = os.path.join('static', file_name)
    
    apps = Appointment.query.filter_by(patient_id=user_id).all()
    
    with open(file_path, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['User ID', 'Username', 'Consulting Doctor', 'Appointment Date', 'Diagnosis', 'Treatment', 'Next Visit/Notes'])
        
        for a in apps:
            doctor = User.query.get(a.doctor_id)
            treatment = Treatment.query.filter_by(appointment_id=a.id).first()
            
            writer.writerow([
                user.id,
                user.name,
                doctor.name if doctor else "Unknown",
                a.date,
                treatment.diagnosis if treatment else "N/A",
                treatment.treatment if treatment else "N/A",
                treatment.notes if treatment else "N/A"
            ])
            

    notif = Notification(
        user_id=user_id,
        message=f"Your treatment history export is ready.{file_name}",
        type="export_ready",
        data=json.dumps({"file_url": f"/static/{file_name}"})
    )
    db.session.add(notif)
    db.session.commit()
    
    return file_name

def format_report(html_template, data):
    with open(html_template) as file:
        template = Template(file.read())
        return template.render(data=data)

@shared_task(name='daily_reminder')
def daily_reminder():
    today = datetime.date.today().strftime('%Y-%m-%d')
    appointments = Appointment.query.filter_by(date=today, status='booked').all()
    
    # Group appointments by patient
    patient_appointments = {}
    for app in appointments:
        if app.patient_id not in patient_appointments:
            patient_appointments[app.patient_id] = []
        patient_appointments[app.patient_id].append(app)
    
    for patient_id, apps in patient_appointments.items():
        patient = User.query.get(patient_id)
        if not patient:
            continue
            
        app_list = []
        for app in apps:
            doctor = User.query.get(app.doctor_id)
            app_list.append({
                "date": app.date,
                "time": app.time,
                "doctor_name": doctor.name if doctor else "Unknown"
            })
            
        data = {
            "title": "Daily Appointment Schedule",
            "user_name": patient.name,
            "message": f"You have {len(apps)} appointment(s) scheduled for today, {today}.",
            "role": "patient",
            "appointments": app_list
        }
        message = format_report('templates/mail_template.html', data)
        send_mail(patient.email, subject="Your Appointments for Today", message=message)

@shared_task(name='monthly_report')
def monthly_report():
    doctors = User.query.filter_by(role='doctor').all()
    
    for doctor in doctors:
        # Get all appointments for this doctor that are either completed or cancelled
        apps = Appointment.query.filter(
            Appointment.doctor_id == doctor.id,
            Appointment.status.in_(['completed', 'cancelled'])
        ).all()
        
        report_data = []
        for a in apps:
            patient = User.query.get(a.patient_id)
            treatment = Treatment.query.filter_by(appointment_id=a.id).first()
            report_data.append({
                "date": a.date,
                "time": a.time,
                "patient_name": patient.name if patient else "Unknown",
                "diagnosis": treatment.diagnosis if treatment else "N/A",
                "treatment": treatment.treatment if treatment else "N/A",
                "status": a.status
            })
            
        data = {
            "title": "Activity Report",
            "user_name": doctor.name,
            "message": "Here is your full activity report containing all past consultations.",
            "role": "doctor",
            "appointments": report_data
        }
        message = format_report('templates/monthly_report.html', data)
        send_mail(doctor.email, subject="Activity Report", message=message)

