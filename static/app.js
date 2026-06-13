import { AppNavigation, AppSidebar, SearchResultsModal, NotificationModal } from './components/Layout.js';
import LoginView from './components/LoginView.js';
import RegisterView from './components/RegisterView.js';
import AdminDashboard from './components/AdminDashboard.js';
import AdminDoctorsView, { AddDoctorModal, EditDoctorModal } from './components/AdminDoctorsView.js';
import AdminAppointmentsView from './components/AdminAppointmentsView.js';
import AdminPatientsView, { EditPatientModal, TreatmentHistoryModal } from './components/AdminPatientsView.js';
import PatientDashboard, { BookingModal, EditProfileModal } from './components/PatientDashboard.js';
import PatientAppointmentsView from './components/PatientAppointmentsView.js';
import DoctorDashboard, { ConsultationModal, AddScheduleModal } from './components/DoctorDashboard.js';

const { createApp } = Vue;

const app = createApp({
    data() {
        const userData = localStorage.getItem('hms_user');
        const user = userData ? JSON.parse(userData) : null;
        
        // Get initial view from URL hash or default based on auth
        const hash = window.location.hash.replace('#', '');
        let initialView = user ? 'dashboard' : 'login';
        if (hash && (user || hash === 'login' || hash === 'register')) {
            initialView = hash;
        }

        return {
            user: user,
            token: localStorage.getItem('hms_token'),
            currentView: initialView,
            searchQuery: '',
            searchResults: { doctors: [], patients: [], appointments: [], departments: [] },
            showSearchResults: false,
            error: '',
            specializations: [],
            // Shared data for modals and cross-component access
            doctors: [],
            patients: [],
            appointments: [],
            stats: { doctors: 0, patients: 0, appointments: 0 },
            doctorStats: {},
            consultedPatients: [],
            schedule: [],
            // Modals visibility and data
            showAddDoctor: false,
            newDoc: { email: '', password: '', name: '', specialization_id: '' },
            editingDoc: null,
            editingPatient: null,
            editingProfile: null,
            patientTreatmentHistory: [],
            viewingHistoryPatient: null,
            consultingApp: null,
            treatment: { diagnosis: '', treatment: '', prescription: '', notes: '' },
            showAddSlot: false,
            newSlot: { date: '', time_slot: '' },
            bookingDoc: null,
            book: { slot_id: '' },
            availableSlots: [],
            notifications: [],
            showNotifications: false,
            alertedNotificationIds: [],
            refreshTrigger: 0
        };
    },
    computed: {
        menuLinks() {
            if (!this.user) return [];
            if (this.user.role === 'admin') return [
                { label: 'Dashboard', view: 'dashboard' },
                { label: 'Doctors', view: 'doctors' },
                { label: 'Patients', view: 'patients' },
                { label: 'Appointments', view: 'appointments' }
            ];
            if (this.user.role === 'doctor') return [
                { label: 'My Schedule', view: 'dashboard' },
                { label: 'Patients', view: 'patients' }
            ];
            return [
                { label: 'Book Appointment', view: 'dashboard' },
                { label: 'My Appointments', view: 'appointments' }
            ];
        },
        filteredDoctors() {
            if (!this.searchQuery) return this.doctors;
            const q = this.searchQuery.toLowerCase();
            return this.doctors.filter(d => 
                d.name.toLowerCase().includes(q) || 
                d.specialization.toLowerCase().includes(q)
            );
        },
        filteredPatients() {
            if (!this.searchQuery) return this.patients;
            const q = this.searchQuery.toLowerCase();
            return this.patients.filter(p => 
                p.name.toLowerCase().includes(q) || 
                p.email.toLowerCase().includes(q)
            );
        }
    },
    watch: {
        currentView(newView) {
            // Update URL hash when view changes
            if (window.location.hash.replace('#', '') !== newView) {
                window.location.hash = newView;
            }
        }
    },
    methods: {
        triggerRefresh() {
            this.refreshTrigger++;
            this.loadData();
        },
        handleSearch(query) {
            this.searchQuery = query;
            if (!query) {
                this.searchResults = { doctors: [], patients: [], appointments: [], departments: [] };
                this.showSearchResults = false;
                return;
            }
            const q = query.toLowerCase();
            
            const doctors = this.doctors.filter(d => 
                d.name.toLowerCase().includes(q) || 
                d.specialization.toLowerCase().includes(q)
            );

            const departments = this.specializations.filter(s => 
                s.name.toLowerCase().includes(q) ||
                (s.description && s.description.toLowerCase().includes(q))
            );

            if (this.user.role === 'admin') {
                this.searchResults = {
                    doctors: doctors,
                    departments: departments,
                    patients: this.patients.filter(p => 
                        p.name.toLowerCase().includes(q) || 
                        p.email.toLowerCase().includes(q)
                    ),
                    appointments: this.appointments.filter(a => 
                        a.patient_name.toLowerCase().includes(q) || 
                        a.doctor_name.toLowerCase().includes(q) ||
                        a.date.toLowerCase().includes(q) ||
                        a.status.toLowerCase().includes(q) ||
                        (a.treatment && (
                            (a.treatment.diagnosis && a.treatment.diagnosis.toLowerCase().includes(q)) ||
                            (a.treatment.treatment && a.treatment.treatment.toLowerCase().includes(q)) ||
                            (a.treatment.prescription && a.treatment.prescription.toLowerCase().includes(q))
                        ))
                    )
                };
            } else if (this.user.role === 'patient') {
                this.searchResults = {
                    doctors: doctors,
                    departments: departments,
                    patients: [],
                    appointments: this.appointments.filter(a => 
                        a.doctor_name.toLowerCase().includes(q) || 
                        a.date.toLowerCase().includes(q) || 
                        a.status.toLowerCase().includes(q) ||
                        (a.diagnosis && a.diagnosis.toLowerCase().includes(q)) ||
                        (a.treatment && a.treatment.toLowerCase().includes(q)) ||
                        (a.prescription && a.prescription.toLowerCase().includes(q))
                    )
                };
            } else if (this.user.role === 'doctor') {
                this.searchResults = {
                    doctors: doctors,
                    departments: departments,
                    patients: this.patients.filter(p => 
                        p.name.toLowerCase().includes(q) ||
                        p.email.toLowerCase().includes(q)
                    ),
                    appointments: this.appointments.filter(a => 
                        a.patient_name.toLowerCase().includes(q) || 
                        (a.diagnosis && a.diagnosis.toLowerCase().includes(q)) ||
                        (a.treatment && a.treatment.toLowerCase().includes(q)) ||
                        (a.prescription && a.prescription.toLowerCase().includes(q))
                    )
                };
            }
            this.showSearchResults = true;
        },
        handleSearchResultAction(type, item) {
            this.showSearchResults = false;
            if (type === 'doctor') {
                if (this.user.role === 'admin') {
                    this.editingDoc = { ...item };
                } else if (this.user.role === 'patient') {
                    this.selectBookingDoc(item);
                }
            } else if (type === 'patient') {
                if (this.user.role === 'admin') {
                    this.editingPatient = { ...item };
                }
            }
        },
        async loadData() {
            // Always fetch specializations as they are needed for registration and admin doctor creation
            try {
                const res = await fetch('/api/departments');
                if (res.ok) {
                    this.specializations = await res.json();
                    console.log('Specializations loaded:', this.specializations);
                }
            } catch (err) { console.error('Failed to fetch specializations:', err); }

            if (!this.user || !this.token) return;
            const headers = { 'Authorization': `Bearer ${this.token}` };

            if (this.user.role === 'admin') {
                try {
                    const [d, p, a] = await Promise.all([
                        fetch('/api/admin/doctors', { headers }).then(r => r.json()),
                        fetch('/api/admin/patients', { headers }).then(r => r.json()),
                        fetch('/api/admin/appointments', { headers }).then(r => r.json())
                    ]);
                    this.doctors = Array.isArray(d) ? d : [];
                    this.patients = Array.isArray(p) ? p : [];
                    this.appointments = Array.isArray(a) ? a : [];
                } catch (err) { console.error('Failed to fetch admin data:', err); }
            } else if (this.user.role === 'patient') {
                try {
                    const [d, a] = await Promise.all([
                        fetch('/api/patient/doctors', { headers }).then(r => r.json()),
                        fetch('/api/patient/appointments', { headers }).then(r => r.json())
                    ]);
                    this.doctors = Array.isArray(d) ? d : [];
                    this.appointments = Array.isArray(a) ? a : [];
                } catch (err) { console.error('Failed to fetch patient data:', err); }
            } else if (this.user.role === 'doctor') {
                try {
                    const [p, a] = await Promise.all([
                        fetch('/api/doctor/patients', { headers }).then(r => r.json()),
                        fetch('/api/doctor/appointments', { headers }).then(r => r.json())
                    ]);
                    this.patients = Array.isArray(p) ? p : [];
                    this.appointments = Array.isArray(a) ? a : [];
                } catch (err) { console.error('Failed to fetch doctor data:', err); }
            }
        },
        async selectBookingDoc(doc) {
            this.bookingDoc = doc;
            this.book = { slot_id: '' };
            try {
                const res = await fetch(`/api/patient/doctors/${doc.id}/slots`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                }).then(r => r.json());
                this.availableSlots = res;
            } catch (err) { alert('Failed to load slots'); }
        },
        async checkAuthStatus() {
            if (!this.user || !this.token) return;
            try {
                const res = await fetch('/api/auth/status', {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (res.status === 403 || res.status === 401) {
                    const data = await res.json();
                    if (data.error === "Account blacklisted") {
                        alert('Your account has been blacklisted. You will be logged out.');
                        // Trigger logout in AppNavigation or just do it here
                        this.user = null;
                        this.token = null;
                        localStorage.removeItem('hms_user');
                        localStorage.removeItem('hms_token');
                        this.currentView = 'login';
                        this.updateBodyClass();
                    }
                }
            } catch (err) {
                console.error('Status check failed', err);
            }
        },
        updateBodyClass() {
            if (this.user) {
                document.body.classList.remove('auth-mode');
                document.body.classList.add('app-mode');
            } else {
                document.body.classList.add('auth-mode');
                document.body.classList.remove('app-mode');
            }
        },
        syncHashWithView() {
            const hash = window.location.hash.replace('#', '');
            if (hash && hash !== this.currentView) {
                // Basic auth guard: don't allow dashboard if not logged in
                if (!this.user && hash !== 'login' && hash !== 'register') {
                    this.currentView = 'login';
                    window.location.hash = 'login';
                } else {
                    this.currentView = hash;
                }
            }
        },
        async viewTreatmentHistory(patient = null) {
            const targetPatient = patient || this.user;
            this.viewingHistoryPatient = targetPatient;
            try {
                const url = this.user.role === 'admin' 
                    ? `/api/admin/patients/${targetPatient.id}/history`
                    : this.user.role === 'doctor'
                        ? `/api/doctor/patients/${targetPatient.id}/history`
                        : '/api/patient/history';
                
                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                }).then(r => r.json());
                this.patientTreatmentHistory = res;
            } catch (err) { alert('Failed to load history'); }
        },
        openEditProfile() {
            this.editingProfile = { ...this.user };
        },
        async triggerExport() {
            try {
                const res = await fetch('/api/patient/export-history', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.token}` }
                }).then(r => r.json());
                alert(res.message || 'Export started. You will be notified here and via email when it is ready.');
            } catch (err) { alert('Failed to start export'); }
        },
        async markNotificationRead(id) {
            try {
                await fetch(`/api/patient/notifications/${id}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                const notif = this.notifications.find(n => n.id === id);
                if (notif) notif.is_read = true;
            } catch (err) {}
        },
        openConsultation(app) {
            this.consultingApp = app;
            this.treatment = { diagnosis: '', treatment: '', prescription: '', notes: '' };
        }
    },
    mounted() {
        this.updateBodyClass();
        this.loadData();

        // Listen for browser back/forward buttons
        window.addEventListener('hashchange', this.syncHashWithView);
        
        // Ensure initial hash is set
        if (!window.location.hash) {
            window.location.hash = this.currentView;
        }

        setInterval(() => {
            this.checkAuthStatus();
        }, 5000);

        // Periodically refresh common data like specializations
        setInterval(() => {
            this.loadData();
        }, 60000);
    }
});

app.component('app-navigation', AppNavigation);
app.component('app-sidebar', AppSidebar);
app.component('login-view', LoginView);
app.component('register-view', RegisterView);
app.component('admin-dashboard', AdminDashboard);
app.component('admin-doctors-view', AdminDoctorsView);
app.component('admin-patients-view', AdminPatientsView);
app.component('admin-appointments-view', AdminAppointmentsView);
app.component('patient-dashboard', PatientDashboard);
app.component('patient-appointments-view', PatientAppointmentsView);
app.component('doctor-dashboard', DoctorDashboard);
app.component('add-doctor-modal', AddDoctorModal);
app.component('edit-doctor-modal', EditDoctorModal);
app.component('edit-patient-modal', EditPatientModal);
app.component('treatment-history-modal', TreatmentHistoryModal);
app.component('search-results-modal', SearchResultsModal);
app.component('add-schedule-modal', AddScheduleModal);
app.component('consultation-modal', ConsultationModal);
app.component('booking-modal', BookingModal);
app.component('notification-modal', NotificationModal);
app.component('edit-profile-modal', EditProfileModal);

app.mount('#app');
