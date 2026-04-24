# Additional Backend Endpoints for Production

The current backend provides basic functionality for the game. For a production-ready multiplayer experience with persistent rooms and real-time updates, consider adding these endpoints:

## Room Management

### `POST /rooms`
**Create a new room**
- Request body: `{ "creatorName": string }`
- Response: `{ "roomId": string, "roomCode": string, "createdAt": timestamp }`
- Purpose: Store rooms on the server instead of in client state for persistence

### `GET /rooms/:roomCode`
**Get room details**
- Response: `{ "roomCode": string, "players": Player[], "gameStarted": boolean, "createdAt": timestamp }`
- Purpose: Fetch room state when users reconnect or join

### `POST /rooms/:roomCode/join`
**Join an existing room**
- Request body: `{ "playerName": string }`
- Response: `{ "playerId": string, "roomCode": string, "players": Player[] }`
- Purpose: Add a new player to the room and validate name uniqueness server-side

### `POST /rooms/:roomCode/select-club`
**Update player's selected club**
- Request body: `{ "playerId": string, "club": string }`
- Response: `{ "success": boolean, "updatedPlayers": Player[] }`
- Purpose: Persist club selections on the server

### `POST /rooms/:roomCode/start`
**Start the game**
- Request body: `{ "playerId": string }`
- Response: `{ "success": boolean, "firstPlayerId": string }`
- Purpose: Validate all players have selected clubs and begin the game

## Game State

### `POST /rooms/:roomCode/verify-guess`
**Submit a player guess (improved)**
- Request body: `{ "playerId": string, "playerName": string, "clubName": string }`
- Response: 
```json
{
  "verified": boolean,
  "playerFound": boolean,
  "clubsFound": string[],
  "pointsEarned": number,
  "updatedScore": number,
  "allPlayersScores": { "playerId": number }
}
```
- Purpose: Handle guess verification, points calculation, and broadcast results

### `POST /rooms/:roomCode/next-turn`
**Move to next player's turn**
- Request body: `{ "currentPlayerId": string }`
- Response: `{ "nextPlayerId": string, "allScores": { "playerId": number } }`
- Purpose: Manage turn rotation and prevent simultaneous guesses

### `GET /rooms/:roomCode/leaderboard`
**Get current leaderboard**
- Response: `{ "players": [{ "playerId": string, "name": string, "club": string, "score": number, "rank": number }] }`
- Purpose: Display live standings

## WebSocket Events (for real-time multiplayer)

For live multiplayer without polling, implement WebSocket support:

- `room-joined` - Notify all players when someone joins
- `club-selected` - Broadcast when a player selects their club
- `game-started` - Notify when game begins
- `turn-changed` - Alert players when it's someone's turn
- `guess-result` - Broadcast verification results to all players
- `score-updated` - Push updated leaderboard to all clients
- `room-closed` - Notify when room ends or creator leaves

## Data Management

### `DELETE /rooms/:roomCode`
**Close/delete a room**
- Request body: `{ "playerId": string }`
- Response: `{ "success": boolean }`
- Purpose: Clean up inactive rooms and free server resources

### `GET /rooms/:roomCode/game-history`
**Get past guesses in the current game**
- Response: 
```json
{
  "history": [
    {
      "playerId": string,
      "playerName": string,
      "guessedPlayer": string,
      "club": string,
      "verified": boolean,
      "pointsEarned": number,
      "timestamp": timestamp
    }
  ]
}
```
- Purpose: Display game history and show which players have been guessed

## Implementation Notes

1. **Client-side fallback**: The current frontend can work with or without these endpoints. It maintains local state for single-device testing.

2. **Database**: Store rooms and game history in a database (PostgreSQL, MongoDB, etc.) to enable:
   - Persistent rooms that survive server restarts
   - Historical analytics
   - Player statistics tracking

3. **Authentication**: Add optional user accounts to:
   - Track lifetime statistics
   - Save favorite clubs
   - Join password-protected rooms

4. **Rate limiting**: Implement rate limiting on `/verify` endpoint to prevent API abuse of TheSportsDB

5. **Caching**: Cache player lookup results to reduce API calls to TheSportsDB

6. **Performance**: Consider implementing pagination for the clubs list if new clubs are added frequently

## Current Limitations Without These Endpoints

- Rooms exist only on the client device
- No persistence if the browser refreshes
- Multiple devices/windows cannot sync game state
- No way to rejoin a game after disconnection
- No game history or statistics

