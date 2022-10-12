
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const PORT = 3000;
const { Server } = require('socket.io');
const io = new Server(http);
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const randRange = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
let room = new Set();
let tmp = new Set();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static("./publicfile"));
app.set('view engine', 'ejs');
http.listen(PORT);
app.get("/", (_, res) => {
  res.sendFile(__dirname + "/main.html")
})
app.get("/solo", async (_, res) => {
  res.sendFile(__dirname + "/solo.html")
});
app.get('/game', (_, res) => {
  res.render(__dirname + '/join.ejs', { content: "ルームIDを入力" });
});
app.post('/game', (req, res) => {
  if (!room.has(req.body.roomid)) return res.render(__dirname + '/join.ejs', { content: `Roomid:${req.body.roomid}は見つかりません。` });
  res.redirect(`/wait?roomid=${req.body.roomid}`);
});
app.get('/roomcreate', (_, res) => {
  const rand = randRange(10000, 99999);
  res.cookie('roomid', rand);
  room.add(String(rand));
  res.redirect(`/wait`);
});
app.get("/wait", async (req, res) => {
  const roomid = req.query?.roomid || req.cookies?.roomid;
  if (!room.has(roomid)) return res.render(__dirname + "/err.ejs", { content: "ルームIDが一致しません<br>すでに開始されている可能性があります" });
  if (!roomid) return res.render(__dirname + "/err.ejs", { content: "ルームIDが見つかりません<br>初めからやり直してください" });
  if (io.sockets.adapter.rooms.get(roomid)?.size == 1) room.delete(roomid);
  tmp.add(roomid);
  res.render(__dirname + "/index.ejs", { content: (req.query?.roomid) ? "相手が回答中" : `貴方のルームID:${roomid}<br>プレイヤーが接続するまでお待ちください` });
});


io.on('connection', socket => {
  if(![...socket.rooms.values()][1]){
    socket.join([...tmp.values()][0]);
  tmp.delete([...tmp.values()][0]);
  }
  const rooms = [...socket.rooms.values()];
  socket.on('disconnect', _ => {
    room.delete(rooms[1])
    io.in(rooms[1]).socketsLeave(rooms[1]);
  });
  socket.to(rooms[1]).emit('chat message', {msg:"connect"});
  socket.on('chat message', msg => {
    if (msg.msg == "back") return io.in(msg.id).socketsLeave(msg.id);
    socket.to(msg.id).emit('chat message', {msg:msg.msg,sp:msg.sp});
  });
});