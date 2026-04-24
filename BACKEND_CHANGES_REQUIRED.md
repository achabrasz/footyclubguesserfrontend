# Backend Changes Required for Frontend Features

## Overview
The frontend now supports session persistence, WebSockets for real-time updates, and room hiding options. The backend needs to be updated to support these features.

## Required Changes

### 1. Add `hideClubs` Field to Room Model

**File: `app.py`**

Update the `Room` model to store the `hideClubs` setting:

```python
class Room(db.Model):
    __tablename__ = 'rooms'
    id = db.Column(db.Integer, primary_key=True)
    room_code = db.Column(db.String(8), unique=True, nullable=False, index=True)
    creator_id = db.Column(db.String(50), nullable=False)
    creator_name = db.Column(db.String(100), nullable=False)
    game_started = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    current_turn_player_id = db.Column(db.String(50), nullable=True)
    hide_clubs = db.Column(db.Boolean, default=False)  # ADD THIS LINE
    
    # ...existing code...

    def to_dict(self):
        return {
            'roomCode': self.room_code,
            'creatorId': self.creator_id,
            'creatorName': self.creator_name,
            'gameStarted': self.game_started,
            'createdAt': self.created_at.isoformat(),
            'currentTurnPlayerId': self.current_turn_player_id,
            'hideClubs': self.hide_clubs,  # ADD THIS LINE
            'players': [p.to_dict() for p in self.players]
        }
```

### 2. Update `/rooms` POST Endpoint

**File: `app.py`**

Update the room creation endpoint to accept and store `hideClubs`:

```python
@app.route('/rooms', methods=['POST'])
def create_room():
    """Create a new room"""
    data = request.get_json()
    creator_name = data.get('creatorName')
    hide_clubs = data.get('hideClubs', False)  # ADD THIS LINE
    
    if not creator_name:
        return jsonify({"error": "Missing creatorName"}), 400
    
    try:
        player_id = generate_player_id()
        room_code = generate_room_code()
        
        room = Room(
            room_code=room_code,
            creator_id=player_id,
            creator_name=creator_name,
            hide_clubs=hide_clubs  # ADD THIS LINE
        )
        
        # ...existing code...
```

### 3. Add WebSocket Support for Real-Time Updates

Install Flask-SocketIO:

```bash
pip install flask-socketio python-socketio python-engineio
```

**Add to `app.py`:**

```python
from flask_socketio import SocketIO, emit, join_room, leave_room

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# ...existing code...

# ============== WEBSOCKET EVENTS ==============

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    print(f'Client connected: {request.sid}')

@socketio.on('join_room')
def on_join_room(data):
    """Join a room's WebSocket broadcast"""
    room_code = data.get('roomCode')
    if room_code:
        join_room(room_code)
        print(f'Client {request.sid} joined room {room_code}')

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    print(f'Client disconnected: {request.sid}')

def broadcast_room_update(room_code):
    """Broadcast room update to all players"""
    room = Room.query.filter_by(room_code=room_code).first()
    if room:
        socketio.emit('room-update', {
            'type': 'room-update',
            'room': room.to_dict()
        }, room=room_code)

def broadcast_turn_change(room_code, next_player_id):
    """Broadcast turn change to all players"""
    socketio.emit('turn-changed', {
        'type': 'turn-changed',
        'nextPlayerId': next_player_id
    }, room=room_code)
```

### 4. Update Endpoints to Trigger WebSocket Events

After each state-changing operation, call the broadcast functions:

**Update `/rooms/<room_code>/select-club`:**

```python
@app.route('/rooms/<room_code>/select-club', methods=['POST'])
def select_club(room_code):
    """Update player's selected club"""
    # ...existing code...
    
    try:
        player = Player.query.filter_by(player_id=player_id, room_id=room.id).first()
        if not player:
            return jsonify({"error": "Player not found in room"}), 404
        
        player.club = club
        db.session.commit()
        
        # ADD THESE LINES
        broadcast_room_update(room_code)
        
        return jsonify({
            "success": True,
            "updatedPlayers": [p.to_dict() for p in room.players]
        }), 200
    
    # ...existing code...
```

**Update `/rooms/<room_code>/next-turn`:**

```python
@app.route('/rooms/<room_code>/next-turn', methods=['POST'])
def next_turn(room_code):
    """Move to next player's turn"""
    # ...existing code...
    
    try:
        # ...existing code...
        
        room.current_turn_player_id = next_player.player_id
        db.session.commit()
        
        # ADD THESE LINES
        broadcast_room_update(room_code)
        broadcast_turn_change(room_code, next_player.player_id)
        
        all_scores = {p.player_id: p.score for p in room.players}
        
        return jsonify({
            "nextPlayerId": next_player.player_id,
            "allScores": all_scores
        }), 200
    
    # ...existing code...
```

**Update `/rooms/<room_code>/verify-guess`:**

```python
@app.route('/rooms/<room_code>/verify-guess', methods=['POST'])
def verify_guess(room_code):
    """Submit a player guess"""
    # ...existing code...
    
    try:
        # ...existing code for verification...
        
        # Record in game history
        history_entry = GameHistory(
            room_id=room.id,
            player_id=player_id,
            player_name=player.name,
            guessed_player=player_name,
            club=club_name,
            verified=verified,
            points_earned=points_earned
        )
        
        db.session.add(history_entry)
        db.session.commit()
        
        # ADD THESE LINES
        broadcast_room_update(room_code)
        
        # ...existing return statement...
```

### 5. Add WebSocket Subscription Endpoint

Add this endpoint for frontend WebSocket connections:

```python
@app.route('/rooms/<room_code>/subscribe')
def subscribe_to_room(room_code):
    """WebSocket subscription endpoint for a room"""
    room = Room.query.filter_by(room_code=room_code).first()
    if not room:
        return jsonify({"error": "Room not found"}), 404
    
    # This endpoint handles WebSocket upgrades
    # Clients should connect to: wss://domain.com/rooms/{roomCode}/subscribe
    return jsonify({"status": "connected"}), 200
```

### 6. Update Main Runner

**Update the `if __name__ == "__main__"` block:**

```python
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    
    # Use socketio.run instead of app.run
    socketio.run(app, host='0.0.0.0', port=5005, debug=True)
```

## Migration Steps

1. **Backup your database** - If you have existing data
2. **Update `app.py`** with all changes above
3. **Install dependencies:**
   ```bash
   pip install flask-socketio python-socketio python-engineio
   ```
4. **Restart the backend server**
5. **Database will auto-migrate** - SQLAlchemy will create the new `hide_clubs` column

## Testing

1. **Create a room with `hideClubs: true`** - Club selections should not be visible to others
2. **Create a room with `hideClubs: false`** - Club selections should be visible
3. **Open the game in multiple browser tabs** - Changes should sync in real-time via WebSocket
4. **Refresh the page** - Frontend should restore session from localStorage

## Environment Variables (Optional)

If deploying to production, ensure these environment variables are set:

```bash
DATABASE_URL=postgresql://user:password@host/database  # Production DB
FLASK_ENV=production
```

## Troubleshooting

### WebSocket Connection Fails
- Ensure the backend is running with `socketio.run()`
- Check CORS settings in SocketIO initialization
- Verify WSS (WebSocket Secure) URLs in production

### Hide Clubs Not Working
- Verify `hideClubs` field is being saved in the Room table
- Check that room update broadcasts include the `hideClubs` field
- Clear browser cache/localStorage

### Session Persistence Issues
- Verify localStorage is enabled in the browser
- Check that room data is being fetched correctly
- Ensure WebSocket reconnection is working

## Summary of Changes

| Component | Change | Purpose |
|-----------|--------|---------|
| `Room` model | Add `hide_clubs` field | Store room privacy setting |
| `/rooms` POST | Accept `hideClubs` param | Allow room creation with privacy setting |
| WebSocket events | Add broadcast functions | Real-time player updates |
| All state endpoints | Add broadcast calls | Trigger WebSocket updates |
| Main runner | Use `socketio.run()` | Enable WebSocket support |


