export default {
    template: `
    <div class="row justify-content-center align-items-center min-vh-100">
        <div class="col-md-4">
            <div class="text-center mb-4 text-white">
                <h1 class="fw-bold">HOSPITAL MANAGEMENT SYSTEM</h1>
            </div>
            <div class="card p-4 glass-card">
                <h2 class="fw-bold text-center mb-4">Create Account</h2>
                <div v-if="error" class="alert alert-danger">{{ error }}</div>
                <form @submit.prevent="register()">
                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted">Full Name</label>
                        <input v-model="reg.name" type="text" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted">Email</label>
                        <input v-model="reg.email" type="text" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted">Password</label>
                        <input v-model="reg.password" type="password" class="form-control" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100 py-2 fw-bold" :disabled="loading">
                        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                        Register
                    </button>
                </form>
                <div class="text-center mt-3">
                    <a href="#" @click.prevent="this.$root.currentView = 'login'" class="small">Back to Login</a>
                </div>
            </div>
        </div>
    </div>
    `,
    data() {
        return {
            reg: { email: '', password: '', name: '' },
            error: '',
            loading: false
        };
    },
    methods: {
        async register() {
            this.error = '';
            this.loading = true;
            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.reg)
                }).then(r => r.json());
                
                if (res.error) throw new Error(res.error);
                
                alert('Registered! Please login.');
                this.reg = { email: '', password: '', name: '' };
                this.$root.currentView = 'login';
            } catch (err) { 
                this.error = err.message; 
            } finally {
                this.loading = false;
            }
        }
    }
};
