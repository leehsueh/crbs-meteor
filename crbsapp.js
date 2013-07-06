

API_URL = 'http://api.biblia.com/v1/bible/content/LEB.txt'
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
      // console.log(data.split("\n"));
      var refParts = data.split("\n");
      var fullRefWithVersion = refParts[0].replace("–","-"); // replace long dash with regular hyphen
      var passageText = refParts.slice(1).join("<br>").replace(/([0-9]+)/g, "<sup>$1</sup>");
      successCallback(fullRefWithVersion, passageText);
    },
    error: errorCallback,
    complete: completeCallback
  });

}

function getFullReference(textToScan) {
  textToScan = textToScan[0].toUpperCase() + textToScan.slice(1);
  var api_url = "http://api.biblia.com/v1/bible/scan/";
  var result = 'not set';
  $.ajax({
    url: api_url,
    type: "GET",
    data: { key: API_KEY, text: textToScan },
    async: false,
    success: function(data) {
      if (data.results.length > 0) {
        result = data.results[0].passage;  
      } else {
        result = false;
      }
    }
  });
  if (!result) return result;
  return result.replace("–","-"); // replace long dash with regular hyphen
}

function parseReference(fullRef) {
  var regex = /(((1|2) )?([A-Za-z ]+)) ([0-9]{1,3})/,
    matches = fullRef.match(regex);
  if (matches && matches.length > 5) {
    return {
      book: matches[1],
      chapter: matches[5]
    };
  } else {
    return null;
  }
}
if (Meteor.isServer) {
  Meteor.publish("user_data", function () {
    return Meteor.users.find({},
        {fields: {'profile.name': 1, '_id': 1}});
  });
  Meteor.publish('public_spaces', function(){
    return Spaces.find({"public": true});
  });

  Meteor.publish('authorized_spaces', function() {
    return Spaces.find({$or: [
      {user_id: this.userId},
      {has_access: this.userId},
      {"public": true}
    ]})
  })

  Meteor.publish('all_passages', function() {
    return Passages.find();
  });
  Spaces.allow({
    insert: function() { return true; },
    update: function(userId, space) {
      return space.user_id === userId;
    },
    remove: function(userId, space) {
      if (space.user_id) {
        return space.user_id === userId;  
      } else if (userId) {
        return space.public;
      }
      return false;  // anyone can delete public spaces
    }
  })
  Passages.allow({
    insert: function() {
      return true;
    }
  });
}
if (Meteor.isClient) {
  Meteor.Router.add({
    '/': 'spaces',
    '/space/:id': function(id) {
      console.log("in router")
      Session.set('currentSpaceId', id);
      return 'space';
    }
  })

  Meteor.startup(function() {
     Session.set('data_loaded', false);
     Session.set('putaway', true);
  }); 
  Meteor.subscribe('user_data')
  Meteor.subscribe('authorized_spaces', function(){
     //Set the reactive session as true to indicate that the data have been loaded
     Session.set('data_loaded', true); 
  });
  Meteor.subscribe('all_passages');

  /* Spaces list */
  Template.spaces.helpers({
    publicSpaces: function() {
      console.log("getting spaces")
      return Spaces.find({public: true});
    },
    mySpaces: function() {
      return Spaces.find({user_id: Meteor.userId() || ""})
    },
    sharedSpaces: function() {
      return Spaces.find({has_access: Meteor.userId()})
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
        Spaces.insert({ name: name, passage_refs: [], user_id: Meteor.userId(), public: !Meteor.userId() });
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

  /* Space permissions */
  Template.space_permissions.helpers({
    writeAccess: function() {
      var space = Spaces.findOne(this._id);
      return space.user_id === Meteor.userId()
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
    },
    putaway: function() {
      return Session.get("putaway");
    },
    writeAccess: function() {
      var space = Spaces.findOne(Session.get("currentSpaceId"));
      return space.user_id === Meteor.userId()
    }
  });
  Template.space.events({
    'blur .editable-space-name' : function(e, template) {
      var newName = e.currentTarget.textContent;
      console.log(template);
      console.log(newName);
      Spaces.update(Session.get('currentSpaceId'), { $set: { name: newName }});
    },
    'change #public-flag' : function(e, template) {
      var checked = e.target.checked || false;
      Spaces.update(Session.get('currentSpaceId'), { $set: { public: checked }});

    },
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
        Spaces.update(
          Session.get('currentSpaceId'),
          { $push:
            { notes:
              { 
                noteAuthor: Session.get("noteAuthor"),
                noteText: noteText
              }
            }
          }
        );
      }
    },
    'click .btn-clear-chat' : function(e, template) {
      Spaces.update(
        Session.get('currentSpaceId'),
        { $set:
          { notes: [] }
        }
      );
    },
    'click .toggle-notes' : function(e, template) {
      e.preventDefault();
      var notes = $(template.find("#notes-container"));
      console.log(Session.get("putaway"));
      Session.set("putaway", !Session.get("putaway"));
    }
  })
  
  /* Invite users */
  function getUserNames() {
    return Meteor.users.find().map(function(u) {
      return u.profile.name;
    });
  }
  Template.invite_users.rendered = function() {
    // $("[rel=bootstrap-tooltip]").tooltip();
    var space = Spaces.findOne(Session.get('currentSpaceId'));
    var users = _.map(space.has_access, function(userId) {
      return Meteor.users.findOne(userId).profile.name;
    });
    $("#shared-tooltip").tooltip({
      title: users.join(", ")
    });
    
    $("#new-name").typeahead({
      source: getUserNames
    })
  }
  Template.invite_users.helpers({
    invited_users: function() {
      var space = Spaces.findOne(Session.get('currentSpaceId'));
      users = _.map(space.has_access, function(userId) {
        return Meteor.users.findOne(userId);
      });
      console.log(users);
      return users;
    }
  });

  Template.invite_users.events({
    'submit form' : function(e) {
      e.preventDefault();
    },
    'click .btn-add' : function(e, template) {
      var space = Spaces.findOne(Session.get('currentSpaceId')),
        inputElem = $(template.find("#new-name")),
        newName = inputElem.val();
      var users = Meteor.users.find({"profile.name": newName}).fetch();
      if (users.length > 0) {
        Spaces.update(space._id, {$push: {has_access: users[0]._id}})
      } else {
        alert("No user for this name")
      }
    }
  })

  /* Passage Form */
  Template.passage_form.errorMessage = function() {
    return Session.get("errorMessage");
  }
  
  Template.passage_form.events({
    'submit form' : function(e) {
      e.preventDefault();
    },
    'click .btn-add' : function (e, template) {
      // template data, if any, is available in 'this'
      var space = Spaces.findOne(Session.get('currentSpaceId')),
        inputElem = $(template.find("#new-reference")),
        enteredRef = inputElem.val(),
        addButton = $(e.currentTarget);

      addButton.attr("disabled", "disabled");
      if (!enteredRef) {
        Session.set("errorMessage", "Please enter a reference");
        return;
      }
      var reference = getFullReference(enteredRef);
      if (reference === false) {
        Session.set("errorMessage", "Uh oh..." + enteredRef + " is not a valid reference");
        inputElem.val("");
        return;
      }
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
          // console.log(fullRef);
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
    var spaceId = Session.get('currentSpaceId'),
      passages = [];
    if (Session.get("data_loaded")) {
      var space = Spaces.findOne(spaceId);
      console.log(space.passage_refs)
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
            Passages.insert({reference: ref, passage_text: "Invalid passage!" });
          }
          
          fetchPassage(API_URL, params, successCallback, errorCallback, null);
        }
        passages.push(Passages.findOne({reference: ref}))
      });
      // return Passages.find({ reference: { $in: space.passage_refs || []}});
      return passages;
    }
  }

  Template.passages_area.spanWidth = function() {
    var numPassages = Passages.find().count();
    return Math.floor(9/numPassages);
  }

  /* Single Passage */
  Template.passage_block.helpers({
    writeAccess: function() {
      var space = Spaces.findOne(Session.get('currentSpaceId'));
      return space.user_id === Meteor.userId();
    }
  })
  Template.passage_block.events({
    'click .btn-delete-passage' : function(e) {
      console.log(this._id);
      Spaces.update({_id: Session.get("currentSpaceId")}, { $pull: { passage_refs: this.reference }});
    },
    'click .btn-prev-chapter' : function(e) {
      var space = Spaces.findOne(Session.get("currentSpaceId")),
        passageRefs = space.passage_refs,
        indexToReplace = passageRefs.indexOf(this.reference),
        refParts = parseReference(this.reference),
        prevChapter = Math.max(parseInt(refParts.chapter) - 1, 1),
        updatedRef = refParts.book + " " + prevChapter;
      console.log(updatedRef);
      passageRefs[indexToReplace] = updatedRef;
      Spaces.update({_id: space._id}, { $set: { passage_refs: passageRefs }});
    },
    'click .btn-full-chapter' : function(e) {
      var space = Spaces.findOne(Session.get("currentSpaceId")),
        passageRefs = space.passage_refs,
        indexToReplace = passageRefs.indexOf(this.reference),
        refParts = parseReference(this.reference),
        updatedRef = refParts.book + " " + refParts.chapter;
      console.log(updatedRef);
      passageRefs[indexToReplace] = updatedRef;
      Spaces.update({_id: space._id}, { $set: { passage_refs: passageRefs }});

    },
    'click .btn-next-chapter' : function(e) {
      var space = Spaces.findOne(Session.get("currentSpaceId")),
        passageRefs = space.passage_refs,
        indexToReplace = passageRefs.indexOf(this.reference),
        refParts = parseReference(this.reference);
        nextChapter = parseInt(refParts.chapter) + 1,
        updatedRef = refParts.book + " " + nextChapter;
      console.log(updatedRef);
      passageRefs[indexToReplace] = updatedRef;
      Spaces.update({_id: space._id}, { $set: { passage_refs: passageRefs }});
    }
  });

  Template.space.currentAuthor = function() {
    return Session.get("noteAuthor");
  }
  Template.space.rendered = function() {
    // scroll chat to bottom
    $(".notes-list").scrollTop(999999);
  }
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
