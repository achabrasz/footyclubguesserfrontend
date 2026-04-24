import { useState, useEffect } from 'react'
import './App.css'

const API_URL = 'https://footytictactoebackend.onrender.com'

interface Player {
  id: string
  name: string
  club: string | null
  score: number
}

interface Room {
  id: string
  players: Player[]
  gameStarted: boolean
}

interface VerifyResult {
  player: string
  club1: string
  club2: string
  played: boolean
  clubs_found: string[]
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
    const fetchClubs = async () => {
      try {
        const res = await fetch(`${API_URL}/clubs`)
        const data = await res.json()
        setAvailableClubs(data.available_clubs)
      } catch (err) {
        console.error('Failed to fetch clubs:', err)
      }
    }
    fetchClubs()
  }, [])

  const createRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const newPlayer: Player = {
      id: Math.random().toString(),
      name: playerName,
      club: null,
      score: 0,
    }
    const newRoom: Room = {
      id: code,
      players: [newPlayer],
      gameStarted: false,
    }
    setCurrentRoom(newRoom)
    setCurrentPlayerId(newPlayer.id)
    setRoomCode(code)
    setView('room')
    setError('')
  }

  const joinRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code')
      return
    }
    if (!currentRoom) {
      setError('Room not found. Make sure the code is correct.')
      return
    }
    // Check if player name already exists
    if (currentRoom.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
      setError('This name is already taken in this room')
      return
    }
    const newPlayer: Player = {
      id: Math.random().toString(),
      name: playerName,
      club: null,
      score: 0,
    }
    setCurrentRoom({
      ...currentRoom,
      players: [...currentRoom.players, newPlayer],
    })
    setCurrentPlayerId(newPlayer.id)
    setView('room')
    setError('')
  }

  const selectClub = (club: string) => {
    if (!currentRoom) return
    const updatedRoom = {
      ...currentRoom,
      players: currentRoom.players.map((p) =>
        p.id === currentPlayerId ? { ...p, club } : p
      ),
    }
    setCurrentRoom(updatedRoom)
    setSelectedClub(club)
  }

  const startGame = () => {
    if (currentRoom?.players.some((p) => !p.club)) {
      setError('All players must select a club before starting')
      return
    }
    if (currentRoom?.players.length && currentRoom.players.length < 2) {
      setError('At least 2 players are required to start the game')
      return
    }
    if (currentRoom) {
      setCurrentRoom({ ...currentRoom, gameStarted: true })
      setCurrentRoundPlayer(currentRoom.players[0].id)
      setView('game')
      setError('')
    }
  }

  const verifyPlayer = async () => {
    if (!verifyPlayerName.trim()) {
      setError('Please enter a player name')
      return
    }

    const activePlayer = currentRoom?.players.find((p) => p.id === currentRoundPlayer)
    if (!activePlayer?.club) return

    setLoading(true)
    setError('')
    try {
      // Get another random club to verify against
      const otherClubs = availableClubs.filter((c) => c !== activePlayer.club)
      const randomClub = otherClubs[Math.floor(Math.random() * otherClubs.length)]

      const res = await fetch(
        `${API_URL}/verify?player=${encodeURIComponent(verifyPlayerName)}&club1=${encodeURIComponent(activePlayer.club)}&club2=${encodeURIComponent(randomClub)}`
      )
      const data = await res.json()
      setVerifyResult(data)

      if (data.played) {
        // Award points for each club matched
        const matchedClubs = data.clubs_found.filter(
          (club: string) =>
            club.toLowerCase().includes(activePlayer.club.toLowerCase()) ||
            club.toLowerCase().includes(randomClub.toLowerCase())
        ).length

        if (currentRoom) {
          const updatedRoom = {
            ...currentRoom,
            players: currentRoom.players.map((p) =>
              p.id === currentRoundPlayer ? { ...p, score: p.score + matchedClubs } : p
            ),
          }
          setCurrentRoom(updatedRoom)
        }
      }
    } catch (err) {
      console.error('Verification failed:', err)
      setError('Failed to verify player')
    } finally {
      setLoading(false)
    }
  }

  const nextRound = () => {
    if (!currentRoom) return
    const currentIndex = currentRoom.players.findIndex((p) => p.id === currentRoundPlayer)
    const nextIndex = (currentIndex + 1) % currentRoom.players.length
    setCurrentRoundPlayer(currentRoom.players[nextIndex].id)
    setVerifyPlayerName('')
    setVerifyResult(null)
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
          />
          <button onClick={createRoom} className="btn btn-primary">
            Create Room
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
          />
          <button onClick={joinRoom} className="btn btn-secondary">
            Join Room
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
          <h2>Your Name: {currentRoom?.players.find((p) => p.id === currentPlayerId)?.name}</h2>
          <p>Pick a club:</p>
          <div className="clubs-grid">
            {availableClubs.map((club) => (
              <button
                key={club}
                className={`club-btn ${selectedClub === club ? 'selected' : ''}`}
                onClick={() => selectClub(club)}
              >
                {club}
              </button>
            ))}
          </div>
        </div>

        <div className="players-list">
          <h3>Players in Room ({currentRoom?.players.length}):</h3>
          {currentRoom?.players.map((p) => (
            <div key={p.id} className="player-item">
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
          disabled={!currentRoom?.players.every((p) => p.club) || currentRoom?.players.length && currentRoom.players.length < 2}
        >
          Start Game
        </button>

        {error && <div className="error-message">{error}</div>}
      </div>
    )
  }

  if (view === 'game') {
    const activePlayer = currentRoom?.players.find((p) => p.id === currentRoundPlayer)
    const isMyTurn = activePlayer?.id === currentPlayerId
    const sortedPlayers = currentRoom?.players.toSorted((a, b) => b.score - a.score)

    return (
      <div className="container game-view">
        <div className="header">
          <h1>🎮 Game in Progress</h1>
          <div className="room-info">
            <span>Room: {roomCode}</span>
            <span>Your name: {currentRoom?.players.find((p) => p.id === currentPlayerId)?.name}</span>
          </div>
        </div>

        <div className="scoreboard">
          <h2>Scores</h2>
          <div className="scores-list">
            {sortedPlayers?.map((p) => (
              <div key={p.id} className={`score-item ${p.id === currentRoundPlayer ? 'active' : ''}`}>
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
              <div className={`result ${verifyResult.played ? 'success' : 'failure'}`}>
                <h3>{verifyResult.player}</h3>
                <p>
                  <strong>Played for {activePlayer?.club}:</strong> {verifyResult.played ? '✅ YES' : '❌ NO'}
                </p>
                <p className="clubs-found">
                  <strong>Clubs found:</strong> {verifyResult.clubs_found.join(', ') || 'None'}
                </p>
                {verifyResult.played && <p className="points-earned">+1 Point!</p>}
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {verifyResult && (
              <button onClick={nextRound} className="btn btn-secondary">
                Next Player's Turn
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
