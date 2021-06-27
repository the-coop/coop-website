import { EventDispatcher, MOUSE, Quaternion, Vector2, Vector3 } from 'three';
import ENTITY_TYPES from '../entity-types';
import { 
	mousewheel, touchstart, touchmove, touchend,
	onPointerDown, onPointerMove, onPointerUp,
	INTERACTION_MODES
} from './trackballEvents';



export default class TrackballControls extends EventDispatcher {
	enabled = true;

	screen = { left: 0, top: 0, width: 0, height: 0 };

	rotateSpeed = 1.0;
	zoomSpeed = 1.2;
	panSpeed = 0.3;

	noRotate = false;
	noZoom = false;
	noPan = false;

	staticMoving = false;
	dynamicDampingFactor = 0.2;

	minDistance = 0;
	maxDistance = Infinity;

	mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };

	// internals

	target = new Vector3();

	lastPosition = new Vector3();
	lastZoom = 1;

	_state = INTERACTION_MODES.NONE;
	_keyState = INTERACTION_MODES.NONE;

	_touchZoomDistanceStart = 0;
	_touchZoomDistanceEnd = 0;

	_lastAngle = 0;

	_eye = new Vector3();

	_movePrev = new Vector2();
	_moveCurr = new Vector2();

	_lastAxis = new Vector3();

	_zoomStart = new Vector2();
	_zoomEnd = new Vector2();

	_panStart = new Vector2();
	_panEnd = new Vector2();


	constructor( object, domElement ) {
		super();

		window.CONQUEST.TRACKBALL = this;

		this.object = object;
		this.domElement = domElement;

		this.domElement.addEventListener( 'pointerdown', onPointerDown );
		this.domElement.addEventListener( 'wheel', mousewheel, { passive: false } );

		this.domElement.addEventListener( 'touchstart', touchstart, { passive: false } );
		this.domElement.addEventListener( 'touchend', touchend );
		this.domElement.addEventListener( 'touchmove', touchmove, { passive: false } );

		this.domElement.ownerDocument.addEventListener( 'pointermove', onPointerMove );
		this.domElement.ownerDocument.addEventListener( 'pointerup', onPointerUp );

		// Run the resize function at the beginning to calibrate.
		this.handleResize();

		// Force render update
		this.update();
	}

	getMouseOnScreen(pageX, pageY) {
		const vector = new Vector2();
		vector.set(
			( pageX - this.screen.left ) / this.screen.width,
			( pageY - this.screen.top ) / this.screen.height
		);

		return vector;
	}

	getMouseOnCircle( pageX, pageY ) {
		const vector = new Vector2();
		vector.set(
			( ( pageX - this.screen.width * 0.5 - this.screen.left ) / ( this.screen.width * 0.5 ) ),
			( ( this.screen.height + 2 * ( this.screen.top - pageY ) ) / this.screen.width ) // screen.width intentional
		);

		return vector;
	};

	checkDistances() {
		if (this.noZoom || this.noPan) return null;

		if ( this._eye.lengthSq() > this.maxDistance * this.maxDistance ) {
			this.object.position.addVectors( this.target, this._eye.setLength( this.maxDistance ) );
			this._zoomStart.copy( this._zoomEnd );
		}

		if ( this._eye.lengthSq() < this.minDistance * this.minDistance ) {
			this.object.position.addVectors( this.target, this._eye.setLength( this.minDistance ) );
			this._zoomStart.copy( this._zoomEnd );
		}
	};

	zoomCamera() {
		const { focusTarget } = window.CONQUEST.VIEW;

		// Initialise zoom factor.
		let factor;

		if ( this._state === INTERACTION_MODES.TOUCH_ZOOM_PAN ) {
			factor = this._touchZoomDistanceStart / this._touchZoomDistanceEnd;
			this._touchZoomDistanceStart = this._touchZoomDistanceEnd;

			if (focusTarget.entity_type === ENTITY_TYPES.STRUCTURE) {
				this.object.zoom /= factor;
				this.object.updateProjectionMatrix();
			}

			// Apply the zooming factor.
			this._eye.multiplyScalar( factor );

		} else {
			factor = 1.0 + ( this._zoomEnd.y - this._zoomStart.y ) * this.zoomSpeed;

			if ( factor !== 1.0 && factor > 0.0 ) {
				if (focusTarget.entity_type === ENTITY_TYPES.STRUCTURE) {
					this.object.zoom /= factor;
					this.object.updateProjectionMatrix();
	
				}
				this._eye.multiplyScalar( factor );
			}

			if ( this.staticMoving ) {
				this._zoomStart.copy( this._zoomEnd );

			} else {
				this._zoomStart.y += ( this._zoomEnd.y - this._zoomStart.y ) * this.dynamicDampingFactor;
			}

		}

	};

	update() {
		this._eye.subVectors( this.object.position, this.target );

		if ( ! this.noRotate ) this.rotateCamera();
		if ( ! this.noZoom ) this.zoomCamera();

		this.object.position.addVectors( this.target, this._eye );

		if ( this.object.isPerspectiveCamera ) {
			this.checkDistances();
			this.object.lookAt( this.target );

			if ( this.lastPosition.distanceToSquared( this.object.position ) > 0.000001 ) {
				this.dispatchEvent( { type: 'change' } );

				this.lastPosition.copy( this.object.position );
			}

		} else if ( this.object.isOrthographicCamera ) {
			this.object.lookAt( this.target );

			if ( this.lastPosition.distanceToSquared( this.object.position ) > 0.000001 || lastZoom !== this.object.zoom ) {
				this.dispatchEvent( { type: 'change' } );

				this.lastPosition.copy( this.object.position );
				lastZoom = this.object.zoom;
			}
		}
	};

	handleResize() {
		const box = this.domElement.getBoundingClientRect();
		// adjustments come from similar code in the jquery offset() function
		const d = this.domElement.ownerDocument.documentElement;
		this.screen.left = box.left + window.pageXOffset - d.clientLeft;
		this.screen.top = box.top + window.pageYOffset - d.clientTop;
		this.screen.width = box.width;
		this.screen.height = box.height;
	};

	rotateCamera() {
		const axis = new Vector3(),
			quaternion = new Quaternion(),
			eyeDirection = new Vector3(),
			objectUpDirection = new Vector3(),
			objectSidewaysDirection = new Vector3(),
			moveDirection = new Vector3();

		moveDirection.set( this._moveCurr.x - this._movePrev.x, this._moveCurr.y - this._movePrev.y, 0 );
		let angle = moveDirection.length();

		if ( angle ) {
			this._eye.copy( this.object.position ).sub( this.target );

			eyeDirection.copy( this._eye ).normalize();
			objectUpDirection.copy( this.object.up ).normalize();
			objectSidewaysDirection.crossVectors( objectUpDirection, eyeDirection ).normalize();

			objectUpDirection.setLength( this._moveCurr.y - this._movePrev.y );
			objectSidewaysDirection.setLength( this._moveCurr.x - this._movePrev.x );

			moveDirection.copy( objectUpDirection.add( objectSidewaysDirection ) );

			axis.crossVectors( moveDirection, this._eye ).normalize();

			angle *= this.rotateSpeed;
			quaternion.setFromAxisAngle( axis, angle );

			this._eye.applyQuaternion( quaternion );
			this.object.up.applyQuaternion( quaternion );

			this._lastAxis.copy( axis );
			this._lastAngle = angle;

		} else if ( ! this.staticMoving && this._lastAngle ) {
			this._lastAngle *= Math.sqrt( 1.0 - this.dynamicDampingFactor );
			this._eye.copy( this.object.position ).sub( this.target );
			quaternion.setFromAxisAngle( this._lastAxis, this._lastAngle );
			this._eye.applyQuaternion( quaternion );
			this.object.up.applyQuaternion( quaternion );

		}

		this._movePrev.copy( this._moveCurr );
	}
}
