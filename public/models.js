export class Room{
    constructor(id, players, state, games){
        this.id = id;
        this.players = players;
        this.state = state;
        this.games = games;
    }
} 

export class Game {
    constructor(id, status, winner){
        this.id = id;
        this.status = status;
        this.winner = winner;
    }
}