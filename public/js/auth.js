 // auth.js - Authentication and shared functions

// Check if user is logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token) {
        window.location.href = '/';
        return null;
    }
    return { token, user };
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Show toast notification
 // Remove alert from login and replace with toast notification
// In auth.js, replace any alert calls

// Add showToast function if not present
function showToast(message, type = 'success') {
    const existingToast = document.getElementById('toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 1001;
        border-left: 4px solid ${type === 'success' ? '#48bb78' : '#f56565'};
        animation: slideIn 0.3s ease;
    `;
    
    const icon = document.createElement('i');
    icon.className = `fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`;
    icon.style.color = type === 'success' ? '#48bb78' : '#f56565';
    
    const span = document.createElement('span');
    span.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(span);
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Format date
function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return 'Date not available';
    }
}

// Handle API errors
async function handleResponse(response) {
    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        throw new Error('Session expired');
    }
    
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Request failed');
    }
    
    return response.json();
}

// Set loading state on button
function setLoading(button, isLoading, originalText) {
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    } else {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// Initialize login page
function initLogin() {
    console.log('Initializing login page...');
    
    const showRegisterLink = document.getElementById('showRegister');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const roleBtns = document.querySelectorAll('.role-btn');
    const regRoleSelect = document.getElementById('regRole');
    const deptField = document.querySelector('.dept-field');
    
    if (!loginForm || !registerForm) {
        console.error('Login or register form not found!');
        return;
    }
    
    // Toggle to register form
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Switching to register form');
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('registerSection').style.display = 'block';
        });
    }
    
    // Toggle back to login form
    const showLoginBtn = document.getElementById('showLogin');
    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Switching to login form');
            document.getElementById('registerSection').style.display = 'none';
            document.getElementById('loginSection').style.display = 'block';
        });
    }
    
    // Role selection for login
    roleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            roleBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Show/hide department field based on role in registration
    if (regRoleSelect) {
        regRoleSelect.addEventListener('change', function() {
            if (deptField) {
                const shouldShow = this.value === 'officer' || this.value === 'admin';
                deptField.style.display = shouldShow ? 'block' : 'none';
                const deptSelect = document.getElementById('regDepartment');
                if (deptSelect) {
                    deptSelect.required = shouldShow;
                }
            }
        });
    }
    
    // Phone number validation
    const regPhone = document.getElementById('regPhone');
    if (regPhone) {
        regPhone.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
    }
    
    // Login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email')?.value.trim();
            const password = document.getElementById('password')?.value;
            
            if (!email || !password) {
                showToast('Please fill all fields', 'error');
                return;
            }
            
            const loginBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = loginBtn.innerHTML;
            setLoading(loginBtn, true, originalText);
            
            try {
                console.log('Attempting login with:', { email });
                
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                console.log('Login response:', data);
                
                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    showToast('Login successful! Redirecting...', 'success');
                    
                    // Redirect based on role
                    setTimeout(() => {
                        if (data.user.role === 'admin') {
                            window.location.href = '/admin.html';
                        } else if (data.user.role === 'officer') {
                            window.location.href = '/officer.html';
                        } else {
                            window.location.href = '/dashboard.html';
                        }
                    }, 1000);
                } else {
                    showToast(data.error || 'Login failed', 'error');
                    setLoading(loginBtn, false, originalText);
                }
            } catch (error) {
                console.error('Login error:', error);
                showToast('Network error. Please check if server is running.', 'error');
                setLoading(loginBtn, false, originalText);
            }
        });
    }
    
    // Register form submission
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('regName')?.value.trim();
            const email = document.getElementById('regEmail')?.value.trim();
            const phone = document.getElementById('regPhone')?.value.trim();
            const password = document.getElementById('regPassword')?.value;
            const role = document.getElementById('regRole')?.value;
            const department = document.getElementById('regDepartment')?.value;
            
            console.log('Registration attempt:', { name, email, phone, role });
            
            // Validate required fields
            if (!name || !email || !phone || !password || !role) {
                showToast('Please fill all required fields', 'error');
                return;
            }
            
            // Validate email format
            if (!email.includes('@') || !email.includes('.')) {
                showToast('Please enter a valid email address', 'error');
                return;
            }
            
            // Validate phone number
            if (!/^\d{10}$/.test(phone)) {
                showToast('Please enter a valid 10-digit phone number', 'error');
                return;
            }
            
            // Validate password
            if (password.length < 6) {
                showToast('Password must be at least 6 characters long', 'error');
                return;
            }
            
            // Validate department for officers/admins
            if ((role === 'officer' || role === 'admin') && !department) {
                showToast('Please select a department', 'error');
                return;
            }
            
            const registerBtn = registerForm.querySelector('button[type="submit"]');
            const originalText = registerBtn.innerHTML;
            setLoading(registerBtn, true, originalText);
            
            try {
                const registrationData = {
                    name,
                    email,
                    phone,
                    password,
                    role
                };
                
                if ((role === 'officer' || role === 'admin') && department) {
                    registrationData.department = department;
                }
                
                console.log('Sending registration data:', registrationData);
                
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(registrationData)
                });
                
                const data = await response.json();
                console.log('Registration response:', data);
                
                if (response.ok) {
                    showToast('Registration successful! Please login.', 'success');
                    
                    // Switch to login form
                    document.getElementById('registerSection').style.display = 'none';
                    document.getElementById('loginSection').style.display = 'block';
                    
                    // Reset register form
                    registerForm.reset();
                    if (deptField) deptField.style.display = 'none';
                    
                    // Pre-fill email in login form
                    document.getElementById('email').value = email;
                    
                    setLoading(registerBtn, false, originalText);
                } else {
                    showToast(data.error || 'Registration failed', 'error');
                    setLoading(registerBtn, false, originalText);
                }
            } catch (error) {
                console.error('Registration error:', error);
                showToast('Network error. Please check if server is running.', 'error');
                setLoading(registerBtn, false, originalText);
            }
        });
    }
}

// Check if user is already logged in
function checkExistingSession() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (token && user.role && window.location.pathname === '/') {
        console.log('User already logged in, redirecting...');
        if (user.role === 'admin') {
            window.location.href = '/admin.html';
        } else if (user.role === 'officer') {
            window.location.href = '/officer.html';
        } else {
            window.location.href = '/dashboard.html';
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    
    // Check for existing session
    checkExistingSession();
    
    // Only run on login page
    if (document.querySelector('.auth-container')) {
        initLogin();
    }
});