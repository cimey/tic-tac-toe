// import {Game, Room} from './public/models.js'

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const statuses = {
    GameOver: 'GameOver',
    WaitingForOpponent: 'WaitingForOpponent',
    Playing: 'Playing',
    OpponentLeft: 'OpponentLeft'
}
let rooms = {};
let users = {};

io.on('connection', socket => {

    socket.emit('roomList', rooms);

    socket.on('userConnected', (username) => {
        console.log("username", username);
        if (!username || username.trim() === '') {
            username = `User${socket.id.substring(0, 5)}`;
        }

        if (!users[socket.id]) users[socket.id] = '';
        users[socket.id] = username;

        io.emit('userList', users);
        socket.emit('roomList', rooms);
    });

    socket.on('disconnect', () => {
        io.emit('userDisconnected', users[socket.id]);
        delete users[socket.id];

        for (let room in rooms) {

            if (rooms[room].players.indexOf(socket.id) <= -1) return;

            rooms[room].players = rooms[room].players.filter(id => id !== socket.id);

            io.to(room).emit('userList', users);
            io.to(room).emit('playerLeft', socket.id);

            if (rooms[room].players.length === 0) {

                console.log('room deleted', room)
                delete rooms[room];

                io.emit('roomList', rooms);
            }
        }
    });

    socket.on('join', ({ uuid, room }) => {
        createRoom(room, uuid);
    });

    socket.on('play', ({ roomId, index, gameState }) => {
        socket.to(roomId).emit('update', { index: index, state: Array.from(gameState) });
        
        rooms[roomId].state = gameState;
        
        //check winner for X and O
        if (checkWinner('O', gameState)) {
            rooms[roomId].status = statuses.GameOver;
            rooms[roomId].scores['O']++;
            io.to(roomId).emit('gameOver', { winner: 'O' });
        }
        else if (checkWinner('X', gameState)) {
            rooms[roomId].status = statuses.GameOver;
            rooms[roomId].scores['X']++;
            io.to(roomId).emit('gameOver', { winner: 'X' });
        }
        else if (checkDraw(gameState)) {
            rooms[roomId].status = statuses.GameOver;
            rooms[roomId].scores['Draw']++;
            io.to(roomId).emit('gameOver', { winner: '' });
        }
        console.log(`Player ${socket.id} played in room ${roomId} at index ${index} gameState ${gameState}`);

        io.emit('roomList', rooms);
        io.to(roomId).emit('roomStatus', rooms[roomId]);
    });

    socket.on('createRoom', ({ room, uuid }) => {

        if (rooms[uuid]) {
            socket.emit('roomCreateError', 'Error: Room already exists');
            return;
        }

        createRoom(room, uuid);
        console.log(`Room created: ${room}`);
        io.emit('roomList', rooms);
    });

    socket.on('userLeftRoom', ({ roomId, userId }) => {

        if (!rooms[roomId]) return;
        const room = rooms[roomId];

        let idx = room.players.indexOf(userId);
        room.players.splice(idx, 1);

        if (room.players.length === 0) {

            console.log('room deleted', room)
            delete rooms[room];
        }

        socket.leave(roomId);
        room.status = statuses.OpponentLeft;

        io.to(roomId).emit('roomUsers', room.players.map(x => ({ name: users[x], id: x })));

        io.to(roomId).emit('roomStatus', room);

        io.to(roomId).emit('playerLeft', socket.id);

        io.emit('roomList', rooms);
    });

    socket.on('updateWinner', ({ roomId, winner }) => {
        console.log('roomid', roomId);
        console.log('rooms[roomid]', rooms[roomId])
        rooms[roomId].status = statuses.GameOver;
        if (winner === '') winner = 'Draw';
        rooms[roomId].scores[winner]++;
    });

    socket.on('restartGame', ({ roomId }) => {

        const room = rooms[roomId];
        room.state = Array(9).fill('').map(x => x);

        io.to(roomId).emit('start', { turn: rooms[roomId].players[0] });
        io.to(roomId).emit('roomStatus', rooms[roomId]);
    })

    function createRoom(room, roomId) {

        console.log("room: ", room, "uuid: ", roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = { name: room, players: [], status: 'WaitingForOpponent', scores: { X: 0, O: 0, Draw: 0 }, state: Array(9).fill('').map(x => x) };
        }

        if (!rooms[roomId].players.find(x => x === socket.id)) {
            rooms[roomId].players.push(socket.id);
        }

        // bind connection to room so emit room will send to the binded connections only
        socket.join(roomId);

        io.to(roomId).emit('roomUsers', rooms[roomId].players.map(x => ({ name: users[x], id: x })));

        if (rooms[roomId].players.length === 2 && rooms[roomId].status !== statuses.Playing) {
            rooms[roomId].status = statuses.Playing;
            io.to(roomId).emit('start', { turn: rooms[roomId].players[0] });
        }

        io.to(roomId).emit('roomStatus', rooms[roomId]);
    }
});

function checkWinner(symbol, gameState) {

    const winnerPatterns = [[0, 1, 2], [3, 4, 5], [6, 7, 8,], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

    //0 1 2  //3 4 5  //6 7 8
    return winnerPatterns.some(pattern => {
        return pattern.every(index => gameState[index] === symbol)
    });
}

function checkDraw(gameState) {

    const result = gameState.every(cell => cell !== "");
    console.log("check draw", result);
    return result;
}

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on ${port}`));
