// 获取 Supabase 客户端（从 auth.js 全局可用）

// 发布动态
async function publishPost(content, imageBase64 = null) {
    const user = getCurrentUser();
    if (!user) {
        alert('请先登录');
        return false;
    }
    
    try {
        const { error } = await supabase
            .from('posts')
            .insert([{
                content: content,
                author: user.username,
                author_id: user.id,
                image: imageBase64,
                likes: 0,
                created_at: new Date().toISOString()
            }]);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// 获取所有动态
async function getPosts() {
    try {
        const { data: posts, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const user = getCurrentUser();
        let userLikes = [];
        if (user) {
            const { data: likes } = await supabase
                .from('likes')
                .select('post_id')
                .eq('user_id', user.id);
            userLikes = likes?.map(l => l.post_id) || [];
        }
        
        return { posts: posts || [], userLikes };
    } catch (error) {
        console.error('获取动态失败:', error);
        return { posts: [], userLikes: [] };
    }
}

// 点赞/取消点赞
async function likePost(postId) {
    const user = getCurrentUser();
    if (!user) {
        alert('请先登录');
        return false;
    }
    
    try {
        const { data: existing } = await supabase
            .from('likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .maybeSingle();
        
        if (existing) {
            await supabase.from('likes').delete().eq('id', existing.id);
            await supabase.rpc('decrement_likes', { post_id: postId });
            return { success: true, action: 'unliked' };
        } else {
            await supabase.from('likes').insert([{
                post_id: postId,
                user_id: user.id,
                username: user.username
            }]);
            await supabase.rpc('increment_likes', { post_id: postId });
            return { success: true, action: 'liked' };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// 添加评论
async function addComment(postId, content) {
    const user = getCurrentUser();
    if (!user) {
        alert('请先登录');
        return false;
    }
    
    try {
        const { error } = await supabase
            .from('comments')
            .insert([{
                post_id: postId,
                content: content,
                author: user.username,
                author_id: user.id,
                created_at: new Date().toISOString()
            }]);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// 获取评论
async function getComments(postId) {
    try {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        return [];
    }
}

// 渲染动态列表
async function renderPosts() {
    const postsList = document.getElementById('postsList');
    if (!postsList) return;
    
    postsList.innerHTML = '<div class="loading">加载中...</div>';
    
    const { posts, userLikes } = await getPosts();
    
    if (posts.length === 0) {
        postsList.innerHTML = '<div class="loading">暂无动态，快来发布第一条吧！</div>';
        return;
    }
    
    postsList.innerHTML = '';
    
    for (const post of posts) {
        const comments = await getComments(post.id);
        
        const postDiv = document.createElement('div');
        postDiv.className = 'post-item';
        
        const timeStr = formatTime(new Date(post.created_at));
        const isLiked = userLikes.includes(post.id);
        
        postDiv.innerHTML = `
            <div class="post-header">
                <span class="post-author">🏋️ ${escapeHtml(post.author)}</span>
                <span class="post-time">${timeStr}</span>
            </div>
            <div class="post-content">${escapeHtml(post.content || '')}</div>
            ${post.image ? `<img src="${post.image}" class="post-image" alt="post image" loading="lazy">` : ''}
            <div class="post-actions">
                <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" data-id="${post.id}">
                    ❤️ ${post.likes || 0}
                </button>
                <button class="action-btn comment-toggle-btn" data-id="${post.id}">
                    💬 ${comments.length}
                </button>
            </div>
            <div class="comments-section" id="comments-${post.id}" style="display:none;">
                <div class="comment-list" id="comment-list-${post.id}">
                    ${comments.map(c => `<div class="comment-item"><span class="comment-author">${escapeHtml(c.author)}:</span> ${escapeHtml(c.content)}</div>`).join('')}
                </div>
                <div class="comment-input">
                    <input type="text" id="comment-input-${post.id}" placeholder="写下你的评论...">
                    <button onclick="submitComment('${post.id}')">发送</button>
                </div>
            </div>
        `;
        
        postsList.appendChild(postDiv);
    }
    
    // 绑定点赞事件
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const postId = btn.dataset.id;
            await likePost(postId);
            renderPosts();
        });
    });
    
    // 绑定评论展开事件
    document.querySelectorAll('.comment-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const postId = btn.dataset.id;
            const commentsDiv = document.getElementById(`comments-${postId}`);
            if (commentsDiv.style.display === 'none') {
                commentsDiv.style.display = 'block';
            } else {
                commentsDiv.style.display = 'none';
            }
        });
    });
}

// 提交评论
window.submitComment = async function(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();
    if (!content) return;
    
    const result = await addComment(postId, content);
    if (result.success) {
        input.value = '';
        renderPosts();
    } else {
        alert(result.message);
    }
};

// 格式化时间
function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return `${days}天前`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// 图片转Base64
function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 模态框逻辑
const modal = document.getElementById('authModal');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const closeBtn = document.querySelector('.close');

if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        modal.style.display = 'block';
    });
}

if (registerBtn) {
    registerBtn.addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        modal.style.display = 'block';
    });
}

if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
}

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

document.getElementById('switchToRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
});

document.getElementById('switchToLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
});

// 登录/注册按钮事件
document.getElementById('doLoginBtn')?.addEventListener('click', async () => {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        alert('请填写完整信息');
        return;
    }
    
    const result = await login(username, password);
    if (result.success) {
        modal.style.display = 'none';
        updateAuthUI();
        renderPosts();
    } else {
        alert(result.message);
    }
});

document.getElementById('doRegisterBtn')?.addEventListener('click', async () => {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;
    
    if (!username || !password) {
        alert('请填写完整信息');
        return;
    }
    
    if (password !== confirm) {
        alert('两次输入的密码不一致');
        return;
    }
    
    if (password.length < 6) {
        alert('密码长度至少6位');
        return;
    }
    
    const result = await register(username, password);
    if (result.success) {
        alert('注册成功！已自动登录');
        modal.style.display = 'none';
        updateAuthUI();
        renderPosts();
    } else {
        alert(result.message);
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    logout();
});

// 发布动态
document.getElementById('publishBtn')?.addEventListener('click', async () => {
    const user = getCurrentUser();
    if (!user) {
        alert('请先登录');
        return;
    }
    
    const content = document.getElementById('postContent').value.trim();
    const imageFile = document.getElementById('postImage').files[0];
    
    if (!content && !imageFile) {
        alert('请填写内容或添加图片');
        return;
    }
    
    let imageBase64 = null;
    if (imageFile) {
        imageBase64 = await imageToBase64(imageFile);
    }
    
    const result = await publishPost(content, imageBase64);
    if (result.success) {
        document.getElementById('postContent').value = '';
        document.getElementById('postImage').value = '';
        document.getElementById('imagePreview').innerHTML = '';
        renderPosts();
    } else {
        alert(result.message);
    }
});

// 图片预览
document.getElementById('postImage')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('imagePreview').innerHTML = `<img src="${event.target.result}" alt="preview">`;
        };
        reader.readAsDataURL(file);
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await restoreSession();
    await renderPosts();
});

// 导航菜单点击
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        if (link.id === 'nav-social') {
            // 已在当前页
        } else if (link.id === 'nav-home') {
            alert('首页正在建设中，当前在运动社区');
        } else if (link.id === 'nav-profile') {
            const user = getCurrentUser();
            if (user) {
                alert(`欢迎 ${user.username}！个人中心功能即将上线`);
            } else {
                alert('请先登录');
            }
        }
    });
});
