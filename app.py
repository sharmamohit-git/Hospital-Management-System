from flask import Flask, send_from_directory
from flask_restful import Api
from flask_cors import CORS
from celery.schedules import crontab

from models import db
import os

app = Flask(__name__, static_folder='static')
# Ensure instance folder exists
basedir = os.path.abspath(os.path.dirname(__file__))
instance_dir = os.path.join(basedir, 'instance')
os.makedirs(instance_dir, exist_ok=True)
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:////{os.path.join(instance_dir, 'hms.sqlite3')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('JWT_SECRET', 'hms-secret-key')
app.config['PROPAGATE_EXCEPTIONS'] = True


from tasks import *
celery = celery_init(app)

# Cache configuration - Simplified to In-Memory for demo
app.config['CACHE_TYPE'] = 'SimpleCache'
app.config['CACHE_DEFAULT_TIMEOUT'] = 300 # 5 minutes expiry


from auth_api import AuthRegister, AuthLogin, AuthStatus
from admin_api import (
    AdminStats, AdminDoctors, AdminDoctorDetail, AdminAppointments,
    AdminPatients, AdminPatientDetail, AdminPatientTreatmentHistory
)
from doctor_api import (
    DoctorStats, DoctorAppointments, DoctorCompleteAppointment, DoctorUpdateAppointmentStatus, DoctorScheduleResource,
    DoctorConsultedPatients, DoctorPatientTreatmentHistory, DoctorAssignedPatients
)
from patient_api import (
    PatientDoctors, PatientAppointments, PatientAppointmentCancel, PatientProfile,
    PatientNotifications, PatientExportHistory, PatientTreatmentHistory
)
from common_api import DepartmentsList, SearchDoctors, DoctorAvailableSlots

CORS(app)
db.init_app(app)
api = Api(app)
app.config['ERROR_404_HELP'] = False

# Create Database
with app.app_context():
    db.create_all()
    
    from models import User, Department
    import bcrypt

    if not User.query.filter_by(role='admin').first():
        hashed_pw = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin = User(email='admin@hms.com', password=hashed_pw, role='admin', name='Hospital Administrator')
        db.session.add(admin)
        db.session.commit()

    depts = ["Cardiology", "Neurology", "Oncology", "Pediatrics", "Orthopedics", "Dermatology"]
    for d in depts:
        if not Department.query.filter_by(name=d).first():
            db.session.add(Department(name=d))
    db.session.commit()

# Auth Routes
api.add_resource(AuthRegister, '/api/auth/register')
api.add_resource(AuthLogin, '/api/auth/login')
api.add_resource(AuthStatus, '/api/auth/status')

# Admin Routes
api.add_resource(AdminStats, '/api/admin/stats')
api.add_resource(AdminDoctors, '/api/admin/doctors')
api.add_resource(AdminDoctorDetail, '/api/admin/doctors/<int:doctor_id>')
api.add_resource(AdminAppointments, '/api/admin/appointments')
api.add_resource(AdminPatients, '/api/admin/patients')
api.add_resource(AdminPatientDetail, '/api/admin/patients/<int:patient_id>')
api.add_resource(AdminPatientTreatmentHistory, '/api/admin/patients/<int:patient_id>/history')

# Doctor Routes
api.add_resource(DoctorStats, '/api/doctor/stats')
api.add_resource(DoctorAppointments, '/api/doctor/appointments')
api.add_resource(DoctorCompleteAppointment, '/api/doctor/appointments/<int:appointment_id>/complete')
api.add_resource(DoctorUpdateAppointmentStatus, '/api/doctor/appointments/<int:appointment_id>/status')
api.add_resource(DoctorScheduleResource, '/api/doctor/schedule', '/api/doctor/schedule/<int:slot_id>')
api.add_resource(DoctorConsultedPatients, '/api/doctor/consulted-patients')
api.add_resource(DoctorAssignedPatients, '/api/doctor/assigned-patients')
api.add_resource(DoctorPatientTreatmentHistory, '/api/doctor/patients/<int:patient_id>/history')

# Patient Routes
api.add_resource(PatientDoctors, '/api/patient/doctors')
api.add_resource(DoctorAvailableSlots, '/api/patient/doctors/<int:doctor_id>/slots')
api.add_resource(PatientAppointments, '/api/patient/appointments')
api.add_resource(PatientAppointmentCancel, '/api/patient/appointments/<int:appointment_id>/cancel')
api.add_resource(PatientProfile, '/api/patient/profile')
api.add_resource(PatientTreatmentHistory, '/api/patient/history')
api.add_resource(PatientNotifications, '/api/patient/notifications', '/api/patient/notifications/<int:notification_id>')
api.add_resource(PatientExportHistory, '/api/patient/export-history')

# Common Routes
api.add_resource(DepartmentsList, '/api/departments')
api.add_resource(SearchDoctors, '/api/search/doctors')

@celery.on_after_finalize.connect
def setup_periodic_tasks(sender, **kwargs):
    # Daily reminder to patients
    sender.add_periodic_task(
        crontab(minute='*/1'),
        daily_reminder.s(),
        name='daily_reminder_task'
    )

    # Monthly report to doctors
    sender.add_periodic_task(
        crontab(minute='*/1'),
        monthly_report.s(),
        name='monthly_report_task'
    )

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    app.run(debug=True)
