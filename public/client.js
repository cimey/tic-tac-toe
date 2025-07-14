const socket = io();
let room = '';
let roomId = '';

let myTurn = false;
let gameOver = false;
let turnElement = document.getElementById('turn');
let resetGameButton = document.getElementById('reset-game-btn');
let users = {};

let yourChar = '';
let opponentChar = '';

let gameStarted = false;

let gameState = ['', '', '', '', '', '', '', '', ''];

let username = '';

socket.on('connect', () => {
    console.log("Connected to server with ID:", socket.id);
    socket.emit('userConnected', username);
});

socket.on('userDisconnected', username => {
    console.log("User disconnected:", username);
});

socket.on('playerLeft', socketId => {

    console.log('userLeft', socketId);
    // socket.emit('updateWinner', { roomId, winner: socket.id === socketId ? yourChar : opponentChar });
});

socket.on('roomStatus', room => {
    updateRoomStatus(room);
});

socket.on('start', ({ turn }) => {
    myTurn = (socket.id === turn);
    gameOver = false;
    yourChar = myTurn ? 'O' : 'X';
    opponentChar = !myTurn ? 'O' : 'X';
    updateTurnDisplay();
});

socket.on('userList', userList => {
    console.log("Connected users:", userList);
    users = userList;
});

socket.on('roomUsers', roomUsers => {

    console.log("Room Users: ", roomUsers);
    let userListDiv = document.getElementById('userList');
    userListDiv.innerHTML = '';
    let label = document.createElement('label');
    label.innerText = "Users";
    userListDiv.appendChild(label);
    roomUsers.forEach((user, idx) => {

        let div = document.createElement('div');
        const isCurrUser = user.id === socket.id;
        div.classList.add('user-box');

        div.innerText = `User ${idx + 1}: ${user.name} ${isCurrUser ? ' (You)' : ''}`;
        if (isCurrUser) {
            div.classList.add('you');


            let leaveRoomBtn = document.createElement('button');

            leaveRoomBtn.innerText = 'Leave Room';
            leaveRoomBtn.onclick = () => leaveRoom();

            div.appendChild(leaveRoomBtn)
        }
        userListDiv.appendChild(div);
    });

    userListDiv.style.display = 'block';
});

socket.on('roomList', rooms => {
    console.log("Connected rooms:", rooms);
    const roomIds = Object.keys(rooms);

    if (!roomIds || roomIds.length === 0) {
        document.getElementById('roomDiv').style.display = 'none';
    }
    else {
        document.getElementById('roomDiv').style.display = 'block';
    }

    const roomListElement = document.getElementById('room-list');
    roomListElement.innerHTML = "";

    roomIds.forEach(key => {
        var liElement = document.createElement('li');
        liElement.innerText = rooms[key].name + " (" + rooms[key].players.length + " players)";
        liElement.setAttribute('data-room', key);

        let button = document.createElement('button');

        button.innerText = "Join";

        button.addEventListener('click', () => {
            joinRoom(rooms[key].name, key);
            console.log('roomId', key);
        });
        liElement.appendChild(button);

        roomListElement.appendChild(liElement);
    });
});

socket.on('update', ({ index, state }) => {

    document.querySelectorAll('#board td').forEach((cell, idx) => { cell.innerText = state[idx] });
    gameState = state;
    myTurn = true;
    updateTurnDisplay();
});

socket.on('gameOver', ({ winner }) => {
    gameOver = true;
    resetGameButton.style.display = 'block'; // show reset game btn
    if (winner == yourChar) {
        turnElement.innerText = "You win!";
        return;
    }
    if (winner == opponentChar) {
        turnElement.innerText = "Opponent wins!";
        return;
    }
    turnElement.innerText = "It's a draw!";
});

document.querySelectorAll('#board td').forEach(cell => {
    cell.addEventListener('click', () => {
        if (!myTurn || cell.innerText !== "" || gameOver) return;
        cell.innerText = yourChar;
        const index = cell.getAttribute('data-index');
        gameState[index] = yourChar;

        socket.emit('play', { roomId, index, gameState });
        myTurn = false;
        updateTurnDisplay();
    });
});

function updateTurnDisplay() {
    turnElement.innerText = myTurn ? "Your turn" : "Waiting for opponent's turn";
}
function register() {

    username = document.getElementById('username').value;
    if (!username || username.trim() === '') {
        return alert("Please enter a valid username");
    }
    sessionStorage.setItem("username", username);

    socket.emit('userConnected', username);

    document.getElementById('setup').style.display = 'none';

    document.getElementById('room-selection').style.display = 'block';

    document.getElementById('username-header').innerText = "Username: " + username;
    document.getElementById('username-header').style.display = 'block';
}

function joinRoom(roomName, id) {
    room = roomName;
    roomId = id;
    socket.emit('join', { room: roomName, uuid: id });
    showGameUI();
}

function leaveRoom() {
    socket.emit('userLeftRoom', { roomId, userId: socket.id });
    hideGameUI();
}

function showGameUI() {
    document.getElementById('room-selection').style.display = "none";
    document.getElementById('game').style.display = "block";
}

function hideGameUI() {
    document.getElementById('room-selection').style.display = "block";
    document.getElementById('game').style.display = "none";
    document.getElementById('userList').style.display = "none";
}

function createRoom() {
    let uuid = generateUUID();

    const roomName = document.getElementById('new-room').value;
    room = roomName;
    roomId = uuid;

    if (!roomName.trim()) return alert("Enter room name");
    socket.emit('createRoom', { room, uuid });

    showGameUI();
}

function resetBoard() {
    const cells = document.querySelectorAll('#board td');

    cells.forEach(cell => {
        cell.innerText = '';
    });

    gameOver = false;
    gameState = Array(9).fill('').map(x => x);
    socket.emit('restartGame', { roomId })
}
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
function updateRoomStatus(room) {

    const waitingDiv = document.getElementById('waitingDiv');
    if (room.players.length < 2) {

        waitingDiv.style.display = 'block';
    }
    else {
        waitingDiv.style.display = 'none';
    }

    const scoreDiv = document.getElementById("score");
    document.querySelectorAll('#board td').forEach((cell, idx) => { cell.innerText = room.state[idx] });
    gameState = room.state;

    scoreDiv.innerText = `Score: O: ${room.scores['O']} X: ${room.scores['X']}, Draw: ${room.scores['Draw']}`
    document.getElementById('status').innerText = room.status;
}
window.onload = () => {

    const savedName = sessionStorage.getItem("username");
    if (savedName) {
        username = savedName;
        document.getElementById("setup").style.display = "none";
        document.getElementById("room-selection").style.display = "block";
        document.getElementById('username-header').innerText = "Welcome " + username;
        document.getElementById('username-header').style.display = 'block';
    } else {
        document.getElementById("setup").style.display = "block";
    }
} 