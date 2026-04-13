// Supabase 配置 - 已填入你的项目信息
const SUPABASE_URL = 'https://mlvyibpftjdseaodlqff.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sdnlpYnBmdGpkc2Vhb2RscWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNjY4MzIsImV4cCI6MjA5MTY0MjgzMn0.fZiHQ9IHIO6dkt7nNxmu5eNmkuYfxjlw6mKMX-eTI6I';

// 初始化 Supabase 客户端
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 当前用户状态
let currentUser = null;

// 获取当前用户
function getCurrentUser() {
    return currentUser;
}

// 检查是否登录
function isLoggedIn() {
    return currentUser !== null;
}

// 注册用户
async function register(username, password) {
    try {
        // 使用 Supabase Auth 注册（用用户名构造邮箱）
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: `${username}@apexfit.local`,
            password: password,
            options: {
                data: { username: username }
            }
        });
        
        if (authError) throw new Error(authError.message);
        
        // 在 profiles 表记录用户名
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([{ id: authData.user.id, username: username }]);
        
        if (profileError) console.warn('Profile创建警告:', profileError);
        
        currentUser = {
            id: authData.user.id,
            username: username,
            email: authData.user.email
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// 登录用户
async function login(username, password) {
    try {
        const email = `${username}@apexfit.local`;
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw new Error('用户名或密码错误');
        
        // 获取用户名
        let displayName = username;
        const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', data.user.id)
            .single();
        
        if (profile) displayName = profile.username;
        
        currentUser = {
            id: data.user.id,
            username: displayName,
            email: data.user.email
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// 登出
async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
    localStorage.removeItem('currentUser');
    location.reload();
}

// 恢复登录状态
async function restoreSession() {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
        currentUser = JSON.parse(stored);
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        currentUser = null;
        localStorage.removeItem('currentUser');
    }
    
    updateAuthUI();
    return currentUser;
}

// 更新UI显示登录状态
function updateAuthUI() {
    const user = getCurrentUser();
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const usernameDisplay = document.getElementById('usernameDisplay');
    
    if (user && authButtons && userInfo) {
        authButtons.style.display = 'none';
        userInfo.style.display = 'flex';
        if (usernameDisplay) usernameDisplay.textContent = user.username;
    } else if (authButtons && userInfo) {
        authButtons.style.display = 'flex';
        userInfo.style.display = 'none';
    }
}
