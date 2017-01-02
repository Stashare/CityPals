// Set to true to use the device's contacts (when running under PhoneGap)
// Set to false to use the dummy contacts (when not running under PhoneGap)
var USE_PHONEGAP = false;

// Various timeout values (in ms)
var SCRIPT_LOAD_TIMEOUT = 3000;
var MAP_LOAD_TIMEOUT = 3000;
var FIT_BOUNDS_TIMEOUT = 500;
var LOADING_MESSAGE_HIDE_DELAY = 2000;


/**
 * Sets up an appropriate event handler to display the cities list
 * when everything's ready.
 *
 * Also adds a click event handler to the "choose city" button.
 *
 * Called when the page body has loaded.
 */

function initCityChums() {
  
  if ( USE_PHONEGAP ) {
    
    // Using PhoneGap: We need to wait for deviceready before trying to
    // access the device's contacts database
    document.addEventListener( 'deviceready', showCities, false );
    
  } else {
    
    // Not using PhoneGap: We can pull the contacts immediately from the
    // dummy contacts array, as soon as the DOM is ready
    $( showCities );
  }
  
  $('#chooseCity').on( 'click', showCities );
  setTimeout( checkConnection, SCRIPT_LOAD_TIMEOUT );
  
  if( navigator.userAgent.match(/iP[ha][od].*OS/) && !navigator.userAgent.match(/iP[ha][od].*OS 6/) && navigator.userAgent.match(/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/)) {
    $('#cities, #map').css('padding-top','20px');
  }
}


/**
 * Checks that the Google Maps script has loaded.
 * If not, displays an alert and retries.
 */

function checkConnection() {
  
  if ( typeof google == "undefined" ) {
    alert( "Can't connect to the Google Maps server. Please make sure you are connected to the internet, then try again." );
    window.location.reload( true );
  }
}


/**
 * Redraws the map when the user rotates their device,
 * so that the markers remain onscreen.
 */

$(window).orientationchange( function( e ) {             
  if ( $('body').pagecontainer('getActivePage').attr('id') == "map" ) {
    window.cityChumsMap.fitBounds( window.cityChumsMapBounds );
  }
} );


/**
 * Displays the list of cities in the contacts database.
 */

function showCities() {
  
  var cities = new Array();
  clearTimeout( window.mapLoadTimeout );
  
  if ( USE_PHONEGAP ) {
    
    // Using PhoneGap: Pull all the contacts from the device's
    // real contacts database
    var options = new ContactFindOptions();
    options.filter = "";
    options.multiple = true;
    var contactFields = ["addresses"];
    navigator.contacts.find( contactFields, onSuccess, findContactsError, options );
    
  } else {
    
    // Not using PhoneGap: Just fill the cities array with the
    // dummy contact cities, then display the cities list.
    for ( var i=0; i<dummyContacts.length; i++ ) {
      cities.push ( { cityName: dummyContacts[i].city, numContacts: dummyContacts[i].contacts.length } );
    }
    
    showCitiesList();
  }
  
  
  /**
   * Callback for PhoneGap's navigator.contacts.find method.
   *
   * Adds all the found cities to the cities array,
   * then displays the cities list.
   *
   * Called when all the contacts have been found.
   */
  
  function onSuccess( contacts ) {
    
    for ( var i=0; i<contacts.length; i++ ) {
      for ( var j=0; j<contacts[i].addresses.length; j++ ) {
        
        var city = contacts[i].addresses[j].locality;
        
        // Is the city already in the array?
        
        var found = false;
        
        for ( var k=0; k<cities.length; k++ ) {
          if ( cities[k].cityName == city ) {
            
            // Yes; increment the city's contact count
            found = true;
            cities[k].numContacts++;
            break;
          }
        }
        
        // No; add the city
        if ( !found ) cities.push( { cityName: city, numContacts: 1 }  );
      }
    }
    
    showCitiesList();
  }
  
  
  /**
   * Displays the list of valid cities as a listview.
   * Called when the cities array has been populated.
   */
  
  function showCitiesList() {
    
    var citiesList =  $('#citiesList');
    citiesList.empty();
    
    for ( var i=0; i<cities.length; i++ ) {
      var li = $( '<li><a href="#">' + cities[i].cityName + '<span class="ui-li-count">' + cities[i].numContacts + '</span></a></li>' );
      citiesList.append( li );
      
      // Store the city name in the list item
      li.jqmData( 'city', cities[i].cityName );
      
      // When the user taps the item, display the city's contacts
      // on the map
      li.click( function() {
        var li = $(this);
 
        // Hide the map while it redraws
        $('#mapCanvas').css( 'opacity', 0 );
 
        // Start transitioning the map page into view
        var pageTitle = "Contacts in " + li.jqmData('city');
        $('#map h2').html( pageTitle );
        $('#map').jqmData( 'title', pageTitle );
        $('body').pagecontainer( 'change', '#map', { transition: "slideup", reverse: true } );
 
        // Once the map page is shown, init the map and add the contact markers
        $('body').off( 'pagecontainershow' );
        $('body').on( 'pagecontainershow', function() {
          if ( $('body').pagecontainer('getActivePage').attr('id') == "map" ) {
            mapContactsInCity( li.jqmData('city') );
          }
        } );
      } );
    }
    
    // Display the cities list and update the listview widget
    $('body').pagecontainer( 'change', '#cities', { transition: "slideup" } );
    citiesList.listview('refresh');
  }
  
}


/**
 * Finds all the contacts in the supplied city, places them on the map,
 * moves the map viewport to encompass the contacts, and displays the map.
 */

function mapContactsInCity( city ) {
  
  // Display the loading spinner while the map is loading
  $.mobile.loading( 'show' );
  
  // Create the Google Maps map and add it to the #mapCanvas container
  
  var mapOptions = {
    zoom: 8,
    center: new google.maps.LatLng( 0, 0 ),
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  
  window.cityChumsMap = new google.maps.Map( document.getElementById('mapCanvas'), mapOptions );
  
  // Clear the map bounds and start tracking the number of
  // geocoded contacts
  window.cityChumsMapBounds = new google.maps.LatLngBounds();
  var contactsGeocoded = 0;
  
  // If the map takes too long to display,
  // try displaying the map again.
  window.mapLoadTimeout = setTimeout( function() { mapContactsInCity( city ) }, MAP_LOAD_TIMEOUT );
  
  // Store the marker objects in a static property
  // (create it if it doesn't exist)
  if ( this.markers === undefined ) this.markers = new Array();
  
  // Remove any previous markers from the map
  for ( var i=0; i<this.markers.length; i++ ) {
    this.markers[i].setMap( null );
  }
  
  this.markers.length = 0;
  
  if ( USE_PHONEGAP ) {
    
    // Using PhoneGap: Pull all the contacts in the city from the device's
    // real contacts database
    var options = new ContactFindOptions();
    options.filter = city;
    options.multiple = true;
    var contactFields = ["displayName", "addresses"];
    navigator.contacts.find( contactFields, onSuccess, findContactsError, options );
    
  } else {
    
    // Not using PhoneGap: Just fill the contacts array with the dummy
    // contacts in the city
    for ( var i=0; i<dummyContacts.length; i++ ) {
      if ( dummyContacts[i].city == city ) {
        var dummyContactsInCity = dummyContacts[i].contacts;
        break;
      }
    }
    
    onSuccess( dummyContactsInCity );
  }
  
  
  /**
   * Geocodes each contact address that is within the city.
   * Called when all the contacts in the city have been found.
   */
  
  function onSuccess( contacts ) {
    
    for ( var i=0; i<contacts.length; i++ ) {
      for ( var j=0; j<contacts[i].addresses.length; j++ ) {
        
        if ( contacts[i].addresses[j].locality == city ) {
          
          // Found an address that's in the city - geocode it
          var request =  {
            address: contacts[i].addresses[j].streetAddress + " " + city
          };
          
          var geocoder = new google.maps.Geocoder();
          geocoder.geocode( request, addMarker( contacts[i].displayName, contacts.length ) );
        }
      }
    }
  }
  
  
  /**
   * Adds a geocoded address as a marker to the map.
   *
   * Once all contacts have been geocoded, moves the map to encompass
   * the markers.
   *
   * Called when an address has been successfully geocoded.
   *
   * Since we need to access displayName and numContacts within the
   * callback, we wrap it in a closure.
   */
  
  function addMarker( displayName, numContacts ) {
    
    return function( results, status ) {
      
      if ( status == "OVER_QUERY_LIMIT" ) {
        alert("Too many Google Maps requests: Please try again later");
        return;
      }
      
      if ( status != "OK" ) return;
      
      // Loop through all the returned results (usually there's only 1)
      for ( var i=0; i<results.length; i++ ) {
        
        // Create the marker
        var marker = new google.maps.Marker( {
          position: results[i].geometry.location,
          map: window.cityChumsMap,
          title: displayName
        } );
        
        // Store the marker and add it to the map
        this.markers.push( marker );
        marker.setMap( window.cityChumsMap );
        
        // Store the contact address in the marker so we can display the
        // info window
        marker.formatted_address = results[i].formatted_address;
        
        // Extend the map bounds to encompass the new marker
        window.cityChumsMapBounds.extend( results[i].geometry.location );
        
        // When the user taps the marker, display an info window
        // containing the name and address
        google.maps.event.addListener( marker, 'click', function() {
                        
          var address = '<div style="font-size: 80%;"><strong>' + displayName + '</strong><br>';
          address += marker.formatted_address;
          address += '</div>';
        
          var infowindow = new google.maps.InfoWindow( {
            content: address,
            maxWidth: 180
          } );
        
          infowindow.open( window.cityChumsMap, marker );
        } );
        
        contactsGeocoded++;
        
        // If we've placed all the markers, move the map to encompass the
        // new bounds, remove the Loading message, and reveal the map
        if ( contactsGeocoded >= numContacts ) {
          setTimeout( function() { window.cityChumsMap.fitBounds( window.cityChumsMapBounds ); }, FIT_BOUNDS_TIMEOUT );
          clearTimeout( window.mapLoadTimeout );
          setTimeout( function() { $.mobile.loading( 'hide' ); }, LOADING_MESSAGE_HIDE_DELAY );
          setTimeout( function() { $('#mapCanvas').css( 'opacity', 1 ); }, FIT_BOUNDS_TIMEOUT );
        }
      }
    }
  }
  
}


/**
 * Callback for PhoneGap's navigator.contacts.find method.
 * Called when there was a problem accessing the device's contacts
 * database.
 *
 * Displays an error alert to the user.
 */

function findContactsError( contactError ) {
  alert( "There was a problem accessing your contacts." );
}

