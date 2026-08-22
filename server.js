const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 데이터 영구 저장을 위한 파일 경로 설정
const USERS_FILE = path.join(__dirname, 'users.json');
const POSTS_FILE = path.join(__dirname, 'posts.json');

// 파일에서 데이터 불러오기 함수
function loadData(file, defaultData) {
    if (fs.existsSync(file)) {
        try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return defaultData; }
    }
    return defaultData;
}

// 파일에 데이터 저장하기 함수
function saveData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

let users = loadData(USERS_FILE, { "admin": "1234" });
let posts = loadData(POSTS_FILE, []);

app.post('/api/signup', (req, res) => {
    const { id, pw } = req.body;
    if (!id || !pw) return res.json({ success: false, msg: "입력 오류" });
    if (users[id]) return res.json({ success: false, msg: "이미 존재하는 아이디" });
    users[id] = pw;
    saveData(USERS_FILE, users);
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { id, pw } = req.body;
    if (users[id] && users[id] === pw) {
        res.json({ success: true, isAdmin: id.toLowerCase() === 'admin' });
    } else {
        res.json({ success: false, msg: "로그인 실패" });
    }
});

app.post('/api/password', (req, res) => {
    const { id, currentPw, newPw } = req.body;
    if (users[id] === currentPw) {
        users[id] = newPw;
        saveData(USERS_FILE, users);
        res.json({ success: true });
    } else {
        res.json({ success: false, msg: "현재 비밀번호 불일치" });
    }
});

app.get('/api/users', (req, res) => {
    res.json(users);
});

app.delete('/api/users/:id', (req, res) => {
    const targetId = req.params.id;
    if (targetId.toLowerCase() !== 'admin') {
        delete users[targetId];
        posts = posts.filter(p => p.author !== targetId);
        saveData(USERS_FILE, users);
        saveData(POSTS_FILE, posts);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.get('/api/posts', (req, res) => {
    res.json(posts);
});

app.post('/api/posts', (req, res) => {
    const { author, title, code } = req.body;
    posts.unshift({ id: Date.now(), author, title, code });
    saveData(POSTS_FILE, posts);
    res.json({ success: true });
});

app.delete('/api/posts/:id', (req, res) => {
    const postId = Number(req.params.id);
    const { user, isAdmin } = req.body;
    posts = posts.filter(p => {
        if (isAdmin) return p.id !== postId;
        return p.id !== postId || p.author !== user;
    });
    saveData(POSTS_FILE, posts);
    res.json({ success: true });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`서버 실행 중: 포트 ${PORT}`);
});