// Built-in word categories. Custom categories live in storage.js.

export const BUILTIN_CATEGORIES = [
  {
    id: 'animals',
    name: 'Animals',
    emoji: '🐾',
    words: [
      'Elephant', 'Kangaroo', 'Penguin', 'Octopus', 'Giraffe', 'Hedgehog',
      'Dolphin', 'Flamingo', 'Chameleon', 'Sloth', 'Platypus', 'Raccoon',
      'Peacock', 'Jellyfish', 'Armadillo', 'Meerkat', 'Walrus', 'Toucan',
      'Lobster', 'Gorilla', 'Hamster', 'Ostrich', 'Seahorse', 'Porcupine',
      'Panther', 'Beaver', 'Falcon', 'Iguana', 'Moose', 'Squid',
      'Tarantula', 'Pelican', 'Otter', 'Cobra', 'Bison', 'Ferret',
      'Koala', 'Vulture', 'Newt', 'Mongoose',
      'Cheetah', 'Panda', 'Owl', 'Crocodile', 'Bat', 'Skunk', 'Scorpion', 'Woodpecker', 'Llama', 'Starfish',
    ],
  },
  {
    id: 'movies',
    name: 'Movies & TV',
    emoji: '🎬',
    words: [
      'Titanic', 'Jurassic Park', 'The Lion King', 'Star Wars', 'Frozen',
      'Harry Potter', 'Spider-Man', 'Finding Nemo', 'The Matrix', 'Shrek',
      'Batman', 'Toy Story', 'Indiana Jones', 'Pirates of the Caribbean',
      'The Avengers', 'Ghostbusters', 'Jaws', 'E.T.', 'Rocky', 'Godzilla',
      'King Kong', 'The Wizard of Oz', 'Forrest Gump', 'Home Alone',
      'Back to the Future', 'The Terminator', 'Aladdin', 'Mary Poppins',
      'Stranger Things', 'Game of Thrones', 'The Office', 'Friends',
      'SpongeBob', 'The Simpsons', 'Sherlock Holmes', 'James Bond',
      'Mission Impossible', 'Kung Fu Panda', 'Despicable Me', 'Squid Game',
      'The Godfather', 'Avatar', 'Inception', 'Breaking Bad', 'Pokémon', 'Scooby-Doo', 'Barbie', 'Top Gun', 'The Hunger Games', 'Moana',
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    emoji: '🍕',
    words: [
      'Pizza', 'Spaghetti', 'Sushi', 'Pancakes', 'Burrito', 'Popcorn',
      'Ice Cream', 'Hot Dog', 'Cheeseburger', 'Ramen', 'Croissant',
      'Guacamole', 'Waffles', 'Lasagna', 'Milkshake', 'Doughnut',
      'French Fries', 'Cotton Candy', 'Meatballs', 'Nachos', 'Omelette',
      'Cupcake', 'Lemonade', 'Bubble Tea', 'Fried Chicken', 'Bagel',
      'Corn on the Cob', 'Cheesecake', 'Espresso', 'Smoothie', 'Pretzel',
      'Dumplings', 'Watermelon', 'Barbecue Ribs', 'Garlic Bread', 'Taco',
      'Pumpkin Pie', 'Scrambled Eggs', 'Churros', 'Marshmallow',
      'Avocado Toast', 'Mac and Cheese', 'Onion Rings', 'Pad Thai', 'Caesar Salad', 'Hot Chocolate', 'Apple Pie', 'Falafel', 'Sausage Roll', 'Chicken Nuggets',
    ],
  },
  {
    id: 'sports',
    name: 'Sports & Games',
    emoji: '⚽',
    words: [
      'Basketball', 'Surfing', 'Bowling', 'Archery', 'Fencing', 'Karate',
      'Gymnastics', 'Skateboarding', 'Volleyball', 'Ping Pong', 'Golf',
      'Ice Skating', 'Rock Climbing', 'Sumo Wrestling', 'Baseball',
      'Cheerleading', 'Darts', 'Curling', 'Javelin', 'Marathon',
      'Pole Vault', 'Synchronized Swimming', 'Tug of War', 'Yoga',
      'Hopscotch', 'Limbo', 'Musical Chairs', 'Hide and Seek', 'Chess',
      'Poker', 'Billiards', 'Badminton', 'Kayaking', 'Zumba', 'Boxing',
      'Snowboarding', 'Juggling', 'Arm Wrestling', 'Dodgeball', 'Frisbee',
      'Foosball', 'Cricket', 'Rugby', 'Handball', 'Skydiving', 'Water Polo', 'Hula Hoop', 'Jenga', 'Paintball', 'Laser Tag',
    ],
  },
  {
    id: 'jobs',
    name: 'Jobs & People',
    emoji: '🧑‍🚒',
    words: [
      'Firefighter', 'Astronaut', 'Magician', 'Dentist', 'Plumber',
      'Ballerina', 'Ninja', 'Pirate', 'Chef', 'Lifeguard', 'Detective',
      'Barber', 'Clown', 'Opera Singer', 'Weather Reporter', 'Referee',
      'Mime', 'Librarian', 'Tattoo Artist', 'Cowboy', 'Judge', 'Paparazzi',
      'Fortune Teller', 'Bodyguard', 'Zookeeper', 'Mail Carrier',
      'Flight Attendant', 'Archaeologist', 'DJ', 'Beekeeper', 'Butler',
      'Cheerleader', 'Electrician', 'Fisherman', 'Knight', 'Mermaid',
      'Photographer', 'Santa Claus', 'Scientist', 'Vampire',
      'Pilot', 'Nurse', 'Farmer', 'Waiter', 'Superhero', 'Robot', 'Wizard', 'Ghost', 'Pop Star', 'Teacher',
    ],
  },
  {
    id: 'objects',
    name: 'Everyday Objects',
    emoji: '🧰',
    words: [
      'Umbrella', 'Toothbrush', 'Microwave', 'Stapler', 'Flashlight',
      'Vacuum Cleaner', 'Sunglasses', 'Backpack', 'Alarm Clock', 'Scissors',
      'Hairdryer', 'Ladder', 'Telescope', 'Wheelbarrow', 'Ironing Board',
      'Fire Extinguisher', 'Rubber Duck', 'Piggy Bank', 'Trampoline',
      'Boomerang', 'Compass', 'Lawnmower', 'Blender', 'Candle', 'Doorbell',
      'Fishing Rod', 'Hammock', 'Kite', 'Magnet', 'Mousetrap', 'Padlock',
      'Remote Control', 'Rolling Pin', 'Seatbelt', 'Shopping Cart',
      'Snow Globe', 'Swiss Army Knife', 'Typewriter', 'Water Balloon',
      'Zipper',
      'Binoculars', 'Wheelchair', 'Toaster', 'Stethoscope', 'Paperclip', 'Dustpan', 'Corkscrew', 'Bubble Wrap', 'Extension Cord', 'Garden Hose',
    ],
  },
  {
    id: 'actions',
    name: 'Actions',
    emoji: '🏃',
    words: [
      'Sneezing', 'Moonwalking', 'Shoveling Snow', 'Milking a Cow',
      'Walking a Dog', 'Changing a Tire', 'Baking a Cake', 'Sleepwalking',
      'Riding a Rollercoaster', 'Building a Sandcastle', 'Blowing Bubbles',
      'Brushing Teeth', 'Catching a Fish', 'Climbing a Tree',
      'Directing Traffic', 'Doing Laundry', 'Flying a Kite',
      'Getting a Haircut', 'Ice Fishing', 'Jump Rope', 'Karaoke',
      'Making a Snow Angel', 'Mowing the Lawn', 'Opening a Gift',
      'Painting a Fence', 'Parallel Parking', 'Playing Air Guitar',
      'Popping Popcorn', 'Proposing', 'Riding a Unicycle',
      'Rocking a Baby', 'Slipping on a Banana', 'Taking a Selfie',
      'Tightrope Walking', 'Tying Shoelaces', 'Waking Up Late',
      'Washing Dishes', 'Whistling', 'Wrapping a Present', 'Yawning',
      'Snoring', 'Hitchhiking', 'Skipping Stones', 'Watering Plants', 'Blowing Out Candles', 'Cracking an Egg', 'Digging a Hole', 'Painting Nails', 'Sharpening a Pencil', 'Swatting a Fly',
    ],
  },
  {
    id: 'places',
    name: 'Places',
    emoji: '🗺️',
    words: [
      'Eiffel Tower', 'Beach', 'Haunted House', 'Library', 'Volcano',
      'Desert Island', 'Amusement Park', 'North Pole', 'Pyramid', 'Jungle',
      'Space Station', 'Submarine', 'Castle', 'Farm', 'Airport',
      'Movie Theater', 'Dentist Office', 'Gas Station', 'Grand Canyon',
      'Great Wall of China', 'Gym', 'Hair Salon', 'Hospital', 'Hotel',
      'Laundromat', 'Lighthouse', 'Museum', 'Niagara Falls', 'Playground',
      'Post Office', 'Restaurant', 'School Bus', 'Shopping Mall',
      'Ski Resort', 'Statue of Liberty', 'Subway', 'Supermarket',
      'Treehouse', 'Waterpark', 'Zoo',
      'Bakery', 'Cave', 'Circus', 'Cruise Ship', 'Swamp', 'Football Stadium', 'Igloo', 'Prison', 'Rooftop', 'Windmill',
    ],
  },
];

export function categoryById(id, customCategories = []) {
  return (
    BUILTIN_CATEGORIES.find((c) => c.id === id) ||
    customCategories.find((c) => c.id === id) ||
    null
  );
}

export function buildWordPool(categoryIds, customCategories = []) {
  const pool = [];
  for (const id of categoryIds) {
    const cat = categoryById(id, customCategories);
    if (cat) pool.push(...cat.words);
  }
  return [...new Set(pool)];
}
