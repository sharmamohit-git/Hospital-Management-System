export const AppNavigation = {
    data() {
        return {
            localSearchQuery: ''
        };
    },
    computed: {
        unreadCount() {
            return this.$root.notifications ? this.$root.notifications.filter(n => !n.is_read).length : 0;
        }
    },
    template: `
    <nav v-if="this.$root.user" class="navbar navbar-expand-lg navbar-dark sticky-top">
        <div class="container-fluid">
            <div class="d-flex align-items-center flex-grow-1">
                <a class="navbar-brand fw-bold me-4" href="#">Hospital Management System</a>
                
                <!-- Search Box for Admin and Patient -->
                <div v-if="this.$root.user.role === 'admin' || this.$root.user.role === 'patient'" class="flex-grow-1 d-flex justify-content-center">
                    <div class="input-group w-50 shadow-sm rounded-3 overflow-hidden">
                        <span class="input-group-text bg-white border-0"><i class="bi bi-search"></i></span>
                        <input 
                            type="text" 
                            class="form-control border-0" 
                            placeholder="Search..." 
                            v-model="localSearchQuery"
                            @keyup.enter="handleSearch(localSearchQuery)"
                        >
                    </div>
                </div>
            </div>

            <div class="d-flex align-items-center gap-3 text-white">
                <div class="text-end d-none d-md-block">
                    <div class="small fw-bold">{{ this.$root.user.name }}</div>
                    <div class="small opacity-75 text-capitalize">{{ this.$root.user.role }}</div>
                </div>
                <button @click="logout()" class="btn btn-sm btn-outline-light">Logout</button>
            </div>
        </div>
    </nav>
    `,
    methods: {
        handleSearch(query) {
            this.$root.handleSearch(query);
        },
        logout() {
            this.$root.user = null;
            this.$root.token = null;
            localStorage.removeItem('hms_user');
            localStorage.removeItem('hms_token');
            this.$root.currentView = 'login';
            this.$root.updateBodyClass();
        },
        async fetchNotifications() {
            if (!this.$root.user || this.$root.user.role !== 'patient') return;
            try {
                const res = await fetch('/api/patient/notifications', {
                    headers: { 'Authorization': `Bearer ${this.$root.token}` }
                }).then(r => r.json());
                
                const newExportReady = res.find(n => 
                    n.type === 'export_ready' && 
                    !n.is_read && 
                    !this.$root.alertedNotificationIds.includes(n.id)
                );
                
                if (newExportReady) {
                    this.$root.alertedNotificationIds.push(newExportReady.id);
                    
                    // Auto-download prompt
                    const data = JSON.parse(newExportReady.data);
                    if (confirm('Your treatment history export is ready. Would you like to download it now?')) {
                        const link = document.createElement('a');
                        link.href = data.file_url;
                        link.download = data.file_url.split('/').pop();
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        this.$root.markNotificationRead(newExportReady.id);
                    }
                }

                this.$root.notifications = res;
            } catch (err) {}
        }
    },
    mounted() {
        if (this.$root.user && this.$root.user.role === 'patient') {
            this.fetchNotifications();
            setInterval(() => this.fetchNotifications(), 10000); // Poll every 10 seconds
        }
    }
};

export const AppSidebar = {
    template: `
    <nav v-if="this.$root.user" class="col-md-3 col-lg-2 d-md-block sidebar collapse p-0">
        <div class="position-sticky pt-3">
            <ul class="nav flex-column">
                <li class="nav-item" v-for="link in $root.menuLinks" :key="link.label">
                    <a class="nav-link" :class="{active: $root.currentView === link.view}" href="#" @click.prevent="$root.currentView = link.view">
                        {{ link.label }}
                    </a>
                </li>
            </ul>
        </div>
    </nav>
    `
};

export const SearchResultsModal = {
    template: `
    <div class="modal fade show d-block" style="background: rgba(0,0,0,0.5)">
        <div class="modal-dialog modal-lg">
            <div class="modal-content rounded-4 border-0 shadow">
                <div class="modal-header border-0 bg-light rounded-top-4">
                    <h5 class="modal-title fw-bold">Search Results for "{{ this.$root.searchQuery }}"</h5>
                    <button type="button" class="btn-close" @click="this.$root.showSearchResults = false"></button>
                </div>
                <div class="modal-body p-4">
                    <div v-if="this.$root.searchResults.doctors.length === 0 && this.$root.searchResults.patients.length === 0 && this.$root.searchResults.appointments.length === 0 && this.$root.searchResults.departments.length === 0" class="text-center py-5 text-muted">
                        <i class="bi bi-search h1 d-block mb-3 opacity-25"></i>
                        No matches found for your search.
                    </div>

                    <!-- Departments -->
                    <div v-if="this.$root.searchResults.departments.length > 0" class="mb-4">
                        <h6 class="text-uppercase small fw-bold text-warning mb-3">Departments ({{ this.$root.searchResults.departments.length }})</h6>
                        <div class="list-group list-group-flush">
                            <div v-for="dept in this.$root.searchResults.departments" :key="dept.id" class="list-group-item d-flex justify-content-between align-items-center px-0">
                                <div>
                                    <div class="fw-bold">{{ dept.name }}</div>
                                    <div class="small text-muted">{{ dept.description }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Doctors -->
                    <div v-if="this.$root.searchResults.doctors.length > 0" class="mb-4">
                        <h6 class="text-uppercase small fw-bold text-primary mb-3">Doctors ({{ this.$root.searchResults.doctors.length }})</h6>
                        <div class="list-group list-group-flush">
                            <div v-for="doc in this.$root.searchResults.doctors" :key="doc.id" class="list-group-item d-flex justify-content-between align-items-center px-0">
                                <div>
                                    <div class="fw-bold">{{ doc.name }}</div>
                                    <div class="small text-muted">{{ doc.specialization }}</div>
                                </div>
                                <button class="btn btn-sm btn-outline-primary" @click="this.$root.handleSearchResultAction('doctor', doc)">
                                    {{ this.$root.user.role === 'admin' ? 'View Details' : 'Book Now' }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Patients (Admin or Doctor) -->
                    <div v-if="(this.$root.user.role === 'admin' || this.$root.user.role === 'doctor') && this.$root.searchResults.patients.length > 0" class="mb-4">
                        <h6 class="text-uppercase small fw-bold text-success mb-3">Patients ({{ this.$root.searchResults.patients.length }})</h6>
                        <div class="list-group list-group-flush">
                            <div v-for="p in this.$root.searchResults.patients" :key="p.id" class="list-group-item d-flex justify-content-between align-items-center px-0">
                                <div>
                                    <div class="fw-bold">{{ p.name }}</div>
                                    <div class="small text-muted">{{ p.email }}</div>
                                </div>
                                <div class="btn-group">
                                    <button class="btn btn-sm btn-outline-info" @click="this.$root.viewTreatmentHistory(p)">History</button>
                                    <button v-if="this.$root.user.role === 'admin'" class="btn btn-sm btn-outline-success" @click="this.$root.handleSearchResultAction('patient', p)">Details</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Appointments (Admin & Patient) -->
                    <div v-if="(this.$root.user.role === 'patient' || this.$root.user.role === 'admin') && this.$root.searchResults.appointments.length > 0">
                        <h6 class="text-uppercase small fw-bold text-info mb-3">Appointments ({{ this.$root.searchResults.appointments.length }})</h6>
                        <div class="list-group list-group-flush">
                            <div v-for="app in this.$root.searchResults.appointments" :key="app.id" class="list-group-item px-0">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <div class="fw-bold">
                                            <span v-if="this.$root.user.role === 'admin'">{{ app.patient_name }} with </span>
                                            Dr. {{ app.doctor_name }}
                                        </div>
                                        <div class="small text-muted">{{ app.date }} at {{ app.time }}</div>
                                        <div v-if="app.diagnosis || (app.treatment && app.treatment.diagnosis)" class="small mt-1">
                                            <strong>Diagnosis:</strong> {{ app.diagnosis || app.treatment.diagnosis }}
                                        </div>
                                    </div>
                                    <span class="badge" :class="{
                                        'bg-primary-subtle text-primary': app.status === 'booked',
                                        'bg-success-subtle text-success': app.status === 'completed',
                                        'bg-danger-subtle text-danger': app.status === 'cancelled'
                                    }">{{ app.status }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer border-0">
                    <button class="btn btn-light" @click="this.$root.showSearchResults = false">Close</button>
                </div>
            </div>
        </div>
    </div>
    `
};

export const NotificationModal = {
    template: `<div></div>`
};
