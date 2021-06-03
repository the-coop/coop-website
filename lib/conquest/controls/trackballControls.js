import { EventDispatcher, MOUSE, Quaternion, Vector2, Vector3 } from 'three';

const _changeEvent = { type: 'change' };
const _startEvent = { type: 'start' };
const _endEvent = { type: 'end' };

export default class TrackballControls extends EventDispatcher {

	STATE = { NONE: - 1, ROTATE: 0, ZOOM: 1, TOUCH_ROTATE: 3 };

	constructor(object, domElement) {
		super();

		const scope = this;

		this.object = object;
		this.domElement = domElement;

		// API

		this.enabled = true;

		this.screen = { left: 0, top: 0, width: 0, height: 0 };

		this.rotateSpeed = 1.0;
		this.zoomSpeed = 1.2;

		this.noRotate = false;
		this.noZoom = false;

		this.staticMoving = false;
		this.dynamicDampingFactor = 0.2;

		this.minDistance = 0;
		this.maxDistance = Infinity;

		this.keys = [ 'KeyA' /*A*/, 'KeyS' /*S*/, 'KeyD' /*D*/ ];

		this.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY };

		// internals

		this.target = new Vector3();

		const EPS = 0.000001;

		const lastPosition = new Vector3();
		let lastZoom = 1;

		let _state = scope.STATE.NONE,
			_keyState = scope.STATE.NONE,
			_touchZoomDistanceEnd = 0,
			_lastAngle = 0;

		const _eye = new Vector3(),

			_movePrev = new Vector2(),
			_moveCurr = new Vector2(),

			_lastAxis = new Vector3(),

			_zoomStart = new Vector2(),
			_zoomEnd = new Vector2();

		// for reset

		this.target0 = this.target.clone();
		this.position0 = this.object.position.clone();
		this.up0 = this.object.up.clone();
		this.zoom0 = this.object.zoom;

		// methods

		this.handleResize = function () {
			const box = scope.domElement.getBoundingClientRect();

			// adjustments come from similar code in the jquery offset() function
			const d = scope.domElement.ownerDocument.documentElement;
			scope.screen.left = box.left + window.pageXOffset - d.clientLeft;
			scope.screen.top = box.top + window.pageYOffset - d.clientTop;
			scope.screen.width = box.width;
			scope.screen.height = box.height;
		};

		const getMouseOnScreen = (function () {
			const vector = new Vector2();

			return function getMouseOnScreen( pageX, pageY ) {
				vector.set(
					( pageX - scope.screen.left ) / scope.screen.width,
					( pageY - scope.screen.top ) / scope.screen.height
				);

				return vector;
			};
		}());

		const getMouseOnCircle = ( function () {
			const vector = new Vector2();

			return function getMouseOnCircle( pageX, pageY ) {
				vector.set(
					( ( pageX - scope.screen.width * 0.5 - scope.screen.left ) / ( scope.screen.width * 0.5 ) ),
					( ( scope.screen.height + 2 * ( scope.screen.top - pageY ) ) / scope.screen.width ) // screen.width intentional
				);

				return vector;
			};
		}());

		this.rotateCamera = ( function () {
			const axis = new Vector3(),
				quaternion = new Quaternion(),
				eyeDirection = new Vector3(),
				objectUpDirection = new Vector3(),
				objectSidewaysDirection = new Vector3(),
				moveDirection = new Vector3();

			return function rotateCamera() {
				moveDirection.set( _moveCurr.x - _movePrev.x, _moveCurr.y - _movePrev.y, 0 );
				let angle = moveDirection.length();

				if ( angle ) {
					_eye.copy( scope.object.position ).sub( scope.target );

					eyeDirection.copy( _eye ).normalize();
					objectUpDirection.copy( scope.object.up ).normalize();
					objectSidewaysDirection.crossVectors( objectUpDirection, eyeDirection ).normalize();

					objectUpDirection.setLength( _moveCurr.y - _movePrev.y );
					objectSidewaysDirection.setLength( _moveCurr.x - _movePrev.x );

					moveDirection.copy( objectUpDirection.add( objectSidewaysDirection ) );

					axis.crossVectors( moveDirection, _eye ).normalize();

					angle *= scope.rotateSpeed;
					quaternion.setFromAxisAngle( axis, angle );

					_eye.applyQuaternion( quaternion );
					scope.object.up.applyQuaternion( quaternion );

					_lastAxis.copy( axis );
					_lastAngle = angle;

				} else if ( ! scope.staticMoving && _lastAngle ) {
					_lastAngle *= Math.sqrt( 1.0 - scope.dynamicDampingFactor );
					_eye.copy( scope.object.position ).sub( scope.target );
					quaternion.setFromAxisAngle( _lastAxis, _lastAngle );
					_eye.applyQuaternion( quaternion );
					scope.object.up.applyQuaternion( quaternion );

				}

				_movePrev.copy( _moveCurr );
			};
		}());


		this.zoomCamera = function () {
			let factor = 1.0 + ( _zoomEnd.y - _zoomStart.y ) * scope.zoomSpeed;

			if ( factor !== 1.0 && factor > 0.0 ) {
				if ( scope.object.isPerspectiveCamera ) {
					_eye.multiplyScalar( factor );

				} else if ( scope.object.isOrthographicCamera ) {
					scope.object.zoom /= factor;
					scope.object.updateProjectionMatrix();

				}

			}

			if ( scope.staticMoving ) {
				_zoomStart.copy( _zoomEnd );

			} else {
				_zoomStart.y += ( _zoomEnd.y - _zoomStart.y ) * this.dynamicDampingFactor;
			}
		};


		this.checkDistances = function () {
			if ( ! scope.noZoom || ! scope.noPan ) {
				if ( _eye.lengthSq() > scope.maxDistance * scope.maxDistance ) {
					scope.object.position.addVectors( scope.target, _eye.setLength( scope.maxDistance ) );
					_zoomStart.copy( _zoomEnd );
				}

				if ( _eye.lengthSq() < scope.minDistance * scope.minDistance ) {
					scope.object.position.addVectors( scope.target, _eye.setLength( scope.minDistance ) );
					_zoomStart.copy( _zoomEnd );
				}
			}
		};

		this.update = function () {
			_eye.subVectors( scope.object.position, scope.target );

			if (!scope.noRotate) scope.rotateCamera();
			if (!scope.noZoom) scope.zoomCamera();


			scope.object.position.addVectors( scope.target, _eye );

			if ( scope.object.isPerspectiveCamera ) {
				scope.checkDistances();

				scope.object.lookAt( scope.target );

				if ( lastPosition.distanceToSquared( scope.object.position ) > EPS ) {

					scope.dispatchEvent( _changeEvent );

					lastPosition.copy( scope.object.position );
				}
			}
		};

		this.reset = function () {
			_state = scope.STATE.NONE;
			_keyState = scope.STATE.NONE;

			scope.target.copy( scope.target0 );
			scope.object.position.copy( scope.position0 );
			scope.object.up.copy( scope.up0 );
			scope.object.zoom = scope.zoom0;

			scope.object.updateProjectionMatrix();

			_eye.subVectors( scope.object.position, scope.target );

			scope.object.lookAt( scope.target );

			scope.dispatchEvent( _changeEvent );

			lastPosition.copy( scope.object.position );
			lastZoom = scope.object.zoom;

		};

		// listeners

		function onPointerDown( event ) {
			if ( scope.enabled === false ) return;

			switch ( event.pointerType ) {

				case 'mouse':
				case 'pen':
					onMouseDown( event );
					break;
			}

		}

		function onPointerMove( event ) {
			if ( scope.enabled === false ) return;

			switch ( event.pointerType ) {
				case 'mouse':
				case 'pen':
					onMouseMove( event );
					break;

			}

		}

		function onPointerUp( event ) {
			if ( scope.enabled === false ) return;

			switch ( event.pointerType ) {
				case 'mouse':
				case 'pen':
					onMouseUp( event );
					break;
			}

		}

		function keydown( event ) {
			if ( scope.enabled === false ) return;

			window.removeEventListener( 'keydown', keydown );

			if ( _keyState !== scope.STATE.NONE ) {
				return;

			} else if ( event.code === scope.keys[ scope.STATE.ROTATE ] && ! scope.noRotate ) {
				_keyState = scope.STATE.ROTATE;

			} else if ( event.code === scope.keys[ scope.STATE.ZOOM ] && ! scope.noZoom ) {
				_keyState = scope.STATE.ZOOM;
			}
		}

		function keyup() {
			if ( scope.enabled === false ) return;

			_keyState = scope.STATE.NONE;

			window.addEventListener( 'keydown', keydown );

		}

		function onMouseDown( event ) {
			event.preventDefault();

			if ( _state === scope.STATE.NONE ) {

				switch ( event.button ) {

					case scope.mouseButtons.LEFT:
						_state = scope.STATE.ROTATE;
						break;

					case scope.mouseButtons.MIDDLE:
						_state = scope.STATE.ZOOM;
						break;

					default:
						_state = scope.STATE.NONE;

				}

			}

			const state = ( _keyState !== scope.STATE.NONE ) ? _keyState : _state;

			if ( state === scope.STATE.ROTATE && ! scope.noRotate ) {

				_moveCurr.copy( getMouseOnCircle( event.pageX, event.pageY ) );
				_movePrev.copy( _moveCurr );

			} else if ( state === scope.STATE.ZOOM && ! scope.noZoom ) {

				_zoomStart.copy( getMouseOnScreen( event.pageX, event.pageY ) );
				_zoomEnd.copy( _zoomStart );

			}

			scope.domElement.ownerDocument.addEventListener( 'pointermove', onPointerMove );
			scope.domElement.ownerDocument.addEventListener( 'pointerup', onPointerUp );

			scope.dispatchEvent( _startEvent );

		}

		function onMouseMove( event ) {

			if ( scope.enabled === false ) return;

			event.preventDefault();

			const state = ( _keyState !== scope.STATE.NONE ) ? _keyState : _state;

			if ( state === scope.STATE.ROTATE && ! scope.noRotate ) {

				_movePrev.copy( _moveCurr );
				_moveCurr.copy( getMouseOnCircle( event.pageX, event.pageY ) );

			} else if ( state === scope.STATE.ZOOM && ! scope.noZoom ) {

				_zoomEnd.copy( getMouseOnScreen( event.pageX, event.pageY ) );

			}

		}

		function onMouseUp( event ) {
			if ( scope.enabled === false ) return;

			event.preventDefault();

			_state = scope.STATE.NONE;

			scope.domElement.ownerDocument.removeEventListener( 'pointermove', onPointerMove );
			scope.domElement.ownerDocument.removeEventListener( 'pointerup', onPointerUp );

			scope.dispatchEvent( _endEvent );

		}

		function mousewheel( event ) {
			if ( scope.enabled === false ) return;
			if ( scope.noZoom === true ) return;

			event.preventDefault();

			switch ( event.deltaMode ) {

				case 2:
					// Zoom in pages
					_zoomStart.y -= event.deltaY * 0.025;
					break;

				case 1:
					// Zoom in lines
					_zoomStart.y -= event.deltaY * 0.01;
					break;

				default:
					// undefined, 0, assume pixels
					_zoomStart.y -= event.deltaY * 0.00025;
					break;

			}

			scope.dispatchEvent( _startEvent );
			scope.dispatchEvent( _endEvent );
		}

		function touchstart( event ) {
			if ( scope.enabled === false ) return;

			event.preventDefault();

			switch ( event.touches.length ) {
				case 1:
					_state = scope.STATE.TOUCH_ROTATE;
					_moveCurr.copy( getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
					_movePrev.copy( _moveCurr );
					break;
			}

			scope.dispatchEvent( _startEvent );
		}

		function touchmove( event ) {
			if ( scope.enabled === false ) return;

			event.preventDefault();

			switch ( event.touches.length ) {

				case 1:
					_movePrev.copy( _moveCurr );
					_moveCurr.copy( getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
					break;

				default: // 2 or more
					const dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
					const dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
					_touchZoomDistanceEnd = Math.sqrt( dx * dx + dy * dy );

					break;

			}

		}

		function touchend( event ) {
			if ( scope.enabled === false ) return;

			switch ( event.touches.length ) {

				case 0:
					_state = scope.STATE.NONE;
					break;

				case 1:
					_state = scope.STATE.TOUCH_ROTATE;
					_moveCurr.copy( getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
					_movePrev.copy( _moveCurr );
					break;

			}

			scope.dispatchEvent( _endEvent );
		}


		this.dispose = function () {
			scope.domElement.removeEventListener( 'pointerdown', onPointerDown );
			scope.domElement.removeEventListener( 'wheel', mousewheel );

			scope.domElement.removeEventListener( 'touchstart', touchstart );
			scope.domElement.removeEventListener( 'touchend', touchend );
			scope.domElement.removeEventListener( 'touchmove', touchmove );

			scope.domElement.ownerDocument.removeEventListener( 'pointermove', onPointerMove );
			scope.domElement.ownerDocument.removeEventListener( 'pointerup', onPointerUp );

			window.removeEventListener( 'keydown', keydown );
			window.removeEventListener( 'keyup', keyup );
		};

		this.domElement.addEventListener( 'pointerdown', onPointerDown );
		this.domElement.addEventListener( 'wheel', mousewheel, { passive: false } );

		this.domElement.addEventListener( 'touchstart', touchstart, { passive: false } );
		this.domElement.addEventListener( 'touchend', touchend );
		this.domElement.addEventListener( 'touchmove', touchmove, { passive: false } );

		this.domElement.ownerDocument.addEventListener( 'pointermove', onPointerMove );
		this.domElement.ownerDocument.addEventListener( 'pointerup', onPointerUp );

		window.addEventListener( 'keydown', keydown );
		window.addEventListener( 'keyup', keyup );

		this.handleResize();

		// force an update at start
		this.update();
	}

}