const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const USERS_FILE = path.join(__dirname, 'users.json');
const POSTS_FILE = path.join(__dirname, 'posts.json');

function loadData(file, defaultData) {
    if (fs.existsSync(file)) {
        try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return defaultData; }
    }
    return defaultData;
}
function saveData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

let users = loadData(USERS_FILE, { "admin": "1234" });
let posts = loadData(POSTS_FILE, []);

app.post('/api/signup', (req, res) => {
    const { id, pw } = req.body;
    if (!id || !pw) return res.json({ success: false, msg: "빈 칸을 채워주세요!" });
    if (users[id]) return res.json({ success: false, msg: "이미 있는 아이디예요!" });
    users[id] = pw;
    saveData(USERS_FILE, users);
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { id, pw } = req.body;
    if (users[id] && users[id] === pw) {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.get('/api/posts', (req, res) => { res.json(posts); });
app.post('/api/posts', (req, res) => {
    const { author, title, code } = req.body;
    posts.unshift({ id: Date.now(), author, title, code });
    saveData(POSTS_FILE, posts);
    res.json({ success: true });
});

app.delete('/api/posts/:id', (req, res) => {
    const postId = Number(req.params.id);
    posts = posts.filter(p => p.id !== postId);
    saveData(POSTS_FILE, posts);
    res.json({ success: true });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => { console.log("서버 준비 완료!"); });