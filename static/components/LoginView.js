export default {
    template: `
    <div class="row justify-content-center align-items-center min-vh-100">
        <div class="col-md-4">
            <div class="text-center mb-4 text-white">
                <h1 class="fw-bold">HOSPITAL MANAGEMENT SYSTEM</h1>
            </div>
            <div class="card p-4 glass-card">
                <div class="text-center mb-4">
                    <h2 class="fw-bold">Welcome</h2>
                    <p class="text-muted">Sign in to your account</p>
                </div>
                <div v-if="error" class="alert alert-danger">{{ error }}</div>
                <form @submit.prevent="login()">
                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted uppercase">Email</label>
                        <input v-model="auth.email" type="text" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted uppercase">Password</label>
                        <input v-model="auth.password" type="password" class="form-control" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100 py-2 fw-bold" :disabled="loading">
                        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                        Sign In
                    </button>
                </form>
                <div class="text-center mt-3">
                    <p class="small text-muted">Don't have an account? <a href="#" @click.prevent="this.$root.currentView = 'register'">Register</a></p>
                </div>
            </div>
        </div>
    </div>
    `,
    data() {
        return {
            auth: { email: '', password: '' },
            error: '',
            loading: false
        };
    },
    methods: {
        async login() {
            this.error = '';
            this.loading = true;
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.auth)
                }).then(r => r.json());
                
                if (res.error) throw new Error(res.error);
                
                this.$root.user = res.user;
                this.$root.token = res.token;
                localStorage.setItem('hms_user', JSON.stringify(res.user));
                localStorage.setItem('hms_token', res.token);
                this.$root.currentView = 'dashboard';
                this.$root.updateBodyClass();
                this.$root.loadData();
            } catch (err) { 
                this.error = err.message; 
            } finally {
                this.loading = false;
            }
        }
    }
};
