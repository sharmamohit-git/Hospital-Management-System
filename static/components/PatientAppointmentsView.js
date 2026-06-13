export default {
    template: `
    <div class="patient-appointments">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="fw-bold mb-0">My Appointments</h2>
            <button class="btn btn-sm btn-outline-primary" @click="fetchAppointments()" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                Refresh
            </button>
        </div>

        <div v-if="loading && appointments.length === 0" class="text-center py-5">
            <div class="spinner-border text-primary"></div>
        </div>
        <div v-else class="row g-4">
            <!-- Upcoming Appointments -->
            <div class="col-md-6">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-header bg-white py-3">
                        <h5 class="mb-0 fw-bold text-primary">Upcoming</h5>
                    </div>
                    <div class="card-body p-0">
                        <div v-if="upcoming.length === 0" class="text-center py-5 text-muted">
                            No upcoming appointments.
                        </div>
                        <ul v-else class="list-group list-group-flush">
                            <li v-for="app in upcoming" :key="app.id" class="list-group-item py-3">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <div class="fw-bold">Dr. {{ app.doctor_name }}</div>
                                        <div class="small text-muted">{{ app.date }} at {{ app.time }}</div>
                                    </div>
                                    <div class="d-flex flex-column align-items-end">
                                        <span class="badge bg-primary-subtle text-primary mb-2">{{ app.status }}</span>
                                        <button class="btn btn-sm btn-outline-danger" @click="cancelAppointment(app.id)">Cancel</button>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Past Appointments -->
            <div class="col-md-6">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-header bg-white py-3">
                        <h5 class="mb-0 fw-bold text-secondary">History</h5>
                    </div>
                    <div class="card-body p-0">
                        <div v-if="past.length === 0" class="text-center py-5 text-muted">
                            No past appointments.
                        </div>
                        <ul v-else class="list-group list-group-flush">
                            <li v-for="app in past" :key="app.id" class="list-group-item py-3">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <div class="fw-bold">Dr. {{ app.doctor_name }}</div>
                                        <div class="small text-muted">{{ app.date }} at {{ app.time }}</div>
                                    </div>
                                    <span :class="app.status === 'completed' ? 'badge bg-success-subtle text-success' : 'badge bg-danger-subtle text-danger'">
                                        {{ app.status }}
                                    </span>
                                </div>
                                <div v-if="app.diagnosis" class="bg-light p-2 rounded small mt-2">
                                    <strong>Diagnosis:</strong> {{ app.diagnosis }}
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    data() {
        return {
            appointments: [],
            loading: false
        };
    },
    computed: {
        upcoming() {
            return this.appointments.filter(a => a.status === 'booked');
        },
        past() {
            return this.appointments.filter(a => a.status !== 'booked');
        }
    },
    mounted() {
        this.fetchAppointments();
    },
    watch: {
        '$root.refreshTrigger'() {
            this.fetchAppointments();
        }
    },
    methods: {
        async fetchAppointments() {
            this.loading = true;
            try {
                const res = await fetch('/api/patient/appointments', {
                    headers: { 'Authorization': `Bearer ${this.$root.token}` }
                }).then(r => r.json());
                this.appointments = Array.isArray(res) ? res : [];
                this.$root.appointments = this.appointments;
            } catch (err) {
                console.error('Failed to fetch appointments', err);
            } finally {
                this.loading = false;
            }
        },
        async cancelAppointment(id) {
            if (!confirm('Are you sure you want to cancel this appointment?')) return;
            try {
                const res = await fetch(`/api/patient/appointments/${id}/cancel`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.$root.token}` }
                }).then(r => r.json());
                if (res.error) throw new Error(res.error);
                this.fetchAppointments();
            } catch (err) {
                alert(err.message);
            }
        }
    }
};
