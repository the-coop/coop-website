export const INTERACTION_MODES = { 
    NONE: - 1, 
    ROTATE: 0, 
    ZOOM: 1, 
    PAN: 2, 
    TOUCH_ROTATE: 3, 
    TOUCH_ZOOM_PAN: 4 
};

export function onPointerDown( event ) {
    const { TRACKBALL } = window.CONQUEST;
    if ( TRACKBALL.enabled === false ) return;

    // console.log(TRACKBALL);

    if (['mouse', 'pen'].includes(event.pointerType))
        onMouseDown( event );
}

export function onPointerMove( event ) {
    const { TRACKBALL } = window.CONQUEST;
    if ( TRACKBALL.enabled === false ) return;

    if (['mouse', 'pen'].includes(event.pointerType))
        onMouseMove( event );
}

export function onPointerUp( event ) {
    const { TRACKBALL } = window.CONQUEST;
    if ( TRACKBALL.enabled === false ) return;

    if (['mouse', 'pen'].includes(event.pointerType))
        onMouseUp( event );
}

export function onMouseDown( event ) {
    event.preventDefault();
    
    const { TRACKBALL } = window.CONQUEST;

    if (TRACKBALL._state === INTERACTION_MODES.NONE ) {
        // Start rotation mode.
        if (event.button === TRACKBALL.mouseButtons.LEFT)
            TRACKBALL._state = INTERACTION_MODES.ROTATE;

        // Start zoom mode.
        else if (event.button === TRACKBALL.mouseButtons.MIDDLE)
            TRACKBALL._state = INTERACTION_MODES.ZOOM;
        
        // Start panning prefer disable, we will see.
        else if (event.button === TRACKBALL.mouseButtons.RIGHT)
            TRACKBALL._state = INTERACTION_MODES.PAN;
        
        // Reset state/interaction mode?
        else TRACKBALL._state = INTERACTION_MODES.NONE;
    }

    const state = ( TRACKBALL._keyState !== INTERACTION_MODES.NONE ) ? TRACKBALL._keyState : TRACKBALL._state;

    if ( state === INTERACTION_MODES.ROTATE && ! TRACKBALL.noRotate ) {
        TRACKBALL._moveCurr.copy( TRACKBALL.getMouseOnCircle( event.pageX, event.pageY ) );
        TRACKBALL._movePrev.copy( TRACKBALL._moveCurr );

    } else if ( state === INTERACTION_MODES.ZOOM && ! TRACKBALL.noZoom ) {
        TRACKBALL._zoomStart.copy( TRACKBALL.getMouseOnScreen( event.pageX, event.pageY ) );
        TRACKBALL._zoomEnd.copy( TRACKBALL._zoomStart );

    } else if ( state === INTERACTION_MODES.PAN && ! TRACKBALL.noPan ) {
        TRACKBALL._panStart.copy( TRACKBALL.getMouseOnScreen( event.pageX, event.pageY ) );
        TRACKBALL._panEnd.copy( TRACKBALL._panStart );
    }

    TRACKBALL.domElement.ownerDocument.addEventListener( 'pointermove', onPointerMove );
    TRACKBALL.domElement.ownerDocument.addEventListener( 'pointerup', onPointerUp );

    TRACKBALL.dispatchEvent( { type: 'start' } );
}

export function onMouseMove( event ) {
    const { TRACKBALL } = window.CONQUEST;

    if ( TRACKBALL.enabled === false ) return;

    event.preventDefault();

    const state = ( TRACKBALL._keyState !== INTERACTION_MODES.NONE ) ? TRACKBALL._keyState : TRACKBALL._state;

    if ( state === INTERACTION_MODES.ROTATE && ! TRACKBALL.noRotate ) {
        TRACKBALL._movePrev.copy( TRACKBALL._moveCurr );
        TRACKBALL._moveCurr.copy( TRACKBALL.getMouseOnCircle( event.pageX, event.pageY ) );
    } else if ( state === INTERACTION_MODES.ZOOM && ! TRACKBALL.noZoom ) {
        TRACKBALL._zoomEnd.copy( TRACKBALL.getMouseOnScreen( event.pageX, event.pageY ) );
    } else if ( state === INTERACTION_MODES.PAN && ! TRACKBALL.noPan ) {
        TRACKBALL._panEnd.copy( TRACKBALL.getMouseOnScreen( event.pageX, event.pageY ) );
    }
}

export function onMouseUp( event ) {
    const { TRACKBALL } = window.CONQUEST;

    if ( TRACKBALL.enabled === false ) return;

    event.preventDefault();

    TRACKBALL._state = INTERACTION_MODES.NONE;

    TRACKBALL.domElement.ownerDocument.removeEventListener('pointermove', onPointerMove);
    TRACKBALL.domElement.ownerDocument.removeEventListener('pointerup', onPointerUp);

    TRACKBALL.dispatchEvent( { type: 'end' } );
}

export function mousewheel( event ) {
    const { TRACKBALL } = window.CONQUEST;
    if (!TRACKBALL.enabled || TRACKBALL.noZoom) return;

    event.preventDefault();

    switch ( event.deltaMode ) {

        case 2:
            // Zoom in pages
            TRACKBALL._zoomStart.y -= event.deltaY * 0.025;
            break;

        case 1:
            // Zoom in lines
            TRACKBALL._zoomStart.y -= event.deltaY * 0.01;
            break;

        default:
            // undefined, 0, assume pixels
            TRACKBALL._zoomStart.y -= event.deltaY * 0.00025;
            break;

    }

    TRACKBALL.dispatchEvent( { type: 'start' } );
    TRACKBALL.dispatchEvent( { type: 'end' } );
}

export function touchstart( event ) {
    const { TRACKBALL } = window.CONQUEST;
    if ( TRACKBALL.enabled === false ) return;

    event.preventDefault();

    switch ( event.touches.length ) {
        case 1:
            TRACKBALL._state = INTERACTION_MODES.TOUCH_ROTATE;
            TRACKBALL._moveCurr.copy( TRACKBALL.getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
            TRACKBALL._movePrev.copy( TRACKBALL._moveCurr );
            break;

        default: // 2 or more
            TRACKBALL._state = INTERACTION_MODES.TOUCH_ZOOM_PAN;
            const dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
            const dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
            TRACKBALL._touchZoomDistanceEnd = TRACKBALL._touchZoomDistanceStart = Math.sqrt( dx * dx + dy * dy );

            const x = ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX ) / 2;
            const y = ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY ) / 2;
            TRACKBALL._panStart.copy( getMouseOnScreen( x, y ) );
            TRACKBALL._panEnd.copy( TRACKBALL._panStart );
            break;
    }

    TRACKBALL.dispatchEvent( { type: 'start' } );
}

export function touchmove( event ) {
    const { TRACKBALL } = window.CONQUEST;
    if ( TRACKBALL.enabled === false ) return;

    event.preventDefault();

    switch ( event.touches.length ) {

        case 1:
            TRACKBALL._movePrev.copy( TRACKBALL._moveCurr );
            TRACKBALL._moveCurr.copy( TRACKBALL.getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
            break;

        default: // 2 or more
            const dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
            const dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
            TRACKBALL._touchZoomDistanceEnd = Math.sqrt( dx * dx + dy * dy );

            const x = ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX ) / 2;
            const y = ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY ) / 2;
            TRACKBALL._panEnd.copy( TRACKBALL.getMouseOnScreen( x, y ) );
            break;
    }
}

export function touchend( event ) {
    const { TRACKBALL } = window.CONQUEST;
    if ( TRACKBALL.enabled === false ) return;

    if (event.touches.length === 0)
        TRACKBALL._state = INTERACTION_MODES.NONE;

    if (event.touches.length === 1) {
        TRACKBALL._state = INTERACTION_MODES.TOUCH_ROTATE;
        TRACKBALL._moveCurr.copy( getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
        TRACKBALL._movePrev.copy( TRACKBALL._moveCurr );
    }

    TRACKBALL.dispatchEvent( { type: 'end' } );
}