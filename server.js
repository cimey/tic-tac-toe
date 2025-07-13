// import {Game, Room} from './public/models.js'

const { create } = require('domain');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let rooms = {};
let users = {};
let roms = [];

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
        if (roomId) io.to(roomId).emit('userList', users);

        for (let room in rooms) {
            rooms[room].players = rooms[room].players.filter(id => id !== socket.id);
            if (rooms[room].players.length === 0) {
                delete rooms[room];
            }
        }
    });

    socket.on('join', ({ uuid, room }) => {
        createRoom(room, uuid);
    });

    socket.on('play', ({ roomId, index, gameState }) => {
        socket.to(roomId).emit('update', { index: index, state: Array.from(gameState) });

        //check winner for X and O
        if (checkWinner('O', gameState)) {
            io.to(roomId).emit('gameOver', { winner: 'O' });
        }
        else if (checkWinner('X', gameState)) {
            io.to(roomId).emit('gameOver', { winner: 'X' });
        }
        else if (checkDraw(gameState)) {
            io.to(roomId).emit('gameOver', { winner: '' });
        }
        gameState = Array(9).map(x => '');
        console.log(`Player ${socket.id} played in room ${roomId} at index ${index} gameState ${gameState}`);

        io.emit('roomList', rooms);
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

    socket.on('restart', () => { })

    socket.on('userLeftRoom', ({ roomId, userId }) => {

        if (!rooms[roomId]) return;

        let idx = rooms[roomId].players.indexOf(userId);
        rooms[roomId].players.splice(idx, 1);
        socket.leave(roomId);

        io.to(roomId).emit('roomUsers', rooms[roomId].players.map(x => ({ name: users[x], id: x })))
        io.emit('roomList', rooms);
    });

    socket.on('gameOver', (uuid, winner) => {
        rooms[uuid].status = 'gameOver';
        rooms[uuid].scores[winner]++;
    });


    function createRoom(room, uuid) {

        console.log("room: ", room, "uuid: ", uuid);
        if (!rooms[uuid]) {
            rooms[uuid] = { name: room, players: [], status: 'NotStarted' };
            // roms.push(new Room(uuid,[],'',[]));
        }

        if (!rooms[uuid].players.find(x => x === socket.id)) {
            rooms[uuid].players.push(socket.id);
            // roms[uuid].players.push(socket.id);
        }
        socket.join(uuid);

        io.to(uuid).emit('roomUsers', rooms[uuid].players.map(x => ({ name: users[x], id: x })));

        if (rooms[uuid].players.length === 2) {
            rooms[uuid].status = 'playing';
            io.to(uuid).emit('start', { turn: rooms[uuid].players[0] });
        }
    }
});

function checkWinner(symbol, gameState) {

    const winnerPatterns = [[0, 1, 2], [3, 4, 5], [6, 7, 8,], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

    //0 1 2  //3 4 5  //6 7 8
    // const cells = document.querySelectorAll('#board td');

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
