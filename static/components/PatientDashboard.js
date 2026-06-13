export default {
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="fw-bold mb-0">Find a Doctor</h2>
            <div class="btn-group">
                <button class="btn btn-outline-secondary rounded-pill px-4 me-2" @click="this.$root.openEditProfile()">
                 Edit Profile
                </button>
                
                <button class="btn btn-outline-primary rounded-pill px-4" @click="this.$root.triggerExport()">
                    Download Treatment History
                </button>
            </div>
        </div>

        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-primary"></div>
        </div>
        <div v-else>
            <div v-for="spec in specializations" :key="spec.id" class="mb-5">
                <h3 class="h5 fw-bold mb-3 text-primary border-bottom pb-2">{{ spec.name }}</h3>
                <div class="row g-4">
                    <div class="col-md-4" v-for="doc in getDoctorsBySpec(spec.name)" :key="doc.id">
                        <div class="card h-100 p-4 shadow-sm border text-center">
                            <h5 class="fw-bold mb-1">Dr. {{ doc.name }}</h5><br>
                            <button class="btn btn-primary w-100 rounded-pill" @click="this.$root.selectBookingDoc(doc)">Book Now</button>
                        </div>
                    </div>
                    <div v-if="getDoctorsBySpec(spec.name).length === 0" class="col-12 text-muted small italic">
                        No doctors available in this specialization yet.
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    data() {
        return {
            specializations: [],
            doctors: [],
            loading: false
        };
    },
    mounted() {
        this.loadData();
    },
    watch: {
        '$root.refreshTrigger'() {
            this.loadData();
        }
    },
    methods: {
        async loadData() {
            this.loading = true;
            try {
                const headers = { 'Authorization': `Bearer ${this.$root.token}` };
                const [s, d] = await Promise.all([
                    fetch('/api/departments').then(r => r.json()),
                    fetch('/api/patient/doctors', { headers }).then(r => r.json())
                ]);
                this.specializations = Array.isArray(s) ? s : [];
                this.doctors = Array.isArray(d) ? d : [];
                
                // Update root for other components
                this.$root.specializations = this.specializations;
                this.$root.doctors = this.doctors;
            } catch (err) {
                console.error('Failed to load patient dashboard data', err);
            } finally {
                this.loading = false;
            }
        },
        getDoctorsBySpec(specName) {
            return this.doctors.filter(d => d.specialization === specName);
        }
    }
};

export const BookingModal = {
    template: `
    <div class="modal fade show d-block" style="background: rgba(0,0,0,0.5)">
        <div class="modal-dialog">
            <div class="modal-content rounded-4">
                <div class="modal-header border-0">
                    <h5 class="modal-title fw-bold">Book with {{ this.$root.bookingDoc.name }}</h5>
                    <button type="button" class="btn-close" @click="this.$root.bookingDoc = null"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Select Available Slot</label>
                        <select v-model="this.$root.book.slot_id" class="form-select" required>
                            <option value="">Choose a slot...</option>
                            <option v-for="s in this.$root.availableSlots" :key="s.id" :value="s.id">
                                {{ s.date }} at {{ s.time_slot }}
                            </option>
                        </select>
                    </div>
                    <div v-if="this.$root.availableSlots.length === 0" class="alert alert-warning py-2 small">
                        No available slots for this doctor.
                    </div>
                </div>
                <div class="modal-footer border-0">
                    <button class="btn btn-light" @click="this.$root.bookingDoc = null">Cancel</button>
                    <button class="btn btn-primary" :disabled="!this.$root.book.slot_id || loading" @click="confirmBooking">
                        <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                        Confirm Booking
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
        async confirmBooking() {
            this.loading = true;
            try {
                const res = await fetch('/api/patient/appointments', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.$root.token}`
                    },
                    body: JSON.stringify({ doctor_id: this.$root.bookingDoc.id, slot_id: this.$root.book.slot_id })
                }).then(r => r.json());
                if (res.error) throw new Error(res.error);
                this.$root.bookingDoc = null;
                this.$root.book = { slot_id: '' };
                alert('Booked!');
                this.$root.triggerRefresh();
            } catch (err) { alert(err.message || 'Failed to book'); }
            finally { this.loading = false; }
        }
    }
};

export const EditProfileModal = {
    template: `
    <div class="modal fade show d-block" style="background: rgba(0,0,0,0.5)">
        <div class="modal-dialog">
            <div class="modal-content rounded-4">
                <div class="modal-header border-0">
                    <h5 class="modal-title fw-bold">Edit My Profile</h5>
                    <button type="button" class="btn-close" @click="this.$root.editingProfile = null"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Full Name</label>
                        <input v-model="this.$root.editingProfile.name" type="text" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Email Address</label>
                        <input v-model="this.$root.editingProfile.email" type="email" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">New Password (leave blank to keep current)</label>
                        <input v-model="this.$root.editingProfile.password" type="password" class="form-control">
                    </div>
                </div>
                <div class="modal-footer border-0">
                    <button class="btn btn-light me-2" @click="this.$root.editingProfile = null">Cancel</button>
                    <button class="btn btn-primary" :disabled="loading" @click="saveProfile">
                        <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                        Update Profile
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
        async saveProfile() {
            this.loading = true;
            try {
                const res = await fetch('/api/patient/profile', {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.$root.token}`
                    },
                    body: JSON.stringify(this.$root.editingProfile)
                });
                const data = await res.json();
                if (res.ok) {
                    // Update local user data
                    this.$root.user.name = this.$root.editingProfile.name;
                    this.$root.user.email = this.$root.editingProfile.email;
                    localStorage.setItem('hms_user', JSON.stringify(this.$root.user));
                    
                    this.$root.editingProfile = null;
                    alert('Profile updated');
                    this.$root.triggerRefresh();
                } else {
                    alert(data.error || 'Failed to update profile');
                }
            } catch (err) { alert('Failed to update profile'); }
            finally { this.loading = false; }
        }
    }
};
