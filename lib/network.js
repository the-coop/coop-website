export class WebSocketManager {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.playerId = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    // Add level loading state tracking
    this.levelDataReceived = false;
    this.levelDataPromise = null;
    this.levelDataResolve = null;
    
    // Callbacks
    this.onPlayerJoin = null;
    this.onPlayerLeave = null;
    this.onPlayerUpdate = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onError = null;
    this.onWelcome = null;
    this.onConnectionLost = null; // New callback for unexpected disconnection
    this.onOriginUpdate = null; // New callback for origin updates
    
    // Add dynamic object callbacks
    this.onDynamicObjectSpawn = null;
    this.onDynamicObjectUpdate = null;
    this.onDynamicObjectRemove = null;
    
    // Add level data callback
    this.onLevelData = null;
    
    // Add ownership callbacks
    this.onObjectOwnershipGranted = null;
    this.onObjectOwnershipRevoked = null;
    
    // Add platform update callback
    this.onPlatformUpdate = null;
    
    // Add vehicle callbacks
    this.onPlayerEnteredVehicle = null;
    this.onPlayerExitedVehicle = null;
    this.onVehicleUpdate = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Connecting to WebSocket server: ${this.url}`);
        this.ws = new WebSocket(this.url);
        
        // Reset level data state on new connection
        this.levelDataReceived = false;
        this.levelDataPromise = new Promise(resolve => {
          this.levelDataResolve = resolve;
        });
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          
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
          if (!this.connected) {
            reject(error);
          }
        };
        
        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected', event.code, event.reason);
          const wasConnected = this.connected;
          this.connected = false;
          this.playerId = null;
          
          if (this.onDisconnected) {
            this.onDisconnected();
          }
          
          // Handle unexpected disconnection
          if (wasConnected && this.onConnectionLost) {
            this.onConnectionLost();
          }
          
          // Only attempt reconnection if it wasn't a clean close
          if (event.code !== 1000 && event.code !== 1001) {
            this.attemptReconnect();
          }
        };
        
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  handleMessage(data) {
    console.log('Received message:', data.type, data);
    
    switch (data.type) {
      case 'welcome':
        this.playerId = data.player_id;
        console.log('Received player ID:', this.playerId);
        console.log('Spawn position:', data.spawn_position);
        if (this.onWelcome) {
          this.onWelcome(data.player_id, data.spawn_position);
        }
        break;
        
      case 'player_id':
        // Keep for backwards compatibility
        this.playerId = data.id;
        console.log('Received player ID:', this.playerId);
        break;
        
      case 'player_joined':
        console.log('Player joined:', data.player_id, data.position);
        if (this.onPlayerJoin && data.player_id !== this.playerId) {
          this.onPlayerJoin(data.player_id, data.position);
        }
        break;
        
      case 'player_left':
        console.log('Player left:', data.player_id);
        if (this.onPlayerLeave && data.player_id !== this.playerId) {
          this.onPlayerLeave(data.player_id);
        }
        break;
        
      case 'player_state':
        if (this.onPlayerUpdate) {
          this.onPlayerUpdate(data.player_id, {
            position: data.position,
            rotation: data.rotation,
            velocity: data.velocity,
            isGrounded: data.is_grounded,
            isSwimming: data.is_swimming || false
          });
        }
        break;
        
      case 'players_list':
        console.log('Received players list with', data.players?.length || 0, 'players');
        // Handle initial list of connected players
        if (data.players) {
          data.players.forEach(player => {
            console.log('Processing player from list:', player.id, player);
            if (player.id !== this.playerId && this.onPlayerJoin) {
              // Call onPlayerJoin with just id and position
              this.onPlayerJoin(player.id, player.position);
              // If rotation is provided, send an update
              if (player.rotation && this.onPlayerUpdate) {
                this.onPlayerUpdate(player.id, {
                  position: player.position,
                  rotation: player.rotation
                });
              }
            }
          });
        }
        break;
        
      case 'origin_update':
        console.log('Received origin update:', data.origin);
        if (this.onOriginUpdate) {
          this.onOriginUpdate(data.origin);
        }
        break;
        
      case 'player_entered_vehicle':
        console.log('Player entered vehicle:', data);
        if (this.onPlayerEnteredVehicle) {
          this.onPlayerEnteredVehicle(data.player_id, data.vehicle_id);
        }
        break;
        
      case 'player_exited_vehicle':
        console.log('Player exited vehicle:', data);
        if (this.onPlayerExitedVehicle) {
          this.onPlayerExitedVehicle(data.player_id, data.vehicle_id, data.exit_position);
        }
        break;
        
      case 'vehicle_update':
        if (this.onVehicleUpdate) {
          this.onVehicleUpdate(data.vehicle_id, {
            position: data.position,
            rotation: data.rotation,
            velocity: data.velocity,
            driver_id: data.driver_id
          });
        }
        break;
        
      case 'dynamic_object_spawn':
        console.log('Dynamic object spawned:', data.object_id, data);
        if (this.onDynamicObjectSpawn) {
          this.onDynamicObjectSpawn(data.object_id, {
            type: data.object_type,
            position: data.position,
            rotation: data.rotation,
            scale: data.scale,
            objectType: data.object_type // Pass the type for vehicle detection
          });
        }
        break;
        
      case 'dynamic_object_update':
        if (this.onDynamicObjectUpdate) {
          this.onDynamicObjectUpdate(data.object_id, {
            position: data.position,
            rotation: data.rotation,
            velocity: data.velocity
          });
        }
        break;
        
      case 'dynamic_object_remove':
        console.log('Dynamic object removed:', data.object_id);
        if (this.onDynamicObjectRemove) {
          this.onDynamicObjectRemove(data.object_id);
        }
        break;
        
      case 'dynamic_objects_list':
        console.log('Received dynamic objects list with', data.objects?.length || 0, 'objects');
        if (data.objects && this.onDynamicObjectSpawn) {
          data.objects.forEach(obj => {
            this.onDynamicObjectSpawn(obj.id, {
              type: obj.type,
              position: obj.position,
              rotation: obj.rotation,
              scale: obj.scale
            });
          });
        }
        break;
        
      case 'level_data':
        console.log('Received level data with', data.objects?.length || 0, 'objects');
        // Mark level data as received and resolve the promise
        this.levelDataReceived = true;
        if (this.levelDataResolve) {
          this.levelDataResolve(data.objects);
        }
        
        if (this.onLevelData) {
          this.onLevelData(data.objects);
        }
        break;
        
      case 'object_ownership_granted':
        console.log('Object ownership granted:', data);
        if (this.onObjectOwnershipGranted) {
          this.onObjectOwnershipGranted(data.object_id, data.player_id, data.duration_ms);
        }
        break;
        
      case 'object_ownership_revoked':
        console.log('Object ownership revoked:', data.object_id);
        if (this.onObjectOwnershipRevoked) {
          this.onObjectOwnershipRevoked(data.object_id);
        }
        break;
        
      case 'platform_update':
        if (this.onPlatformUpdate) {
          this.onPlatformUpdate(data.platform_id, data.position);
        }
        break;
        
      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  sendPlayerState(position, rotation, velocity, isGrounded = false, isSwimming = false) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Position should be relative to local origin
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
      },
      is_grounded: isGrounded,
      is_swimming: isSwimming,
      timestamp: performance.now() // Add client timestamp
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

  sendPushObject(objectId, force, contactPoint) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const message = {
      type: 'push_object',
      object_id: objectId,
      force: {
        x: force.x,
        y: force.y,
        z: force.z
      },
      point: {
        x: contactPoint.x,
        y: contactPoint.y,
        z: contactPoint.z
      }
    };
    
    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send push object:', error);
    }
  }

  sendVehicleControl(controls) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const message = {
      type: 'vehicle_control',
      ...controls
    };
    
    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send vehicle control:', error);
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
    console.log('Manually disconnecting WebSocket');
    
    // Prevent reconnection attempts
    this.reconnectAttempts = this.maxReconnectAttempts;
    
    if (this.ws) {
      // Send a clean close
      this.ws.close(1000, 'User requested disconnect');
      this.ws = null;
    }
    
    this.connected = false;
    this.playerId = null;
  }
  
  // Add a new method to wait for level data
  waitForLevelData(timeoutMs = 10000) {
    if (this.levelDataReceived) {
      return Promise.resolve();
    }
    
    // Return the promise with a timeout
    return Promise.race([
      this.levelDataPromise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout waiting for level data')), timeoutMs);
      })
    ]);
  }
}