import { NETWORK_CONFIG } from './players';

export class NetworkManager {
  constructor() {
    this.ws = null;
    this.connectionStatus = 'disconnected';
    this.playerId = null;
    this.ping = 0;
    this.onStateUpdate = null;
    this.onPlayerLeft = null;
    this.onInit = null;
    this.pingInterval = null;
    this.reconnectTimeout = null;
    this.isIntentionalDisconnect = false;
    this.initialized = false; // Add this flag
  }

  connect(wsUrl) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Connecting to WebSocket server at:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        this.connectionStatus = 'connecting...';
        this.isIntentionalDisconnect = false;
        
        this.ws.onopen = () => {
          console.log('Connected to server');
          this.connectionStatus = 'connected';
          
          // Start ping interval
          this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            }
          }, 1000);
          
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.error('Error parsing server message:', e);
          }
        };
        
        this.ws.onclose = () => {
          this.connectionStatus = 'disconnected';
          console.log('Disconnected from server');
          
          if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
          }
          
          // Only try to reconnect if it wasn't an intentional disconnect
          if (!this.isIntentionalDisconnect) {
            console.log('Will attempt to reconnect in 3 seconds...');
            this.reconnectTimeout = setTimeout(() => {
              if (!this.isIntentionalDisconnect) {
                this.connect(wsUrl);
              }
            }, 3000);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.connectionStatus = 'error';
          reject(error);
        };
      } catch (e) {
        console.error('Error connecting to server:', e);
        reject(e);
      }
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'init':
        this.playerId = message.playerId;
        this.initialized = true; // Set initialized flag
        console.log('NetworkManager: Set player ID to:', this.playerId);
        console.log('Init message contains', Object.keys(message.state || {}).length, 'other players');
        if (this.onInit) {
          this.onInit(message);
        }
        break;
        
      case 'state':
        // Only process state updates after initialization
        if (this.initialized && this.onStateUpdate) {
          this.onStateUpdate(message);
        } else if (!this.initialized) {
          console.log('Ignoring state update - not initialized yet');
        }
        break;
        
      case 'playerLeft':
        if (this.onPlayerLeft) {
          this.onPlayerLeft(message.playerId);
        }
        break;
        
      case 'pong':
        this.ping = Date.now() - message.timestamp;
        break;
    }
  }

  sendInput(input, sequence) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    
    this.ws.send(JSON.stringify({
      type: 'input',
      input,
      sequence
    }));
    
    return true;
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    console.log('Disconnected intentionally');
  }
}
