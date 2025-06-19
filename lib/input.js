import { PlayerConstants } from '@game/shared'
import { Control } from './control.js'

export class Input {
  static keys = {}
  static mouse = { x: 0, y: 0 }
  static isPointerLocked = false
  static container = null

  static init(container) {
    this.container = container
    
    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    
    // Mouse events
    container.addEventListener('click', this.onClick)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    document.addEventListener('mousemove', this.onMouseMove)
  }

  static onKeyDown = (e) => {
    // Prevent key repeat
    if (this.keys[e.code]) return
    
    this.keys[e.code] = true
    
    // Handle special keys
    switch (e.code) {
      case 'KeyF':
        Control.handleVehicleInteraction()
        break
      case 'KeyG':
        Control.handleGhostInteraction()
        break
      case 'KeyO':
        Control.toggleThirdPerson()
        break
      case 'Backquote':
        Control.toggleDebugInfo()
        break
    }
  }

  static onKeyUp = (e) => {
    this.keys[e.code] = false
  }

  static onBlur = () => {
    // Clear all keys
    Object.keys(this.keys).forEach(key => {
      this.keys[key] = false
    })
  }

  static onClick = () => {
    if (!this.isPointerLocked) {
      this.container.requestPointerLock()
    } else {
      Control.handleShoot()
    }
  }

  static onPointerLockChange = () => {
    this.isPointerLocked = document.pointerLockElement === this.container
    // Reset keys when pointer lock is lost
    if (!this.isPointerLocked) {
      Object.keys(this.keys).forEach(key => {
        this.keys[key] = false
      })
    }
  }

  static onMouseMove = (e) => {
    if (this.isPointerLocked) {
      Control.cameraRotation.y -= e.movementX * PlayerConstants.MOUSE_SENSITIVITY
      Control.cameraRotation.x -= e.movementY * PlayerConstants.MOUSE_SENSITIVITY
      Control.cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, Control.cameraRotation.x))
    }
  }

  static getInput() {
    return {
      moveForward: this.keys['KeyW'] || false,
      moveBackward: this.keys['KeyS'] || false,
      moveLeft: this.keys['KeyA'] || false,
      moveRight: this.keys['KeyD'] || false,
      jump: this.keys['Space'] || false,
      shift: this.keys['ShiftLeft'] || this.keys['ShiftRight'] || false,
      descend: this.keys['KeyZ'] || false
    }
  }

  static cleanup() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    document.removeEventListener('mousemove', this.onMouseMove)
  }
}
