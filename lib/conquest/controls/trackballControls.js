import { EventDispatcher, MOUSE, Quaternion, Vector2, Vector3 } from 'three';

export default class TrackballControls extends EventDispatcher {

	STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, TOUCH_ROTATE: 3 };

	constructor(object, domElement) {
		super();
		
		const scope = this;

		this.object = object;
		this.domElement = domElement;

		this.enabled = true;

		const box = domElement.getBoundingClientRect();

		this.screen = { 
			left: box.left + window.pageXOffset - document.clientLeft, 
			top: box.top + window.pageYOffset - document.clientTop, 
			width: box.width, 
			height: box.height 
		};

		this.rotateSpeed = 1.0;
		this.zoomSpeed = 1.2;

		this.noRotate = false;
		this.noZoom = false;

		this.dynamicDampingFactor = 0.2;

		this.minDistance = 0;
		this.maxDistance = Infinity;

		// internals

		this.target = new Vector3();

		const lastPosition = new Vector3();

		let _state = scope.STATE.NONE;
		let _keyState = scope.STATE.NONE;
		let _lastAngle = 0;

		const _eye = new Vector3();

		const _movePrev = new Vector2();
		const _moveCurr = new Vector2();

		const _lastAxis = new Vector3();

		const _zoomStart = new Vector2();
		const _zoomEnd = new Vector2();


		const getMouseOnScreen = (pageX, pageY) =>
			new Vector2(
				( pageX - this.screen.left ) / this.screen.width,
				( pageY - this.screen.top ) / this.screen.height
			)

		const getMouseOnCircle = (pageX, pageY) =>
			new Vector2(
				( ( pageX - this.screen.width * 0.5 - this.screen.left ) / ( this.screen.width * 0.5 ) ),
				( ( this.screen.height + 2 * ( this.screen.top - pageY ) ) / this.screen.width )
			);

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

				} else if (_lastAngle) {
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

			_zoomStart.y += ( _zoomEnd.y - _zoomStart.y ) * this.dynamicDampingFactor;
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

			if (scope.object.isPerspectiveCamera) {
				scope.checkDistances();

				scope.object.lookAt( scope.target );

				if (lastPosition.distanceToSquared( scope.object.position ) > Number.EPSILON) {
					scope.dispatchEvent( { type: 'change' } );

					lastPosition.copy( scope.object.position );
				}
			}
		};

		function onPointerDown( event ) {
			if ( scope.enabled === false ) return;

			onMouseDown( event );
		}

		function onPointerMove( event ) {
			if ( scope.enabled === false ) return;
			onMouseMove( event );
		}

		function onPointerUp( event ) {
			if ( scope.enabled === false ) return;

			onMouseUp( event );
		}

		function onMouseDown( event ) {
			event.preventDefault();

			if ( _state === scope.STATE.NONE ) {

				switch ( event.button ) {

					case MOUSE.ROTATE:
						_state = scope.STATE.ROTATE;
						break;

					case MOUSE.DOLLY:
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

			scope.dispatchEvent( { type: 'start' } );
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

			scope.dispatchEvent( { type: 'end' } );
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

			scope.dispatchEvent( { type: 'start' } );
			scope.dispatchEvent( { type: 'end' } );
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

			scope.dispatchEvent( { type: 'start' } );
		}

		function touchmove( event ) {
			if ( scope.enabled === false ) return;

			event.preventDefault();

			_movePrev.copy( _moveCurr );
			_moveCurr.copy( getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
		}

		function touchend(event) {
			if (scope.enabled === false) return;

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

			scope.dispatchEvent( { type: 'end' } );
		}

		this.domElement.addEventListener( 'pointerdown', onPointerDown );
		this.domElement.addEventListener( 'wheel', mousewheel, { passive: false } );

		this.domElement.addEventListener( 'touchstart', touchstart, { passive: false } );
		this.domElement.addEventListener( 'touchend', touchend );
		this.domElement.addEventListener( 'touchmove', touchmove, { passive: false } );

		this.domElement.ownerDocument.addEventListener( 'pointermove', onPointerMove );
		this.domElement.ownerDocument.addEventListener( 'pointerup', onPointerUp );

		// force an update at start
		this.update();
	}

}


