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
  }

  connect(wsUrl) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Connecting to WebSocket server at:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        this.connectionStatus = 'connecting...';
        
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
          
          // Try to reconnect after 3 seconds
          setTimeout(() => this.connect(wsUrl), 3000);
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
        console.log('Initialized as player:', this.playerId);
        if (this.onInit) {
          this.onInit(message);
        }
        break;
        
      case 'state':
        if (this.onStateUpdate) {
          this.onStateUpdate(message);
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
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
