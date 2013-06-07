Spaces = new Meteor.Collection("spaces");
Passages = new Meteor.Collection("passages");

// Passages.remove({});
// Spaces.remove({})
if (Meteor.isServer && Spaces.find().count() == 0) {
  var spaces = [
    {
      name: "View Only Space",
      passage_refs: [
        "Genesis 14", "Malachi 3", "Mark 10:17-30"
      ],
      read_only: true
    },
    {
      name: "Editable Space",
      passage_refs: [
        "Matthew 14", "Luke 3", "John 7:1-12"
      ],
      read_only: false
    }
  ];
  _.each(spaces, function(space) {
    Spaces.insert(space);
  })
}