export default {
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="fw-bold mb-0">Admin Overview</h2>
            <button class="btn btn-sm btn-outline-primary" @click="loadDashboardData()" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                Refresh Data
            </button>
        </div>
        <div v-if="loading && !stats.doctors" class="text-center py-5">
            <div class="spinner-border text-primary"></div>
        </div>
        <div v-else>
            <div class="row g-4 mb-4">
                <div class="col-md-4" v-for="(val, key) in displayStats" :key="key">
                    <div class="card stat-card bg-white h-100 border">
                        <div class="text-muted small fw-bold text-uppercase">{{ key }}</div>
                        <div class="h2 fw-bold mb-0">{{ val }}</div>
                    </div>
                </div>
            </div>

            <div class="row g-4">
                <div class="col-lg-6">
                    <div class="card border">
                        <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center border">
                            <h5 class="mb-0 fw-bold">Doctors List</h5>
                            <button class="btn btn-sm btn-primary" @click="$root.showAddDoctor = true">Add Doctor</button>
                        </div>
                        <div class="table-responsive border">
                            <table class="table mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Specialization</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="doc in doctors" :key="doc.id">
                                        <td>{{ doc.name }}</td>
                                        <td>{{ doc.email }}</td>
                                        <td><span class="badge bg-primary-subtle text-primary">{{ doc.specialization }}</span></td>
                                        <td>
                                            <button class="btn btn-sm btn-outline-primary" @click="$root.editingDoc = { ...doc }">Edit</button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div class="col-lg-6">
                    <div class="card border">
                        <div class="card-header bg-white py-3 border">
                            <h5 class="mb-0 fw-bold">Recent Appointments</h5>
                        </div>
                        <div class="table-responsive border">
                            <table class="table mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>Patient</th>
                                        <th>Doctor</th>
                                        <th>Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="app in appointments" :key="app.id">
                                        <td>
                                            <div class="fw-bold">{{ app.patient_name }}</div>
                                            <div v-if="app.treatment" class="small text-muted mt-1">
                                                <strong>Diag:</strong> {{ app.treatment.diagnosis }}<br>
                                                <strong>Rx:</strong> {{ app.treatment.prescription }}
                                            </div>
                                        </td>
                                        <td>{{ app.doctor_name }}</td>
                                        <td>{{ app.date }}</td>
                                        <td>
                                            <span class="badge" :class="app.status === 'completed' ? 'bg-primary-subtle text-primary' : 'bg-info-subtle text-info'">
                                                {{ app.status }}
                                            </span>
                                        </td>
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
            stats: {},
            doctors: [],
            appointments: [],
            loading: false
        };
    },
    computed: {
        displayStats() {
            if (!this.stats) return {};
            const { appointments_per_day, ...rest } = this.stats;
            return rest;
        }
    },
    mounted() {
        this.loadDashboardData();
    },
    watch: {
        '$root.refreshTrigger'() {
            this.loadDashboardData();
        }
    },
    methods: {
        async loadDashboardData() {
            this.loading = true;
            try {
                const headers = { 'Authorization': `Bearer ${this.$root.token}` };
                const [s, d, a] = await Promise.all([
                    fetch('/api/admin/stats', { headers }).then(r => r.ok ? r.json() : null),
                    fetch('/api/admin/doctors', { headers }).then(r => r.ok ? r.json() : []),
                    fetch('/api/admin/appointments', { headers }).then(r => r.ok ? r.json() : [])
                ]);
                
                if (s) this.stats = s;
                this.doctors = (Array.isArray(d) ? d : []).slice(0, 5); // Show only 5
                this.appointments = (Array.isArray(a) ? a : []).slice(0, 5); // Show only 5
            } catch (err) {
                console.error('Failed to load dashboard data', err);
            } finally {
                this.loading = false;
            }
        }
    }
};
