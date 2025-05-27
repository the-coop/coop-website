export class WebSocketManager {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.playerId = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    // Callbacks
    this.onPlayerJoin = null;
    this.onPlayerLeave = null;
    this.onPlayerUpdate = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onError = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Connecting to WebSocket server: ${this.url}`);
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          
          // Server should send player ID on connection
          if (this.onConnected) {
            this.onConnected();
          }
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (this.onError) {
            this.onError(error);
          }
          reject(error);
        };
        
        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.connected = false;
          
          if (this.onDisconnected) {
            this.onDisconnected();
          }
          
          // Attempt reconnection
          this.attemptReconnect();
        };
        
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  handleMessage(data) {
    switch (data.type) {
      case 'player_id':
        this.playerId = data.id;
        console.log('Received player ID:', this.playerId);
        break;
        
      case 'player_joined':
        if (this.onPlayerJoin && data.player_id !== this.playerId) {
          this.onPlayerJoin(data.player_id, data.position);
        }
        break;
        
      case 'player_left':
        if (this.onPlayerLeave && data.player_id !== this.playerId) {
          this.onPlayerLeave(data.player_id);
        }
        break;
        
      case 'player_state':
        if (this.onPlayerUpdate && data.player_id !== this.playerId) {
          this.onPlayerUpdate(data.player_id, {
            position: data.position,
            rotation: data.rotation,
            velocity: data.velocity
          });
        }
        break;
        
      case 'players_list':
        // Handle initial list of connected players
        if (data.players) {
          data.players.forEach(player => {
            if (player.id !== this.playerId && this.onPlayerJoin) {
              this.onPlayerJoin(player.id, player.position);
            }
          });
        }
        break;
        
      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  sendPlayerState(position, rotation, velocity) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const message = {
      type: 'player_update',
      position: {
        x: position.x,
        y: position.y,
        z: position.z
      },
      rotation: {
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
        w: rotation.w
      },
      velocity: {
        x: velocity.x,
        y: velocity.y,
        z: velocity.z
      }
    };
    
    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send player state:', error);
    }
  }

  sendPlayerAction(action, data = {}) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const message = {
      type: 'player_action',
      action: action,
      ...data
    };
    
    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send player action:', error);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.playerId = null;
  }
}