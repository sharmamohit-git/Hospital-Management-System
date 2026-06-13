export default {
    template: `
        <div class="admin-patients">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="h4 mb-0">Patient Management</h2>
                <button class="btn btn-sm btn-outline-primary" @click="fetchPatients()" :disabled="loading">
                    <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                    Refresh
                </button>
            </div>

            <div class="card glass-card">
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading && patients.length === 0">
                                <td colspan="4" class="text-center py-4">
                                    <div class="spinner-border text-primary"></div>
                                </td>
                            </tr>
                            <tr v-for="patient in filteredPatients" :key="patient.id">
                                <td>
                                    <div class="fw-bold">{{ patient.name }}</div>
                                </td>
                                <td>{{ patient.email }}</td>
                                <td>
                                    <span :class="patient.is_blacklisted ? 'badge bg-danger' : 'badge bg-success'">
                                        {{ patient.is_blacklisted ? 'Blacklisted' : 'Active' }}
                                    </span>
                                </td>
                                <td class="text-end">
                                    <button class="btn btn-sm btn-outline-info me-2" @click="$root.viewTreatmentHistory(patient)">
                                        View History
                                    </button>
                                    <button class="btn btn-sm btn-outline-primary me-2" @click="$root.editingPatient = { ...patient }">
                                        Edit
                                    </button>
                                    <button 
                                        :class="patient.is_blacklisted ? 'btn btn-sm btn-outline-success me-2' : 'btn btn-sm btn-outline-warning me-2'"
                                        @click="toggleBlacklist(patient)"
                                    >
                                        {{ patient.is_blacklisted ? 'Unblacklist' : 'Blacklist' }}
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" @click="deletePatient(patient)">
                                        Delete
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="!loading && filteredPatients.length === 0">
                                <td colspan="4" class="text-center py-4 text-muted">No patients found</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            patients: [],
            loading: false
        };
    },
    computed: {
        filteredPatients() {
            if (!this.$root.searchQuery) return this.patients;
            const q = this.$root.searchQuery.toLowerCase();
            return this.patients.filter(p => 
                p.name.toLowerCase().includes(q) || 
                p.email.toLowerCase().includes(q)
            );
        }
    },
    mounted() {
        this.fetchPatients();
    },
    watch: {
        '$root.refreshTrigger'() {
            this.fetchPatients();
        }
    },
    methods: {
        async fetchPatients() {
            this.loading = true;
            try {
                const res = await fetch('/api/admin/patients', {
                    headers: { 'Authorization': `Bearer ${this.$root.token}` }
                }).then(r => r.json());
                this.patients = Array.isArray(res) ? res : [];
                this.$root.patients = this.patients;
            } catch (err) {
                console.error('Failed to fetch patients', err);
            } finally {
                this.loading = false;
            }
        },
        async toggleBlacklist(patient) {
            try {
                const res = await fetch(`/api/admin/patients/${patient.id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.$root.token}` 
                    },
                    body: JSON.stringify({ is_blacklisted: !patient.is_blacklisted })
                }).then(r => r.json());
                if (res.error) throw new Error(res.error);
                patient.is_blacklisted = !patient.is_blacklisted;
            } catch (err) {
                alert(err.message);
            }
        },
        async deletePatient(patient) {
            if (!confirm('Are you sure you want to delete this patient?')) return;
            try {
                const res = await fetch(`/api/admin/patients/${patient.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${this.$root.token}` }
                }).then(r => r.json());
                if (res.error) throw new Error(res.error);
                this.patients = this.patients.filter(p => p.id !== patient.id);
                this.$root.patients = this.patients;
            } catch (err) {
                alert(err.message);
            }
        }
    }
};

export const TreatmentHistoryModal = {
    template: `
    <div class="modal fade show d-block" style="background: rgba(0,0,0,0.5)">
        <div class="modal-dialog modal-lg">
            <div class="modal-content rounded-4">
                <div class="modal-header border-0">
                    <h5 class="modal-title fw-bold">Treatment History: {{ $root.viewingHistoryPatient.name }}</h5>
                    <button type="button" class="btn-close" @click="$root.viewingHistoryPatient = null"></button>
                </div>
                <div class="modal-body">
                    <div v-if="$root.patientTreatmentHistory.length === 0" class="text-center py-4 text-muted">
                        No treatment history found for this patient.
                    </div>
                    <div v-else class="accordion" id="historyAccordion">
                        <div v-for="(item, index) in $root.patientTreatmentHistory" :key="item.appointment_id" class="accordion-item border-0 mb-3 shadow-sm rounded-3 overflow-hidden">
                            <h2 class="accordion-header">
                                <button class="accordion-button collapsed fw-bold" type="button" data-bs-toggle="collapse" :data-bs-target="'#collapse' + index">
                                    <div class="d-flex justify-content-between w-100 me-3">
                                        <span>{{ item.date }} at {{ item.time }}</span>
                                        <span class="text-muted small">Dr. {{ item.doctor_name }}</span>
                                    </div>
                                </button>
                            </h2>
                            <div :id="'collapse' + index" class="accordion-collapse collapse" data-bs-parent="#historyAccordion">
                                <div class="accordion-body bg-light">
                                    <div class="mb-3">
                                        <label class="small text-muted text-uppercase fw-bold">Diagnosis</label>
                                        <p class="mb-0">{{ item.diagnosis }}</p>
                                    </div>
                                    <div class="mb-3">
                                        <label class="small text-muted text-uppercase fw-bold">Treatment</label>
                                        <p class="mb-0">{{ item.treatment }}</p>
                                    </div>
                                    <div class="mb-3">
                                        <label class="small text-muted text-uppercase fw-bold">Prescription</label>
                                        <p class="mb-0">{{ item.prescription }}</p>
                                    </div>
                                    <div v-if="item.notes">
                                        <label class="small text-muted text-uppercase fw-bold">Notes</label>
                                        <p class="mb-0">{{ item.notes }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer border-0">
                    <button class="btn btn-light" @click="$root.viewingHistoryPatient = null">Close</button>
                </div>
            </div>
        </div>
    </div>
    `
};

export const EditPatientModal = {
    template: `
    <div class="modal fade show d-block" style="background: rgba(0,0,0,0.5)">
        <div class="modal-dialog">
            <div class="modal-content rounded-4">
                <div class="modal-header border-0">
                    <h5 class="modal-title fw-bold">Edit Patient Profile</h5>
                    <button type="button" class="btn-close" @click="$root.editingPatient = null"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Full Name</label>
                        <input v-model="$root.editingPatient.name" type="text" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Email Address</label>
                        <input v-model="$root.editingPatient.email" type="email" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">New Password (leave blank to keep current)</label>
                        <input v-model="$root.editingPatient.password" type="password" class="form-control">
                    </div>
                </div>
                <div class="modal-footer border-0 d-flex justify-content-between">
                    <button class="btn btn-outline-danger" @click="deletePatient">Delete Patient</button>
                    <div>
                        <button class="btn btn-light me-2" @click="$root.editingPatient = null">Cancel</button>
                        <button class="btn btn-primary" :disabled="loading" @click="updatePatient">
                            <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                            Update Profile
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    data() {
        return { loading: false };
    },
    methods: {
        async updatePatient() {
            this.loading = true;
            try {
                await fetch(`/api/admin/patients/${this.$root.editingPatient.id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.$root.token}`
                    },
                    body: JSON.stringify(this.$root.editingPatient)
                });
                this.$root.editingPatient = null;
                alert('Patient profile updated');
                this.$root.triggerRefresh();
            } catch (err) { alert('Failed to update patient'); }
            finally { this.loading = false; }
        },
        async deletePatient() {
            if (!confirm('Are you sure you want to delete this patient?')) return;
            try {
                await fetch(`/api/admin/patients/${this.$root.editingPatient.id}`, {
                    method: 'DELETE',
                    headers: { 
                        'Authorization': `Bearer ${this.$root.token}`
                    }
                });
                this.$root.editingPatient = null;
                alert('Patient deleted');
                this.$root.triggerRefresh();
            } catch (err) { alert('Failed to delete patient'); }
        }
    }
};
