/**
 * This stores the displayName part of the current entry so that when we move from
 * the list page to the entry page, we keep track of which entry to display...
 * @type {string}
 */

var currentEntry = "";

/**
 * Here is the standard $(document).ready() call-back.  This is essentially the 'initialize' function
 * since it is called only when the entire DOM document has been loaded into the browser.
 * This is a very good place to set up things like event handlers for user interactions, since we
 * have a guarantee that the object the event handlers refer to are part of the DOM now.
 */

var callId = null;
var ringInAudioSrcs;
var ringOutAudioSrcs;
var msgInAudioSrcs;
var audio;

function setupAudio() {
          ringInAudioSrcs = [
              {src: 'https://kandy-portal.s3.amazonaws.com/public/sounds/ringin.mp3', type: 'audio/mp3'},
              {src: 'https://kandy-portal.s3.amazonaws.com/public/sounds/ringin.ogg', type: 'audio/ogg'}
          ];
          ringOutAudioSrcs = [
              {src: 'https://kandy-portal.s3.amazonaws.com/public/sounds/ringout.mp3', type: 'audio/mp3'},
              {src: 'https://kandy-portal.s3.amazonaws.com/public/sounds/ringout.ogg', type: 'audio/ogg'}
          ];
          msgInAudioSrcs = [
              {src: 'https://kandy-portal.s3.amazonaws.com/public/sounds/msgin.mp3', type: 'audio/mp3'},
              {src: 'https://kandy-portal.s3.amazonaws.com/public/sounds/msgin.ogg', type: 'audio/ogg'}
          ];

          audio = {
              ringIn: $('<audio/>', {loop: 'loop', id: 'ringInAudio'})[0],
              ringOut: $('<audio/>', {loop: 'loop', id: 'ringOutAudio'})[0],
              msgIn: $('<audio/>', {id: 'msgInAudio'})[0]
          };

          // setup Msg sources
          for (var i = 0; i < msgInAudioSrcs.length; i++) {
              audio.msgIn.appendChild($('<source/>', msgInAudioSrcs[i])[0]);
          }

          // setup RingIn sources
          for (var i = 0; i < ringInAudioSrcs.length; i++) {
              audio.ringIn.appendChild($('<source/>', ringInAudioSrcs[i])[0]);
          }

          // setup RingOut sources
          for (var i = 0; i < ringOutAudioSrcs.length; i++) {
              audio.ringOut.appendChild($('<source/>', ringOutAudioSrcs[i])[0]);
          }
      };     

function kandySetUp(){
      kandy.setup({              
              listeners: {
                  callinitiated: function (call, number) {
                      callId = call.getId();
                      console.log(callId);
                      audio.ringOut.play();
                      $('#callStatus').html('Calling ' + $('#number').val());
                  },
                  oncall: function (call) {
                      audio.ringOut.pause();
                      $('#callStatus').html('Connected');
                  },
                  callrejected: function(){
                      kandy.call.endCall();
                      kandy.logout();
                      $('#callStatus').html('Call Rejected');
                  },
                  callinitiatefailed: function(){
                      audio.ringOut.pause();
                      kandy.call.endCall();
                      kandy.logout();

                      $('#callStatus').html('Call init failed');
                  },
                  callended: function () {
                      audio.ringOut.pause();
                      $('#callStatus').html('Call ended');
                  }
              }
          });
}

$(document).ready(function() {
    setupAudio();
    kandySetUp();

    kandy.login('apikey', 'user@domain.com', 'password',
          function(result) {
            $('#callStatus').html('Phone Connected');
          },
          function (msg, code) {
            $('#callStatus').html('Phone not connected');
          }
    );

    // Run the start-up routine, which, in this case, loads the current list of entries from
    // local storage and displays them on the main (list) page...
    init();

    $('#mobileCall').bind('click', function () {
           console.log('calling...');
           kandy.call.makePSTNCall($('#mobile').val(),
                  $('#mobile').val());
    });

    $('#mobileHungUp').bind('click', function () {
          kandy.call.endCall(callId);
          kandy.logout();
          console.log('disconnected...');
    });

    // Now install the event handlers for buttons the user can click or tap on.
    // 1. The "Add" button (for adding a new entry)...
    $("#add").click(function() {
        currentEntry = "";
        var e = new Entry();    // An empty one.
        displayEntry(e);
    });

    // 2. The "Del" button, for deleting an entry...
    $("#del").click(function() {
        if(currentEntry !== ""){
            removeEntry(currentEntry);
            currentEntry = "";
            displayEntryList("#list");
            saveList();
        }
    });

    // 3. The "Update" button, for updating an entry's details...
    $("#update").click(function() {
        if(currentEntry === ""){
            addNewEntry();
        } else {
            updateEntry();
        }
        displayEntryList("#list");
        // Whenever anything is changed, save the whole list...
        saveList();
    });

});

// This selector applies to all <a> elements inside the <ul> with the id "list".
// $(this) is a jQuery object referencing the actual <a> element that was clicked on.
$(document).on('click', "#list a", function() {
    currentEntry = $(this).text();                  // The text in the <a> element, which is an Entry's displayName()
    var e = getEntryFromDisplayName(currentEntry);  // This get a reference to the actual Entry
    displayEntry(e);                                // This puts it into the form on the 'entry' page
});

// This gets call when the app is first loaded...
function init(){
    loadList();
    displayEntryList("#list");
}


/**
 * This lets us make a new entry object.
 * @param name - the person's name
 * @param mobile - their mobile number
 * @param home - their home number
 * @param email - their email address
 * @constructor
 */
var Entry = function(name, mobile, home, email) {
    this.name = name;
    this.mobile = mobile;
    this.home = home;
    this.email = email;
}

/**
 * Get the display name of an Entry object.  e.g. if the entry is for "John Smith", this will
 * return "Smith, John", which simplifies organising the entries alphabetically...
 * @returns {string}
 */
Entry.prototype.displayName = function() {
    var firstnames, surname;
    firstnames = this.name.substring(0, this.name.lastIndexOf(" ")).trim();
    surname = this.name.substring(this.name.lastIndexOf(" ") + 1);
    return surname + ", " + firstnames;
}


/**
 * This lets us change an entry's name (due to marriage, deed-pool or some attempt to evade
 * the law.  It returns a reference to the Entry with its new name...
 * @param firstnames
 * @param surname
 * @returns {*}
 */
Entry.prototype.changeName = function(firstnames, surname){
    this.name = firstnames.trim() + " " + surname.trim();
    return this;
}

/**
 * This is the core data structure.  An array of Entry objects...
 * @type {Array}
 */
var entries = [];		// Start with a simple array

/**
 * This is a global factory function - it takes entry details and returns a new Entry...
 * @param name
 * @param mobile
 * @param home
 * @param email
 * @returns {Entry}
 */
function addEntry(name, mobile, home, email) {
    var e = new Entry(name, mobile, home, email);
    entries.push(e);
    sortEntries();
    return e;
}

/**
 * This removes the named Entry from the array.  It returns the newly removed Entry, or
 * null if no matching entry was found...
 * @param name
 * @returns {null}
 */
function removeEntry(name){
    var pos = -1, index, entry = null;
    for(index = 0; index < entries.length; index += 1){
        if(name === entries[index].displayName()) {
            pos = index;
            break;
        }
    }
    if(pos > -1) {
        entry = entries[pos];
        entries.splice(pos, 1);
    }
    return entry;
}

/**
 * Sorts the entries into alphabetical order by surname, firstnames...
 * @returns {Array}
 */
function sortEntries() {
    entries.sort(function(a, b) {
        if(a.displayName() < b.displayName()){
            return -1;
        }
        if(a.displayName() > b.displayName()) {
            return 1;
        }
        return 0;
    });
    return entries;
}

/**
 * This is key to displaying the Entry list on the main page.  It returns a sequence of &lt;li&gt;
 * elements as a string.  This is exactly the mark-up needed by the &lt;ul&gt; on the main page.
 * Note that each list object has an anchor element so that it acts as a hyper-link to the detail
 * (entry) page...
 * @returns {string}
 */
function entryList(){
    var index, list = "";
    for(index = 0; index < entries.length; index += 1){
        list += "<li><a href='#entry'>" + entries[index].displayName() + "</a></li>"; // name='item'
    }
    return list;
}

/**
 * A simple function to update a named <ul> element with a sequence of <li> elements.
 * The function returns  the <ul> element...
 * @param listElement
 * @returns {*|jQuery|HTMLElement}
 */
function displayEntryList(listElement){
    $(listElement).html(entryList()).listview('refresh');
    return $(listElement);
}

/**
 * This returns the Entry object that matches a given displayName (e.g. "Smith, John"),
 * or null if there is no such Entry object...
 * @param displayName
 * @returns {*}
 */
function getEntryFromDisplayName(displayName){
    var index, e;
    for(index = 0; index < entries.length; index += 1){
        if(entries[index].displayName() === displayName){
            return entries[index];
        }
    }
    return null;
}

/**
 * This puts the properties of the given Entry object into the form fields on the entry page...
 * @param e
 */
function displayEntry(e){
    $("#fullname").val(e.name);
    $("#mobile").val(e.mobile);
    $("#email").val(e.email);
    $("#mailbutton").attr("href", "mailto:"+ e.email);
    $("#home").val(e.home);
    $("#name").text(e.name);
}

/**
 * This updates the properties of the current entry according to the form fields on the
 * entry page...
 */
function updateEntry(){
    var e = getEntryFromDisplayName(currentEntry);
    e.name = $("#fullname").val();
    e.mobile = $("#mobile").val();
    e.home = $("#home").val();
    e.email = $("#email").val();
}

/**
 * Adds a new entry based on the contents of the form fields on the entry page...
 * @returns {*}
 */
function addNewEntry(){
    var name = $("#fullname").val(),
        mobile = $("#mobile").val(),
        home = $("#home").val(),
        email = $("#email").val();
    if(name !== "") {
        return addEntry(name, mobile, home, email);
    } else {
        return null;
    }
}

/**
 * Saves the whole list of entries to local storage...
 */
function saveList(){
    var strList = JSON.stringify(entries);
    localStorage.phoneBook = strList;
}

/**
 * Loads the list of entries from local storage...
 */
function loadList(){
    var strList;
    strList = localStorage.phoneBook;
    if(strList){
        entries = JSON.parse(strList);
        var proto = new Entry();
        for(e in entries){
            entries[e].__proto__ = proto;
        }
    } else {
        entries = [];
    }
}