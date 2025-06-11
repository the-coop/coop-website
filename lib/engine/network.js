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
    
    // Add callbacks for weapons and vehicles
    this.onWeaponFire = null;
    this.onProjectileHit = null;
    this.onExplosion = null;
    this.onVehicleSpawn = null;
    this.onVehicleUpdate = null;
    this.onVehicleDestroy = null;
    this.onPlayerEnteredVehicle = null;
    this.onPlayerExitedVehicle = null;
    this.onVehiclePlayerState = null;
    
    // Add countermeasure callback
    this.onCountermeasureDeploy = null;
    
    // Add lock-on callback
    this.onLockOnUpdate = null;
    
    // Add weapon pickup callbacks
    this.onWeaponPickupSpawned = null;
    this.onWeaponPickedUp = null;
    this.onWeaponPickupRespawned = null;
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
            const message = JSON.parse(event.data);
            
            switch (message.type) {
              case 'welcome':
                this.playerId = message.player_id;
                console.log('Received player ID:', this.playerId);
                console.log('Spawn position:', message.spawn_position);
                if (this.onWelcome) {
                  this.onWelcome(message.player_id, message.spawn_position);
                }
                break;
                
              case 'player_id':
                // Keep for backwards compatibility
                this.playerId = message.id;
                console.log('Received player ID:', this.playerId);
                break;
                
              case 'player_joined':
                console.log('Player joined:', message.player_id, message.position);
                if (this.onPlayerJoin && message.player_id !== this.playerId) {
                  this.onPlayerJoin(message.player_id, message.position);
                }
                break;
                
              case 'player_left':
                console.log('Player left:', message.player_id);
                if (this.onPlayerLeave && message.player_id !== this.playerId) {
                  this.onPlayerLeave(message.player_id);
                }
                break;
                
              case 'player_state':
                if (this.onPlayerUpdate) {
                  this.onPlayerUpdate(message.player_id, {
                    position: message.position,
                    rotation: message.rotation,
                    velocity: message.velocity,
                    isGrounded: message.is_grounded,
                    isSwimming: message.is_swimming || false
                  });
                }
                break;
                
              case 'players_list':
                console.log('Received players list with', message.players?.length || 0, 'players');
                // Handle initial list of connected players
                if (message.players) {
                  message.players.forEach(player => {
                    console.log('Processing player from list:', player.id, player);
                    if (player.id !== this.playerId && this.onPlayerJoin) {
                      // First create the player with position
                      this.onPlayerJoin(player.id, player.position);
                      
                      // Then immediately send a full state update to initialize properly
                      if (this.onPlayerUpdate) {
                        // Ensure we have all required fields for proper initialization
                        const fullState = {
                          position: player.position,
                          rotation: player.rotation || { x: 0, y: 0, z: 0, w: 1 },
                          velocity: player.velocity || { x: 0, y: 0, z: 0 },
                          isGrounded: player.is_grounded !== undefined ? player.is_grounded : true,
                          isSwimming: player.is_swimming !== undefined ? player.is_swimming : false
                        };
                        
                        this.onPlayerUpdate(player.id, fullState);
                      }
                    }
                  });
                }
                break;
                
              case 'origin_update':
                console.log('Received origin update:', message.origin);
                if (this.onOriginUpdate) {
                  this.onOriginUpdate(message.origin);
                }
                break;
                
              case 'player_entered_vehicle':
                console.log('Player entered vehicle:', message);
                if (this.onPlayerEnteredVehicle) {
                  this.onPlayerEnteredVehicle(message.player_id, message.vehicle_id);
                }
                break;
                
              case 'player_exited_vehicle':
                console.log('Player exited vehicle:', message);
                if (this.onPlayerExitedVehicle) {
                  this.onPlayerExitedVehicle(message.player_id, message.vehicle_id, message.exit_position);
                }
                break;
                
              case 'vehicle_update':
                if (this.onVehicleUpdate) {
                  this.onVehicleUpdate(message.vehicle_id, {
                    position: message.position,
                    rotation: message.rotation,
                    velocity: message.velocity,
                    driver_id: message.driver_id
                  });
                }
                break;
                
              case 'dynamic_object_spawn':
                console.log('Dynamic object spawned:', message.object_id, message);
                if (this.onDynamicObjectSpawn) {
                  this.onDynamicObjectSpawn(message.object_id, {
                    type: message.object_type,
                    position: message.position,
                    rotation: message.rotation,
                    scale: message.scale,
                    objectType: message.object_type // Pass the type for vehicle detection
                  });
                }
                break;
                
              case 'dynamic_object_update':
                if (this.onDynamicObjectUpdate) {
                  this.onDynamicObjectUpdate(message.object_id, {
                    position: message.position,
                    rotation: message.rotation,
                    velocity: message.velocity,
                    timestamp: performance.now() // Add timestamp for interpolation
                  });
                }
                break;
                
              case 'dynamic_object_remove':
                console.log('Dynamic object removed:', message.object_id);
                if (this.onDynamicObjectRemove) {
                  this.onDynamicObjectRemove(message.object_id);
                }
                break;
                
              case 'dynamic_objects_list':
                console.log('Received dynamic objects list with', message.objects?.length || 0, 'objects');
                if (message.objects && this.onDynamicObjectSpawn) {
                  message.objects.forEach(obj => {
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
                console.log('Received level data with', message.objects?.length || 0, 'objects');
                // Mark level data as received and resolve the promise
                this.levelDataReceived = true;
                if (this.levelDataResolve) {
                  this.levelDataResolve(message.objects);
                }
                
                if (this.onLevelData) {
                  this.onLevelData(message.objects);
                }
                break;
                
              case 'object_ownership_granted':
                console.log('Object ownership granted:', message);
                if (this.onObjectOwnershipGranted) {
                  this.onObjectOwnershipGranted(message.object_id, message.player_id, message.duration_ms);
                }
                break;
                
              case 'object_ownership_revoked':
                console.log('Object ownership revoked:', message.object_id);
                if (this.onObjectOwnershipRevoked) {
                  this.onObjectOwnershipRevoked(message.object_id);
                }
                break;
                
              case 'platform_update':
                if (this.onPlatformUpdate) {
                  this.onPlatformUpdate(message.platform_id, message.position);
                }
                break;
                
              case 'weapon_fire':
                if (this.onWeaponFire) {
                  this.onWeaponFire(message.player_id, message.weapon_type, message.origin, message.direction);
                }
                break;
                
              case 'projectile_hit':
                if (this.onProjectileHit) {
                  this.onProjectileHit(message.projectile_id, message.hit_position, message.hit_type, message.hit_entity_id);
                }
                break;
                
              case 'explosion':
                if (this.onExplosion) {
                  this.onExplosion(message.position, message.radius, message.damage, message.type);
                }
                break;
                
              case 'vehicle_spawn':
                if (this.onVehicleSpawn) {
                  this.onVehicleSpawn(message.vehicle_id, message.vehicle_type, message.position, message.rotation);
                }
                break;
                
              case 'vehicle_update':
                if (this.onVehicleUpdate) {
                  this.onVehicleUpdate(message.vehicle_id, message.state);
                }
                break;
                
              case 'vehicle_destroy':
                if (this.onVehicleDestroy) {
                  this.onVehicleDestroy(message.vehicle_id);
                }
                break;
                
              case 'player_entered_vehicle':
                if (this.onPlayerEnteredVehicle) {
                  this.onPlayerEnteredVehicle(message.player_id, message.vehicle_id);
                }
                break;
                
              case 'player_exited_vehicle':
                if (this.onPlayerExitedVehicle) {
                  this.onPlayerExitedVehicle(message.player_id, message.vehicle_id, message.exit_position);
                }
                break;
                
              case 'vehicle_player_state':
                if (this.onVehiclePlayerState) {
                  this.onVehiclePlayerState(message.player_id, message.vehicle_id, message.relative_position, 
                    message.relative_rotation, message.aim_rotation, message.is_grounded);
                }
                break;
                
              case 'lock_on_update':
                this.handleLockOnUpdate(message);
                break;
                
              case 'countermeasure_deploy':
                if (this.onCountermeasureDeploy) {
                  this.onCountermeasureDeploy(
                    message.player_id,
                    message.vehicle_id,
                    message.countermeasure_type,
                    message.position,
                    message.velocity
                  );
                }
                break;
                
              case 'player_health':
                this.handlePlayerHealth(message);
                break;
                
              case 'player_damaged':
                this.handlePlayerDamaged(message);
                break;
                
              case 'player_killed':
                this.handlePlayerKilled(message);
                break;
                
              case 'player_respawned':
                this.handlePlayerRespawned(message);
                break;
                
              case 'weapon_fired':
                this.handleWeaponFired(message);
                break;
                
              case 'item_spawned':
                this.handleItemSpawned(message);
                break;
                
              case 'item_picked_up':
                this.handleItemPickedUp(message);
                break;
                
              case 'vehicle_spawned':
                this.handleVehicleSpawned(message);
                break;
                
              case 'object_grabbed':
                if (this.onObjectGrabbed) {
                  this.onObjectGrabbed(message.object_id, message.player_id, message.grab_offset);
                }
                break;
                
              case 'object_moved':
                if (this.onObjectMoved) {
                  this.onObjectMoved(message.object_id, message.position, message.rotation);
                }
                break;
                
              case 'object_thrown':
                if (this.onObjectThrown) {
                  this.onObjectThrown(message.object_id, message.player_id, message.position, message.velocity, message.angular_velocity);
                }
                break;
                
              case 'object_released':
                if (this.onObjectReleased) {
                  this.onObjectReleased(message.object_id, message.player_id, message.position, message.velocity);
                }
                break;
                
              case 'grab_failed':
                if (this.onGrabFailed) {
                  this.onGrabFailed(message.object_id, message.reason);
                }
                break;
                
              case 'weapon_pickup_spawned':
                if (this.onWeaponPickupSpawned) {
                  this.onWeaponPickupSpawned(message.pickup_id, message.weapon_type, message.position);
                }
                break;
                
              case 'weapon_picked_up':
                if (this.onWeaponPickedUp) {
                  this.onWeaponPickedUp(message.pickup_id, message.player_id, message.weapon_type);
                }
                break;
                
              case 'weapon_pickup_respawned':
                if (this.onWeaponPickupRespawned) {
                  this.onWeaponPickupRespawned(message.pickup_id);
                }
                break;
                
              default:
                console.warn('Unknown message type:', message.type);
            }
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
    switch(data.type) {
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
              // First create the player with position
              this.onPlayerJoin(player.id, player.position);
              
              // Then immediately send a full state update to initialize properly
              if (this.onPlayerUpdate) {
                // Ensure we have all required fields for proper initialization
                const fullState = {
                  position: player.position,
                  rotation: player.rotation || { x: 0, y: 0, z: 0, w: 1 },
                  velocity: player.velocity || { x: 0, y: 0, z: 0 },
                  isGrounded: player.is_grounded !== undefined ? player.is_grounded : true,
                  isSwimming: player.is_swimming !== undefined ? player.is_swimming : false
                };
                
                this.onPlayerUpdate(player.id, fullState);
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
            velocity: data.velocity,
            timestamp: performance.now() // Add timestamp for interpolation
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
        
      case 'weapon_fire':
        if (this.onWeaponFire) {
          this.onWeaponFire(data.player_id, data.weapon_type, data.origin, data.direction);
        }
        break;
        
      case 'projectile_hit':
        if (this.onProjectileHit) {
          this.onProjectileHit(data.projectile_id, data.hit_position, data.hit_type, data.hit_entity_id);
        }
        break;
        
      case 'explosion':
        if (this.onExplosion) {
          this.onExplosion(data.position, data.radius, data.damage, data.type);
        }
        break;
        
      case 'vehicle_spawn':
        if (this.onVehicleSpawn) {
          this.onVehicleSpawn(data.vehicle_id, data.vehicle_type, data.position, data.rotation);
        }
        break;
        
      case 'vehicle_update':
        if (this.onVehicleUpdate) {
          this.onVehicleUpdate(data.vehicle_id, data.state);
        }
        break;
        
      case 'vehicle_destroy':
        if (this.onVehicleDestroy) {
          this.onVehicleDestroy(data.vehicle_id);
        }
        break;
        
      case 'player_entered_vehicle':
        if (this.onPlayerEnteredVehicle) {
          this.onPlayerEnteredVehicle(data.player_id, data.vehicle_id);
        }
        break;
        
      case 'player_exited_vehicle':
        if (this.onPlayerExitedVehicle) {
          this.onPlayerExitedVehicle(data.player_id, data.vehicle_id, data.exit_position);
        }
        break;
        
      case 'vehicle_player_state':
        if (this.onVehiclePlayerState) {
          this.onVehiclePlayerState(data.player_id, data.vehicle_id, data.relative_position, 
            data.relative_rotation, data.aim_rotation, data.is_grounded);
        }
        break;
        
      case 'lock_on_update':
        this.handleLockOnUpdate(data);
        break;
        
      case 'countermeasure_deploy':
        if (this.onCountermeasureDeploy) {
          this.onCountermeasureDeploy(
            data.player_id,
            data.vehicle_id,
            data.countermeasure_type,
            data.position,
            data.velocity
          );
        }
        break;
        
      case 'player_health':
        this.handlePlayerHealth(data);
        break;
        
      case 'player_damaged':
        this.handlePlayerDamaged(data);
        break;
        
      case 'player_killed':
        this.handlePlayerKilled(data);
        break;
        
      case 'player_respawned':
        this.handlePlayerRespawned(data);
        break;
        
      case 'weapon_fired':
        this.handleWeaponFired(data);
        break;
        
      case 'item_spawned':
        this.handleItemSpawned(data);
        break;
        
      case 'item_picked_up':
        this.handleItemPickedUp(data);
        break;
        
      case 'vehicle_spawned':
        this.handleVehicleSpawned(data);
        break;
        
      case 'object_grabbed':
        if (this.onObjectGrabbed) {
          this.onObjectGrabbed(data.object_id, data.player_id, data.grab_offset);
        }
        break;
        
      case 'object_moved':
        if (this.onObjectMoved) {
          this.onObjectMoved(data.object_id, data.position, data.rotation);
        }
        break;
        
      case 'object_thrown':
        if (this.onObjectThrown) {
          this.onObjectThrown(data.object_id, data.player_id, data.position, data.velocity, data.angular_velocity);
        }
        break;
        
      case 'object_released':
        if (this.onObjectReleased) {
          this.onObjectReleased(data.object_id, data.player_id, data.position, data.velocity);
        }
        break;
        
      case 'grab_failed':
        if (this.onGrabFailed) {
          this.onGrabFailed(data.object_id, data.reason);
        }
        break;
        
      case 'weapon_pickup_spawned':
        if (this.onWeaponPickupSpawned) {
          this.onWeaponPickupSpawned(data.pickup_id, data.weapon_type, data.position);
        }
        break;
        
      case 'weapon_picked_up':
        if (this.onWeaponPickedUp) {
          this.onWeaponPickedUp(data.pickup_id, data.player_id, data.weapon_type);
        }
        break;
        
      case 'weapon_pickup_respawned':
        if (this.onWeaponPickupRespawned) {
          this.onWeaponPickupRespawned(data.pickup_id);
        }
        break;
        
      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  handleLockOnUpdate(data) {
    if (!data.player_id || !data.lockData) return;
    
    // Don't process our own lock-on updates
    if (data.player_id === this.playerId) return;
    
    // Pass to callback if registered
    if (this.onLockOnUpdate) {
      this.onLockOnUpdate(data.player_id, data.lockData);
    }
  }

  send(message) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
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

  sendWeaponFire(weaponType, origin, direction) {
    if (!this.connected) return;
    
    this.send({
      type: 'weapon_fire',
      weapon_type: weaponType,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z }
    });
  }
  
  sendProjectileHit(projectileId, hitPosition, hitType, hitEntityId = null) {
    if (!this.connected) return;
    
    this.send({
      type: 'projectile_hit',
      projectile_id: projectileId,
      hit_position: { x: hitPosition.x, y: hitPosition.y, z: hitPosition.z },
      hit_type: hitType, // 'player', 'vehicle', 'terrain', 'object'
      hit_entity_id: hitEntityId
    });
  }
  
  sendExplosion(position, radius, damage, type) {
    if (!this.connected) return;
    
    this.send({
      type: 'explosion',
      position: { x: position.x, y: position.y, z: position.z },
      radius: radius,
      damage: damage,
      type: type // 'grenade', 'rocket', 'vehicle', etc.
    });
  }
  
  // Vehicle-related messages
  sendVehicleSpawn(vehicleType, position, rotation) {
    if (!this.connected) return;
    
    this.send({
      type: 'vehicle_spawn',
      vehicle_type: vehicleType,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }
    });
  }
  
  sendVehicleUpdate(vehicleId, state) {
    if (!this.connected) return;
    
    this.send({
      type: 'vehicle_update',
      vehicle_id: vehicleId,
      state: state
    });
  }
  
  sendVehicleDestroy(vehicleId) {
    if (!this.connected) return;
    
    this.send({
      type: 'vehicle_destroy',
      vehicle_id: vehicleId
    });
  }
  
  sendEnterVehicle(vehicleId) {
    if (!this.connected) return;
    
    this.send({
      type: 'enter_vehicle',
      vehicle_id: vehicleId
    });
  }
  
  sendExitVehicle(exitPosition = null) {
    if (!this.connected) return;
    
    const msg = { type: 'exit_vehicle' };
    if (exitPosition) {
      msg.exit_position = { x: exitPosition.x, y: exitPosition.y, z: exitPosition.z };
    }
    
    this.send(msg);
  }
  
  sendVehicleControl(controls) {
    if (!this.connected) return;
    
    this.send({
      type: 'vehicle_control',
      forward: controls.forward || false,
      backward: controls.backward || false,
      left: controls.left || false,
      right: controls.right || false,
      brake: controls.brake || false
    });
  }
  
  sendVehiclePlayerUpdate(relativePosition, relativeRotation, aimRotation, isGrounded) {
    if (!this.connected) return;
    
    this.send({
      type: 'vehicle_player_update',
      relative_position: { x: relativePosition.x, y: relativePosition.y, z: relativePosition.z },
      relative_rotation: { x: relativeRotation.x, y: relativeRotation.y, z: relativeRotation.z, w: relativeRotation.w },
      aim_rotation: { x: aimRotation.x, y: aimRotation.y, z: aimRotation.z, w: aimRotation.w },
      is_grounded: isGrounded
    });
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
  
  handlePlayerHealth(data) {
    if (data.player_id === this.playerId) {
      // Update local player health
      if (this.scene.player) {
        this.scene.player.health = data.health;
        this.scene.player.armor = data.armor;
        
        // Update HUD
        if (this.scene.HUD) {
          this.scene.HUD.updateHealth(data.health, data.armor);
        }
      }
    }
  }
  
  handlePlayerDamaged(data) {
    const player = this.scene.players.get(data.player_id);
    if (player) {
      player.health = data.health;
      player.armor = data.armor;
      
      // Show damage indicator
      if (data.player_id === this.playerId && this.scene.HUD) {
        this.scene.HUD.showDamageIndicator(data.damage, data.attacker_id);
      }
      
      // Play hit sound
      if (this.scene.audioSystem) {
        this.scene.audioSystem.playHitSound(player.mesh.position);
      }
    }
  }
  
  handlePlayerKilled(data) {
    if (data.player_id === this.playerId) {
      // Local player died
      if (this.scene.player) {
        this.scene.player.isDead = true;
        this.scene.player.mesh.visible = false;
        
        // Show death screen
        if (this.scene.HUD) {
          this.scene.HUD.showDeathScreen(data.killer_id, data.weapon_type);
        }
      }
    } else {
      // Other player died
      const player = this.scene.players.get(data.player_id);
      if (player) {
        player.isDead = true;
        player.mesh.visible = false;
        
        // Create death effect
        if (this.scene.pyrotechnics) {
          this.scene.pyrotechnics.createPlayerDeathEffect(player.mesh.position);
        }
      }
    }
    
    // Show kill notification
    if (data.killer_id === this.playerId && this.scene.HUD) {
      this.scene.HUD.showKillNotification(data.player_id, data.weapon_type);
    }
  }
  
  handlePlayerRespawned(data) {
    if (data.player_id === this.playerId) {
      // Respawn local player
      if (this.scene.player) {
        this.scene.player.isDead = false;
        this.scene.player.health = data.health;
        this.scene.player.mesh.visible = true;
        this.scene.player.setPosition(new THREE.Vector3(
          data.position.x,
          data.position.y,
          data.position.z
        ));
        
        // Hide death screen
        if (this.scene.HUD) {
          this.scene.HUD.hideDeathScreen();
          this.scene.HUD.updateHealth(data.health, 0);
        }
      }
    } else {
      // Respawn other player
      const player = this.scene.players.get(data.player_id);
      if (player) {
        player.isDead = false;
        player.mesh.visible = true;
        player.mesh.position.set(
          data.position.x,
          data.position.y,
          data.position.z
        );
      }
    }
  }
  
  handleWeaponFired(data) {
    // Don't show own weapon fire (already handled locally)
    if (data.player_id === this.playerId) return;
    
    const player = this.scene.players.get(data.player_id);
    if (player && player.weaponSystem) {
      // Show muzzle flash
      player.weaponSystem.showRemoteMuzzleFlash();
      
      // Create tracer
      const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
      const direction = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
      const endPoint = origin.clone().add(direction.clone().multiplyScalar(100));
      
      player.weaponSystem.createTracer(origin, endPoint);
      
      // Play sound
      if (this.scene.audioSystem) {
        this.scene.audioSystem.playWeaponSound(data.weapon_type, origin);
      }
    }
  }
  
  handleItemSpawned(data) {
    // Create item pickup in world
    if (this.scene.itemManager) {
      this.scene.itemManager.spawnItem(
        data.item_id,
        data.item_type,
        new THREE.Vector3(data.position.x, data.position.y, data.position.z),
        data.properties
      );
    }
  }
  
  handleItemPickedUp(data) {
    // Remove item from world
    if (this.scene.itemManager) {
      this.scene.itemManager.removeItem(data.item_id);
    }
    
    // Play pickup sound
    if (this.scene.audioSystem) {
      this.scene.audioSystem.playPickupSound();
    }
  }
  
  handleVehicleSpawned(data) {
    // Spawn vehicle in world
    const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    const rotation = new THREE.Quaternion(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);
    
    switch(data.vehicle_type) {
      case 'spaceship':
        if (this.scene.spawnSpaceship) {
          this.scene.spawnSpaceship(position, rotation, data.vehicle_id);
        }
        break;
      case 'helicopter':
        if (this.scene.spawnHelicopter) {
          this.scene.spawnHelicopter(position, rotation, data.vehicle_id);
        }
        break;
      case 'plane':
        if (this.scene.spawnPlane) {
          this.scene.spawnPlane(position, rotation, data.vehicle_id);
        }
        break;
    }
  }
  
  // Add method to send weapon fire
  sendWeaponFire(weaponType, origin, direction, hitInfo = null) {
    if (!this.connected) return;
    
    const message = {
      type: 'fire_weapon',
      weapon_type: weaponType,
      origin: {
        x: origin.x,
        y: origin.y,
        z: origin.z
      },
      direction: {
        x: direction.x,
        y: direction.y,
        z: direction.z
      }
    };
    
    if (hitInfo) {
      if (hitInfo.hitPlayerId) {
        message.hit_player_id = hitInfo.hitPlayerId;
      }
      if (hitInfo.hitObjectId) {
        message.hit_object_id = hitInfo.hitObjectId;
      }
      if (hitInfo.hitPoint) {
        message.hit_point = {
          x: hitInfo.hitPoint.x,
          y: hitInfo.hitPoint.y,
          z: hitInfo.hitPoint.z
        };
      }
    }
    
    this.ws.send(JSON.stringify(message));
  }
  
  sendPickupItem(itemId) {
    if (!this.connected) return;
    
    this.ws.send(JSON.stringify({
      type: 'pickup_item',
      item_id: itemId
    }));
  }
  
  sendRequestRespawn() {
    if (!this.connected) return;
    
    this.ws.send(JSON.stringify({
      type: 'request_respawn'
    }));
  }
  
  // Add methods to send grab/throw messages
  sendGrabObject(objectId, grabPoint) {
    if (!this.connected) return;
    
    this.send({
      type: 'grab_object',
      object_id: objectId,
      grab_point: {
        x: grabPoint.x,
        y: grabPoint.y,
        z: grabPoint.z
      }
    });
  }
  
  sendMoveGrabbedObject(objectId, targetPosition) {
    if (!this.connected) return;
    
    this.send({
      type: 'move_grabbed_object',
      object_id: objectId,
      target_position: {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z
      }
    });
  }
  
  sendThrowObject(objectId, throwForce, releasePoint) {
    if (!this.connected) return;
    
    this.send({
      type: 'throw_object',
      object_id: objectId,
      throw_force: {
        x: throwForce.x,
        y: throwForce.y,
        z: throwForce.z
      },
      release_point: {
        x: releasePoint.x,
        y: releasePoint.y,
        z: releasePoint.z
      }
    });
  }
  
  sendReleaseObject(objectId) {
    if (!this.connected) return;
    
    this.send({
      type: 'release_object',
      object_id: objectId
    });
  }
  
  sendPickupWeapon(pickupId) {
    if (!this.connected) return;
    
    this.send({
      type: 'pickup_weapon',
      pickup_id: pickupId
    });
  }
}