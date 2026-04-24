import { useState, useEffect } from 'react'
import './App.css'

const API_URL = 'https://footytictactoebackend.onrender.com'
//const API_URL = 'http://localhost:5005'

interface Player {
  playerId: string
  name: string
  club: string | null
  score: number
  joinedAt?: string
}

interface Room {
  roomCode: string
  creatorId: string
  creatorName: string
  gameStarted: boolean
  createdAt: string
  currentTurnPlayerId: string | null
  players: Player[]
}

interface VerifyResult {
  verified: boolean
  playerFound: boolean
  clubsFound: string[]
  pointsEarned: number
  updatedScore: number
  allPlayersScores: { [key: string]: number }
}

function App() {
  const [view, setView] = useState<'home' | 'room' | 'game'>('home')
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState('')
  const [availableClubs, setAvailableClubs] = useState<string[]>([])
  const [selectedClub, setSelectedClub] = useState<string>('')
  const [currentRoundPlayer, setCurrentRoundPlayer] = useState<string>('')
  const [verifyPlayerName, setVerifyPlayerName] = useState('')
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fetch available clubs on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Call the /start endpoint
        await fetch(`${API_URL}/start`)
      } catch (err) {
        console.error('Failed to initialize app:', err)
      }

      // Fetch available clubs
      try {
        const res = await fetch(`${API_URL}/clubs`)
        const data = await res.json()
        setAvailableClubs(data.available_clubs)
      } catch (err) {
        console.error('Failed to fetch clubs:', err)
      }
    }

    initializeApp()
  }, [])

  const createRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorName: playerName }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create room')
        return
      }

      setCurrentPlayerId(data.playerId)
      setRoomCode(data.roomCode)

      // Fetch the full room data
      const roomRes = await fetch(`${API_URL}/rooms/${data.roomCode}`)
      const roomData = await roomRes.json()
      setCurrentRoom(roomData)
      setView('room')
    } catch (err) {
      console.error('Failed to create room:', err)
      setError('Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  const joinRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/rooms/${roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to join room')
        return
      }

      setCurrentPlayerId(data.playerId)

      // Fetch the full room data
      const roomRes = await fetch(`${API_URL}/rooms/${roomCode}`)
      const roomData = await roomRes.json()
      setCurrentRoom(roomData)
      setView('room')
    } catch (err) {
      console.error('Failed to join room:', err)
      setError('Failed to join room')
    } finally {
      setLoading(false)
    }
  }

  const selectClub = async (club: string) => {
    if (!currentRoom) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/rooms/${currentRoom.roomCode}/select-club`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: currentPlayerId, club }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to select club')
        return
      }

      setSelectedClub(club)

      // Update room with new players data
      setCurrentRoom({
        ...currentRoom,
        players: data.updatedPlayers,
      })
    } catch (err) {
      console.error('Failed to select club:', err)
      setError('Failed to select club')
    } finally {
      setLoading(false)
    }
  }

  const startGame = async () => {
    if (currentRoom?.players.some((p) => !p.club)) {
      setError('All players must select a club before starting')
      return
    }
    if (currentRoom && currentRoom.players.length < 2) {
      setError('At least 2 players are required to start the game')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/rooms/${currentRoom?.roomCode}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: currentPlayerId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to start game')
        return
      }

      // Fetch updated room
      const roomRes = await fetch(`${API_URL}/rooms/${currentRoom?.roomCode}`)
      const roomData = await roomRes.json()
      setCurrentRoom(roomData)
      setCurrentRoundPlayer(data.firstPlayerId)
      setView('game')
    } catch (err) {
      console.error('Failed to start game:', err)
      setError('Failed to start game')
    } finally {
      setLoading(false)
    }
  }

  const verifyPlayer = async () => {
    if (!verifyPlayerName.trim()) {
      setError('Please enter a player name')
      return
    }

    const activePlayer = currentRoom?.players.find((p) => p.playerId === currentRoundPlayer)
    if (!activePlayer?.club) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/rooms/${currentRoom?.roomCode}/verify-guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: currentPlayerId,
          playerName: verifyPlayerName,
          clubName: activePlayer.club,
        }),
      })
      const data = await res.json()
      setVerifyResult(data)

      if (!res.ok) {
        setError(data.error || 'Failed to verify player')
        return
      }

      // Update room scores
      if (currentRoom) {
        setCurrentRoom({
          ...currentRoom,
          players: currentRoom.players.map((p) =>
            p.playerId === currentPlayerId ? { ...p, score: data.updatedScore } : p
          ),
        })
      }
    } catch (err) {
      console.error('Verification failed:', err)
      setError('Failed to verify player')
    } finally {
      setLoading(false)
    }
  }

  const nextRound = async () => {
    if (!currentRoom) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/rooms/${currentRoom.roomCode}/next-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPlayerId: currentRoundPlayer }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to advance turn')
        return
      }

      setCurrentRoundPlayer(data.nextPlayerId)
      setVerifyPlayerName('')
      setVerifyResult(null)

      // Update scores in room
      setCurrentRoom({
        ...currentRoom,
        players: currentRoom.players.map((p) => ({
          ...p,
          score: data.allScores[p.playerId] || p.score,
        })),
      })
    } catch (err) {
      console.error('Failed to advance turn:', err)
      setError('Failed to advance turn')
    } finally {
      setLoading(false)
    }
  }

  if (view === 'home') {
    return (
      <div className="container home-view">
        <div className="header">
          <h1>⚽ Football Club Guesser</h1>
          <p>Guess which clubs your favourite players have played for!</p>
        </div>

        <div className="form-group">
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createRoom()}
            className="input"
            disabled={loading}
          />
          <button onClick={createRoom} className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </div>

        <div className="divider">OR</div>

        <div className="form-group">
          <input
            type="text"
            placeholder="Enter room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            className="input"
            disabled={loading}
          />
          <button onClick={joinRoom} className="btn btn-secondary" disabled={loading}>
            {loading ? 'Joining...' : 'Join Room'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>
    )
  }

  if (view === 'room') {
    return (
      <div className="container room-view">
        <div className="header">
          <h1>Room: {roomCode}</h1>
          <p>Select your club to continue</p>
        </div>

        <div className="player-section">
          <h2>Your Name: {currentRoom?.players.find((p) => p.playerId === currentPlayerId)?.name}</h2>
          <p>Pick a club:</p>
          <select
            value={selectedClub}
            onChange={(e) => selectClub(e.target.value)}
            className="club-select"
            disabled={loading}
          >
            <option value="">-- Select a club --</option>
            {availableClubs.map((club) => (
              <option key={club} value={club}>
                {club}
              </option>
            ))}
          </select>
        </div>

        <div className="players-list">
          <h3>Players in Room ({currentRoom?.players.length}):</h3>
          {currentRoom?.players.map((p) => (
            <div key={p.playerId} className="player-item">
              <span className="player-name">{p.name}</span>
              <span className={`club-badge ${p.club ? 'selected' : 'empty'}`}>
                {p.club || 'No club selected'}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={startGame}
          className="btn btn-primary start-btn"
          disabled={!currentRoom?.players.every((p) => p.club) || (currentRoom?.players.length || 0) < 2 || loading}
        >
          {loading ? 'Starting...' : 'Start Game'}
        </button>

        {error && <div className="error-message">{error}</div>}
      </div>
    )
  }

  if (view === 'game') {
    const activePlayer = currentRoom?.players.find((p) => p.playerId === currentRoundPlayer)
    const isMyTurn = activePlayer?.playerId === currentPlayerId
    const sortedPlayers = currentRoom?.players.toSorted((a, b) => b.score - a.score)

    return (
      <div className="container game-view">
        <div className="header">
          <h1>🎮 Game in Progress</h1>
          <div className="room-info">
            <span>Room: {roomCode}</span>
            <span>Your name: {currentRoom?.players.find((p) => p.playerId === currentPlayerId)?.name}</span>
          </div>
        </div>

        <div className="scoreboard">
          <h2>Scores</h2>
          <div className="scores-list">
            {sortedPlayers?.map((p) => (
              <div key={p.playerId} className={`score-item ${p.playerId === currentRoundPlayer ? 'active' : ''}`}>
                <span className="player-name">{p.name}</span>
                <span className="club-info">{p.club}</span>
                <span className="score">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>

        {isMyTurn ? (
          <div className="game-section">
            <div className="turn-indicator">
              <h2>🎯 Your Turn, {activePlayer?.name}!</h2>
              <p>Enter a player name to check if they played for your club</p>
            </div>

            <div className="form-group">
              <input
                type="text"
                placeholder="Enter football player name"
                value={verifyPlayerName}
                onChange={(e) => setVerifyPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && verifyPlayer()}
                className="input"
                disabled={loading}
              />
              <button
                onClick={verifyPlayer}
                className="btn btn-primary"
                disabled={loading || !verifyPlayerName.trim()}
              >
                {loading ? 'Checking...' : 'Check Player'}
              </button>
            </div>

            {verifyResult && (
              <div className={`result ${verifyResult.verified ? 'success' : 'failure'}`}>
                <h3>{verifyPlayerName}</h3>
                <p>
                  <strong>Played for {activePlayer?.club}:</strong> {verifyResult.verified ? '✅ YES' : '❌ NO'}
                </p>
                <p className="clubs-found">
                  <strong>Clubs found:</strong> {verifyResult.clubsFound.join(', ') || 'None'}
                </p>
                {verifyResult.verified && (
                  <p className="points-earned">+{verifyResult.pointsEarned} Points!</p>
                )}
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {verifyResult && (
              <button onClick={nextRound} className="btn btn-secondary" disabled={loading}>
                {loading ? 'Loading...' : "Next Player's Turn"}
              </button>
            )}
          </div>
        ) : (
          <div className="game-section waiting">
            <h2>⏳ Waiting for {activePlayer?.name}...</h2>
            <p>They are currently checking a player.</p>
            <div className="current-turn-club">
              <span className="label">Active Player's Club:</span>
              <span className="club">{activePlayer?.club}</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}

export default App
