import { MessageTypes } from '@game/shared'
import { Scene } from './scene.js'
import { Entities } from './entities.js'
import { Vehicles } from './vehicles.js'
import { Ghosts } from './ghosts.js'
import { Input } from './input.js'
import { Control } from './control.js'
import { State } from './state.js'

export class Network {
  static ws = null
  static lastInputSent = {}

  static connect() {
    // Use standard NODE_ENV check
    const dev = process.env.NODE_ENV === 'development'
    const wsUrl = dev ? 'ws://localhost:8080' : 'ws://thecoop.herokuapp.com'
    
    this.ws = new WebSocket(wsUrl)
    
    this.ws.onopen = () => {
      console.log('Connected to server')
      State.connected = true
    }
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      this.handleMessage(message)
    }
    
    this.ws.onclose = () => {
      console.log('Disconnected from server')
      State.connected = false
    }
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  static handleMessage(message) {
    switch (message.type) {
      case MessageTypes.INIT:
        State.playerId = message.playerId
        if (message.level) {
          Scene.createLevel(message.level)
        }
        this.send({ type: MessageTypes.JOIN })
        break
        
      case MessageTypes.GAME_STATE:
        this.updateGameState(message.state)
        break
        
      case MessageTypes.PLAYER_JOINED:
        Entities.addPlayer(message.player)
        break
        
      case MessageTypes.PLAYER_LEFT:
        Entities.removePlayer(message.playerId)
        break
        
      case MessageTypes.PROJECTILE_SPAWN:
        Entities.addProjectile(message.projectile)
        break
        
      case MessageTypes.PROJECTILE_REMOVE:
        Entities.removeProjectile(message.projectileId)
        break
        
      case MessageTypes.HIT:
        this.handleHit(message)
        break
      
      case MessageTypes.VEHICLE_UPDATE:
        Vehicles.updateVehicle(message.vehicle)
        break
      
      case MessageTypes.GHOST_UPDATE:
        Ghosts.updateGhost(message.ghost)
        break
    }
  }

  static updateGameState(state) {
    // Update player count
    State.playerCount = state.players.length
    
    // Update players
    for (const playerData of state.players) {
      if (!Entities.players.has(playerData.id)) {
        Entities.addPlayer(playerData)
      } else {
        Entities.updatePlayer(playerData)
      }
      
      // Update own player data
      if (playerData.id === State.playerId) {
        State.playerHealth = playerData.health
        State.carryingGhost = playerData.carryingGhost
      }
    }
    
    // Remove players that are no longer in state
    for (const [id] of Entities.players) {
      if (!state.players.find(p => p.id === id)) {
        Entities.removePlayer(id)
      }
    }
    
    // Update projectiles
    for (const projectileData of state.projectiles) {
      if (!Entities.projectileMeshes.has(projectileData.id)) {
        Entities.addProjectile(projectileData)
      } else {
        Entities.updateProjectile(projectileData)
      }
    }
    
    // Remove projectiles that are no longer in state
    for (const [id] of Entities.projectileMeshes) {
      if (!state.projectiles.find(p => p.id === id)) {
        Entities.removeProjectile(id)
      }
    }
    
    // Update vehicles
    for (const vehicleData of state.vehicles) {
      Vehicles.updateVehicle(vehicleData)
    }
    
    // Update ghosts
    for (const ghostData of state.ghosts) {
      Ghosts.updateGhost(ghostData)
    }
    
    // Check interactions
    Control.checkNearbyVehicles()
    Control.checkNearbyGhosts()
  }

  static handleHit(hitData) {
    if (hitData.target === State.playerId) {
      // Flash red effect
      const overlay = document.createElement('div')
      overlay.style.position = 'fixed'
      overlay.style.top = '0'
      overlay.style.left = '0'
      overlay.style.width = '100%'
      overlay.style.height = '100%'
      overlay.style.backgroundColor = 'red'
      overlay.style.opacity = '0.3'
      overlay.style.pointerEvents = 'none'
      overlay.style.zIndex = '1000'
      document.body.appendChild(overlay)
      
      setTimeout(() => {
        document.body.removeChild(overlay)
      }, 200)
    }
  }

  static sendInput() {
    const input = Input.getInput()
    
    // Add look direction if not in vehicle
    if (!State.currentVehicle) {
      input.lookDirection = Control.getLookDirection()
    }
    
    // Always send input when there's movement or look changes
    const hasMovement = input.moveForward || input.moveBackward || input.moveLeft || input.moveRight || input.jump || input.shift || input.descend
    const lookChanged = JSON.stringify(input.lookDirection) !== JSON.stringify(this.lastInputSent.lookDirection)
    
    if (hasMovement || lookChanged || JSON.stringify(input) !== JSON.stringify(this.lastInputSent)) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: MessageTypes.INPUT,
          input: input
        })
      }
      this.lastInputSent = { ...input }
    }
  }

  static send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  static disconnect() {
    if (this.ws) {
      this.ws.close()
    }
  }
}
