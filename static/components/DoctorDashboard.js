export default {
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="fw-bold mb-0">Doctor Dashboard</h2>
            <div class="btn-group">
                <button class="btn btn-primary" @click="this.$root.showAddSlot = true">Add Availability Slot</button>
            </div>
        </div>

        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-primary"></div>
        </div>
        <div v-else>

            <div v-if="view === 'appointments'" class="row g-4">
                <div class="col-lg-8">
                    <div class="card border-0 shadow-sm mb-4">
                        <div class="card-header bg-white py-3">
                            <h5 class="mb-0 fw-bold">My Appointments</h5>
                        </div>
                        <div class="table-responsive">
                            <table class="table mb-0 align-middle">
                                <thead class="table-light text-muted small text-uppercase">
                                    <tr>
                                        <th>Patient</th>
                                        <th>Date & Time</th>
                                        <th>Status</th>
                                        <th class="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="app in appointments" :key="app.id">
                                        <td>
                                            <div class="fw-bold">{{ app.patient_name }}</div>
                                            <div class="small text-muted">ID: {{ app.id }}</div>
                                        </td>
                                        <td>
                                            <div>{{ app.date }}</div>
                                            <div class="small text-muted">{{ app.time }}</div>
                                        </td>
                                        <td>
                                            <span :class="getStatusClass(app.status)">{{ app.status }}</span>
                                        </td>
                                        <td class="text-end">
                                            <div v-if="app.status === 'booked'" class="btn-group">
                                                <button class="btn btn-sm btn-primary" @click="this.$root.openConsultation(app)">Consult</button>
                                                <button class="btn btn-sm btn-danger" @click="updateStatus(app.id, 'cancelled')">Cancel</button>
                                            </div>
                                            <span v-else class="text-muted small">No actions</span>
                                        </td>
                                    </tr>
                                    <tr v-if="appointments.length === 0">
                                        <td colspan="4" class="text-center py-4 text-muted">No appointments scheduled.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="col-lg-4">
                    <div class="card border-0 shadow-sm">
                        <div class="card-header bg-white py-3">
                            <h5 class="mb-0 fw-bold">My Availability</h5>
                        </div>
                        <div class="card-body p-0">
                            <ul class="list-group list-group-flush">
                                <li v-for="slot in schedule" :key="slot.id" class="list-group-item d-flex justify-content-between align-items-center py-3">
                                    <div>
                                        <div class="fw-bold">{{ slot.date }}</div>
                                        <div class="small text-muted">{{ slot.time_slot }}</div>
                                    </div>
                                    <div class="d-flex align-items-center">
                                        <span v-if="slot.is_booked" class="badge bg-success-subtle text-success me-2">Booked</span>
                                        <button v-else class="btn btn-sm btn-link text-danger p-0 text-decoration-none" @click="deleteSlot(slot.id)">
                                            Delete
                                        </button>
                                    </div>
                                </li>
                                <li v-if="schedule.length === 0" class="list-group-item text-center py-4 text-muted small">
                                    No availability slots added yet.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else-if="view === 'patients'" class="row">
                <div class="col-12">
                    <div class="card border-0 shadow-sm">
                        <div class="card-header bg-white py-3">
                            <h5 class="mb-0 fw-bold">Assigned Patients</h5>
                        </div>
                        <div class="table-responsive">
                            <table class="table mb-0 align-middle">
                                <thead class="table-light text-muted small text-uppercase">
                                    <tr>
                                        <th>Patient Name</th>
                                        <th>Email</th>
                                        <th>Last Visit</th>
                                        <th>Diagnosis</th>
                                        <th>Treatment</th>
                                        <th>Prescription</th>
                                        <th class="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="p in consultedPatients" :key="p.id">
                                        <td>
                                            <div class="fw-bold">{{ p.name }}</div>
                                        </td>
                                        <td>{{ p.email }}</td>
                                        <td>{{ p.last_visit }}</td>
                                        <td>{{ p.last_diagnosis }}</td>
                                        <td>{{ p.last_treatment }}</td>
                                        <td>{{ p.last_prescription }}</td>
                                        <td class="text-end">
                                            <button class="btn btn-sm btn-outline-primary" @click="this.$root.viewTreatmentHistory({id: p.id, name: p.name})">View Full History</button>
                                        </td>
                                    </tr>
                                    <tr v-if="consultedPatients.length === 0">
                                        <td colspan="5" class="text-center py-4 text-muted">No patients assigned yet.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    data() {
        return {
            view: this.$root.currentView === 'patients' ? 'patients' : 'appointments',
            appointments: [],
            schedule: [],
            consultedPatients: [],
            doctorStats: { appointments_per_day: [] },
            loading: false
        };
    },
    mounted() {
        this.loadDoctorData();
    },
    watch: {
        '$root.refreshTrigger'() {
            this.loadDoctorData();
        },
        '$root.currentView'(newView) {
            if (newView === 'patients') this.view = 'patients';
            if (newView === 'dashboard') this.view = 'appointments';
        }
    },
    methods: {
        async loadDoctorData() {
            this.loading = true;
            try {
                const headers = { 'Authorization': `Bearer ${this.$root.token}` };
                const [a, s, cp, ds] = await Promise.all([
                    fetch('/api/doctor/appointments', { headers }).then(r => r.json()),
                    fetch('/api/doctor/schedule', { headers }).then(r => r.json()),
                    fetch('/api/doctor/assigned-patients', { headers }).then(r => r.json()),
                    fetch('/api/doctor/stats', { headers }).then(r => r.json())
                ]);
                
                this.appointments = Array.isArray(a) ? a : [];
                this.schedule = Array.isArray(s) ? s : [];
                this.consultedPatients = Array.isArray(cp) ? cp : [];
                this.doctorStats = ds || { appointments_per_day: [] };
                
                // Update root for other components
                this.$root.appointments = this.appointments;
                this.$root.schedule = this.schedule;
                this.$root.consultedPatients = this.consultedPatients;
                this.$root.doctorStats = this.doctorStats;
            } catch (err) {
                console.error('Failed to load doctor dashboard data', err);
            } finally {
                this.loading = false;
            }
        },
        async updateStatus(appId, status) {
            if (!confirm(`Are you sure you want to mark this appointment as ${status}?`)) return;
            try {
                const res = await fetch(`/api/doctor/appointments/${appId}/status`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.$root.token}`
                    },
                    body: JSON.stringify({ status })
                }).then(r => r.json());
                if (res.error) throw new Error(res.error);
                alert(`Appointment ${status}`);
                this.loadDoctorData();
            } catch (err) {
                alert(err.message);
            }
        },
        async deleteSlot(id) {
            try {
                const res = await fetch(`/api/doctor/schedule/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${this.$root.token}` }
                }).then(r => r.json());
                if (res.error) throw new Error(res.error);
                this.schedule = this.schedule.filter(s => s.id !== id);
                this.$root.schedule = this.schedule;
            } catch (err) {
                alert(err.message);
            }
        },
        getStatusClass(status) {
            const classes = {
                'booked': 'badge bg-primary-subtle text-primary',
                'completed': 'badge bg-success-subtle text-success',
                'cancelled': 'badge bg-danger-subtle text-danger'
            };
            return classes[status] || 'badge bg-secondary-subtle text-secondary';
        }
    }
};

export const ConsultationModal = {
    template: `
    <div class="modal fade show d-block" style="background: rgba(0,0,0,0.5)">
        <div class="modal-dialog">
            <div class="modal-content rounded-4">
                <div class="modal-header border-0">
                    <h5 class="modal-title fw-bold">Consultation: {{ this.$root.consultingApp.patient_name }}</h5>
                    <button type="button" class="btn-close" @click="this.$root.consultingApp = null"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Diagnosis</label>
                        <textarea v-model="this.$root.treatment.diagnosis" class="form-control" rows="3"></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Treatment</label>
                        <textarea v-model="this.$root.treatment.treatment" class="form-control" rows="3"></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Prescription</label>
                        <textarea v-model="this.$root.treatment.prescription" class="form-control" rows="3"></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Notes</label>
                        <textarea v-model="this.$root.treatment.notes" class="form-control" rows="2"></textarea>
                    </div>
                </div>
                <div class="modal-footer border-0">
                    <button class="btn btn-light" @click="this.$root.consultingApp = null">Cancel</button>
                    <button class="btn btn-primary" :disabled="loading" @click="completeConsultation">
                        <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                        Complete Visit
                    </button>
                </div>
            </div>
        </div>
    </div>
    `,
    data() {
        return { loading: false };
    },
    methods: {
        async completeConsultation() {
            this.loading = true;
            try {
                await fetch(`/api/doctor/appointments/${this.$root.consultingApp.id}/complete`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.$root.token}`
                    },
                    body: JSON.stringify(this.$root.treatment)
                });
                this.$root.consultingApp = null;
                this.$root.treatment = { diagnosis: '', treatment: '', prescription: '', notes: '' };
                alert('Visit Completed');
                this.$root.triggerRefresh();
            } catch (err) { alert('Failed to complete visit'); }
            finally { this.loading = false; }
        }
    }
};

export const AddScheduleModal = {
    template: `
    <div class="modal fade show d-block" style="background: rgba(0,0,0,0.5)">
        <div class="modal-dialog">
            <div class="modal-content rounded-4">
                <div class="modal-header border-0">
                    <h5 class="modal-title fw-bold">Add Availability Slot</h5>
                    <button type="button" class="btn-close" @click="this.$root.showAddSlot = false"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Date</label>
                        <input v-model="this.$root.newSlot.date" type="date" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Time Slot</label>
                        <input v-model="this.$root.newSlot.time_slot" type="time" class="form-control" required>
                    </div>
                </div>
                <div class="modal-footer border-0">
                    <button class="btn btn-light" @click="this.$root.showAddSlot = false">Cancel</button>
                    <button class="btn btn-primary" :disabled="loading" @click="addSlot">
                        <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                        Add Slot
                    </button>
                </div>
            </div>
        </div>
    </div>
    `,
    data() {
        return { loading: false };
    },
    methods: {
        async addSlot() {
            this.loading = true;
            try {
                const res = await fetch('/api/doctor/schedule', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.$root.token}`
                    },
                    body: JSON.stringify(this.$root.newSlot)
                }).then(r => r.json());
                if (res.error) throw new Error(res.error);
                this.$root.showAddSlot = false;
                this.$root.newSlot = { date: '', time_slot: '' };
                this.$root.triggerRefresh();
            } catch (err) { alert(err.message || 'Failed to add slot'); }
            finally { this.loading = false; }
        }
    }
};
