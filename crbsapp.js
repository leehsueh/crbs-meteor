Passages = new Meteor.Collection("passages");
Notes = new Meteor.Collection("notes");

API_URL = 'http://api.biblia.com/v1/bible/content/KJV.txt'
API_KEY = "6936276c430fe411a35bb1f6ae786c19"
MAX_PASSAGES_TO_SHOW = 3;

if (Meteor.isClient) {
  Meteor.startup(function() {
    // Session.set("errorMessage","");
  });

  Template.passage_form.errorMessage = function() {
    return Session.get("errorMessage");
  }
  
  Template.passage_form.events({
    'submit form' : function(e) {
      e.preventDefault();
    },
    'click .btn-add' : function (e, template) {
      // template data, if any, is available in 'this'
      var inputElem = $(template.find("#new-reference"));
      var reference = inputElem.val();
      var addButton = $(e.currentTarget);
      if (Passages.find().count() >= MAX_PASSAGES_TO_SHOW) {
        Session.set("errorMessage", "Remove a passage before adding another one.");
        return;
      }
      var params = {
        key: API_KEY,
        passage: reference,
        style: "orationOneVersePerLine"
      }
      $.ajax({
        url: API_URL,
        type: "GET",
        data: params,
        success: function(data) {
          console.log(data.split("\n"));
          var refParts = data.split("\n");
          var fullRef = refParts[0];
          var passageText = refParts.slice(1).join("<br>");
          // var elements = $(data);
          // var fullRef = elements.eq(0).text().trim();
          // var passageText = elements.eq(2).html();
          if (fullRef && passageText) {
            if (Passages.find({reference: fullRef}).count() == 0) {
              console.log("inserting");
              Passages.insert({reference: fullRef, passage_text: passageText });
              Session.set("errorMessage", "");
            } else {
              console.log("already added");
              Session.set("errorMessage", "Already added");
            }
          } else {
            Session.set("errorMessage", "Invalid response: " + data)
          }
        },
        error: function(jqXHR, textStatus, errorThrown) {
          console.log("errrorrr");
          Session.set("errorMessage", errorThrown);
          $(template.find(".alert-error")).show();
        },
        complete: function() {
          addButton.removeAttr("disabled");
        }
      });
      addButton.attr("disabled", "disabled");
    },
    'click .close-alert' : function(e, template) {
      $(template.find(".text-error")).hide();
    }
  });

  Template.passages_area.passages = function() {
    return Passages.find();
  }

  Template.passages_area.spanWidth = function() {
    var numPassages = Passages.find().count();
    return Math.floor(9/numPassages);
  }

  Template.passage_block.events({
    'click .btn-delete-passage' : function(e) {
      console.log(this._id);
      Passages.remove({_id: this._id});
    }
  });

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
