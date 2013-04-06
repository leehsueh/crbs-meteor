Spaces = new Meteor.Collection("spaces");
Passages = new Meteor.Collection("passages");
// Passages.remove({});
// Spaces.remove({})
if (Meteor.isServer && Spaces.find().count() == 0) {
  var spaces = [
    {
      name: "Space 1",
      passage_refs: [
        "Genesis 14", "Malachi 3", "Mark 10:17-30"
      ],

    }
  ];
  _.each(spaces, function(space) {
    Spaces.insert(space);
  })
}