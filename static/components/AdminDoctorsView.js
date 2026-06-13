export default {
    template: `
    <div class="card">
        <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
            <h5 class="mb-0 fw-bold">All Registered Doctors</h5>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-primary" @click="fetchDoctors()" :disabled="loading">
                    <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                    Refresh
                </button>
                <button class="btn btn-sm btn-primary" @click="$root.showAddDoctor = true">Add New Doctor</button>
            </div>
        </div>
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead class="table-light">
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Specialization</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading && doctors.length === 0">
                        <td colspan="5" class="text-center py-4">
                            <div class="spinner-border text-primary"></div>
                        </td>
                    </tr>
                    <tr v-for="doc in filteredDoctors" :key="doc.id">
                        <td>
                            <div class="fw-bold">{{ doc.name }}</div>
                            <div class="small text-muted">ID: #{{ doc.id }}</div>
                        </td>
                        <td>{{ doc.email }}</td>
                        <td><span class="badge bg-primary-subtle text-primary">{{ doc.specialization }}</span></td>
                        <td>
                            <span :class="doc.is_blacklisted ? 'badge bg-danger' : 'badge bg-success'">
                                {{ doc.is_blacklisted ? 'Blacklisted' : 'Active' }}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-2" @click="$root.editingDoc = { ...doc }">Edit Profile</button>
                            <button 
                                :class="doc.is_blacklisted ? 'btn btn-sm btn-outline-success me-2' : 'btn btn-sm btn-outline-warning me-2'"
                                @click="toggleBlacklist(doc)"
                            >
                                {{ doc.is_blacklisted ? 'Unblacklist' : 'Blacklist' }}
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    `,
    data() {
        return {
            doctors: [],
            loading: false
        };
    },
    computed: {
        filteredDoctors() {
            if (!this.$root.searchQuery) return this.doctors;
            const q = this.$root.searchQuery.toLowerCase();
            return this.doctors.filter(d => 
                d.name.toLowerCase().includes(q) || 
                d.specialization.toLowerCase().includes(q)
            );
        }
    },
    mounted() {
        this.fetchDoctors();
    },
    watch: {
        '$root.refreshTrigger'() {
            this.fetchDoctors();
        }
    },
    methods: {
        async fetchDoctors() {
            this.loading = true;
            try {
                const res = await fetch('/api/admin/doctors', {
                    headers: { 'Authorization': `Bearer ${this.$root.token}` }
                }).then(r => r.json());
                this.doctors = Array.isArray(res) ? res : [];
                // Also update root doctors for other components that might still use it
                this.$root.doctors = this.doctors;
            } catch (err) {
                console.error('Failed to fetch doctors', err);
            } finally {
                this.loading = false;
            }
        },
        async toggleBlacklist(doc) {
            try {
                const res = await fetch(`/api/admin/doctors/${doc.id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.$root.token}` 
                    },
                    body: JSON.stringify({ is_blacklisted: !doc.is_blacklisted })
                }).then(r => r.json());
                if (res.error) throw new Error(res.error);
                doc.is_blacklisted = !doc.is_blacklisted;
            } catch (err) {
                alert(err.message);
            }
        }
    }
};

export const AddDoctorModal = {
    template: `
    <div class="modal fade show d-block" style="background: rgba(0,0,0,0.5)">
        <div class="modal-dialog">
            <div class="modal-content rounded-4">
                <div class="modal-header border-0">
                    <h5 class="modal-title fw-bold">Add New Doctor</h5>
                    <button type="button" class="btn-close" @click="$root.showAddDoctor = false"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Full Name</label>
                        <input v-model="$root.newDoc.name" type="text" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Specialization</label>
                        <select v-model="$root.newDoc.specialization_id" class="form-select" required>
                            <option value="">Select Specialization</option>
                            <option v-for="s in $root.specializations" :key="s.id" :value="s.id">{{ s.name }}</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Email</label>
                        <input v-model="$root.newDoc.email" type="email" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Password</label>
                        <input v-model="$root.newDoc.password" type="password" class="form-control" required>
                    </div>
                </div>
                <div class="modal-footer border-0">
                    <button class="btn btn-light" @click="$root.showAddDoctor = false">Cancel</button>
                    <button class="btn btn-primary" :disabled="loading" @click="addDoctor">
                        <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                        Save Doctor
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
        async addDoctor() {
            this.loading = true;
            try {
                const res = await fetch('/api/admin/doctors', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.$root.token}`
                    },
                    body: JSON.stringify(this.$root.newDoc)
                });
                const data = await res.json();
                if (res.ok) {
                    this.$root.showAddDoctor = false;
                    this.$root.newDoc = { email: '', password: '', name: '', specialization_id: '' };
                    alert('Doctor added successfully');
                    this.$root.triggerRefresh();
                } else {
                    alert(data.error || 'Failed to add doctor');
                }
            } catch (err) { alert('Failed to add doctor'); }
            finally { this.loading = false; }
        }
    }
};

export const EditDoctorModal = {
    template: `
    <div class="modal fade show d-block" style="background: rgba(0,0,0,0.5)">
        <div class="modal-dialog">
            <div class="modal-content rounded-4">
                <div class="modal-header border-0">
                    <h5 class="modal-title fw-bold">Edit Doctor Profile</h5>
                    <button type="button" class="btn-close" @click="$root.editingDoc = null"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Full Name</label>
                        <input v-model="$root.editingDoc.name" type="text" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Email</label>
                        <input v-model="$root.editingDoc.email" type="email" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Specialization</label>
                        <select v-model="$root.editingDoc.specialization_id" class="form-select" required>
                            <option value="">Select Specialization</option>
                            <option v-for="s in $root.specializations" :key="s.id" :value="s.id">{{ s.name }}</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">New Password (leave blank to keep current)</label>
                        <input v-model="$root.editingDoc.password" type="password" class="form-control">
                    </div>
                </div>
                <div class="modal-footer border-0 d-flex justify-content-between">
                    <button class="btn btn-outline-danger" @click="deleteDoctor">Delete Doctor</button>
                    <div>
                        <button class="btn btn-light me-2" @click="$root.editingDoc = null">Cancel</button>
                        <button class="btn btn-primary" :disabled="loading" @click="updateDoctor">
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
        async updateDoctor() {
            this.loading = true;
            try {
                await fetch(`/api/admin/doctors/${this.$root.editingDoc.id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.$root.token}`
                    },
                    body: JSON.stringify(this.$root.editingDoc)
                });
                this.$root.editingDoc = null;
                alert('Doctor profile updated');
                this.$root.triggerRefresh();
            } catch (err) { alert('Failed to update doctor'); }
            finally { this.loading = false; }
        },
        async deleteDoctor() {
            if (!confirm('Are you sure you want to delete this doctor?')) return;
            try {
                await fetch(`/api/admin/doctors/${this.$root.editingDoc.id}`, {
                    method: 'DELETE',
                    headers: { 
                        'Authorization': `Bearer ${this.$root.token}`
                    }
                });
                this.$root.editingDoc = null;
                alert('Doctor deleted');
                this.$root.triggerRefresh();
            } catch (err) { alert('Failed to delete doctor'); }
        }
    }
};
