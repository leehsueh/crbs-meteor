

API_URL = 'http://api.biblia.com/v1/bible/content/KJV.txt'
API_KEY = "6936276c430fe411a35bb1f6ae786c19"
MAX_PASSAGES_TO_SHOW = 6;

function fetchPassage(api_url, params, successCallback, errorCallback, completeCallback) {
  console.log("fetching passage");
  $.ajax({
    url: api_url,
    type: "GET",
    data: params,
    async: false,
    success: function(data) {
      console.log(data.split("\n"));
      var refParts = data.split("\n");
      var fullRefWithVersion = refParts[0].replace("–","-"); // replace long dash with regular hyphen
      var passageText = refParts.slice(1).join("<br>");
      successCallback(fullRefWithVersion, passageText);
    },
    error: errorCallback,
    complete: completeCallback
  });

}

function getFullReference(textToScan) {
  var api_url = "http://api.biblia.com/v1/bible/scan/";
  var result = 'not set';
  $.ajax({
    url: api_url,
    type: "GET",
    data: { key: API_KEY, text: textToScan },
    async: false,
    success: function(data) {
      result = data.results[0].passage;
    }
  });
  return result.replace("–","-"); // replace long dash with regular hyphen
}
if (Meteor.isServer) {
  Meteor.publish('default_db_data', function(){
    return Spaces.find();
  });
}
if (Meteor.isClient) {
  Meteor.Router.add({
    '/': 'spaces',
    '/space/:id': function(id) {
      Session.set('currentSpaceId', id);
      return 'space';
    }
  })

  Meteor.startup(function() {
     Session.set('data_loaded', false); 
  }); 

  Meteor.subscribe('default_db_data', function(){
     //Set the reactive session as true to indicate that the data have been loaded
     Session.set('data_loaded', true); 
  });

  /* Spaces list */
  Template.spaces.helpers({
    spaces: function() {
      console.log("getting spaces")
      return Spaces.find();
    },
    listed_passage_refs: function() {
      return this.passage_refs.join(", ")
    },
    dataLoaded: function() {
      return Session.get("data_loaded");
    }
  });

  Template.spaces.events({
    'click button': function(e, template) {
      var nameInput = template.find("#new-space-name");
      var name = nameInput.value;
      if (name) {
        Spaces.insert({ name: name, passage_refs: [] });
        nameInput.value = "";
      }
    },
    'click .delete' : function(e, template) {
      var confirmDelete = confirm("Are you sure you want to delete " + this.name + "?");
      if (confirmDelete) {
        Spaces.remove({ _id: this._id });
      }
    }
  })

  /* Single space */
  Template.space.helpers({
    space: function() {
      if (Session.get("data_loaded")) {
        return Spaces.findOne(Session.get("currentSpaceId"));
      }
    },
    spaceName: function() {
      if (Session.get("data_loaded")) {
        return Spaces.findOne(Session.get("currentSpaceId")).name;
      }
    },
    dataLoaded: function() {
      return Session.get("data_loaded");
    }
  });
  Template.space.events({
    'blur .editable-space-name' : function(e, template) {
      var newName = e.currentTarget.textContent;
      console.log(template);
      console.log(newName);
      Spaces.update(Session.get('currentSpaceId'), { $set: { name: newName }});
    }
  })

  /* Passage Form */
  Template.passage_form.errorMessage = function() {
    return Session.get("errorMessage");
  }
  
  Template.passage_form.events({
    'submit form' : function(e) {
      e.preventDefault();
      console.log(this);
    },
    'click .btn-add' : function (e, template) {
      // template data, if any, is available in 'this'
      var space = Spaces.findOne(Session.get('currentSpaceId'));
      var inputElem = $(template.find("#new-reference"));
      var reference = getFullReference(inputElem.val());
      var addButton = $(e.currentTarget);
      addButton.attr("disabled", "disabled");
      if (space.passage_refs && space.passage_refs.length >= MAX_PASSAGES_TO_SHOW) {
        Session.set("errorMessage", "Remove a passage before adding another one.");
        return;
      }
      if (_.indexOf(space.passage_refs, reference) >= 0) {
        Session.set("errorMessage", "Already added");
        return;
      }
      var params = {
        key: API_KEY,
        passage: reference,
        style: "orationOneVersePerLine"
      }
      var successCallback = function(fullRefWithVersion, passageText) {
        if (fullRefWithVersion && passageText) {
          fullRef = getFullReference(fullRefWithVersion);
          console.log(fullRef);
          if (Spaces.find({_id: Session.get('currentSpaceId'), passage_refs: fullRef }))
          if (Passages.find({reference: fullRef}).count() == 0) {
            console.log("inserting");
            Passages.insert({reference: fullRef, passage_text: passageText });
            Session.set("errorMessage", "");
          }
          Spaces.update(Session.get('currentSpaceId'), {$push: {passage_refs: fullRef } });
        } else {
          Session.set("errorMessage", "Invalid response: " + data)
        }
      }
      var errorCallback = function(jqXHR, textStatus, errorThrown) {
        console.log("errrorrr");
        Session.set("errorMessage", errorThrown);
        $(template.find(".alert-error")).show();
      }
      var completeCallback = function() {
        addButton.removeAttr("disabled");
        inputElem.val("");
      }
      fetchPassage(API_URL, params, successCallback, errorCallback, completeCallback)
      
    },
    'click .close-alert' : function(e, template) {
      Session.set("errorMessage", "");
    }
  });

  /* Passages Area */
  Template.passages_area.passages = function() {
    var spaceId = Session.get('currentSpaceId');
    console.log(spaceId);
    if (Session.get("data_loaded")) {
      var space = Spaces.findOne(spaceId);

      // check if Passages collections has the text of the passage
      _.each(space.passage_refs, function(ref) {
        console.log("finding " + ref)
        if (Passages.find({reference: ref}).count() == 0) {
          var params = {
            key: API_KEY,
            passage: ref,
            style: "orationOneVersePerLine"
          }
          var successCallback = function(fullRefWithVersion, passageText) {
            console.log("inserting");
            var fullRef = getFullReference(fullRefWithVersion);
            Passages.insert({reference: fullRef, passage_text: passageText });
          }
          var errorCallback = function(jqXHR, textStatus, errorThrown) {
            console.log("Error fetching passage " + ref);
          }
          
          fetchPassage(API_URL, params, successCallback, errorCallback, null);
        }
      });
      return Passages.find({ reference: { $in: space.passage_refs || []}});
    }
  }

  Template.passages_area.spanWidth = function() {
    var numPassages = Passages.find().count();
    return Math.floor(9/numPassages);
  }

  /* Single Passage */
  Template.passage_block.helpers({
    readOnly: function() {
      return Spaces.findOne(Session.get('currentSpaceId')).read_only;
    }
  })
  Template.passage_block.events({
    'click .btn-delete-passage' : function(e) {
      console.log(this._id);
      Spaces.update({_id: Session.get("currentSpaceId")}, { $pull: { passage_refs: this.reference }});
    }
  });

  /* Space notes */
  Template.notes_area.events({
    'submit form' : function(e) {
      e.preventDefault();
    },
    'click .btn-add-note' : function(e, template) {
      var textarea = $(template.find("#new-note"));
      var noteText = textarea.val();
      if (noteText) {
        if (!Session.get("noteAuthor")) {
          var name = prompt("Please enter your alias");
          Session.set("noteAuthor", name);
        }
        textarea.val("");
        console.log(noteText);
        Notes.insert({noteAuthor: Session.get("noteAuthor"), noteText: noteText});
      }
    },
    'click .btn-clear-chat' : function(e, template) {
      Notes.remove({});
    },
    'click .toggle-notes' : function(e, template) {
      e.preventDefault();
      var notes = $(template.firstNode);
      if (parseInt(notes.css("width")) <= 0) {
        notes.animate({
          'width': 200
        })
      } else {
        notes.animate({
          'width': 0
        })
      }
    }
  });

  Template.notes_area.notes = function() {
    return Notes.find();
  }
  Template.notes_area.currentAuthor = function() {
    return Session.get("noteAuthor");
  }
  Template.notes_area.rendered = function() {
    // scroll chat to bottom
    $(".notes-list").scrollTop(999999);
  }
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
