//Article Javascript

//Angular modules and dependencies
angular.module( 'mapsArticle', ['mapsArticleDeps'] );
angular.module( 'mapsArticleDeps', [] );

//Directives

//Directive - Base Map

angular.module( 'mapsArticleDeps' ).directive( 'baseMap', [
    function(){
        var directive = {
            restrict: 'A',
            scope: {
                location: '=',
                onZoomChanged: '&',
                onIdle: '&'
            },
            transclude: true,
            //replace: true,
            template: '<div class="map-container"><div class="map"></div><div data-ng-transclude=""></div></div>',
            controller: ['$scope', '$element', function( $scope, $element ){
                this.map = new google.maps.Map( $element.find( '.map' ).get( 0 ), {
                    center: new google.maps.LatLng( 40.714623,-74.006605 ),
                    zoom: 10,
                    zoomControl: false,
                    disableDefaultUI: true
                } );

                google.maps.visualRefresh = true;
                //surface map events
                google.maps.event.addListener( this.map, 'zoom_changed', _.debounce(onZoomChanged.bind( this ), 500) );
                google.maps.event.addListener( this.map, 'idle', _.debounce(onIdle.bind( this ), 500) );

                //watchers
                $scope.$watch( 'location', focusMapToLocation.bind( this ) );

                ///////////////////////
                //// Private Handlers

                function onZoomChanged(){
                    var that = this;
                    $scope.$apply( function(){
                        $scope.onZoomChanged( {payload: payload.call( that ) } );
                    } );
                }

                function onIdle(){
                    var that = this;
                    $scope.$apply( function(){
                        $scope.onIdle( {payload: payload.call( that ) } );
                    } );
                }

                function focusMapToLocation( location ){
                    if ( location ) {
                        if ( location.latLng ) {
                            this.map.setCenter( latLng );
                        }
                        if ( location.zoom ) {
                            this.map.setZoom( zoom );
                        }
                    }
                }

                function payload(){
                    return {
                        bounds: this.map.getBounds(),
                        zoom: this.map.getZoom()
                    };
                }


            }]
        };

        return directive;
    }
] );

//Directive - Basic Zoom Control
angular.module( 'mapsArticleDeps' ).directive( 'mapControlZoom', [
    function(){
        var directive = {
            restrict: 'A',
            scope: true,
            require: '^baseMap',
            template: '<div class="map-control-zoom"><ul><li><button ng-click="zoomIn()" class="btn custom-zoom-in"><i class="fa fa-download"></i></button></li><li><button ng-click="zoomOut()" class="btn custom-zoom-out"><i class="fa fa-upload"></i></button></li></ul></div>',
            link: function( scope, element, attrs, controller ){
                var map = controller.map;

                scope.zoomIn = function(){
                    map.setZoom( map.getZoom() + 1 );
                };

                scope.zoomOut = function(){
                    map.setZoom( map.getZoom() - 1 );
                };
            }
        };

        return directive;
    }
] );

//Directive - Ruler Directive
angular.module( 'mapsArticleDeps' ).directive( 'mapControlRuler', [
    function(){
        var directive = {
            restrict: 'A',
            scope: true,
            require: '^baseMap',
            template: '<div  class="map-control-ruler"><ul><li><button type="button" class="btn btn-info btn-sm " ng-click="toggleRuler()" ng-class=" {active: rulerOn } " > <i class="fa fa-crosshairs"></i> </button> <button type="button" class="btn btn-info btn-sm " ng-click=" removeLastRulerMarker() " ng-show=" showRemoveRulerButton() " ><i class="fa fa-minus-square-o"></i></button></li></ul></div>',
            link: function( scope, element, attrs, controller ){
                var map = controller.map;
                var rulerSegments = [];
                var rulerLabel = null;
                var rulerPolyLine = null;

                scope.rulerOn = false;

                google.maps.event.addListener( map, 'click', function( point ){
                    if ( scope.rulerOn ) {
                        scope.$apply(function () {
                            addToRulerSegments( point.latLng )
                        })
                    }
                } );

                ////////////////
                /// Scope methods

                scope.toggleRuler = function(){
                    scope.rulerOn = !scope.rulerOn;

                    if ( scope.rulerOn ) {
                        map.setOptions( {draggableCursor: 'crosshair'} );
                    } else {
                        map.setOptions( {draggableCursor: null} );
                        clearRulers();
                    }
                };

                scope.removeLastRulerMarker = function(){
                    var last;

                    if ( rulerSegments.length ) {
                        last = _( rulerSegments ).last();
                        rulerSegments = _( rulerSegments ).without( last );

                        clearRulerMarker( last );
                        rulerDrawEvent();
                    }
                };

                scope.showRemoveRulerButton = function(){
                    return rulerSegments && (rulerSegments.length > 1)
                };


                /////////////////////////////////
                /// Private Scope Helpers

                function addToRulerSegments( latLng ){
                    var ruler;

                    //add a marker
                    ruler = new google.maps.Marker( {
                        position: latLng,
                        map: map,
                        draggable: true,
                        zIndex: 100
                    } );

                    rulerSegments.push( ruler );

                    //if this is the first marker, add a label and link it to the first marker
                    if ( rulerSegments.length === 1 ) {
                        rulerLabel = new Label( { map: map, text: '0 ft' } );
                        rulerLabel.bindTo( 'position', ruler, 'position' );
                    } else {
                        rulerDrawEvent();
                    }

                    google.maps.event.addListener( ruler, 'drag', function(){
                        rulerDrawEvent();
                    } );
                }

                function clearRulerMarker( ruler ){
                    google.maps.event.clearListeners( ruler );
                    ruler.setMap( null );
                }

                function rulerDrawEvent(){
                    drawRulerPolyline();
                    updateLengthLabel();
                }

                function drawRulerPolyline(){
                    clearPolyLine();

                    rulerPolyLine = new google.maps.Polyline( {
                        path: rulersToPositions(),
                        strokeColor: "#FFFF00",
                        strokeWeight: 3,
                        clickable: false,
                        map: map
                    } );
                }

                function updateLengthLabel(){
                    var total;

                    if ( rulerSegments.length ) {
                        total = _( rulerSegments ).reduce( function( length, ruler, index ){
                            var prev;
                            //console.log( 'reduce', length, ruler,index )
                            //ignore the first ruler.... work from current ruler to the previous ruler
                            if ( index ) {
                                prev = rulerSegments[index - 1];

                                return length + distance(
                                    prev.getPosition().lat(), prev.getPosition().lng(),
                                    ruler.getPosition().lat(), ruler.getPosition().lng()
                                )
                            } else {
                                return 0;
                            }
                        }, 0 );

                        console.log( 'rulerLabel', rulerLabel)
                        console.log( 'total', total, total.toLocaleString() + ' ft')

                        rulerLabel.set( 'text', total.toLocaleString() + ' ft' );
                        rulerLabel.draw();
                    } else {
                        if ( rulerLabel ) {
                            rulerLabel.setMap( null );
                            rulerLabel = null;
                        }
                    }
                }

                function clearPolyLine(){
                    if ( rulerPolyLine ) {
                        rulerPolyLine.setMap( null );
                        rulerPolyLine = null;
                    }
                }

                function rulersToPositions() {
                    return _( rulerSegments ).map(function (ruler) {
                        return ruler.position
                    })
                }

                function clearRulers() {
                    clearPolyLine();
                    _( rulerSegments ).each(function (ruler) {
                        clearRulerMarker(ruler);
                    });
                    rulerSegments = null;
                    rulerSegments = [];

                    rulerDrawEvent();
                }

                function distance( lat1, lon1, lat2, lon2 ){
                    var R = 3959;
                    var dLat = (lat2 - lat1) * Math.PI / 180;
                    var dLon = (lon2 - lon1) * Math.PI / 180;
                    var a = Math.sin( dLat / 2 ) * Math.sin( dLat / 2 ) +
                        Math.cos( lat1 * Math.PI / 180 ) * Math.cos( lat2 * Math.PI / 180 ) *
                        Math.sin( dLon / 2 ) * Math.sin( dLon / 2 );
                    var c = 2 * Math.atan2( Math.sqrt( a ), Math.sqrt( 1 - a ) );
                    var d = R * c;

                    return Math.round( d * 5280 );
                }

            }
        };


        ////////////////////////
        //// PRIVATE

        function Label( opt_options ){

            this.setValues( opt_options );

            var span = this.span_ = document.createElement( 'div' );
            span.style.cssText = 'position: relative; left: 0%; top: -8px; ' +
                'white-space: nowrap; border: 0px; font-family:arial; font-weight:bold;' +
                'padding: 5px; background-color: #fff; ' +
                'color: #000; font-size: 13px; z-index: 1000; ' +
                'opacity: .75; ' +
                'filter: alpha(opacity=75); ' +
                '-ms-filter: "alpha(opacity=75)"; ' +
                '-khtml-opacity: .75; ' +
                '-moz-opacity: .75;';

            var div = this.div_ = document.createElement( 'div' );
            div.appendChild( span );
            div.style.cssText = 'position: absolute; display: none';
        }

        Label.prototype = new google.maps.OverlayView();

        Label.prototype.onAdd = function(){
            var pane = this.getPanes().overlayLayer;
            var that = this;

            pane.appendChild( this.div_ );

            // Ensures the label is redrawn if the text or position is changed.
            this.listeners_ = [
                google.maps.event.addListener( this, 'position_changed',
                    function(){
                        that.draw();
                    } ),
                google.maps.event.addListener( this, 'text_changed',
                    function(){
                        that.draw();
                    } )
            ];

        };

        Label.prototype.onRemove = function(){
            this.div_.parentNode.removeChild( this.div_ );
            for ( var i = 0, I = this.listeners_.length; i < I; ++i ) {
                google.maps.event.removeListener( this.listeners_[i] );
            }
        };

        Label.prototype.draw = function(){
            var projection = this.getProjection();
            var position = projection.fromLatLngToDivPixel( this.get( 'position' ) );
            var div = this.div_;

            div.style.left = position.x + 'px';
            div.style.top = position.y + 'px';
            div.style.display = 'block';

            this.span_.innerHTML = this.get( 'text' ).toString();
        };


        ////////////////////////
        /// Return

        return directive;

    }
] );

angular.element( document ).ready( function(){
    angular.bootstrap( document, ['mapsArticle'] );
} );