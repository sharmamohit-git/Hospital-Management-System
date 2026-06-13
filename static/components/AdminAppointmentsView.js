export default {
    template: `
    <div class="card">
        <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
            <h5 class="mb-0 fw-bold">All Appointments History</h5>
            <button class="btn btn-sm btn-outline-primary" @click="fetchAppointments()" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                Refresh
            </button>
        </div>
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead class="table-light">
                    <tr>
                        <th>ID</th>
                        <th>Patient Name</th>
                        <th>Doctor Name</th>
                        <th>Date & Time</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading && appointments.length === 0">
                        <td colspan="5" class="text-center py-4">
                            <div class="spinner-border text-primary"></div>
                        </td>
                    </tr>
                    <tr v-for="app in appointments" :key="app.id">
                        <td>#{{ app.id }}</td>
                        <td>
                            <div class="fw-medium">{{ app.patient_name }}</div>
                            <div v-if="app.treatment" class="small text-muted mt-1">
                                <strong>Diagnosis:</strong> {{ app.treatment.diagnosis }}<br>
                                <strong>Prescription:</strong> {{ app.treatment.prescription }}
                            </div>
                        </td>
                        <td>{{ app.doctor_name }}</td>
                        <td>
                            <div>{{ app.date }}</div>
                            <div class="small text-muted">{{ app.time }}</div>
                        </td>
                        <td>
                            <span class="badge" :class="{
                                'bg-primary-subtle text-primary': app.status === 'completed',
                                'bg-info-subtle text-info': app.status === 'booked',
                                'bg-danger-subtle text-danger': app.status === 'cancelled'
                            }">
                                {{ app.status }}
                            </span>
                        </td>
                    </tr>
                    <tr v-if="!loading && appointments.length === 0">
                        <td colspan="5" class="text-center py-4 text-muted">No appointments found</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    `,
    data() {
        return {
            appointments: [],
            loading: false
        };
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
                const res = await fetch('/api/admin/appointments', {
                    headers: { 'Authorization': `Bearer ${this.$root.token}` }
                }).then(r => r.json());
                this.appointments = Array.isArray(res) ? res : [];
                this.$root.appointments = this.appointments;
            } catch (err) {
                console.error('Failed to fetch appointments', err);
            } finally {
                this.loading = false;
            }
        }
    }
};
